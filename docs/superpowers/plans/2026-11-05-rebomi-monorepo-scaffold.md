# Rebomi 모노레포 스캐폴드 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 웹·API·워커·Chrome 확장·Expo 앱이 한 레포에서 함께 돌고, 세 클라이언트가 공유 계약 패키지로 `/health` 를 호출해 DB까지 갔다 오는 골격을 만든다. 기능 코드는 넣지 않는다.

**Architecture:** pnpm 워크스페이스 + Turborepo. `packages/api-contract` 가 서버와 클라이언트 사이 유일한 계약이고, `packages/api-client` 가 그것을 소비하는 유일한 HTTP 경로다. `apps/api` 는 HTTP 경계만, 도메인 판단은 `packages/core` 의 순수 함수에 위임한다. `apps/worker` 는 `api` 와 `core`·`db` 를 공유하되 HTTP를 띄우지 않는다.

**Tech Stack:** TypeScript 7 · Node 22 · pnpm 11 · Turborepo 2 · Fastify 5 · Next.js 16 · Expo 58 · Vite 8 + @crxjs/vite-plugin 3 · Drizzle ORM 0.45 · pg-boss 12 · Zod 4 · Vitest 5 · Postgres + PGroonga + pgvector

**Spec:** [docs/superpowers/specs/2026-11-05-rebomi-monorepo-scaffold-design.md](../specs/2026-11-05-rebomi-monorepo-scaffold-design.md)

## Global Constraints

- Node 22, pnpm 11. `package.json` 루트에 `"packageManager": "pnpm@11.25.0"`, `"engines": { "node": ">=22" }`.
- 모든 패키지 ESM (`"type": "module"`). TypeScript `strict: true`.
- 패키지 이름은 `@rebomi/<dir>`. 앱도 같은 규칙 (`@rebomi/web`, `@rebomi/api`, …).
- `packages/api-client` 는 `fetch` 외의 플랫폼 API와 Node 전용 모듈(`node:*`, `pg`, `fs`)을 import 하지 않는다. React Native 번들러가 깨지지 않게 하는 조건이다.
- 공통 에러 포맷은 `{ error: { code, message, details? } }` 로 고정. 네 클라이언트가 같은 코드로 분기하므로 나중에 바꾸면 네 곳을 고친다.
- 개발 머신은 arm64(Apple Silicon). DB 이미지는 arm64에서 빌드·기동되어야 한다.
- 각 클라이언트의 API 주소는 환경변수로만 받는다. 없으면 기동 시 즉시 실패한다 — 조용히 localhost로 폴백하지 않는다.
- 기능 구현 금지. 이 계획이 만드는 것은 골격과 `/health` 한 경로뿐이다.

## Review Focus

스펙이 전제하지만 어느 태스크의 주 테스트도 건드리지 않는, 실제로 사람을 물 가능성이 높은 입력들. 각 줄의 테스트는 해당 코드를 소유한 태스크에 넣어뒀다.

1. **`normalizeUrl` 에 URL이 아닌 문자열·`javascript:`·상대 경로가 들어온다.** 저장은 사용자가 보고 있는 아무 페이지에서나 시작되므로 이 입력은 반드시 온다. 던지는 예외가 타입 있는 `InvalidUrlError` 여야 하고, 호출자가 500으로 흘리지 않을 수 있어야 한다. → Task 1
2. **DB가 죽은 상태로 `/health` 가 호출된다.** 스펙은 `db` 필드만 말하고 이때의 HTTP 상태를 말하지 않는다. 200으로 "ok"처럼 보이면 모니터링이 장애를 못 잡는다. → Task 4
3. **`api-client` 가 JSON이 아닌 응답을 받는다** (프록시·로드밸런서가 돌려주는 HTML 503, 빈 바디). Zod 파싱 예외가 그대로 터지면 클라이언트 세 곳이 각자 try/catch를 만든다. → Task 3
4. **`Authorization` 헤더가 있지만 Bearer가 아니다** (`Basic …`, `Bearer` 뒤 빈 문자열, 소문자 `bearer`). 껍데기 단계에서 통과시켜 두면 나중에 인증을 붙일 때 이미 뚫린 자리가 된다. → Task 4
5. **워커 잡이 예외를 던진다.** 재시도 소진 후 프로세스가 죽으면 큐 전체가 멈춘다. 상주 프로세스는 잡 실패를 삼키고 살아 있어야 한다. → Task 5

---

### Task 1: 워크스페이스 뼈대 · 공유 설정 · `packages/core`

워크스페이스가 서 있고, 그 안에서 테스트되는 패키지 하나가 빌드된다는 것까지를 한 덩어리로 증명한다.

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `turbo.json`, `.gitignore`, `.npmrc`
- Create: `packages/config/package.json`, `packages/config/tsconfig.base.json`, `packages/config/eslint.config.js`, `packages/config/prettier.config.js`
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`, `packages/core/src/index.ts`, `packages/core/src/url.ts`, `packages/core/src/errors.ts`
- Test: `packages/core/src/url.test.ts`

**Interfaces:**
- Consumes: 없음 (첫 태스크)
- Produces:
  - `@rebomi/config` — `tsconfig.base.json`, `eslint.config.js`, `prettier.config.js` 를 파일로 노출. 각 패키지가 extends/import 한다.
  - `@rebomi/core` — `normalizeUrl(input: string): string`, `class InvalidUrlError extends Error`
  - 루트 스크립트: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `pnpm dev` (모두 turbo 위임). `pnpm dev` 는 `--filter '!@rebomi/mobile'` 로 web·api·worker 세 프로세스만 띄운다 — Expo는 대화형 터미널을 쓰므로 turbo 출력 다중화와 맞지 않아 `pnpm dev:mobile` 로 분리한다 (스펙 9장 4번)

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `packages/core/src/url.test.ts`

`normalizeUrl` 의 정규화 규칙은 PRD 4.1의 중복 판정 기준이다. 아래가 그 규칙의 전부다.

```ts
import { describe, it, expect } from 'vitest'
import { normalizeUrl, InvalidUrlError } from './index.js'

describe('normalizeUrl', () => {
  it('트래킹 파라미터를 제거한다', () => {
    expect(normalizeUrl('https://a.com/p?utm_source=x&id=7&fbclid=y&gclid=z&igshid=w&ref=r'))
      .toBe('https://a.com/p?id=7')
  })
  it('호스트를 소문자로, 기본 포트를 제거한다', () => {
    expect(normalizeUrl('HTTPS://A.com:443/p')).toBe('https://a.com/p')
    expect(normalizeUrl('http://a.com:80/p')).toBe('http://a.com/p')
  })
  it('프래그먼트를 제거한다', () => {
    expect(normalizeUrl('https://a.com/p#section')).toBe('https://a.com/p')
  })
  it('빈 경로의 끝 슬래시를 제거한다', () => {
    expect(normalizeUrl('https://a.com/')).toBe('https://a.com')
  })
  it('남은 쿼리 파라미터를 정렬해 순서만 다른 URL을 같게 만든다', () => {
    expect(normalizeUrl('https://a.com/p?b=2&a=1')).toBe(normalizeUrl('https://a.com/p?a=1&b=2'))
  })
  // Review Focus 1
  it('URL이 아닌 입력에 InvalidUrlError를 던진다', () => {
    for (const bad of ['', 'not a url', '/relative/path', 'a.com/p']) {
      expect(() => normalizeUrl(bad)).toThrow(InvalidUrlError)
    }
  })
  it('http·https가 아닌 스킴에 InvalidUrlError를 던진다', () => {
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'file:///etc/passwd', 'ftp://a.com/p']) {
      expect(() => normalizeUrl(bad)).toThrow(InvalidUrlError)
    }
  })
})
```

- [ ] **Step 2: 워크스페이스와 공유 설정을 만든다**

`pnpm-workspace.yaml` 은 `apps/*`, `packages/*` 를 담는다. `nodeLinker` 는 **설정하지 않는다** — Expo SDK 58은 pnpm isolated 설치를 지원하므로 기본값으로 시작하고, Task 7에서 실패할 때만 내린다.

`turbo.json` 태스크: `build`(`dependsOn: ["^build"]`, 출력 캐시), `typecheck`(`dependsOn: ["^build"]`), `lint`, `test`, `dev`(`cache: false`, `persistent: true`).

`packages/config/tsconfig.base.json`: `strict`, `module`/`moduleResolution` 을 `nodenext`, `target` `es2023`, `declaration`, `isolatedModules`, `verbatimModuleSyntax`.

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `pnpm install && pnpm --filter @rebomi/core test`
Expected: FAIL — `normalizeUrl` 을 찾을 수 없다는 해석 오류

- [ ] **Step 4: `packages/core/src/errors.ts` 에 `InvalidUrlError`, `packages/core/src/url.ts` 에 `normalizeUrl(input: string): string` 을 구현한다**

`new URL(input)` 이 던지면 `InvalidUrlError` 로 감싼다. 제거할 파라미터는 `utm_` 접두사 전체와 `fbclid`·`gclid`·`igshid`·`ref`. `index.ts` 는 두 모듈을 re-export 한다.

- [ ] **Step 5: 테스트와 전체 파이프가 통과하는 것을 확인한다**

Run: `pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 PASS. core 테스트 7개 통과.

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: pnpm 워크스페이스와 core 패키지 추가"
```

---

### Task 2: DB 이미지 · `packages/db`

**Files:**
- Create: `docker/postgres/Dockerfile`, `docker/compose.yml`, `.env.example`
- Create: `packages/db/package.json`, `packages/db/tsconfig.json`, `packages/db/drizzle.config.ts`, `packages/db/src/index.ts`, `packages/db/src/schema.ts`, `packages/db/src/client.ts`
- Create: `packages/db/migrations/0000_extensions.sql`
- Test: `packages/db/src/client.test.ts`

**Interfaces:**
- Consumes: `@rebomi/config`
- Produces:
  - `@rebomi/db` — `schema.users`, `createDb(connectionString: string): Db`, `ping(db: Db): Promise<void>`, `type Db = { drizzle: NodePgDatabase<typeof schema>, close(): Promise<void> }`
  - 루트 스크립트 `pnpm db:migrate`, `pnpm db:generate`
  - `docker compose up -d` 로 `postgres` 서비스 (포트 5432, DB `rebomi`)

- [ ] **Step 1: DB 이미지를 만들고 두 확장이 올라가는 것을 확인한다**

공식 `postgres:18` 베이스에, Groonga apt 저장소에서 `postgresql-18-pgdg-pgroonga`, PGDG에서 `postgresql-18-pgvector` 를 설치한다. 태그는 고정한다.

Run: `docker compose -f docker/compose.yml up -d --build && docker compose -f docker/compose.yml exec -T postgres psql -U rebomi -d rebomi -c "create extension pgroonga; create extension vector; select extname from pg_extension;"`
Expected: `pgroonga` 와 `vector` 가 목록에 나온다.

**arm64에서 패키지가 없으면:** `cubeplex/postgresql-pgroonga-pgvector` 의 태그 고정 이미지로 폴백하고, 폴백했다는 사실과 이유를 `docker/postgres/Dockerfile` 주석과 스펙 9장에 기록한다. 소스 빌드로 넘어가지 않는다 — 개발 환경 세팅에 쓸 시간이 아니다.

- [ ] **Step 2: 실패하는 테스트를 쓴다** — `packages/db/src/client.test.ts`

실제 Postgres를 쓴다. PGroonga·pgvector가 핵심이라 모킹하면 증명하는 바가 없다.

```ts
it('createDb로 연결해 ping이 통과한다', async () => {
  const db = createDb(process.env.DATABASE_URL!)
  await expect(ping(db)).resolves.toBeUndefined()
  await db.close()
})
it('마이그레이션이 pgroonga와 vector 확장을 활성화했다', async () => {
  const db = createDb(process.env.DATABASE_URL!)
  const rows = await db.drizzle.execute(
    sql`select extname from pg_extension where extname in ('pgroonga','vector')`,
  )
  expect(rows.rows.map((r) => r.extname).sort()).toEqual(['pgroonga', 'vector'])
  await db.close()
})
it('users 테이블에 insert하고 조회한다', async () => {
  // email unique 제약과 기본값(id, created_at)이 동작하는지
})
```

- [ ] **Step 3: 테스트가 실패하는 것을 확인한다**

Run: `pnpm --filter @rebomi/db test`
Expected: FAIL

- [ ] **Step 4: 스키마·클라이언트·마이그레이션을 구현한다**

`schema.ts` 의 `users`: `id` uuid primary key default `gen_random_uuid()`, `email` text unique not null, `createdAt` timestamptz not null default `now()`.

`0000_extensions.sql` 은 `drizzle-kit generate --custom` 으로 만들어 저널에 등록하고, `CREATE EXTENSION IF NOT EXISTS pgroonga;` 와 `CREATE EXTENSION IF NOT EXISTS vector;` 를 담는다. 둘 중 하나라도 실패하면 마이그레이션 전체가 실패해야 한다 — 확장 없는 DB로 개발이 시작되는 것을 막는다. `users` 테이블은 `drizzle-kit generate` 로 0001을 생성한다.

- [ ] **Step 5: 마이그레이션과 테스트가 통과하는 것을 확인한다**

Run: `pnpm db:migrate && pnpm --filter @rebomi/db test`
Expected: 마이그레이션 2건 적용, 테스트 3개 PASS

- [ ] **Step 6: 커밋**

```bash
git add -A
git commit -m "feat: PGroonga·pgvector 이미지와 db 패키지 추가"
```

---

### Task 3: `packages/api-contract` · `packages/api-client`

계약과 그 유일한 소비자를 함께 만든다. 계약만 있고 클라이언트가 없으면 리뷰어가 판단할 게 없다.

**Files:**
- Create: `packages/api-contract/package.json`, `packages/api-contract/tsconfig.json`, `packages/api-contract/src/index.ts`, `packages/api-contract/src/health.ts`, `packages/api-contract/src/error.ts`
- Create: `packages/api-client/package.json`, `packages/api-client/tsconfig.json`, `packages/api-client/src/index.ts`, `packages/api-client/src/client.ts`, `packages/api-client/src/error.ts`
- Test: `packages/api-client/src/client.test.ts`

**Interfaces:**
- Consumes: `@rebomi/config`
- Produces:
  - `@rebomi/api-contract` — `healthResponseSchema`, `type HealthResponse = { status: 'ok' | 'degraded', db: 'ok' | 'error', version: string }`, `apiErrorBodySchema`, `ERROR_CODES` (`VALIDATION_FAILED`, `INTERNAL`, `UNAUTHORIZED`, `NETWORK`, `MALFORMED_RESPONSE`)
  - `@rebomi/api-client` — `createApiClient(opts: { baseUrl: string, getToken?: () => string | null }): ApiClient`, `ApiClient.health(): Promise<HealthResponse>`, `class ApiError extends Error { code: string; status: number | null }`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `packages/api-client/src/client.test.ts`

`health()` 는 200과 503 **둘 다** 파싱해서 반환한다. 던지지 않는다 — degraded 상태를 화면에 보여줘야 하므로 예외로 만들면 쓸 수 없다. 이 결정이 테스트에 박혀 있어야 한다.

```ts
it('200 응답을 파싱해 반환한다', async () => { /* status:'ok', db:'ok' */ })
it('503 degraded 응답도 던지지 않고 반환한다', async () => {
  // fetch mock: 503 + { status:'degraded', db:'error', version:'…' }
  // → resolves, result.db === 'error'
})
it('4xx 에러 바디를 code가 담긴 ApiError로 던진다', async () => {
  // 401 + { error: { code:'UNAUTHORIZED', message:'…' } }
  // → rejects, err.code === 'UNAUTHORIZED', err.status === 401
})
it('fetch가 거부되면 NETWORK 코드의 ApiError를 던진다', async () => {
  // → err.code === 'NETWORK', err.status === null
})
// Review Focus 3
it('JSON이 아닌 응답을 MALFORMED_RESPONSE ApiError로 바꾼다', async () => {
  // 503 + text/html '<html>502 Bad Gateway</html>', 그리고 200 + 빈 바디
  // → 두 경우 모두 rejects, err.code === 'MALFORMED_RESPONSE' (Zod/SyntaxError가 새어나오지 않는다)
})
it('getToken이 값을 주면 Authorization 헤더를 붙인다', async () => {
  // → 'Bearer t0ken'
})
it('getToken이 null을 주면 Authorization 헤더를 붙이지 않는다', async () => {})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `pnpm --filter @rebomi/api-client test`
Expected: FAIL

- [ ] **Step 3: `api-contract` 의 스키마와 `api-client` 의 `createApiClient`·`ApiError` 를 구현한다**

`client.ts` 는 요청·응답·에러 변환을 한 군데(`request()` private 함수)에 모아 엔드포인트가 늘어도 이 로직이 복제되지 않게 한다. `fetch` 외의 전역을 쓰지 않는다 (Global Constraints).

- [ ] **Step 4: 테스트가 통과하는 것을 확인한다**

Run: `pnpm --filter @rebomi/api-client test && pnpm typecheck`
Expected: 테스트 7개 PASS

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: API 계약과 공용 클라이언트 추가"
```

---

### Task 4: `apps/api`

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/src/app.ts`, `apps/api/src/server.ts`, `apps/api/src/env.ts`, `apps/api/src/routes/health.ts`, `apps/api/src/auth.ts`, `apps/api/src/errors.ts`
- Test: `apps/api/src/app.test.ts`

**Interfaces:**
- Consumes: `@rebomi/db` (`createDb`, `ping`), `@rebomi/api-contract`, `@rebomi/core`
- Produces: `buildApp(deps: { db: Db }): FastifyInstance`, `requireAuth` preHandler

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `apps/api/src/app.test.ts`

Fastify `inject` 로 포트를 열지 않고 돌린다. DB는 실제 테스트 DB.

```ts
it('GET /health가 200과 ok 상태를 반환한다', async () => {
  // status:'ok', db:'ok', version: package.json의 버전
  // healthResponseSchema.parse(body)가 통과한다 — 계약과 실제 응답이 일치함을 증명
})
// Review Focus 2
it('DB가 죽으면 503과 degraded를 반환한다', async () => {
  // ping이 거부되는 db 더블을 주입
  // → statusCode 503, body.status === 'degraded', body.db === 'error'
  // 200이 아니어야 한다. 모니터링이 장애를 잡을 수 있어야 하므로.
})
it('처리되지 않은 예외를 INTERNAL 포맷으로 바꾸고 스택을 응답에 넣지 않는다', async () => {
  // → 500, body.error.code === 'INTERNAL', JSON.stringify(body)에 'at ' 스택 흔적이 없다
})
// Review Focus 4
it('requireAuth가 잘못된 Authorization 헤더를 401로 막는다', async () => {
  // 테스트용으로만 requireAuth를 붙인 라우트에
  // 헤더 없음 / 'Basic abc' / 'Bearer' / 'Bearer   ' / 'bearer t'
  // → 앞 네 개는 401 UNAUTHORIZED. 'bearer t'는 소문자 스킴도 허용(RFC 7235) → 통과
})
it('허용 오리진에 CORS 헤더를 붙인다', async () => {
  // OPTIONS 프리플라이트 → access-control-allow-origin.
  // 확장(chrome-extension://)과 웹이 같은 API를 쓰므로 필요.
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `pnpm --filter @rebomi/api test`
Expected: FAIL

- [ ] **Step 3: `env.ts`·`app.ts`·`auth.ts`·`routes/health.ts` 를 구현한다**

`env.ts` 는 Zod로 `DATABASE_URL`·`PORT`·`CORS_ORIGINS` 를 파싱하고 실패 시 즉시 `process.exit(1)`. `app.ts` 의 `buildApp` 은 `db` 를 주입받아 테스트가 더블을 끼울 수 있게 한다 — `server.ts` 만 실제 `createDb` 를 호출한다. `setErrorHandler` 가 Zod 오류를 400 `VALIDATION_FAILED` 로, 나머지를 500 `INTERNAL` 로 바꾸고 스택은 로거로만 보낸다.

- [ ] **Step 4: 테스트가 통과하고 서버가 뜨는 것을 확인한다**

Run: `pnpm --filter @rebomi/api test` 그리고 `pnpm --filter @rebomi/api dev` 후 `curl -s localhost:3001/health`
Expected: 테스트 5개 PASS. curl이 `{"status":"ok","db":"ok","version":"…"}`

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: Fastify API 서버와 health 엔드포인트 추가"
```

---

### Task 5: `apps/worker`

**Files:**
- Create: `apps/worker/package.json`, `apps/worker/tsconfig.json`, `apps/worker/src/index.ts`, `apps/worker/src/env.ts`, `apps/worker/src/jobs/noop.ts`
- Test: `apps/worker/src/jobs/noop.test.ts`

**Interfaces:**
- Consumes: `@rebomi/db` (connection string만), pg-boss
- Produces: `startWorker(opts: { connectionString: string }): Promise<{ stop(): Promise<void> }>`, 큐 이름 상수 `QUEUES.NOOP`

- [ ] **Step 1: 실패하는 테스트를 쓴다** — `apps/worker/src/jobs/noop.test.ts`

```ts
it('큐에 넣은 noop 잡을 핸들러가 처리한다', async () => {
  // startWorker → boss.send(QUEUES.NOOP, { n: 1 }) → 핸들러가 호출될 때까지 대기
  // → 핸들러가 payload { n: 1 }로 정확히 한 번 호출된다
})
// Review Focus 5
it('잡 핸들러가 던져도 워커 프로세스가 살아 있다', async () => {
  // 첫 잡은 항상 던지는 핸들러로 등록, 재시도 소진까지 보낸 뒤
  // 두 번째 잡을 보낸다 → 두 번째가 정상 처리된다
  // (실패가 큐 전체를 멈추지 않는다)
})
```

- [ ] **Step 2: 테스트가 실패하는 것을 확인한다**

Run: `pnpm --filter @rebomi/worker test`
Expected: FAIL

- [ ] **Step 3: `startWorker` 와 noop 잡을 구현한다**

pg-boss가 자기 스키마를 만들게 둔다 (Drizzle 마이그레이션과 분리 — 큐 스키마는 pg-boss 소유). `boss.schedule(QUEUES.NOOP, '* * * * *')` 로 1분마다 돌려 스케줄러 경로도 살아 있는지 로그로 보이게 한다. `boss.on('error', …)` 를 반드시 붙인다 — 없으면 unhandled error로 프로세스가 죽는다.

- [ ] **Step 4: 테스트가 통과하고 워커가 도는 것을 확인한다**

Run: `pnpm --filter @rebomi/worker test` 그리고 `pnpm --filter @rebomi/worker dev` 를 70초 띄워 로그 확인
Expected: 테스트 2개 PASS. 스케줄된 noop 잡 처리 로그가 최소 1회.

- [ ] **Step 5: 커밋**

```bash
git add -A
git commit -m "feat: pg-boss 워커와 스케줄러 골격 추가"
```

---

### Task 6: `apps/web`

**Files:**
- Create: `apps/web/package.json`, `apps/web/tsconfig.json`, `apps/web/next.config.ts`, `apps/web/src/app/layout.tsx`, `apps/web/src/app/page.tsx`, `apps/web/src/lib/api.ts`
- Modify: `.env.example` — `NEXT_PUBLIC_API_BASE_URL` 추가

**Interfaces:**
- Consumes: `@rebomi/api-client`
- Produces: 없음 (최종 소비자)

- [ ] **Step 1: Next.js 앱을 만들고 `/health` 를 브라우저에서 호출한다**

`page.tsx` 는 **클라이언트 컴포넌트**로 만든다. 서버 컴포넌트에서 호출하면 브라우저→API 경로와 CORS가 검증되지 않고, 확장·모바일이 쓰는 것은 그 경로다.

`lib/api.ts` 는 `NEXT_PUBLIC_API_BASE_URL` 이 없으면 모듈 로드 시점에 던진다 (Global Constraints).

- [ ] **Step 2: 브라우저에서 확인한다**

Run: `pnpm dev` 후 `http://localhost:3000`
Expected: 스펙 완료조건 4의 확인 지점이다. turbo 출력에 `web`·`api`·`worker` 세 프로세스가 모두 기동한 로그가 보이고(`mobile` 은 없다), 화면에 `status: ok · db: ok · version: …` 가 보이고, 브라우저 콘솔에 CORS 오류가 없다.

- [ ] **Step 3: 빌드와 타입체크를 확인한다**

Run: `pnpm lint && pnpm typecheck && pnpm build`
Expected: PASS

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: Next.js 웹 앱에서 health 호출 확인"
```

---

### Task 7: `apps/mobile`

Expo를 먼저 하는 이유: 셋 중 모노레포 해석 문제가 날 가능성이 가장 높고, `nodeLinker` 를 내려야 하면 그 영향이 다른 앱에도 미치므로 먼저 알아야 한다.

**Files:**
- Create: `apps/mobile/package.json`, `apps/mobile/tsconfig.json`, `apps/mobile/app.json`, `apps/mobile/metro.config.js`, `apps/mobile/App.tsx`
- Modify: `.env.example` — `EXPO_PUBLIC_API_BASE_URL` 추가
- Modify (조건부): `pnpm-workspace.yaml`

**Interfaces:**
- Consumes: `@rebomi/api-client`
- Produces: 없음

- [ ] **Step 1: Expo 앱을 만들고 모노레포 해석을 설정한다**

`metro.config.js` 에 워크스페이스 루트를 `watchFolders` 로, `nodeModulesPaths` 에 앱과 루트의 `node_modules` 를 넣는다 (Expo 모노레포 가이드). `nodeLinker` 는 아직 건드리지 않는다.

- [ ] **Step 2: 기동해 `/health` 호출을 확인한다**

루트에 `pnpm dev:mobile` 스크립트를 추가한다 (Task 1에서 `pnpm dev` 가 mobile을 제외한 짝).

Run: `pnpm dev` 를 띄워둔 다른 터미널에서 `pnpm dev:mobile`
Expected: iOS 시뮬레이터에서 화면에 `status: ok · db: ok` 가 보인다. 두 명령이 서로의 출력을 망치지 않는다.

시뮬레이터는 호스트의 `localhost` 에 그대로 닿는다. Android 에뮬레이터는 `10.0.2.2` 를 써야 하므로 `EXPO_PUBLIC_API_BASE_URL` 로 갈아끼운다.

- [ ] **Step 3: isolated 설치가 깨지면 hoisted로 내린다**

번들러가 `@rebomi/api-client` 나 그 의존성을 해석하지 못하면 `pnpm-workspace.yaml` 에 `nodeLinker: hoisted` 를 넣고 `pnpm install` 을 다시 돌린다. **내렸으면 스펙 9장 2번에 그 사실과 증상을 기록하고, Task 1·4·6의 명령을 다시 한 번 돌려 다른 앱이 멀쩡한지 확인한다.**

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "feat: Expo 앱에서 health 호출 확인"
```

---

### Task 8: `apps/extension`

**Files:**
- Create: `apps/extension/package.json`, `apps/extension/tsconfig.json`, `apps/extension/vite.config.ts`, `apps/extension/manifest.config.ts`, `apps/extension/src/popup/index.html`, `apps/extension/src/popup/main.tsx`, `apps/extension/src/popup/Popup.tsx`
- Modify: `.env.example` — `VITE_API_BASE_URL` 추가

**Interfaces:**
- Consumes: `@rebomi/api-client`
- Produces: 없음

- [ ] **Step 1: MV3 확장을 만들고 팝업에서 `/health` 를 호출한다**

`@crxjs/vite-plugin` 3으로 MV3 매니페스트를 생성한다. `permissions` 는 아직 비우고, `host_permissions` 에 API 오리진만 넣는다 — 저장 기능이 붙을 때 필요한 권한을 그때 추가한다.

**플러그인이 Vite 8에서 동작하지 않으면** Vite 다중 엔트리 수동 설정(`build.rollupOptions.input` 에 popup, `manifest.json` 은 `public/` 에 정적 파일로)으로 바꾼다. 스펙 9장 3번에 결정을 기록한다.

- [ ] **Step 2: Chrome에 로드해 확인한다**

Run: `pnpm --filter @rebomi/extension build` 후 `chrome://extensions` 에서 `apps/extension/dist` 를 압축해제된 확장으로 로드
Expected: 팝업에 `status: ok · db: ok` 가 보인다. API 서버 로그에 `chrome-extension://` 오리진 요청이 CORS 통과로 찍힌다.

- [ ] **Step 3: 커밋**

```bash
git add -A
git commit -m "feat: Chrome 확장 팝업에서 health 호출 확인"
```

---

### Task 9: CI

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `README.md` — 로컬 세팅 절차(설치 → compose up → migrate → dev)와 필요한 환경변수

**Interfaces:**
- Consumes: 모든 태스크의 스크립트
- Produces: 없음

- [ ] **Step 1: CI 워크플로를 쓴다**

`services:` 는 레지스트리 이미지만 받으므로, `docker/postgres` 를 **스텝에서 빌드하고 `docker run` 으로 띄운다.** Node 22 + pnpm 캐시, `pnpm db:migrate` 후 `pnpm lint typecheck test build` 를 turbo로 실행. 모바일 네이티브 빌드(EAS)는 범위 밖이므로 넣지 않는다.

- [ ] **Step 2: CI가 통과하는 것을 확인한다**

Run: 브랜치를 푸시하고 `gh run watch`
Expected: 모든 잡 성공

- [ ] **Step 3: 완료 조건 11개를 처음부터 끝까지 훑는다**

스펙 1장의 완료 조건을 깨끗한 상태에서 순서대로 실행한다.

Run: `rm -rf node_modules **/node_modules && pnpm install && docker compose -f docker/compose.yml up -d && pnpm db:migrate && pnpm lint && pnpm typecheck && pnpm test && pnpm build`
Expected: 전부 통과. 수동 확인 3건(웹·확장·모바일 화면)은 각 태스크에서 이미 확인했으므로 결과만 기록한다.

- [ ] **Step 4: 커밋**

```bash
git add -A
git commit -m "ci: 린트·타입체크·테스트·빌드 워크플로와 README 추가"
```
