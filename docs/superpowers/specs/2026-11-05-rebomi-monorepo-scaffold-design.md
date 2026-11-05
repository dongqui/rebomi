# Rebomi 모노레포 스캐폴드 — 설계

2026-11-05 · 범위: 프로젝트 골격과 툴체인. 기능 구현은 포함하지 않는다.

## 1. 목적과 범위

PRD v0.5는 웹·Chrome 확장·iOS·Android 네 클라이언트와 공통 API 서버, 잡 큐, 하이브리드 검색, 재노출 스케줄러, 과금을 담고 있다. 이 문서는 그중 **어떤 기능도 구현하지 않고**, 네 클라이언트와 서버·워커가 한 레포에서 함께 돌아가는 골격만 정의한다.

### 완료 조건 (이 스펙의 done)

1. `pnpm install` 한 번으로 전체 설치가 끝난다.
2. `docker compose up -d` 로 Postgres가 뜨고 `pgroonga`·`vector` 확장이 활성된다.
3. `pnpm db:migrate` 가 통과한다 (테이블은 `users` 하나 + 확장 활성화 마이그레이션).
4. `pnpm dev` 가 web·api·worker를 동시에 띄운다.
5. `GET /health` 가 `{ status, db, version }` 를 반환한다 (DB 핑 포함).
6. 웹 루트 페이지가 `@rebomi/api-client` 로 `/health` 를 호출해 결과를 화면에 표시한다.
7. 확장을 빌드해 Chrome에 로드하면 팝업에서 `/health` 호출이 성공한다.
8. Expo 앱이 기동해 `/health` 호출 결과를 표시한다.
9. 워커가 pg-boss로 더미 잡을 큐잉·처리한 로그를 남긴다.
10. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` 가 모두 통과한다.
11. GitHub Actions가 위 10번을 CI에서 실행한다.

### 범위 밖 (각각 별도 스펙)

회원가입·로그인 구현, 콘텐츠 저장 API, 본문 추출, 요약·임베딩, 검색, 재노출 선정, 북마크 가져오기, 과금.

인증은 두 가지만 둔다. 첫째, `users` 테이블(id, email, created_at). 둘째, `requireAuth` preHandler — `Authorization: Bearer <token>` 헤더가 없으면 401 `UNAUTHORIZED` 를 반환한다. 토큰을 실제로 검증하지는 않고, 적용된 라우트도 아직 없다. `/health` 는 공개 엔드포인트다. 이 껍데기를 미리 두는 이유는 인증이 붙을 자리를 구조에 남겨, 나중에 라우트마다 흩어지지 않게 하는 것이다.

## 2. 레포 구조

```
rebomi/
├─ apps/
│  ├─ web/            Next.js (App Router) — 웹 앱
│  ├─ api/            Fastify — 공개 REST API
│  ├─ worker/         pg-boss 컨슈머 + 재노출 스케줄러
│  ├─ extension/      Chrome 확장 (React + Vite + CRXJS, MV3)
│  └─ mobile/         Expo — iOS/Android + 공유 extension
├─ packages/
│  ├─ core/           도메인 로직 (순수)
│  ├─ db/             Drizzle 스키마 + 마이그레이션
│  ├─ api-contract/   요청·응답 Zod 스키마와 타입
│  ├─ api-client/     타입 세이프 HTTP 클라이언트
│  └─ config/         tsconfig·eslint·prettier 공유 설정
├─ docker/            Postgres(PGroonga + pgvector) Dockerfile, compose.yml
├─ docs/              PRD, specs
├─ .github/workflows/ci.yml
├─ pnpm-workspace.yaml
└─ turbo.json
```

## 3. 패키지 경계

경계의 기준은 "혼자 읽고 혼자 테스트할 수 있는가"다.

### `packages/core`

**무엇을 하는가:** 도메인 규칙을 순수 함수로 담는다. DB도 HTTP도 모른다.
**의존:** 없음 (zod 정도).
**스캐폴드에 들어가는 것:** URL 정규화 함수 하나(`normalizeUrl` — 트래킹 파라미터 제거, PRD 4.1의 중복 판정 기준)와 그 테스트. Vitest 파이프가 실제로 도는지 증명하는 역할.

이후 재노출 선정 규칙(PRD 4.4)·추출 수준 판정이 여기 들어온다. 선정 규칙은 입력이 콘텐츠 목록과 현재 시각, 출력이 선정 결과인 순수 함수로 설계해 DB 없이 테스트한다.

### `packages/db`

**무엇을 하는가:** Drizzle 스키마, 마이그레이션, 커넥션 풀 팩토리.
**의존:** drizzle-orm, pg.
**경계:** 쿼리를 노출하지 않는다. 스키마와 `createDb(connectionString)` 만 내보낸다. 질의는 `api`·`worker` 가 각자 작성한다.

### `packages/api-contract`

**무엇을 하는가:** 엔드포인트별 요청·응답 Zod 스키마와 그로부터 추론한 타입. 공통 에러 포맷.
**의존:** zod.
**경계:** 서버와 네 클라이언트 사이의 **유일한** 계약 지점. `api`는 이것을 구현하고, 클라이언트는 이것만 안다.

### `packages/api-client`

**무엇을 하는가:** `fetch` 기반 클라이언트. `api-contract` 로 응답을 파싱하고, 비-2xx를 `ApiError` 로 던진다.
**의존:** api-contract. 플랫폼 API는 `fetch` 만 (web·extension·RN 모두 가능).
**경계:** Node 전용 모듈을 쓰지 않는다. React Native 번들러가 깨지지 않게 하는 조건.

### `packages/config`

tsconfig base, eslint flat config, prettier 설정. 각 앱이 extends 한다.

### `apps/api`

Fastify. `api-contract` 를 구현하고 `db` 로 질의한다. `core` 의 규칙을 호출한다. HTTP 경계와 인증만 담당하고 도메인 판단은 `core` 에 위임한다.

### `apps/worker`

pg-boss 컨슈머와 스케줄러. `api` 와 같은 `core`·`db` 를 공유하되 HTTP를 띄우지 않는다. API와 분리한 이유는 스케일과 생애주기가 다르기 때문이다 (API는 요청 기반, 워커는 상주·장시간 작업).

## 4. 기술 선택과 근거

| 항목 | 선택 | 근거 |
| --- | --- | --- |
| 워크스페이스 | pnpm + Turborepo | pnpm 11 설치 완료. Turborepo는 태스크 그래프와 캐시만 담당하고 런타임에 관여하지 않는다 |
| 언어 | TypeScript strict, ESM | |
| API 프레임워크 | Fastify | Zod 스키마를 그대로 검증·직렬화에 꽂을 수 있고, 플랫폼 중립 Node 프로세스 |
| ORM | Drizzle | PGroonga·pgvector 인덱스는 raw SQL로 붙일 수밖에 없는데, Drizzle은 생성 SQL이 그대로 보여 수동 SQL과 섞기 쉽다. Prisma는 벡터 타입·커스텀 인덱스에 우회가 필요 |
| 잡 큐 | pg-boss | Postgres를 큐로 재사용해 인프라를 하나 줄인다. 교체 지점은 `worker` 내부 한 곳 |
| DB | Postgres + PGroonga + pgvector | PRD 8장 |
| 테스트 | Vitest | 전 패키지 동일 러너. E2E는 범위 밖 |
| 확장 | Vite + @crxjs/vite-plugin (MV3) | |
| 모바일 | Expo | |

### DB 이미지

PGroonga 공식 이미지에는 pgvector가 없고, 두 확장을 함께 담은 공식 이미지는 없다. 서드파티 이미지(`cubeplex/postgresql-pgroonga-pgvector`)가 존재하지만, 버전을 직접 쥐고 나중에 운영 이미지로 그대로 쓰기 위해 `docker/postgres/Dockerfile` 을 자체로 둔다: `groonga/pgroonga` 베이스에 pgvector를 설치한다. 태그는 고정한다.

마이그레이션 0001이 `CREATE EXTENSION IF NOT EXISTS pgroonga` 와 `vector` 를 수행한다. 둘 중 하나라도 실패하면 마이그레이션이 실패해야 한다 — 확장 없이 뜬 DB로 개발이 시작되는 상황을 막는다.

### Expo와 pnpm

Expo는 SDK 54부터 pnpm isolated 설치를 공식 지원한다. 따라서 **기본값(isolated)으로 시작**하고, 네이티브 빌드나 의존성 해석 오류가 날 때만 `pnpm-workspace.yaml` 의 `nodeLinker: hoisted` 로 내린다. 처음부터 hoisted를 거는 것은 불필요한 전역 비용이다.

## 5. 데이터 흐름 (스캐폴드가 증명하는 경로)

```
extension popup ─┐
web page ────────┼─→ @rebomi/api-client ─→ GET /health ─→ apps/api ─→ packages/db ─→ Postgres
mobile screen ───┘                                            │
                                                              └─→ pg-boss.send('noop') ─→ apps/worker
```

이 한 경로가 통하면 계약 패키지, 클라이언트 공유, DB 연결, 큐가 모두 살아 있다는 뜻이다. 이후 기능은 이 경로를 따라 붙인다.

## 6. 에러 처리

공통 에러 포맷을 처음부터 고정한다. 네 클라이언트가 같은 코드로 처리해야 하므로 나중에 바꾸면 네 곳을 고쳐야 한다.

```ts
// packages/api-contract
{ error: { code: string, message: string, details?: unknown } }
```

- `api`: Zod 검증 실패 → 400 `VALIDATION_FAILED`. 처리되지 않은 예외 → 500 `INTERNAL`, 서버 로그에 스택, 응답에는 메시지만.
- `api-client`: 비-2xx → `ApiError { code, message, status }` 를 던진다. 네트워크 실패 → `ApiError { code: 'NETWORK' }`. 클라이언트가 `code` 로 분기할 수 있게 한다.
- `worker`: 잡 실패는 pg-boss 재시도에 맡기고, 재시도 소진 시 실패 로그를 남긴다.

## 7. 테스트 전략

스캐폴드 단계의 테스트는 "파이프가 돌아간다"를 증명하는 수준이다.

| 대상 | 테스트 |
| --- | --- |
| `core` | `normalizeUrl` 단위 테스트 — Vitest가 동작함을 증명 |
| `api` | `/health` 통합 테스트. Fastify `inject` 로 HTTP 없이, DB는 실제 Postgres(테스트 DB) |
| `api-client` | 모킹한 fetch로 2xx·4xx·네트워크 실패 세 경로 |
| `web`·`extension`·`mobile` | 자동 테스트 없음. 완료 조건의 수동 확인으로 대체 |

DB를 쓰는 테스트는 실제 Postgres를 쓴다 — PGroonga·pgvector가 핵심이라 모킹하면 의미가 없고, 처음부터 실제 DB로 테스트하는 습관을 잡는다. CI는 docker 서비스로 같은 이미지를 띄운다.

## 8. CI

`.github/workflows/ci.yml`: Node 22 + pnpm 캐시, `docker/postgres` 이미지를 서비스로 기동, `pnpm lint`·`typecheck`·`test`·`build` 를 Turborepo로 실행. 모바일 네이티브 빌드(EAS)는 범위 밖.

## 9. 미결 사항

구현 중 실제로 확인해야 하는 것들. 추측으로 넘기지 않는다.

1. `groonga/pgroonga` 베이스에 pgvector를 설치하는 가장 단순한 방법 (apt 패키지 가용 여부, 아니면 소스 빌드). arm64(Apple Silicon)에서 동작해야 한다.
2. Expo isolated 설치가 이 구성에서 실제로 문제없이 도는지. 안 되면 hoisted로 전환하고 그 사실을 기록한다.
3. `@crxjs/vite-plugin` 의 MV3 지원 현황 — 메인테넌스 상태를 확인하고, 불안하면 Vite 다중 엔트리 수동 설정으로 대체한다.
4. Turborepo가 Expo 개발 서버와 함께 돌 때의 터미널 출력 문제 — 필요하면 `mobile` 을 `pnpm dev` 대상에서 빼고 별도 명령으로 둔다.
