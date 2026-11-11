# 소셜 로그인과 액세스·갱신 토큰 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Google·Apple 신원 토큰으로 로그인해 서버가 발급한 액세스·갱신 토큰을 받고, API가 액세스 토큰으로 사용자를 식별한다 (Issue #2).

**Architecture:** 계약(`api-contract`) → DB 스키마(`db`) → API(`apps/api/src/auth/*`, `routes/auth.ts`) → 클라이언트(`api-client`). 제공자 검증기와 시계는 `buildApp`에 주입해 테스트가 로컬 키와 가짜 시간으로 실제 검증 코드를 지나게 한다.

**Tech Stack:** Fastify 5, `@fastify/cookie`, `jose`, Drizzle + Postgres, Zod 4, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-11-auth-tokens-design.md`

## Global Constraints

- 액세스 토큰: JWT HS256, 15분, `iss=rebomi`, `aud=rebomi-api`, `sub=사용자 ID`.
- 갱신 토큰: 256비트 난수 base64url, DB에는 SHA-256 해시만. 60일, 쓸 때마다 연장. 회전 없음.
- 에러 코드와 상태는 spec §4 표 그대로.
- 쿠키: `rebomi_refresh`, HttpOnly, SameSite=Lax, Path=/auth, Max-Age 60일, 운영에서 Secure.
- 토큰·`Authorization`·`Cookie`·요청 본문을 로그에 쓰지 않는다.
- `api-client`는 `fetch` 외 플랫폼 API를 쓰지 않는다. 던지는 것은 언제나 `ApiError`.
- 응답은 계약의 JSON 스키마로 직렬화한다.

## Review Focus

1. 같은 신원의 첫 로그인 두 건이 동시에 오면 계정이 하나만 생긴다 → Task 3 테스트.
2. 이메일 대소문자만 다른 Google·Apple 신원은 같은 계정이다 → Task 3 테스트.
3. 다른 서비스가 같은 비밀키 없이 만든 JWT, `alg: none` JWT는 액세스 토큰으로 통하지 않는다 → Task 3 테스트.
4. 액세스 토큰 만료로 동시에 실패한 요청 여러 개가 갱신을 한 번만 보낸다 → Task 4 테스트.
5. 갱신 후 다시 보낸 요청이 또 `ACCESS_TOKEN_EXPIRED`여도 무한히 돌지 않는다 → Task 4 테스트.

---

### Task 1: 계약과 에러 코드

**Files:** Create `packages/api-contract/src/auth.ts`, `auth.test.ts`. Modify `error.ts`, `index.ts`.

**Produces:**
- `ERROR_CODES`에 `ACCESS_TOKEN_EXPIRED`, `INVALID_PROVIDER_TOKEN`, `REFRESH_TOKEN_EXPIRED`, `REFRESH_TOKEN_INVALID`, `EMAIL_NOT_VERIFIED`, `PROVIDER_NOT_CONFIGURED`.
- `authProviderSchema`(`google`|`apple`), `sessionModeSchema`(`body`|`cookie`), `loginRequestSchema { provider, idToken(1..8192), session? }`, `loginResponseSchema { accessToken, expiresIn, refreshToken: string|null, user: { id, email } }`, `refreshRequestSchema { refreshToken? }`, `refreshResponseSchema { accessToken, expiresIn }`, `logoutRequestSchema { refreshToken? }`, 각 응답의 `*JsonSchema`, 타입.

- [ ] 스키마 테스트(잘못된 provider 거부, session 생략 허용, 응답 스키마 왕복) 작성 → 실패 확인 → 구현 → 통과 → 커밋.

### Task 2: DB 스키마

**Files:** Modify `packages/db/src/schema.ts`, `migrations.test.ts`. Create `packages/db/src/auth.test.ts`, 마이그레이션 `0003_auth`(`pnpm db:generate --name auth`).

**Produces:** `schema.authIdentities`(`id`, `userId`, `provider`, `subject`, `email`, `createdAt`; unique `(provider, subject)`; check provider), `schema.refreshTokens`(`id`, `userId`, `tokenHash` unique, `expiresAt`, `revokedAt`, `lastUsedAt`, `createdAt`), `AUTH_PROVIDERS`.

- [ ] 테스트: 같은 `(provider, subject)` 두 번 → 23505, 모르는 provider → check 위반, 사용자 삭제 시 두 테이블 행도 삭제, 마이그레이션 테스트에 새 테이블 추가 → 실패 확인 → 스키마·마이그레이션 → `pnpm db:migrate` → 통과 → 커밋.

### Task 3: API

**Files:** Create `apps/api/src/auth/tokens.ts`, `providers.ts`, `accounts.ts`, `routes/auth.ts`, `auth.test.ts`. Modify `auth.ts`, `app.ts`, `env.ts`, `server.ts`, `errors.ts`, `app.test.ts`, `package.json`, `.env.example`.

**Produces:**
- `tokens.ts`: `ACCESS_TOKEN_TTL_SECONDS = 900`, `REFRESH_TOKEN_TTL_SECONDS = 5_184_000`, `signAccessToken(secret, userId, now): Promise<string>`, `verifyAccessToken(secret, token, now): Promise<{ ok: true; userId } | { ok: false; reason: 'expired' | 'invalid' }>`, `newRefreshToken(): { token, hash }`, `hashRefreshToken(token): string`.
- `providers.ts`: `type ProviderIdentity = { subject; email: string | null; emailVerified: boolean }`, `type IdentityVerifier = (idToken: string) => Promise<ProviderIdentity>`(실패 시 `InvalidProviderTokenError`), `createIdentityVerifier({ jwks, issuers, audiences })`, `googleVerifier(clientIds)`, `appleVerifier(clientIds)`.
- `accounts.ts`: `findOrCreateUser(db, provider, identity): Promise<{ id; email } | 'email_not_verified'>`, `storeRefreshToken`, `useRefreshToken(db, hash, now): Promise<{ userId } | 'expired' | 'invalid'>`, `revokeRefreshToken`.
- `auth.ts`: `createRequireAuth(auth)` → preHandler, `request.userId: string`.
- `app.ts`: `BuildAppDeps.auth: { jwtSecret: string; verifiers: Partial<Record<AuthProvider, IdentityVerifier>>; secureCookies: boolean; now?: () => Date }`.

- [ ] Issue 완료 조건 1~11과 Review Focus 1~3, 로그 비노출 테스트를 `auth.test.ts`에 작성(테스트용 RSA 키 + `createLocalJWKSet`, 가짜 `now`) → 실패 확인 → 구현 → 통과 → 커밋.

### Task 4: api-client

**Files:** Modify `packages/api-client/src/client.ts`, `client.test.ts`, `index.ts`. `apps/web/src/lib/api.ts`는 옵션을 쓰지 않으므로 그대로.

**Produces:** `type AuthTokens = { accessToken: string; refreshToken: string | null }`, `type TokenStore = { get(): AuthTokens | null | Promise<AuthTokens | null>; set(tokens: AuthTokens | null): void | Promise<void> }`, `ApiClientOptions.tokenStore?`, `ApiClientOptions.session?`, `ApiClient.login(provider, idToken)`, `refresh()`, `logout()`.

- [ ] 테스트: 로그인이 토큰을 저장, `ACCESS_TOKEN_EXPIRED` → 갱신 → 재요청 성공, 갱신 실패 시 저장소를 비우고 `REFRESH_TOKEN_*` ApiError, Review Focus 4·5, cookie 모드의 `credentials: 'include'`, 로그아웃이 서버 실패에도 저장소를 비움 → 실패 확인 → 구현 → 통과 → 커밋.

### Task 5: 문서와 전체 검증

- [ ] `docs/architecture.md` §1 상태, §3 표·토큰 수명·저장 형태·서명 방식, `docs/features/account.md` §4·§6 갱신.
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build` → 전부 통과 → 커밋.
