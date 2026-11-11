# 소셜 로그인과 액세스·갱신 토큰 — 설계 (Issue #2)

기준: Issue #2, `docs/features/account.md` §2·§4, `docs/architecture.md` §2·§3.

표기: **[결정]** 은 사용자가 2026-11-11에 정한 것, **[구현 판단]** 은 구현자가 정한 것이다.

## 1. 목표와 범위 밖

Google·Apple 신원 토큰으로 로그인해 서버가 발급한 액세스·갱신 토큰을 받고, API가 액세스 토큰으로 요청한 사용자를 안다.

하지 않는 것: 로그인 화면, 확장·모바일의 로그인 흐름(D-08), nonce 검증(클라이언트 흐름이 정해지는 로그인 화면 Issue에서), 수동 계정 연결·분리, 계정 삭제. 개발용 우회 로그인은 만들지 않는다(account §4).

## 2. 토큰

| 항목 | 값 |
| --- | --- |
| 액세스 토큰 | **[결정]** 서명된 JWT(HS256, 서버 비밀키 `AUTH_JWT_SECRET`), 수명 15분. 요청마다 DB를 조회하지 않는다. 로그아웃해도 이미 발급된 것은 만료까지 유효하다 |
| 액세스 토큰 클레임 | **[구현 판단]** `sub`=사용자 ID, `iss`=`rebomi`, `aud`=`rebomi-api`, `iat`, `exp` |
| 갱신 토큰 | **[구현 판단]** 256비트 난수(base64url). DB에는 SHA-256 해시만 저장한다 |
| 갱신 토큰 수명 | **[결정]** 60일. 갱신에 쓸 때마다 그 시점부터 60일로 연장 |
| 회전 | **[결정]** 없음. 로그아웃·만료 전까지 같은 갱신 토큰을 쓴다(여러 탭·공유 확장의 동시 갱신이 서로를 끊지 않게) |
| 라이브러리 | **[구현 판단]** `jose` — 액세스 토큰 서명·검증과 제공자 JWKS 검증에 같이 쓴다 |

## 3. 엔드포인트 (계약은 `packages/api-contract/src/auth.ts`)

| 경로 | 요청 | 응답 |
| --- | --- | --- |
| `POST /auth/login` | `{ provider: 'google' \| 'apple', idToken, session?: 'body' \| 'cookie' }` (기본 `body`) | 200 `{ accessToken, expiresIn, refreshToken, user: { id, email } }` |
| `POST /auth/refresh` | `{ refreshToken? }` | 200 `{ accessToken, expiresIn }` |
| `POST /auth/logout` | `{ refreshToken? }` | 204. 모르는 토큰이어도 204(멱등) |

`expiresIn`은 초 단위다.

**[결정] 갱신 토큰 전달 두 가지**

- `session: 'body'`(확장·모바일): `refreshToken`이 응답 본문에 온다.
- `session: 'cookie'`(웹): 본문의 `refreshToken`은 `null`이고, `rebomi_refresh` 쿠키로만 준다 — `HttpOnly`, `SameSite=Lax`, `Path=/auth`, `Max-Age` 60일, 운영(`NODE_ENV=production`)에서 `Secure`. 액세스 토큰은 본문으로 주고 웹은 메모리에만 둔다.
- 전제: 웹과 API가 같은 사이트(같은 등록 도메인)에 배포된다. 다르면 브라우저가 쿠키를 막는다.
- 갱신·로그아웃은 본문에 `refreshToken`이 있으면 그것을, 없으면 쿠키를 쓴다. **쿠키를 쓰는 요청은 `Origin` 헤더가 `CORS_ORIGINS`에 있을 때만 받는다**(없거나 다르면 403). 갱신할 때 쿠키의 `Max-Age`도 다시 60일로 내려 준다. 로그아웃은 쿠키를 지운다.

## 4. 에러 코드 **[결정]**

`ERROR_CODES`에 추가한다.

| 코드 | 상태 | 언제 |
| --- | --- | --- |
| `UNAUTHORIZED` (기존) | 401 | 액세스 토큰이 없거나 형식·서명이 틀림 |
| `ACCESS_TOKEN_EXPIRED` | 401 | 액세스 토큰 만료. `api-client`는 이 코드일 때만 자동 갱신한다 |
| `INVALID_PROVIDER_TOKEN` | 401 | 제공자 신원 토큰의 서명·만료·issuer·audience 검증 실패 |
| `REFRESH_TOKEN_EXPIRED` | 401 | 갱신 토큰 만료 |
| `REFRESH_TOKEN_INVALID` | 401 | 폐기되었거나 모르는 갱신 토큰, 또는 갱신 토큰이 본문·쿠키 어디에도 없음 |
| `EMAIL_NOT_VERIFIED` | 403 | 처음 보는 신원인데 제공자가 검증한 이메일이 없음(§6) |
| `PROVIDER_NOT_CONFIGURED` | 503 | 그 제공자의 클라이언트 ID가 서버에 설정되지 않음 |

거부 사유의 세부(어느 검증이 실패했는지)는 응답에 넣지 않고 서버 로그에만 남긴다. 허용되지 않은 Origin의 쿠키 요청은 기존 403 매핑(`BAD_REQUEST`)을 쓴다 **[구현 판단]**.

## 5. 제공자 신원 토큰 검증

`apps/api/src/auth/providers.ts`. 검증기는 `(idToken) => Promise<{ subject, email, emailVerified }>` 이고 `buildApp`에 주입된다.

| | Google | Apple |
| --- | --- | --- |
| JWKS | `https://www.googleapis.com/oauth2/v3/certs` | `https://appleid.apple.com/auth/keys` |
| issuer | `https://accounts.google.com`, `accounts.google.com` | `https://appleid.apple.com` |
| audience | `GOOGLE_CLIENT_IDS` 중 하나 | `APPLE_CLIENT_IDS` 중 하나(Service ID, 앱 번들 ID) |
| 알고리즘 | RS256 | RS256 |

- 클라이언트 ID가 여러 개인 이유: 웹·iOS·Android가 서로 다른 ID로 토큰을 받는다.
- Apple의 `email_verified`는 문자열 `"true"`로 올 수 있어 불리언과 문자열을 모두 받는다.
- 신원 토큰만 검증하므로 Apple 비밀키(.p8)·Team ID는 서버에 필요 없다.
- 테스트는 실제 검증기 팩토리에 테스트용 키로 만든 로컬 JWKS를 넣는다. 서명·만료·audience 검증은 운영과 같은 코드를 지난다.

## 6. 계정 찾기·만들기

1. `(provider, subject)`로 신원을 찾으면 그 계정.
2. 없고 이메일이 검증됐으면, 소문자로 맞춘 이메일로 계정을 찾아 신원을 붙인다(ACC-7). 없으면 계정과 신원을 만든다.
3. 이메일이 검증되지 않았거나 없으면 **[결정]** 로그인을 거부한다(403 `EMAIL_NOT_VERIFIED`). 계정도 신원도 만들지 않는다. 이미 신원이 있는 경우(1번)는 이메일 검증 여부와 무관하게 로그인된다. `users.email`은 NOT NULL + UNIQUE 그대로다.

한 트랜잭션에서 한다. 동시 첫 로그인으로 유일 제약이 터지면 한 번 다시 조회한다. 이메일은 소문자로 저장·비교한다 **[구현 판단]**.

## 7. DB (`packages/db`, 마이그레이션 `0003_auth`)

- `auth_identities`: `id`, `user_id`(FK, cascade), `provider`(text + check `google`/`apple`), `subject`, `email`(제공자가 준 값, nullable), `created_at`. 유일 `(provider, subject)`.
- `refresh_tokens`: `id`, `user_id`(FK, cascade), `token_hash`(unique), `expires_at`, `revoked_at`(nullable), `last_used_at`, `created_at`.

## 8. API 구조 (`apps/api`)

- `src/auth/tokens.ts` — 액세스 토큰 서명·검증, 갱신 토큰 생성·해시.
- `src/auth/providers.ts` — §5.
- `src/auth/accounts.ts` — §6과 갱신 토큰 저장·조회·폐기 질의.
- `src/routes/auth.ts` — 세 경로. 응답은 계약의 JSON 스키마로 직렬화.
- `src/auth.ts`의 `requireAuth` — 액세스 토큰을 검증해 `request.userId`를 채운다. 실패 코드는 §4.
- `buildApp` deps에 `auth: { jwtSecret, verifiers: { google?, apple? }, secureCookies, now? }` 추가. `server.ts`만 env를 읽어 조립한다.
- 쿠키는 `@fastify/cookie`.

**환경변수 [결정]** — `.env.example`에는 빈 키만 둔다.

| 키 | 규칙 |
| --- | --- |
| `AUTH_JWT_SECRET` | 필수, 32자 이상. 없으면 기동 실패 |
| `GOOGLE_CLIENT_IDS`, `APPLE_CLIENT_IDS` | 쉼표 구분, 선택. 비어 있으면 서버는 뜨고 그 제공자 로그인만 503 `PROVIDER_NOT_CONFIGURED`. 기동 시 경고 로그 |

**로그** — 요청 본문·`Authorization`·`Cookie`·`Set-Cookie`를 로그에 쓰지 않는다. 테스트가 로거 출력을 모아 발급된 토큰 문자열이 없는지 확인한다.

## 9. `packages/api-client`

- **[결정]** `getToken`을 없애고 `tokenStore: { get(), set(tokens | null) }`(동기·비동기 모두 허용)로 바꾼다. `tokens = { accessToken, refreshToken: string | null }`.
- 옵션 `session: 'body' | 'cookie'`(기본 `body`). `cookie`면 `/auth/*` 요청에 `credentials: 'include'`를 붙이고 `refreshToken`은 `null`로 보관한다.
- 메서드: `login(provider, idToken)`, `refresh()`, `logout()`. `refresh()`를 공개하는 이유는 쿠키 방식의 웹이 새로고침 뒤 메모리에 액세스 토큰이 없을 때 세션을 되살려야 해서다 **[구현 판단]**.
- 자동 갱신: 응답이 401 `ACCESS_TOKEN_EXPIRED`면 갱신 후 원래 요청을 한 번만 다시 보낸다. 동시에 여러 요청이 만료돼도 갱신은 한 번만 나간다. 갱신이 실패하면 `tokenStore.set(null)` 하고 그 갱신 오류(`REFRESH_TOKEN_*`)를 `ApiError`로 던진다.
- `logout()`은 서버 호출이 실패해도 로컬 토큰을 지운다.

## 10. 테스트

- `apps/api`: 실제 Postgres 통합 테스트로 Issue의 완료 조건을 하나씩. 시간은 주입한 `now`로 넘긴다.
- `packages/api-client`: 모킹한 fetch로 자동 갱신·단일 갱신·갱신 실패.
- `packages/db`: 마이그레이션(빈 DB, 기존 DB)과 유일 제약.
- `packages/api-contract`: 스키마.
