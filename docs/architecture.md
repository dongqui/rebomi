# Rebomi — 아키텍처 기준 문서

실제 스캐폴드(2026-11-10 기준)를 근거로 한다. 제품 요구사항은 [product.md](product.md)와 [기능 문서](features/)에 있다.
스캐폴드의 설계 근거는 [스캐폴드 설계 스펙](superpowers/specs/2026-11-05-rebomi-monorepo-scaffold-design.md)에 있다.

표기: **구현됨 / 골격만 / 없음 / 확인 필요**, **[제안]** 은 원문 PRD에 없는 설계 제안, **D-xx** 는 [product.md 미결정 사항](product.md#9-미결정-사항).

## 1. 구성과 현재 상태

pnpm 11 + Turborepo 모노레포, TypeScript strict ESM, Node 22.

| 경로 | 역할 | 기술 | 현재 상태 |
| --- | --- | --- | --- |
| `apps/api` | 공개 REST API | Fastify 5, Zod 4 | **골격만.** `GET /health`(DB 핑 포함)와 인증 경로(`POST /auth/login`·`/auth/refresh`·`/auth/logout`), `requireAuth`, 콘텐츠 저장·목록·단건 조회(`POST /contents`·`GET /contents`·`GET /contents/:id`), 보관·삭제·복구(`POST /contents/:id/archive`·`/trash`·`/restore`), 키워드 검색(`POST /search`), 대기 명단 설문 응답 저장(`PUT /waitlist/responses/:id`, 인증 없음 — §8). 공통 에러 핸들러와 CORS 구현됨 |
| `apps/worker` | 잡 컨슈머 + 스케줄러 | pg-boss 12, @mozilla/readability, linkedom | **구현됨(범위 작음).** `content-process` 큐를 소비해 페이지를 가져오고 제목·설명·이미지·본문을 채운다(§5). `noop` 큐와 1분 주기 스케줄. 요약·임베딩·링크 생존 확인·재노출 잡은 없음 |
| `apps/web` | 웹 앱 | Next.js 16 (App Router), React 19 | **구현됨(범위 작음).** `/`는 누구에게나 보이는 대기 명단 랜딩이다(§8). 랜딩의 설문 응답을 받는 서버 경로 `/api/waitlist/responses/:id`가 있다(§8). 로그인 화면(`/login`, Google·Apple)과 세션 유지·로그아웃(§3). 로그인해야 보이는 `/app`은 디자인(RebomiWeb)의 틀을 갖는다: 넓은 화면은 사이드바, 860px 이하는 상단 바, 상단의 검색창과 "링크 저장"(대화상자), 설정 자리의 메뉴(테마·로그아웃). 홈은 최근 저장 목록과 첫 사용 안내다(§5). 검색 화면(`/app/search`)은 키워드 검색 결과와 결과에서의 보관·삭제·삭제 되돌리기다(§5). 재노출 카드, 보관함·Inbox·정리·휴지통·설정 화면, 자세히 보기, 정렬, 요약 표시는 없음. 스타일은 Tailwind CSS 4이고 랜딩과 `/app`에 적용돼 있다 — 로그인 화면은 토큰의 배경·글꼴만 따른다. 화면 언어(ko/en)는 `/app`·`/login`에서 요청의 `Accept-Language`로 정하고(랜딩은 영어 고정), 테마는 `/app`에서 고른 값(기기 설정·라이트·다크)을 브라우저에 저장해 `<html data-theme>`로 적용한다(랜딩은 늘 기기 설정). 토큰은 `light-dark()`로 한 번만 정의한다(`apps/web/src/app/globals.css`) |
| `apps/extension` | Chrome 확장 | Vite 8 + @crxjs/vite-plugin, MV3, React 19 | **원클릭 저장.** 팝업을 열면 웹 로그인을 재사용해(§3) 지금 탭의 제목·설명·대표 이미지·본문을 뽑아 저장하고 결과와 추출 수준을 보인다(§5). 권한은 `activeTab`·`scripting`과 API 오리진. background·상시 content script·단축키·우클릭 메뉴 없음 |
| `apps/mobile` | iOS·Android | Expo SDK 58, React Native 0.88 | **골격만.** 단일 `App.tsx`가 `/health`를 호출. 내비게이션, 공유 수신(Share Extension·Share Intent), 푸시, 네이티브 프로젝트(prebuild) 없음 |
| `apps/e2e` | 연결 테스트 | Vitest | **구현됨(범위 작음).** 실제 api + worker + Postgres를 한 프로세스에 띄워 저장 → 목록(처리 중) → 워커 처리 → 목록(완료·추출 수준)을 `api-client`로 확인하는 테스트와, 본문과 함께 저장하면 워커가 페이지를 요청하지 않고 완료하는지 확인하는 테스트, 저장 → 보관 → 삭제 → 휴지통 목록 → 복구를 확인하는 테스트. 배포되지 않는다. api·worker는 이를 위해 `buildApp`·`startJobQueue`(api), `startWorker`·처리 핸들러(worker)를 패키지 입구로 내보낸다. 브라우저 E2E는 없음 |
| `packages/api-contract` | 요청·응답 Zod 스키마 | Zod 4 | **구현됨(범위 작음).** health 응답, 공통 에러 코드·에러 바디, 로그인·갱신·로그아웃 계약, 콘텐츠·저장 요청/응답·목록 쿼리/응답 스키마, 검색 요청/응답(매칭 근거 포함) 스키마, 대기 명단 설문 응답 저장 요청과 답의 고정 키 |
| `packages/api-client` | 타입 세이프 HTTP 클라이언트 | fetch만 사용 | **구현됨(범위 작음).** `health()`, `login()`, `refresh()`, `logout()`, `saveContent()`, `listContents()`, `getContent()`, `archiveContent()`·`trashContent()`·`restoreContent()`, `searchContents()`, `saveWaitlistResponse()`(토큰 없이 보낸다). 타임아웃, `tokenStore`, 액세스 토큰 만료 시 자동 갱신, `ApiError` 변환 |
| `packages/core` | 순수 도메인 로직 | — | **구현됨(범위 작음).** `normalizeUrl`(트래킹 파라미터 제거·정규화), `domainOf`, 큐 이름(`QUEUES`)·잡 페이로드 타입·재시도 정책(`CONTENT_PROCESS_RETRY`) |
| `packages/db` | Drizzle 스키마·마이그레이션 | Drizzle 0.45, pg | **골격만.** `users(id, email, created_at)`, `auth_identities`·`refresh_tokens`(§3), `contents`·`content_bodies`(§4), `waitlist_responses`(§8) 테이블, 키워드 검색용 PGroonga 인덱스 2개(§5), PGroonga·pgvector 확장 활성화 |
| `packages/config` | tsconfig·eslint·prettier 공유 | — | 구현됨 |
| `docker/` | Postgres 이미지(PGroonga + pgvector) | compose | 구현됨 |

- **인증: 서버, `api-client`, 웹, 확장이 구현됨(§3).** 모바일의 로그인과 토큰 보관은 없다. 콘텐츠 라우트는 `requireAuth`를 지난다.
- **테스트:** Vitest. `core`, `db`, `api`, `api-client`, `worker`에 있다. DB 테스트는 실제 Postgres를 쓴다. `web`은 컴포넌트 테스트(Testing Library + jsdom)가 있고 `fetch`만 가짜로 바꿔 실제 `api-client`를 통과시킨다. `extension`도 같은 방식의 팝업 테스트와 추출 함수 테스트(jsdom)가 있다. `mobile`에는 자동 테스트가 없다. E2E 없음.
- **CI:** `.github/workflows/ci.yml`이 push·PR마다 Postgres 이미지 빌드 → migrate → lint → typecheck → test → build를 돌린다. 모바일 네이티브 빌드(EAS) 없음.
- **환경 설정:** 루트 `.env` 하나(`.env.example`). 값이 없으면 각 앱이 기동 시 실패한다. 예외는 `GOOGLE_CLIENT_IDS`·`APPLE_CLIENT_IDS`로, 비어 있어도 API는 뜨고 그 제공자의 로그인만 503이다. 웹은 `NEXT_PUBLIC_API_BASE_URL`·`NEXT_PUBLIC_GOOGLE_CLIENT_ID`·`NEXT_PUBLIC_APPLE_CLIENT_ID` 중 하나라도 없으면 dev·build가 실패한다(`next.config.ts`). CI는 두 클라이언트 ID를 자리 채움 값으로 준다.
- **배포 (2026-11-19): 랜딩과 설문만.** `https://rebomi.app`(Vercel 프로젝트 `rebomi`, Root Directory `apps/web`, 빌드 명령은 `apps/web/vercel.json`)에 웹이 올라가 있다. API 서버·워커는 배포돼 있지 않아 `/login`·`/app`은 떠도 동작하지 않는다. 설문 응답은 Supabase 프로젝트 `rebomi`의 `waitlist_responses`에 쌓인다(§8). 그 DB에는 이 테이블 하나만 손으로 만들었다 — 마이그레이션 기록(`drizzle.__drizzle_migrations`)이 없으므로, 나머지 스키마를 그 DB에 올릴 때는 `pnpm db:migrate`를 그대로 돌리지 말고 이 테이블을 먼저 정리한다. 테이블에는 RLS를 켜고 정책을 두지 않아 Supabase Data API로는 읽거나 쓸 수 없다(웹은 DB에 직접 연결한다). Vercel 환경변수: `DATABASE_URL`(Supabase 연결 문자열), `NEXT_PUBLIC_API_BASE_URL=https://rebomi.app/api`, 두 로그인 클라이언트 ID는 자리 채움 값, `ENABLE_EXPERIMENTAL_COREPACK=1`(pnpm 버전을 `packageManager`로 맞춘다). Vercel 프로젝트는 GitHub 저장소에 연결돼 있다 — `main`에 병합하면 운영에, 다른 브랜치에 올리면 미리보기에 배포된다. 손으로 올릴 때는 저장소 루트에서 `npx vercel@latest deploy --prod`다. 올리지 않을 파일은 `.vercelignore`에 있다.
- **확인 필요:** 스캐폴드 스펙 9장의 미결(Expo isolated 설치의 네이티브 빌드 동작, @crxjs 유지보수 상태)은 기능 개발 중 실제 빌드로 확인한다. 스캐폴드의 실행 가능 여부는 이 문서 작성 시 다시 실행해 보지 않았다 — README와 CI 구성에 근거한다.

## 2. 패키지 경계 (바꾸지 않는 규칙)

```
extension ─┐
web ───────┼─→ api-client ─→ api-contract ←─ api ─→ db ─→ Postgres
mobile ────┘                                  │ └→ core
                                              └─→ pg-boss ─→ worker ─→ db, core
```

- `api-contract`가 서버와 클라이언트 사이의 **유일한 계약**이다. 엔드포인트를 추가하면 여기에 Zod 스키마를 먼저 둔다.
- 세 클라이언트는 `api-client`만으로 서버와 통신한다. `api-client`는 `fetch` 외 플랫폼 API를 쓰지 않는다(React Native 번들 호환).
- `core`는 DB·HTTP를 모르는 순수 함수다. URL 정규화, 재노출 선정 규칙, RRF 결합처럼 입출력이 없는 로직이 여기 온다.
- API 응답은 계약의 JSON 스키마로 직렬화해 계약에 없는 필드가 나가지 못하게 한다(`routes/health.ts`의 방식).
- 에러는 `{ error: { code, message, details? } }` 한 모양이고 클라이언트는 `code`로만 분기한다. 새 코드는 `api-contract`의 `ERROR_CODES`에 추가한다.

## 3. 인증과 기기 동기화

| 책임 | 위치 | 상태 |
| --- | --- | --- |
| Google·Apple 신원 토큰 검증, 계정 생성·조회, 액세스·갱신 토큰 발급·갱신·폐기 | `apps/api` — `routes/auth.ts`, `auth/*`. 외부 인증 서비스를 쓰지 않고 직접 구현한다 | 구현됨 |
| 요청의 사용자 식별 | `apps/api/src/auth.ts`의 `requireAuth`(`app.requireAuth`). 통과한 요청은 `request.userId`를 가진다 | 구현됨. 콘텐츠 라우트에 적용 |
| 토큰 보관·전달, 만료 시 자동 갱신 | 각 클라이언트가 `api-client`의 `tokenStore`(`get`/`set`)를 구현 (모바일 `SecureStore`). 웹과 확장은 메모리 + 웹의 쿠키 | `api-client`와 웹(`apps/web/src/auth/token-store.ts`) 구현됨. 확장·모바일 저장소 없음 |
| 공유 확장과 메인 앱의 세션 공유 | iOS App Group, Android 공유 저장소 **[원문]** | 없음 |
| 기기 간 동기화 | 서버가 단일 원본. 클라이언트는 서버 상태를 조회한다 **[제안]** — 오프라인 편집·충돌 해결은 요구되지 않았다 | 없음 |

로그인은 Google·Apple 소셜 로그인이고, 검증된 이메일이 같으면 같은 계정이다. 제품 규칙은 [account](features/account.md) §4에 있다. 확장은 웹 로그인을 재사용한다(account ACC-9) — 방법은 아래 "확장의 로그인"에 있다. 모바일은 Google·Apple을 웹과 똑같이 제공하고 Google은 네이티브 로그인이다(account §4, 2026-11-24) — 구현은 아직 없다. "동기화"의 반영 시점은 **D-08**로 남아 있다.

**웹의 로그인과 세션 (2026-11-13)** — `apps/web/src/auth/`.

- 로그인 여부는 브라우저에서 판단한다. 갱신 쿠키가 API의 `/auth` 경로에만 붙어 Next 서버에는 보이지 않기 때문이다. 앱이 뜰 때 `refresh()`를 한 번 불러 세션을 복구하고(다시 방문하면 자동 로그인), 서버가 거부하면 `/login`으로 보낸다. 서버에 닿지 못한 경우는 로그아웃과 구분해 오류와 다시 시도를 보인다.
- 액세스 토큰은 메모리에만 둔다. 사용 중에 갱신이 거부되면 `api-client`가 토큰을 지우고, 웹은 토큰 저장소를 구독해 로그아웃 상태로 바꾼다.
- Google은 Google Identity Services 버튼, Apple은 Sign in with Apple JS 팝업으로 신원 토큰을 받는다. 두 스크립트는 로그인 화면에서 직접 불러오고 npm 의존성은 없다. Google 버튼 방식은 사용자가 창을 닫아 취소해도 신호를 주지 않는다.
- 로그인 수단은 목록(`LoginMethod[]`)이다. 수단은 자기 버튼을 그리고 `attempt`로 로그인을 실행할 뿐이고, 진행 표시·오류 문구·화면 이동은 로그인 화면이 맡는다. 새 수단(예: 이메일)은 항목 하나로 더한다.
- 아직 없는 것: nonce 검증, 로그인한 사용자 정보 표시(갱신 응답에 사용자 정보가 없다), 탭 사이의 로그아웃 동기화.

**확장의 로그인 (2026-11-17)** — `apps/extension/src/auth/`.

- 확장은 로그인하지 않는다. 같은 브라우저에서 웹이 받은 갱신 쿠키(`rebomi_refresh`)를 그대로 쓴다(account ACC-9). `api-client`를 웹과 같은 쿠키 방식으로 만들고, 팝업이 열릴 때 `refresh()`를 한 번 불러 액세스 토큰을 받는다.
- 확장이 가진 것은 액세스 토큰뿐이고 메모리에만 둔다. 갱신 토큰을 받지도 `chrome.storage`에 쓰지도 않는다. 팝업이 닫히면 토큰도 사라진다.
- 쿠키가 실리는 조건은 둘이다. 매니페스트의 `host_permissions`에 API 오리진이 있어야 Chrome이 확장 페이지의 요청에 `SameSite=Lax` 쿠키를 붙이고, 확장의 오리진(`chrome-extension://<id>`)이 `CORS_ORIGINS`에 있어야 서버가 쿠키로 온 갱신 요청을 받는다(아니면 403).
- 로그인돼 있지 않으면(갱신이 401·403) 팝업이 알리고, 버튼이 `VITE_WEB_BASE_URL`의 `/login`을 새 탭으로 연다. 서버에 닿지 못한 경우는 웹처럼 로그아웃과 구분한다.
- 웹에서 로그아웃하면 쿠키가 지워지고 갱신 토큰이 폐기되므로 확장도 다음에 열 때 로그인이 필요한 상태다. 확장에는 로그아웃이 없다.
- 저장도 팝업 안에서 끝나므로 팝업 밖(background)에서 토큰을 나눠 쓰지 않는다.
- 아직 없는 것: 확장 ID 고정(매니페스트 `key`) — 지금은 unpacked 경로에서 생긴 ID를 `CORS_ORIGINS`에 직접 넣는다.

**토큰 (2026-11-11 결정)**

| | 형태 | 수명 | 저장 |
| --- | --- | --- | --- |
| 액세스 토큰 | JWT, HS256, 서버 비밀키 `AUTH_JWT_SECRET`(32자 이상). 클레임 `sub`(사용자 ID)·`iss=rebomi`·`aud=rebomi-api`·`iat`·`exp` | 15분 | 서버에 저장하지 않는다. 요청마다 서명만 검증한다 |
| 갱신 토큰 | 256비트 난수(base64url) | 60일. 갱신에 쓸 때마다 그 시점부터 60일로 연장 | `refresh_tokens`에 SHA-256 해시만. 원문은 클라이언트만 가진다 |

- 갱신 토큰은 **회전하지 않는다.** 로그아웃(폐기)이나 만료 전까지 같은 토큰을 쓴다 — 여러 탭이나 앱·공유 확장이 동시에 갱신해도 서로를 끊지 않게 하기 위해서다.
- 로그아웃은 그 갱신 토큰 하나만 폐기한다. 이미 발급된 액세스 토큰은 만료(최대 15분)까지 유효하다.
- 서명·검증 라이브러리는 `jose`다.

**제공자 신원 토큰** — 클라이언트가 Google·Apple에서 받은 신원 토큰(JWT)을 `POST /auth/login`으로 보내면, 서버가 제공자의 공개키(JWKS)로 서명·만료·발급자·대상(audience)을 검증한다. 대상은 `GOOGLE_CLIENT_IDS`·`APPLE_CLIENT_IDS`(쉼표 구분)에 있는 우리 앱의 클라이언트 ID여야 한다. 신원은 `auth_identities`에 `(provider, subject)`로 남고, 한 계정에 두 제공자의 신원이 붙을 수 있다. nonce 검증은 아직 없다 — 클라이언트의 로그인 흐름이 정해질 때 넣는다.

**갱신 토큰 전달** — 로그인 요청의 `session`으로 고른다.

| `session` | 쓰는 곳 | 갱신 토큰 |
| --- | --- | --- |
| `body`(기본) | 모바일 | 응답 본문 |
| `cookie` | 웹 (확장은 로그인하지 않고 웹이 받은 쿠키를 쓴다) | `rebomi_refresh` 쿠키로만 — `HttpOnly`, `SameSite=Lax`, `Path=/auth`, `Max-Age` 60일, 운영(`NODE_ENV=production`)에서 `Secure`. 본문의 `refreshToken`은 `null` |

쿠키 방식은 웹과 API가 같은 사이트(같은 등록 도메인)에 배포되는 것을 전제로 한다. 쿠키로 온 갱신·로그아웃 요청은 `Origin`이 `CORS_ORIGINS`에 있을 때만 받는다(아니면 403).

**인증 에러 코드** — `api-contract`의 `ERROR_CODES`.

| 코드 | 상태 | 언제 | 클라이언트가 할 일 |
| --- | --- | --- | --- |
| `UNAUTHORIZED` | 401 | 액세스 토큰이 없거나 형식·서명이 틀림 | 로그인으로 |
| `ACCESS_TOKEN_EXPIRED` | 401 | 액세스 토큰 만료 | `api-client`가 갱신 후 원래 요청을 한 번 다시 보낸다 |
| `INVALID_PROVIDER_TOKEN` | 401 | 제공자 신원 토큰의 서명·만료·발급자·대상 검증 실패 | 로그인 실패 표시 |
| `REFRESH_TOKEN_EXPIRED` | 401 | 갱신 토큰 만료 | 로그인으로 |
| `REFRESH_TOKEN_INVALID` | 401 | 폐기되었거나 모르는 갱신 토큰, 또는 갱신 토큰 없음 | 로그인으로 |
| `EMAIL_NOT_VERIFIED` | 403 | 처음 보는 신원인데 제공자가 검증한 이메일이 없음 | 다른 계정으로 로그인하라고 안내 |
| `PROVIDER_NOT_CONFIGURED` | 503 | 그 제공자의 클라이언트 ID가 서버에 없음 | 그 로그인 수단을 쓸 수 없다고 표시 |

거부 사유의 세부는 응답에 넣지 않고 서버 로그에만 남긴다. 토큰, `Authorization`·`Cookie` 헤더, 요청 본문은 로그에 쓰지 않는다.

모든 콘텐츠 데이터는 **비공개 기본값**이며 소유 사용자만 접근한다. 콘텐츠를 다루는 모든 쿼리는 사용자 ID로 범위를 제한한다. **[원문 11.8]**

## 4. 콘텐츠의 공통 상태

서로 다른 축을 한 필드에 섞지 않는다. 아래 축은 `contents` 테이블(`packages/db`)의 서로 다른 컬럼이고, 계약(`packages/api-contract`의 `contentSchema`)에서도 서로 다른 필드다. 계약의 필드 이름은 컬럼 이름의 camelCase이고 값 이름은 같다.

| 축 | 컬럼 | 값 (저장되는 이름) | 근거 |
| --- | --- | --- | --- |
| **보관 상태** | `archive_state` | Inbox `inbox` / 보관됨 `archived` / 휴지통 `trashed`. 기본 `inbox` | [원문 4.5] Inbox는 30일 뒤 자동으로 보관됨. 휴지통은 30일 뒤 영구 삭제 |
| **링크 상태** | `link_state` | 정상 `ok` / 링크 소멸 `dead`. 기본 `ok` | [원문 4.5] 링크 소멸은 "어느 상태에나 겹쳐 붙는 플래그". **[제안]** 판정 전·일시 실패를 구분하는 값은 D-04 결정 뒤 추가 |
| **추출 수준** | `extraction_level` | 본문 `full` / 일부 `partial` / 메타데이터만 `metadata_only`. 기본 `metadata_only` (본문을 확보하면 올린다) | [원문 4.1] 콘텐츠마다 저장하고 화면에 표시 |
| **AI 처리 상태** | `summary_status` | 요약: 생성 중 `pending` / 완료 `done` / 실패 `failed` / 본문 없음 `no_content`. 기본 `pending` | [원문 4.2] **[제안]** 임베딩 처리 상태는 원문에 없다. 사용자에게 보이지 않는 내부 상태로 따로 둔다(컬럼은 임베딩 Issue에서 추가) |
| **재노출 포함 여부** | `resurfacing_included` | 포함 `true` / 제외 `false`. DB 기본값 없음 — 넣는 쪽이 정한다 | [원문 4.4] "보관 상태와 별도로 관리". 기본값은 출처에 따라 다르다 → [resurfacing](features/resurfacing.md) |
| **메타데이터 처리 상태** | `metadata_status` | 처리 중 `pending` / 완료 `done` / 실패 `failed`. 기본 `pending` | 원문에 없는 축 — 서버 측 메타데이터 수집·보조 추출 잡의 진행을 담는다(Issue #1에서 추가). 추출 수준(결과)과 다르다: 처리가 `done`이어도 추출 수준은 `metadata_only`일 수 있다 |

값은 text 컬럼 + check 제약으로 저장한다(pg enum이 아니다 — 값 추가가 제약 교체로 끝난다). 값 목록은 `packages/db`의 스키마와 `packages/api-contract`에 각각 있고, 두 패키지는 서로 의존하지 않는다(§2). 어긋남은 DB 행을 계약 타입으로 옮기는 `apps/api`의 타입체크가 잡는다.

함께 저장하는 속성과 컬럼: 소유 사용자 `user_id`(사용자 삭제 시 함께 삭제), 원본 URL `url`, 정규화된 URL `normalized_url`, 제목 `title`, 설명 `description`(페이지가 스스로 밝힌 og:description 등 — 요약이 아니다), 도메인 `domain`, 대표 이미지 `image_url`, 출처 경로 `source`(확장 `extension` / 모바일 `mobile` / 웹 `web` / 가져오기 `import`), 저장일 `saved_at`. `(user_id, normalized_url)`은 유일하다 — 중복 저장은 DB가 거부한다. 가져온 폴더명과 한 줄 메모는 아직 컬럼이 없다(각 기능 Issue에서 추가).

추출한 본문은 `content_bodies(content_id, text, extracted_at)`에 콘텐츠당 하나로 둔다. `contents`와 가른 이유는 크기다 — 목록 질의가 본문을 함께 읽지 않는다. 콘텐츠를 지우면 본문도 지워진다. 본문은 API 응답에 싣지 않는다(검색·요약의 입력이다).

휴지통에 있는 콘텐츠에는 삭제한 시각 `trashed_at`과 삭제하기 직전의 보관 상태 `trashed_from`(`inbox` / `archived`)이 함께 있다. 둘은 휴지통일 때만, 그리고 그때는 반드시 값이 있다(check 제약). 보관 상태 축에 딸린 값이고 계약에는 싣지 않는다 — 삭제한 시각은 휴지통 화면을 만들 때 싣는다.

**[제안] 전이 규칙** — 원문에서 직접 읽히는 것만 적는다. 나머지는 해당 Issue의 설계에서 정하고 이 표에 추가한다.

| 전이 | 조건 |
| --- | --- |
| Inbox → 보관됨 | 사용자의 보관 액션(구현됨), 또는 30일 경과(아직 없음) |
| Inbox·보관됨 → 휴지통 | 사용자의 삭제 액션(구현됨). 삭제한 시각과 삭제 전 상태를 남긴다 |
| 휴지통 → 삭제하기 직전 상태 | 삭제 복구(구현됨). Inbox에서 지웠으면 Inbox로, 보관됨에서 지웠으면 보관됨으로 돌아간다 (2026-11-18 결정 — 삭제 직후의 "되돌리기"가 삭제 전과 같아야 한다) |
| 휴지통 → 영구 삭제 | 30일 경과(아직 없음) |

두지 않는 전이: 보관됨 → Inbox(원문에 없다. Inbox는 "새로 저장한 것"이다), 휴지통 → 보관됨(복구를 거친다). 보관 상태를 바꿔도 다른 축은 바뀌지 않는다.

추출 수준과 처리 상태의 전이:

| 전이 | 조건 |
| --- | --- |
| 추출 수준 `metadata_only` → `full` (저장 시) | 저장 요청에 본문이 함께 옴. 새 저장이면 처음부터 `full`. 이미 저장한 URL이면 기존이 `metadata_only`일 때만 올리고, 요약 상태가 `no_content`였으면 `pending`으로 돌린다 |
| 메타데이터 처리 `pending` → `done` | 워커가 페이지를 받아 처리함. 본문을 뽑았으면 추출 수준 `full`, 요약 상태는 `pending` 유지. 본문이 없으면 추출 수준은 그대로(`metadata_only`), 요약 상태 `no_content` |
| 메타데이터 처리 `pending` → `failed` | 다시 해도 소용없는 오류, 또는 재시도 소진. 요약 상태 `no_content`. 콘텐츠는 남는다 |

## 5. 수집 → 처리 → 검색 흐름

```
[클라이언트]                       [api]                         [worker]
확장: DOM 본문 캡처 ─┐
iOS Safari: 본문 수신 ├─→ 저장 요청 ─→ URL 정규화·중복 감지 ─→ 잡 큐잉 ─→ 메타데이터 수집
모바일 공유: 텍스트   │   (본문 포함)    콘텐츠 행 생성(즉시 응답)          서버 보조 추출 (본문이 없을 때)
웹: URL만 ───────────┘                                                    링크 생존 확인
                                                                          요약 → 임베딩(청크)
                                       검색 요청 ←── 키워드(PGroonga) + 의미(pgvector) → RRF
```

- **저장은 동기, 처리는 비동기.** 저장 요청은 콘텐츠 행을 만들고 바로 응답한다. 요약·임베딩이 끝나지 않아도 목록과 키워드 검색에 나타나야 한다. **[원문 4.1, 4.3]**
- **본문 추출 우선순위:** 클라이언트 캡처 → 공유 텍스트 → 서버 fetch → 메타데이터만. 클라이언트가 본문을 보냈으면 서버 fetch는 하지 않는다(보조). **[원문 4.1]**
- **잡의 위치:** 메타데이터 수집, 서버 보조 추출, 링크 생존 확인, 요약, 임베딩, 재노출 선정은 모두 `apps/worker`의 pg-boss 잡이다. 큐 이름과 페이로드 타입은 한 곳(`packages/core`의 `QUEUES`, `ContentProcessPayload`)에 두고 api(보내는 쪽)와 worker(받는 쪽)가 같은 것을 쓴다. 저장된 콘텐츠의 서버 측 처리 큐는 `content-process`이고 페이로드는 `{ contentId }`다. 재시도 정책도 `core`의 `CONTENT_PROCESS_RETRY`에 있고 api가 잡에 실어 보낸다.
- **저장 API (`POST /contents`, 구현됨):** `core.normalizeUrl`로 정규화하고 `(user_id, normalized_url)` 유일 제약으로 중복을 판정한다. 새로 저장하면 201, 이미 있으면 200이고 본문은 둘 다 `{ status: 'created' | 'duplicate', content }`다 — 중복은 오류가 아니며 기존 콘텐츠를 그대로 준다(두 번째 요청의 URL·출처로 덮어쓰지 않는다). http(s)가 아닌 입력은 400 `VALIDATION_FAILED`. `domain`은 호스트에서 앞의 `www.`만 뗀 값이다.
  - **함께 받는 값:** 저장하는 쪽은 `title`·`description`·`body`·`imageUrl`을 선택으로 보낼 수 있다. 상한은 제목 500자, 설명 2,000자, 본문 20만 자, 이미지 주소 2,048자이고(`api-contract`의 `CONTENT_SAVE_LIMITS`, 워커의 추출 상한과 같다) 이미지는 절대 http(s) 주소만 받는다. 넘거나 모양이 틀리면 자르지 않고 400 `VALIDATION_FAILED`로 거부한다 — 보내는 쪽이 잘라 보낸다. 이 경로의 요청 크기 제한은 2MB다. 앞뒤 공백은 떼고, 공백뿐인 값은 보내지 않은 것으로 본다.
  - **본문이 오면** `content_bodies`에 넣고 추출 수준을 `full`로 시작한다. 콘텐츠 행·본문·잡이 한 트랜잭션이다. 처리 상태는 본문이 있어도 `pending`으로 시작하고 잡도 넣는다 — 가져올지 말지는 워커가 정한다.
  - **이미 저장한 URL에 본문이 오면** 기존 추출 수준이 `metadata_only`일 때만 그 본문을 넣고 `full`로 올린다. 이때 제목·설명·이미지는 비어 있는 것만 채우고, 요약 상태가 `no_content`였으면 `pending`으로 돌린다. 본문이 이미 있으면 아무것도 바꾸지 않는다. 어느 쪽이든 응답은 `duplicate`이고 저장일은 그대로이며 잡을 더 넣지 않는다.
- **행과 잡은 한 트랜잭션이다.** api는 콘텐츠 행 삽입과 `content-process` 잡 삽입을 같은 DB 트랜잭션에서 한다(`Db.transaction` + pg-boss `send`의 `db` 옵션). 잡을 넣지 못하면 행도 남지 않는다 — 행만 남으면 그 콘텐츠는 영원히 처리 중이고, 다시 저장해도 중복이라 고칠 길이 없다. api의 pg-boss는 보내기 전용이고(유지보수·스케줄 꺼짐) 소비는 worker가 한다.
- **콘텐츠 처리 잡 (`content-process`, 구현됨):** 워커가 저장된 URL을 가져와 제목(`og:title` → `<title>`), 설명(`og:description` → meta description), 이미지(`og:image` → `twitter:image`, 절대 http(s) 주소)와 본문을 채운다. 저장한 쪽이 먼저 채운 값은 덮어쓰지 않는다. 처리 중인(`metadata_status = pending`) 행만 고치므로 같은 잡이 두 번 돌아도 결과가 같다. 본문이 이미 있는 콘텐츠(추출 수준이 `metadata_only`가 아닌 것 — 저장한 쪽이 본문을 보냈다)는 가져오지 않고 처리 상태만 완료로 바꾼다. 제목·설명·이미지가 비어 있어도 가져오지 않는다 — 서버가 받으면 로그인 화면 같은 다른 내용이 나올 수 있다.
  - **본문 추출은 규칙 기반이다(AI를 쓰지 않는다).** Readability(`@mozilla/readability` + `linkedom`)가 비어 있지 않은 결과를 내면 길이와 무관하게 본문으로 본다. 원본 HTML은 저장하지 않고 텍스트만 20만 자까지 저장한다. AI로 본문을 뽑는 보완은 서버 추출 성공률(H4)을 재 본 뒤에 판단한다.
  - **재시도:** 연결 실패·시간 초과·5xx·429 같은 일시 오류만 최대 3번(30초부터 두 배씩) 다시 한다. 그 밖의 4xx, HTML이 아닌 응답, 5MB 초과, 리다이렉트 5번 초과, 차단된 주소는 바로 실패로 기록한다. 마지막 시도까지 실패하면 실패로 기록하고 잡은 끝낸다 — 워커는 계속 돈다.
  - **나가는 요청의 제한:** 주소는 사용자 입력이라 믿지 않는다. 사설·루프백·링크 로컬 주소로는 연결하지 않고(연결 직전의 DNS 결과로 판정), 리다이렉트는 직접 따라가며 매번 다시 검사한다. 요청 전체 10초, 응답 5MB(압축을 푼 크기). User-Agent는 `Mozilla/5.0 (compatible; RebomiBot/0.1)`로 봇임을 밝힌다. robots.txt는 확인하지 않는다 — 사용자가 저장한 주소 하나만 가져온다. 로그에는 콘텐츠 ID와 실패 사유만 남기고 주소는 남기지 않는다.
- **확장의 저장 (`apps/extension/src/capture/`, 구현됨):** 팝업을 열면 로그인 확인 뒤 바로 저장한다 — 저장 버튼도, 캡처 전 안내도 없다(capture CAP-2, §5 본문 저장 고지).
  - **페이지 읽기:** `activeTab` + `scripting` 권한으로, 사용자가 확장 버튼을 누른 그 탭에 그때 한 번 추출 스크립트를 넣는다(`chrome.scripting.executeScript`). 스크립트는 페이지와 분리된 세계에서 돌고 결과를 팝업이 읽어 간다. 상시 content script와 모든 사이트 권한은 없다. 빌드는 스크립트를 한 파일(IIFE)로 묶고, crxjs가 자동으로 넣는 `web_accessible_resources`는 뺀다 — 남기면 웹 페이지가 확장의 설치 여부를 알아낼 수 있다.
  - **추출:** 제목·설명·이미지는 워커와 같은 순서로 고른다. 본문은 문서의 복사본에 Readability를 돌리고(보고 있는 페이지를 고치지 않는다), 결과가 없으면 화면에 보이는 텍스트(`innerText`)로 대체한다 — SNS처럼 기사 구조가 없는 페이지를 위한 것이고 메뉴 같은 잡음이 섞일 수 있다. 화면에 텍스트가 없으면 본문 없이 저장한다. 값은 `CONTENT_SAVE_LIMITS`에 맞춰 잘라 보낸다.
  - **저장할 수 없는 탭:** http(s)가 아닌 탭(브라우저 내부 페이지, 파일)은 이유를 보이고 서버에 보내지 않는다. 스크립트를 넣을 수 없는 http(s) 페이지(Chrome 웹 스토어 등)는 URL과 탭 제목만 저장한다.
  - **결과:** 저장됨 / 이미 저장됨, 제목, 추출 수준을 보인다. 서버에 닿지 못하거나 서버가 거부하면 실패와 다시 시도를 보인다. 요청은 팝업을 한 번 열 때 한 번만 보낸다.
- **목록 API (`GET /contents`, 구현됨):** 요청한 사용자의 콘텐츠를 저장일순으로 준다. `limit`(기본 50, 최대 100)과 `cursor`를 받고 `{ items, nextCursor }`를 준다. 커서는 `(saved_at, id)` 키셋이고 클라이언트에게는 불투명한 문자열이다 — 중간에 새 저장이 끼어도 건너뛰거나 겹치지 않는다.
  - **보관 상태 조건 `archiveState`:** `inbox` / `archived` / `trashed` 중 하나를 주면 그 상태만 준다. 생략하면 휴지통을 뺀 전체(Inbox와 보관됨)다. 휴지통은 `trashed`를 지정해야만 온다.
  - **정렬 `sort`:** 최근순 `recent`(기본) / 오래된 순 `oldest`. 기준은 어느 목록이든 저장일이다(휴지통도 — 삭제한 시각순은 휴지통 화면에서 정한다). 커서는 받은 정렬을 담고 있어, 다른 정렬에 넘기면 400 `VALIDATION_FAILED`다.
- **단건 조회 API (`GET /contents/:id`, 구현됨):** 요청한 사용자의 콘텐츠 하나를 목록과 같은 모양으로 준다. 없는 ID, 남의 콘텐츠, 휴지통의 콘텐츠, UUID 모양이 아닌 ID는 구분하지 않고 404 `NOT_FOUND`다 — 구분하면 ID가 존재하는지 알려 주게 된다. 클라이언트가 처리 상태를 다시 확인하는 데 쓴다.
- **보관·삭제·복구 API (`POST /contents/:id/archive` · `/trash` · `/restore`, 구현됨):** 본문 없이 부르고 바뀐 콘텐츠를 받는다. 상태 값을 직접 지정하는 요청은 없다 — 복구가 돌아갈 상태는 서버가 안다. 전이는 §4의 표를 따른다.
  - **같은 요청의 반복은 오류가 아니다.** 이미 보관됨인 것을 보관, 이미 휴지통인 것을 삭제, 휴지통이 아닌 것을 복구하면 바꾸지 않고 200으로 지금의 콘텐츠를 준다(삭제한 시각도 그대로다). 응답을 받지 못해 다시 보내도 안전하다.
  - **허용하지 않는 전이**는 휴지통의 콘텐츠를 보관하는 것 하나이고 409 `INVALID_STATE_TRANSITION`이다. 콘텐츠는 바뀌지 않는다.
  - 없는 ID와 남의 콘텐츠는 단건 조회와 같게 404다. 단, 자기 휴지통의 콘텐츠는 이 경로들로 다룰 수 있다.
  - 판정은 조건을 건 UPDATE 한 번이다 — 읽고 나서 바꾸지 않으므로 동시에 온 요청이 서로를 덮어쓰지 않는다.
- **웹의 처리 상태 갱신 (`apps/web/src/library/`):** 저장은 즉시 응답하고 처리는 워커가 나중에 하므로, 웹은 처리 중(`metadataStatus: pending`)인 항목만 3초마다 단건 조회로 다시 확인한다. 처리 중인 항목이 없거나 탭이 숨겨져 있으면 묻지 않는다. 확인에 실패하면 항목을 그대로 두고 다음 차례에 다시 묻고, 404면 목록에서 뺀다. 서버가 변경을 밀어 주는 방식(SSE·웹소켓)은 쓰지 않는다. 목록은 첫 페이지 50개와 "더 보기"다. 목록 상태는 `/app` 레이아웃의 `LibraryProvider`에 있어, 앱 틀의 링크 저장 결과가 홈 목록에 바로 나타난다.
- **검색 대상:** 제목, URL·도메인, 요약, 메모, 추출된 본문. 긴 본문은 청크 단위로 임베딩해 매칭 근거 문장을 제시한다. **[원문 8장]**
- **키워드 검색 API (`POST /search`, 구현됨):** 요청한 사용자의 콘텐츠를 키워드로 찾는다. 지금 대상은 제목, URL·도메인, 설명, 추출된 본문이다 — 요약과 메모는 그 컬럼이 생길 때 넣고, 의미 검색과 RRF 결합은 아직 없다.
  - **요청은 본문으로 보낸다:** `{ query, limit?, cursor? }`. 조회지만 POST다 — 검색어를 주소에 실으면 서버 로그와 프록시에 남는다.
  - **검색어:** 앞뒤 공백을 뗀 뒤 1~200자, 공백으로 나눈 단어는 10개까지다. 넘거나 비면 400 `VALIDATION_FAILED`다. 단어가 **모두** 들어 있는 콘텐츠만 결과다. 단어마다 어느 대상에 있어도 된다. `OR`·`-`·따옴표 같은 검색 문법은 없고 글자 그대로 찾는다. 단어의 일부로도 찾고(한국어·영어 모두), 대소문자와 전각·반각을 가리지 않는다.
  - **범위:** 휴지통은 빠지고 Inbox와 보관됨이 대상이다. 남의 콘텐츠는 나오지 않는다(§3).
  - **응답:** `{ items: [{ content, matches }], nextCursor }`. `content`는 목록과 같은 모양이다. `matches`는 일치한 곳마다 `{ field, text, ranges }`다 — `field`는 `title`/`url`/`description`/`body`(도메인 일치는 `url`), `text`는 HTML이 아닌 글(본문은 일치한 곳 주변의 조각으로 2개까지, 나머지는 값 전체), `ranges`는 `text` 안의 일치 구간(`start`부터 `end` 앞까지, UTF-16 위치)이다. 화면이 그 구간을 강조한다. 일치가 없으면 `items`가 빈 배열이다.
  - **정렬:** 관련도순이다. 단어마다 제목 일치를 가장 높게, 그다음 설명·주소·도메인, 그다음 본문으로 점수를 더한다. 점수가 같으면 최근 저장이 먼저다.
  - **페이지:** `limit` 기본 20, 최대 50. 커서는 "몇 번째부터"를 담은 불투명한 값이다(최대 10,000번째). 관련도순에는 키셋으로 삼을 고정된 기준이 없어서다 — 페이지 사이에 새 콘텐츠가 저장되면 한 항목이 겹칠 수 있다.
  - **인덱스:** PGroonga 인덱스 둘 — `contents_search_idx`(제목·설명·URL·도메인을 한 배열로)와 `content_bodies_search_idx`(본문). 토크나이저는 알파벳·숫자·기호를 단어로 묶지 않는 N-gram, 정규화는 `NormalizerNFKC150`이다. Drizzle 스키마로 표현할 수 없어 마이그레이션 `0007_search_indexes`에 직접 쓴 SQL로 있다. 인덱스는 사용자별로 나뉘어 있지 않다 — 일치를 찾은 뒤 사용자로 거른다.
  - **엔진에 묶인 SQL은 `apps/api/src/search/keyword.ts` 한 파일에만 있다.** 경로(`routes/search.ts`)는 그 함수의 입력과 결과만 본다. Phase 2 평가에서 엔진을 바꾸면 그 파일만 바꾼다.
- **웹의 검색 화면 (`apps/web/src/search/`, `/app/search`):** 상단 검색창은 `/app`의 어느 화면에서나 보이고, Enter를 눌렀을 때 찾는다(입력하는 동안에는 묻지 않는다).
  - **검색어는 주소의 `#` 뒤에 둔다:** `/app/search#q=단어`. 새로고침과 뒤로 가기에서 결과가 유지된다. `?q=`를 쓰지 않는 이유는 검색 API가 검색어를 본문으로 받는 이유와 같다 — `#` 뒤는 서버로 가지 않아 Vercel 로그에 남지 않는다. 주소가 검색어의 유일한 출처이고(`search/query.ts`), 서버는 검색어를 모르므로 화면은 브라우저에서 그린다.
  - **상태:** 입력 전 / 찾는 중 / 결과 / 결과 없음 / 실패(다시 시도) / 서버가 검색어를 받지 않음(400, 다시 시도 없음). 받지 못한 것을 결과 없음처럼 보이지 않는다. 전체 개수는 API가 주지 않아, 다 받았을 때만 "N개를 찾았어요"로 세고 더 남았으면 "결과 더 보기"로 이어 받는다.
  - **일치 근거는 결과마다 하나**만 보인다. `matches`에서 본문 → 설명 → 제목 → 주소 순으로 먼저 있는 것을 고른다(`search/evidence.ts`). 본문·설명·주소는 `ranges`를 강조한 글을, 제목은 일치한 단어를 보인다. 요약과 "뜻이 비슷해요" 근거는 요약·의미 검색이 생길 때 붙인다.
  - **결과에서의 보관·삭제:** 보관은 Inbox인 결과에만 있고 되돌리기가 없다 — 보관됨 → Inbox 전이가 없다(§4). 보관한 결과는 그대로 남는다. 삭제는 확인을 거쳐 휴지통으로 보내고, 알림이 떠 있는 동안(4.5초) 되돌리면 복구 API로 삭제 전 상태와 결과의 제자리로 돌아온다. 삭제·복구는 홈의 목록에도 반영한다(`LibraryProvider`). 검색 상태는 `/app` 레이아웃의 `SearchProvider`에, 알림은 `ToastProvider`에 있다.
- **링크 소멸 콘텐츠는 요약·임베딩을 건너뛴다.** **[원문 4.1]**

## 6. 재노출의 책임

| 책임 | 위치 |
| --- | --- |
| 선정 규칙(순수 함수: 후보와 설정을 받아 회차를 돌려준다) | `packages/core` **[제안]** |
| 주기 실행, 회차 저장 | `apps/worker` 스케줄러 |
| 홈 피드 조회, 카드 액션 반영 | `apps/api` |
| 피드 표시와 액션 UI | `apps/web`, `apps/mobile` |
| 푸시 발송 | `apps/worker` → 푸시 서비스(미정) → `apps/mobile` |
| 노출·액션 이벤트 기록(H2 판단 지표) | `apps/api` — 계측 저장 방식은 미정(**D-18**) |

선정은 규칙 기반이다(P0). 규칙은 [resurfacing](features/resurfacing.md)에 있다.

## 7. 비용 통제와 사용량 집행

상품 정책(한도 수치)은 [billing](features/billing.md)에 있다. 여기는 **어디서 집행하는가**만 적는다.

| 장치 | 집행 위치 |
| --- | --- |
| 저장 개수 한도 | `apps/api` — 저장 요청 시점 |
| 가져오기 개수·횟수 한도 | `apps/api` — 가져오기 접수 시점 |
| AI 요약·임베딩 월 한도 | `apps/worker` — 잡을 실행하기 직전. 초과분은 메타데이터만 유지 |
| 본문 입력 토큰 상한(예: 4,000) | `apps/worker` — 요약 잡 |
| 링크 소멸 콘텐츠 AI 생략 | `apps/worker` — 링크 생존 확인이 요약보다 앞선다 |
| 동일 URL 요약·임베딩 캐시 공유(공개 페이지 한정) | `apps/worker` — 공개 판정은 D-12 |
| 대량 가져오기 순차 처리(최근 북마크부터) | `apps/worker` — 큐 우선순위 |

한도는 클라이언트가 아니라 서버에서만 집행한다. 클라이언트는 남은 한도를 표시할 뿐이다. 한도 초과 시의 사용자 동작은 **D-03**.

목표 단위 경제: Pro 사용자 1인당 월 AI 비용 ≤ 구독료의 15%. 건당 비용은 Phase 2에서 측정해 기록한다.

## 8. 개인정보

- **대기 명단 설문 응답 (구현됨, [waitlist](features/waitlist.md)):** `PUT /waitlist/responses/:id`는 로그인 없이 받는다. `:id`는 브라우저가 만든 UUID이고, 요청은 지금까지의 답 전체다 — 없으면 만들고 있으면 덮어쓴다(보내지 않은 답은 비운다). 이메일만 예외로, 이메일 없는 요청은 저장된 이메일을 지우지 않는다. 성공은 본문 없는 204다.
  - 저장된 이메일과 답을 돌려주는 경로는 없다. ID를 아는 쪽은 그 응답을 덮어쓸 수 있을 뿐 읽을 수 없다.
  - `waitlist_responses`는 `users`와 무관하다. 이메일은 앞뒤 공백을 떼고 소문자로 저장하며 유일하지 않다. 답은 화면 문구가 아닌 고정 키이고(`api-contract`의 `WAITLIST_*`), DB의 check 제약이 같은 목록을 강제한다. 질문 넷은 모두 하나만 고르고, 답이 `other`일 때만 방문자가 적은 글(`…_other`, 500자까지)이 함께 남는다. 방문자가 본 언어·헤드라인·히어로 그림도 남는다.
  - 요청 제한: 이 경로에만 IP당 1분 60회(`@fastify/rate-limit`, 메모리 저장 — API 인스턴스가 여럿이면 인스턴스마다 따로 센다). 넘으면 429 `RATE_LIMITED`. 요청 본문은 4KB까지다. 프록시 뒤에 배포할 때는 `TRUST_PROXY=true`로 프록시가 넘긴 주소를 요청자로 본다 — 직접 노출된 서버에서 켜면 주소를 속여 제한을 피할 수 있다.
  - **웹의 `/api` (2026-11-19, waitlist WAIT-11):** 배포된 랜딩은 API 서버 없이 뜬다. 같은 계약의 `PUT /api/waitlist/responses/:id`가 웹(Next.js route handler, `apps/web/src/server/`)에 있고 `@rebomi/db`로 직접 저장한다 — 웹이 DB에 닿는 곳은 이것 하나다. 요청을 저장할 값으로 바꾸는 규칙(`waitlistAnswersOf`)은 `api-contract`에 한 번만 있고 두 서버가 함께 쓴다. 웹은 서버 환경변수 `DATABASE_URL`이 있을 때만 이 경로로 저장하고(없으면 503), 랜딩이 어디로 보낼지는 `NEXT_PUBLIC_API_BASE_URL`이 정한다 — 로컬은 API 서버, 배포는 자기 오리진의 `/api`. 이 경로에는 메모리 요청 제한이 없다(서버리스 인스턴스는 메모리를 나누지 않는다). 제한은 배포 쪽 방화벽에서 건다 — Vercel Firewall의 규칙 `waitlist rate limit`: 경로에 `/api/waitlist/`가 들어 있으면 IP당 60초에 60회, 넘으면 429(2026-11-19 설정. 코드가 아니라 Vercel 대시보드에 있다).
  - **수집 고지와 보관 (2026-11-19, waitlist WAIT-12):** 이메일 단계에 수집 항목·목적·보관 기간(1년)·삭제 요청 주소를 적는다. 1년 뒤 지우는 작업은 아직 없다(**D-19**).
  - **웹의 랜딩 (`apps/web/src/landing/`, 2026-11-17):** `/`는 요청마다 서버에서 그린다 — 헤드라인과 히어로 그림을 `?h=`·`?hero=`로 정하기 때문이다. 언어는 지금 영어 고정이다(`LANDING_LOCALE`, 2026-11-20 — 그 전에는 `Accept-Language`로 골랐다). 등록 대화상자만 브라우저에서 돌고, 저장 요청은 브라우저가 `api-client`로 직접 보낸다(로컬은 API 서버, 배포는 웹의 `/api`). 응답 ID는 대화상자가 처음 열릴 때 브라우저가 만들어 페이지가 떠 있는 동안만 쥔다(저장소에 두지 않는다). 저장 요청은 한 번에 하나만 보내고, 보내는 중에 답이 바뀌면 끝난 뒤 최신 상태를 한 번 더 보낸다 — 요청마다 답 전체를 싣기 때문에 순서가 바뀌어 도착하면 옛 답이 새 답을 덮는다.
  - **웹의 최상위 레이아웃은 둘이다.** `(site)`(랜딩)는 Tailwind와 디자인 토큰(`globals.css`, 톤 "웜 페이퍼", 라이트·다크는 기기 설정)을 쓰고, `(product)`(`/login`, `/app`)는 아직 인라인 스타일이라 Tailwind를 불러오지 않는다. 그쪽에 디자인을 입힐 때 합친다. 두 레이아웃 사이를 오가면 페이지 전체를 새로 불러온다.

- 클라이언트 캡처는 로그인·페이월 뒤 본문까지 서버에 저장한다. 캡처 전 안내는 두지 않고, 저장 결과의 추출 수준 표시와 스토어 등록정보·개인정보처리방침으로 알린다([capture](features/capture.md) §5 "본문 저장 고지", 2026-11-13 결정 — 원문 11.8의 사전 안내를 대체).
- 서버가 가져온 페이지의 원본 HTML은 저장하지 않는다. 추출한 본문 텍스트만 저장하고, 콘텐츠를 지우면 함께 지운다.
- 외부 AI로 본문을 보낼 때의 데이터 정책을 명시한다.
- 내보내기·삭제 지원 범위는 D-06.

## 9. 확정 기술과 검증할 후보

원문 PRD에 기술명이 있다는 이유만으로 도입을 확정하지 않는다. "확정"은 저장소에 실제로 들어와 있는 것이다.

| 영역 | 확정 (저장소에 있음) | 후보·미정 (원문 언급) | 결정 시점 |
| --- | --- | --- | --- |
| 워크스페이스·언어 | pnpm 11, Turborepo, TypeScript strict ESM | — | — |
| API | Fastify 5 + Zod 4 | — | — |
| DB·ORM | PostgreSQL, Drizzle | — | — |
| 잡 큐 | pg-boss | — | 교체 지점은 `apps/worker` 내부 |
| 서버 본문 추출 | `@mozilla/readability` + `linkedom` (규칙 기반) | AI 추출 보완 | H4(서버 추출 성공률) 측정 뒤 |
| 키워드 검색 | PGroonga로 구현됨(인덱스·쿼리, §5). 엔진 확정은 아니다 | 대안 pg_bigm | Phase 2 평가 |
| 의미 검색 | pgvector 확장 활성화됨(인덱스·쿼리는 없음) | 임베딩 모델: bge-m3, 대안 multilingual-e5-large. 호스팅 방식 미정 | Phase 2, 한·영 혼합 쿼리 100개 비교 |
| 결과 결합 | — | RRF | 검색 구현 시 |
| 요약 LLM | — | "저비용 모델" — 제공자·모델 미정 | 요약 구현 시, 건당 비용 측정 |
| 웹 | Next.js 16, Tailwind CSS 4, Pretendard 가변 글꼴(로컬 파일) | — | — |
| 확장 | Vite + @crxjs, MV3. 본문 추출 `@mozilla/readability`(워커와 같은 라이브러리) | — | — |
| 모바일 | Expo SDK 58 | iOS Share Extension + App Group, Android Share Intent 구현 방식(Expo config plugin 등) 미정 | capture 구현 시 |
| 인증 | 직접 구현, Google·Apple 소셜 로그인, 액세스(JWT HS256)+갱신 토큰, `jose`, `@fastify/cookie` (§3) | — | — |
| 푸시 | — | "모바일 푸시 알림 서비스" — 제공자 미정 | resurfacing 푸시 구현 시 |
| 결제 | — | Stripe 또는 앱 내 결제 (D-10) | billing 구현 시 |
| 테스트 | Vitest (실제 Postgres) | E2E 도구 미정 | 첫 사용자 흐름 연결 검증 시 |

**PRD와 저장소의 차이 (어느 쪽이 맞는지 단정하지 않는다)**

- PRD 8장은 서버를 "공통 API 서버"로만 적는다. 저장소는 `api`와 `worker`를 별도 앱으로 나눴다(스캐폴드 스펙 3장의 결정).
- PRD는 Chrome 확장을 "React + TypeScript + Readability"로 적는다. 저장소도 그렇다 — Readability는 확장의 본문 추출에 쓴다(§5).
- PRD 4.1은 중복 URL 감지를 "정규화된 URL 기준, 트래킹 파라미터 제거"로 적는다. `core.normalizeUrl`은 `utm_*`, `fbclid`, `gclid`, `igshid`, `ref`만 제거한다. 이 목록이 충분한지는 capture 구현 시 확인한다.

대규모 검색 전용 인프라나 복잡한 RAG 아키텍처는 처음부터 도입하지 않는다. **[원문 8장]**
