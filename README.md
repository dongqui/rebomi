# Rebomi

저장한 콘텐츠를 잊지 않도록 다시 보여주고, 필요한 순간 빠르게 찾아준다.

제품 정의는 [docs/product.md](docs/product.md) 와 [docs/features/](docs/features/) 에,
기술 구성은 [docs/architecture.md](docs/architecture.md) 에 있다
([docs/PRD-v0.5.md](docs/PRD-v0.5.md) 는 이력용 원본). 이 저장소는 현재
**스캐폴드 단계**다 — 네 클라이언트와 서버·워커가 한 레포에서 함께 돌고
`/health` 한 경로가 DB까지 닿는 것까지만 구현돼 있다. 기능 코드는 없다.

## 구조

```
apps/
  web/          Next.js — 웹 앱
  api/          Fastify — 공개 REST API
  worker/       pg-boss 컨슈머 + 스케줄러
  extension/    Chrome 확장 (Vite + CRXJS, MV3)
  mobile/       Expo — iOS/Android
packages/
  core/         도메인 로직 (순수 함수, DB·HTTP를 모른다)
  db/           Drizzle 스키마 + 마이그레이션
  api-contract/ 요청·응답 Zod 스키마 — 서버와 클라이언트 사이 유일한 계약
  api-client/   타입 세이프 HTTP 클라이언트 (web·extension·mobile 공용)
  config/       tsconfig·eslint·prettier 공유 설정
docker/         Postgres(PGroonga + pgvector) 이미지와 compose
```

`api-contract` 가 유일한 계약 지점이고 `api-client` 가 그것을 소비하는 유일한
HTTP 경로다. 확장·모바일이 `api-client` 만 의존하므로 서버 내부 변경이 번지지
않는다.

## 요구사항

- Node 22 이상
- pnpm 11
- Docker (Postgres + PGroonga + pgvector)

## 시작하기

```bash
pnpm install
cp .env.example .env
docker compose -f docker/compose.yml up -d --build
pnpm db:migrate
pnpm dev
```

`pnpm dev` 는 web(3000)·api(3001)·worker 셋을 띄운다. http://localhost:3000 에
`status: ok · db: ok · version: …` 가 보이면 전체 경로가 살아 있는 것이다.

모바일은 Expo가 대화형 터미널을 쓰므로 따로 띄운다.

```bash
pnpm dev:mobile
```

## 명령

| 명령 | 하는 일 |
| --- | --- |
| `pnpm dev` | web·api·worker 동시 기동 |
| `pnpm dev:mobile` | Expo 개발 서버 |
| `pnpm lint` | 전 패키지 ESLint |
| `pnpm typecheck` | 전 패키지 타입체크 |
| `pnpm test` | 전 패키지 테스트 (DB 테스트는 실제 Postgres를 쓴다) |
| `pnpm build` | 전 패키지 빌드 |
| `pnpm db:migrate` | 마이그레이션 적용 |
| `pnpm db:generate` | 스키마 변경으로부터 마이그레이션 생성 |
| `pnpm format` | Prettier 적용 |

## 환경변수

루트 `.env` 하나로 관리한다. 각 앱이 자기 방식으로 읽는다(Next는
`next.config.ts`, Expo는 `metro.config.js`, 확장은 Vite `envDir`). 값이 없으면
각 클라이언트는 조용히 폴백하지 않고 기동 시점에 실패한다.

`.env.example` 을 복사해 쓴다. 확장을 Chrome에 로드한 뒤에는 `chrome://extensions`
에서 확장 ID를 확인해 `CORS_ORIGINS` 에 `chrome-extension://<your-id>` 를 덧붙여야
팝업에서 API 호출이 통과한다.

## Chrome 확장 로드

```bash
pnpm --filter @rebomi/extension build
```

`chrome://extensions` → 개발자 모드 → "압축해제된 확장 프로그램을 로드" →
`apps/extension/dist` 를 고른다.

## 데이터베이스

PGroonga(한국어 전문 검색)와 pgvector(의미 검색)를 함께 담은 공식 이미지가 없어
`docker/postgres/Dockerfile` 에서 공식 `postgres` 이미지에 두 확장을 올린다.
마이그레이션 0번이 두 확장을 활성화하며, 하나라도 실패하면 마이그레이션 전체가
실패한다 — 확장 없는 DB로 개발이 시작되는 것을 막기 위해서다.

## 설계 문서

- [스캐폴드 설계](docs/superpowers/specs/2026-11-05-rebomi-monorepo-scaffold-design.md)
- [구현 계획](docs/superpowers/plans/2026-11-05-rebomi-monorepo-scaffold.md)
