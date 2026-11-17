import { randomUUID } from 'node:crypto'
import { createServer, type Server, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'
import { buildApp, signAccessToken, startJobQueue, type StartedJobQueue } from '@rebomi/api'
import { createApiClient, type ApiClient } from '@rebomi/api-client'
import { createDb, eq, schema, type Db } from '@rebomi/db'
import { createContentProcessHandler, fetchPage, startWorker, type Worker } from '@rebomi/worker'
import { afterAll, beforeAll, expect, it } from 'vitest'

/*
 * 저장 → 목록 → 처리 완료의 연결 검증 (capture.md CAP-1·CAP-2·CAP-8, architecture.md §5).
 *
 * api와 worker를 각자의 테스트처럼 따로 세우지 않고, 실제 Postgres와 같은 큐를 사이에 두고
 * 함께 띄운다. 호출은 클라이언트가 쓰는 경로(`@rebomi/api-client` → HTTP) 그대로다.
 * 각 부분의 세부 동작은 각 패키지의 테스트가 본다 — 여기서는 이어져 있는지만 본다.
 *
 * 외부 사이트는 부르지 않는다. 저장하는 주소는 이 파일이 띄운 로컬 서버다.
 */

const connectionString = process.env.DATABASE_URL

const JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-0123456'
const PAGE_ADDRESS = '127.0.0.1'
const PAGE_TITLE = '다시 만나는 글'

const PAGE_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>${PAGE_TITLE} | 예시 블로그</title>
<meta property="og:title" content="${PAGE_TITLE}">
</head>
<body>
<main>
<article>
<h1>${PAGE_TITLE}</h1>
<p>저장만 하고 다시 보지 않는 글이 쌓이는 이유는 저장하는 순간과 필요한 순간이 다르기 때문이다. 읽을 시간이 없어서 저장했는데, 시간이 생겼을 때는 무엇을 저장했는지 기억나지 않는다.</p>
<p>그래서 목록을 잘 정리하는 것만으로는 문제가 풀리지 않는다. 정리된 목록도 열어 보지 않으면 없는 것과 같다. 필요한 것은 적절한 때에 다시 눈앞에 가져다 주는 장치다.</p>
<p>다시 보여 주는 시점을 고르는 일은 생각보다 어렵다. 너무 자주 보여 주면 소음이 되고, 너무 드물면 잊힌다. 사람마다 견딜 수 있는 빈도가 다르다는 점도 고려해야 한다.</p>
</article>
</main>
</body>
</html>`

/**
 * 저장할 페이지를 주는 로컬 서버. 요청을 받아도 `release()` 전에는 답하지 않는다 —
 * 그래야 "처리 중"인 동안의 목록을 워커와 경주하지 않고 볼 수 있다.
 */
type PageServer = {
  readonly url: string
  /** 같은 서버의 다른 경로. */
  urlFor(path: string): string
  /** 그 경로로 온 요청 수. */
  hits(path: string): number
  /** 워커의 요청이 도착할 때까지 기다린다. */
  requested(): Promise<void>
  release(): void
  close(): Promise<void>
}

async function startPageServer(): Promise<PageServer> {
  const waiting: ServerResponse[] = []
  const hits = new Map<string, number>()
  let released = false
  let onRequest: () => void = () => {}
  const requested = new Promise<void>((resolve) => {
    onRequest = resolve
  })

  const answer = (response: ServerResponse) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(PAGE_HTML)
  }

  const server: Server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://page').pathname
    hits.set(path, (hits.get(path) ?? 0) + 1)
    onRequest()
    if (released) answer(response)
    else waiting.push(response)
  })
  await new Promise<void>((resolve) => server.listen(0, PAGE_ADDRESS, resolve))
  const { port } = server.address() as AddressInfo

  return {
    url: `http://${PAGE_ADDRESS}:${port}/article`,
    urlFor: (path) => `http://${PAGE_ADDRESS}:${port}${path}`,
    hits: (path) => hits.get(path) ?? 0,
    requested: () => requested,
    release: () => {
      released = true
      for (const response of waiting.splice(0)) answer(response)
    },
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}

async function within<T>(promise: Promise<T>, timeoutMs: number, message: string): Promise<T> {
  let timer: NodeJS.Timeout | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(message)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

async function waitFor<T>(
  read: () => Promise<T>,
  done: (value: T) => boolean,
  timeoutMs: number,
): Promise<T> {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const value = await read()
    if (done(value)) return value
    if (Date.now() >= deadline) {
      throw new Error(`시간 안에 처리가 끝나지 않았습니다. 마지막 상태: ${JSON.stringify(value)}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
}

let db: Db
let jobs: StartedJobQueue
let worker: Worker
let app: ReturnType<typeof buildApp>
let page: PageServer
let client: ApiClient
let userId: string

beforeAll(async () => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)
  page = await startPageServer()

  // 이 테스트만 쓰는 큐. 기본 큐를 쓰면 로컬에 떠 있는 개발용 워커가 잡을 가져간다.
  // api와 worker에 같은 이름을 준다 — 둘을 잇는 것은 이 큐 하나다.
  const queue = `content-process-e2e-${randomUUID()}`

  jobs = await startJobQueue({ connectionString, queue })
  worker = await startWorker({
    connectionString,
    queue: `noop-e2e-${randomUUID()}`,
    schedule: false,
    log: () => {},
    contentProcess: {
      queue,
      handler: createContentProcessHandler({
        db,
        // 페이지 서버가 루프백에 있어 그 주소만 허용한다. 다른 내부 주소는 그대로 막힌다.
        fetchPage: (url) => fetchPage(url, { allowedAddresses: [PAGE_ADDRESS] }),
        log: () => {},
      }),
    },
  })

  app = buildApp({
    db,
    corsOrigins: [],
    auth: { jwtSecret: JWT_SECRET, verifiers: {}, secureCookies: false },
    jobs,
  })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const { port } = app.server.address() as AddressInfo

  // 로그인 흐름은 이 테스트의 대상이 아니다. 사용자를 만들고 토큰을 직접 서명한다.
  const [user] = await db.drizzle
    .insert(schema.users)
    .values({ email: `e2e-${randomUUID()}@example.com` })
    .returning()
  userId = user!.id
  const accessToken = await signAccessToken(JWT_SECRET, userId, new Date())

  client = createApiClient({
    baseUrl: `http://127.0.0.1:${port}`,
    tokenStore: { get: () => ({ accessToken, refreshToken: null }), set: () => {} },
  })
})

afterAll(async () => {
  page?.release()
  await app?.close()
  await worker?.destroy()
  await jobs?.stop()
  // 콘텐츠와 본문은 사용자 삭제에 딸려 지워진다.
  if (userId) await db.drizzle.delete(schema.users).where(eq(schema.users.id, userId))
  await db?.close()
  await page?.close()
})

it('저장한 URL이 목록에 처리 중으로 보이고, 워커가 처리하면 완료와 추출 수준이 보인다', async () => {
  const saved = await client.saveContent({ url: page.url, source: 'web' })

  expect(saved.status).toBe('created')
  expect(saved.content).toMatchObject({ metadataStatus: 'pending', title: null })

  // 워커가 잡을 받아 페이지를 요청한 뒤에도, 응답을 받기 전까지 목록은 처리 중이다.
  await within(
    page.requested(),
    20_000,
    '워커가 페이지를 요청하지 않았습니다 — 워커가 떠 있지 않거나 api와 큐가 이어지지 않았습니다',
  )
  const during = await client.listContents()
  expect(during.items).toHaveLength(1)
  expect(during.items[0]).toMatchObject({
    id: saved.content.id,
    metadataStatus: 'pending',
    extractionLevel: 'metadata_only',
  })

  page.release()

  const after = await waitFor(
    () => client.listContents(),
    (list) => list.items[0]?.metadataStatus !== 'pending',
    30_000,
  )
  expect(after.items).toHaveLength(1)
  expect(after.items[0]).toMatchObject({
    id: saved.content.id,
    metadataStatus: 'done',
    extractionLevel: 'full',
    title: PAGE_TITLE,
  })
})

it('본문과 함께 저장한 콘텐츠는 워커가 페이지를 요청하지 않고 처리를 끝낸다', async () => {
  // 가져왔다면 PAGE_TITLE 과 다른 본문이 나오는 주소다. 서버는 이미 풀려 있어 바로 답한다.
  const url = page.urlFor('/members-only')

  const saved = await client.saveContent({
    url,
    source: 'extension',
    title: '확장이 읽은 제목',
    body: '로그인한 브라우저에서만 보이는 본문이다.',
    imageUrl: 'https://cdn.example.com/captured.png',
  })

  expect(saved.status).toBe('created')
  expect(saved.content).toMatchObject({ metadataStatus: 'pending', extractionLevel: 'full' })

  const after = await waitFor(
    () => client.getContent(saved.content.id),
    (content) => content.metadataStatus !== 'pending',
    30_000,
  )

  expect(after).toMatchObject({
    metadataStatus: 'done',
    extractionLevel: 'full',
    title: '확장이 읽은 제목',
    imageUrl: 'https://cdn.example.com/captured.png',
  })
  // 완료는 워커가 가져오지 않기로 한 뒤에 기록한다. 이 뒤로 요청이 올 일은 없다.
  expect(page.hits('/members-only')).toBe(0)

  const [body] = await db.drizzle
    .select()
    .from(schema.contentBodies)
    .where(eq(schema.contentBodies.contentId, saved.content.id))
  expect(body?.text).toBe('로그인한 브라우저에서만 보이는 본문이다.')
})
