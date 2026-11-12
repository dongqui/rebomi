# Rebomi — 아키텍처 기준 문서

실제 스캐폴드(2026-11-10 기준)를 근거로 한다. 제품 요구사항은 [product.md](product.md)와 [기능 문서](features/)에 있다.
스캐폴드의 설계 근거는 [스캐폴드 설계 스펙](superpowers/specs/2026-11-05-rebomi-monorepo-scaffold-design.md)에 있다.

표기: **구현됨 / 골격만 / 없음 / 확인 필요**, **[제안]** 은 원문 PRD에 없는 설계 제안, **D-xx** 는 [product.md 미결정 사항](product.md#9-미결정-사항).

## 1. 구성과 현재 상태

pnpm 11 + Turborepo 모노레포, TypeScript strict ESM, Node 22.

| 경로 | 역할 | 기술 | 현재 상태 |
| --- | --- | --- | --- |
| `apps/api` | 공개 REST API | Fastify 5, Zod 4 | **골격만.** `GET /health`(DB 핑 포함)와 인증 경로(`POST /auth/login`·`/auth/refresh`·`/auth/logout`), `requireAuth`, 콘텐츠 저장·목록(`POST /contents`·`GET /contents`). 공통 에러 핸들러와 CORS 구현됨 |
| `apps/worker` | 잡 컨슈머 + 스케줄러 | pg-boss 12, @mozilla/readability, linkedom | **구현됨(범위 작음).** `content-process` 큐를 소비해 페이지를 가져오고 제목·설명·이미지·본문을 채운다(§5). `noop` 큐와 1분 주기 스케줄. 요약·임베딩·링크 생존 확인·재노출 잡은 없음 |
| `apps/web` | 웹 앱 | Next.js 16 (App Router), React 19 | **골격만.** 루트 페이지 하나가 `/health`를 호출해 표시. 라우팅·화면·인증 없음 |
| `apps/extension` | Chrome 확장 | Vite 8 + @crxjs/vite-plugin, MV3, React 19 | **골격만.** 팝업이 `/health`를 호출. 권한은 API 오리진뿐. content script·background·저장 UI·본문 추출 없음 |
| `apps/mobile` | iOS·Android | Expo SDK 58, React Native 0.88 | **골격만.** 단일 `App.tsx`가 `/health`를 호출. 내비게이션, 공유 수신(Share Extension·Share Intent), 푸시, 네이티브 프로젝트(prebuild) 없음 |
| `packages/api-contract` | 요청·응답 Zod 스키마 | Zod 4 | **구현됨(범위 작음).** health 응답, 공통 에러 코드·에러 바디, 로그인·갱신·로그아웃 계약, 콘텐츠·저장 요청/응답·목록 쿼리/응답 스키마 |
| `packages/api-client` | 타입 세이프 HTTP 클라이언트 | fetch만 사용 | **구현됨(범위 작음).** `health()`, `login()`, `refresh()`, `logout()`, `saveContent()`, `listContents()`. 타임아웃, `tokenStore`, 액세스 토큰 만료 시 자동 갱신, `ApiError` 변환 |
| `packages/core` | 순수 도메인 로직 | — | **구현됨(범위 작음).** `normalizeUrl`(트래킹 파라미터 제거·정규화), `domainOf`, 큐 이름(`QUEUES`)·잡 페이로드 타입·재시도 정책(`CONTENT_PROCESS_RETRY`) |
| `packages/db` | Drizzle 스키마·마이그레이션 | Drizzle 0.45, pg | **골격만.** `users(id, email, created_at)`, `auth_identities`·`refresh_tokens`(§3), `contents`·`content_bodies`(§4) 테이블, PGroonga·pgvector 확장 활성화 |
| `packages/config` | tsconfig·eslint·prettier 공유 | — | 구현됨 |
| `docker/` | Postgres 이미지(PGroonga + pgvector) | compose | 구현됨 |

- **인증: 서버와 `api-client`만 구현됨(§3).** 로그인 화면과 각 클라이언트의 토큰 보관은 없다. 콘텐츠 라우트는 `requireAuth`를 지난다.
- **테스트:** Vitest. `core`, `db`, `api`, `api-client`, `worker`에 있다. DB 테스트는 실제 Postgres를 쓴다. `web`·`extension`·`mobile`에는 자동 테스트가 없다. E2E 없음.
- **CI:** `.github/workflows/ci.yml`이 push·PR마다 Postgres 이미지 빌드 → migrate → lint → typecheck → test → build를 돌린다. 모바일 네이티브 빌드(EAS) 없음.
- **환경 설정:** 루트 `.env` 하나(`.env.example`). 값이 없으면 각 앱이 기동 시 실패한다. 예외는 `GOOGLE_CLIENT_IDS`·`APPLE_CLIENT_IDS`로, 비어 있어도 API는 뜨고 그 제공자의 로그인만 503이다.
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
| 토큰 보관·전달, 만료 시 자동 갱신 | 각 클라이언트가 `api-client`의 `tokenStore`(`get`/`set`)를 구현 (확장 `chrome.storage`, 모바일 `SecureStore`). 웹은 메모리 + 쿠키 | `api-client` 구현됨. 클라이언트별 저장소 없음 |
| 공유 확장과 메인 앱의 세션 공유 | iOS App Group, Android 공유 저장소 **[원문]** | 없음 |
| 기기 간 동기화 | 서버가 단일 원본. 클라이언트는 서버 상태를 조회한다 **[제안]** — 오프라인 편집·충돌 해결은 요구되지 않았다 | 없음 |

로그인은 Google·Apple 소셜 로그인이고, 검증된 이메일이 같으면 같은 계정이다. 제품 규칙은 [account](features/account.md) §4에 있다. 확장·모바일의 로그인 방식과 "동기화"의 반영 시점은 **D-08**로 남아 있다.

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
| `body`(기본) | 확장, 모바일 | 응답 본문 |
| `cookie` | 웹 | `rebomi_refresh` 쿠키로만 — `HttpOnly`, `SameSite=Lax`, `Path=/auth`, `Max-Age` 60일, 운영(`NODE_ENV=production`)에서 `Secure`. 본문의 `refreshToken`은 `null` |

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

**[제안] 전이 규칙** — 원문에서 직접 읽히는 것만 적는다. 나머지는 해당 Issue의 설계에서 정하고 이 표에 추가한다.

| 전이 | 조건 |
| --- | --- |
| Inbox → 보관됨 | 사용자의 보관 액션, 또는 30일 경과 |
| Inbox·보관됨 → 휴지통 | 사용자의 삭제 액션 |
| 휴지통 → 이전 상태 | 삭제 복구 (복구 시 어느 상태로 돌아가는지는 원문에 없다 — 설계에서 결정) |
| 휴지통 → 영구 삭제 | 30일 경과 |
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
- **저장 API (`POST /contents`, 구현됨):** `core.normalizeUrl`로 정규화하고 `(user_id, normalized_url)` 유일 제약으로 중복을 판정한다. 새로 저장하면 201, 이미 있으면 200이고 본문은 둘 다 `{ status: 'created' | 'duplicate', content }`다 — 중복은 오류가 아니며 기존 콘텐츠를 그대로 준다(두 번째 요청의 URL·출처로 덮어쓰지 않는다). http(s)가 아닌 입력은 400 `VALIDATION_FAILED`. `domain`은 호스트에서 앞의 `www.`만 뗀 값이다. 지금은 URL만 받는다 — 본문을 함께 받는 저장은 확장·모바일 Issue에서 더한다.
- **행과 잡은 한 트랜잭션이다.** api는 콘텐츠 행 삽입과 `content-process` 잡 삽입을 같은 DB 트랜잭션에서 한다(`Db.transaction` + pg-boss `send`의 `db` 옵션). 잡을 넣지 못하면 행도 남지 않는다 — 행만 남으면 그 콘텐츠는 영원히 처리 중이고, 다시 저장해도 중복이라 고칠 길이 없다. api의 pg-boss는 보내기 전용이고(유지보수·스케줄 꺼짐) 소비는 worker가 한다.
- **콘텐츠 처리 잡 (`content-process`, 구현됨):** 워커가 저장된 URL을 가져와 제목(`og:title` → `<title>`), 설명(`og:description` → meta description), 이미지(`og:image` → `twitter:image`, 절대 http(s) 주소)와 본문을 채운다. 저장한 쪽이 먼저 채운 값은 덮어쓰지 않는다. 처리 중인(`metadata_status = pending`) 행만 고치므로 같은 잡이 두 번 돌아도 결과가 같다. 지금은 모든 저장이 URL만 보내므로 항상 가져온다 — 클라이언트가 본문을 보내는 저장이 생기면 그 콘텐츠는 가져오지 않게 해야 한다.
  - **본문 추출은 규칙 기반이다(AI를 쓰지 않는다).** Readability(`@mozilla/readability` + `linkedom`)가 비어 있지 않은 결과를 내면 길이와 무관하게 본문으로 본다. 원본 HTML은 저장하지 않고 텍스트만 20만 자까지 저장한다. AI로 본문을 뽑는 보완은 서버 추출 성공률(H4)을 재 본 뒤에 판단한다.
  - **재시도:** 연결 실패·시간 초과·5xx·429 같은 일시 오류만 최대 3번(30초부터 두 배씩) 다시 한다. 그 밖의 4xx, HTML이 아닌 응답, 5MB 초과, 리다이렉트 5번 초과, 차단된 주소는 바로 실패로 기록한다. 마지막 시도까지 실패하면 실패로 기록하고 잡은 끝낸다 — 워커는 계속 돈다.
  - **나가는 요청의 제한:** 주소는 사용자 입력이라 믿지 않는다. 사설·루프백·링크 로컬 주소로는 연결하지 않고(연결 직전의 DNS 결과로 판정), 리다이렉트는 직접 따라가며 매번 다시 검사한다. 요청 전체 10초, 응답 5MB(압축을 푼 크기). User-Agent는 `Mozilla/5.0 (compatible; RebomiBot/0.1)`로 봇임을 밝힌다. robots.txt는 확인하지 않는다 — 사용자가 저장한 주소 하나만 가져온다. 로그에는 콘텐츠 ID와 실패 사유만 남기고 주소는 남기지 않는다.
- **목록 API (`GET /contents`, 구현됨):** 요청한 사용자의 콘텐츠 중 휴지통을 뺀 것을 저장일 최근순으로 준다. `limit`(기본 50, 최대 100)과 `cursor`를 받고 `{ items, nextCursor }`를 준다. 커서는 `(saved_at, id)` 키셋이고 클라이언트에게는 불투명한 문자열이다 — 중간에 새 저장이 끼어도 건너뛰거나 겹치지 않는다. 상태별 필터와 오래된 순 정렬은 아직 없다.
- **검색 대상:** 제목, URL·도메인, 요약, 메모, 추출된 본문. 긴 본문은 청크 단위로 임베딩해 매칭 근거 문장을 제시한다. **[원문 8장]**
- **링크 소멸 콘텐츠는 요약·임베딩을 건너뛴다.** **[원문 4.1]**

## 6. 재노출의 책임

| 책임 | 위치 |
| --- | --- |
| 선정 규칙(순수 함수: 후보와 설정을 받아 회차를 돌려준다) | `packages/core` **[제안]** |
| 주기 실행, 회차 저장 | `apps/worker` 스케줄러 |
| 홈 피드 조회, 카드 액션 반영 | `apps/api` |
| 피드 표시와 액션 UI | `apps/web`, `apps/mobile` |
| 푸시 발송 | `apps/worker` → 푸시 서비스(미정) → `apps/mobile` |
| 노출·액션 이벤트 기록(H2 판단 지표) | `apps/api` — 계측 저장 방식은 미정 |

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

- 클라이언트 캡처는 로그인·페이월 뒤 본문까지 서버에 저장한다. 캡처 전에 "이 페이지 본문도 저장됩니다"를 안내한다. **[원문 11.8]**
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
| 키워드 검색 | PGroonga 확장 활성화됨(인덱스·쿼리는 없음) | 대안 pg_bigm | Phase 2 평가 |
| 의미 검색 | pgvector 확장 활성화됨(인덱스·쿼리는 없음) | 임베딩 모델: bge-m3, 대안 multilingual-e5-large. 호스팅 방식 미정 | Phase 2, 한·영 혼합 쿼리 100개 비교 |
| 결과 결합 | — | RRF | 검색 구현 시 |
| 요약 LLM | — | "저비용 모델" — 제공자·모델 미정 | 요약 구현 시, 건당 비용 측정 |
| 웹 | Next.js 16 | — | — |
| 확장 | Vite + @crxjs, MV3 | 본문 추출: Readability 계열 라이브러리(미설치) | capture 구현 시 |
| 모바일 | Expo SDK 58 | iOS Share Extension + App Group, Android Share Intent 구현 방식(Expo config plugin 등) 미정 | capture 구현 시 |
| 인증 | 직접 구현, Google·Apple 소셜 로그인, 액세스(JWT HS256)+갱신 토큰, `jose`, `@fastify/cookie` (§3) | — | — |
| 푸시 | — | "모바일 푸시 알림 서비스" — 제공자 미정 | resurfacing 푸시 구현 시 |
| 결제 | — | Stripe 또는 앱 내 결제 (D-10) | billing 구현 시 |
| 테스트 | Vitest (실제 Postgres) | E2E 도구 미정 | 첫 사용자 흐름 연결 검증 시 |

**PRD와 저장소의 차이 (어느 쪽이 맞는지 단정하지 않는다)**

- PRD 8장은 서버를 "공통 API 서버"로만 적는다. 저장소는 `api`와 `worker`를 별도 앱으로 나눴다(스캐폴드 스펙 3장의 결정).
- PRD는 Chrome 확장을 "React + TypeScript + Readability"로 적는다. 저장소에는 React + TypeScript만 있고 Readability는 설치되지 않았다.
- PRD 4.1은 중복 URL 감지를 "정규화된 URL 기준, 트래킹 파라미터 제거"로 적는다. `core.normalizeUrl`은 `utm_*`, `fbclid`, `gclid`, `igshid`, `ref`만 제거한다. 이 목록이 충분한지는 capture 구현 시 확인한다.

대규모 검색 전용 인프라나 복잡한 RAG 아키텍처는 처음부터 도입하지 않는다. **[원문 8장]**
