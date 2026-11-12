import { randomUUID } from 'node:crypto'
import { createDb, eq, schema, type Db } from '@rebomi/db'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { fetchPage } from '../fetch-page.js'
import { startWorker, type Worker } from '../index.js'
import {
  FIXTURE_ADDRESS,
  html,
  startFixtureServer,
  type FixtureServer,
} from '../testing/fixture-server.js'
import { ARTICLE_FIRST_SENTENCE, ARTICLE_HTML, NO_BODY_HTML } from '../testing/pages.js'
import { createContentProcessHandler } from './content-process.js'

/*
 * 워커 통합 테스트. 실제 Postgres와 pg-boss, 로컬 픽스처 서버를 쓴다 — 외부 사이트는
 * 부르지 않는다.
 */

const connectionString = process.env.DATABASE_URL

const { contents, contentBodies, users } = schema

let db: Db
let server: FixtureServer
let worker: Worker | undefined
const createdUserIds: string[] = []
let logs: Array<{ message: string; context?: unknown }> = []

beforeAll(async () => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)
  server = await startFixtureServer()

  server.on('/article', (_request, response) => html(response, ARTICLE_HTML))
  server.on('/no-body', (_request, response) => html(response, NO_BODY_HTML))
  // 처음 두 번은 503, 세 번째에 성공한다.
  server.on('/flaky', (_request, response, hit) => {
    if (hit <= 2) {
      response.writeHead(503)
      response.end()
      return
    }
    html(response, ARTICLE_HTML)
  })
  server.on('/down', (_request, response) => {
    response.writeHead(503)
    response.end()
  })
  server.on('/gone', (_request, response) => {
    response.writeHead(404)
    response.end()
  })
  server.on('/to-internal', (_request, response) => {
    response.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' })
    response.end()
  })
  server.on('/moved', (_request, response) => {
    response.writeHead(301, { location: '/article' })
    response.end()
  })
})

afterEach(async () => {
  await worker?.destroy()
  worker = undefined
  logs = []
})

afterAll(async () => {
  // 콘텐츠와 본문은 사용자 삭제에 딸려 지워진다.
  for (const id of createdUserIds) await db.drizzle.delete(users).where(eq(users.id, id))
  await db.close()
  await server.close()
})

/** 재시도를 기다리지 않게 간격을 없앤다. 횟수는 운영과 같다. */
const FAST_RETRY = { retryLimit: 3, retryDelay: 0, retryBackoff: false }

async function start(): Promise<Worker> {
  const log = (message: string, context?: unknown) => void logs.push({ message, context })
  worker = await startWorker({
    connectionString: connectionString!,
    queue: `noop-test-${randomUUID()}`,
    schedule: false,
    log,
    contentProcess: {
      queue: `content-process-test-${randomUUID()}`,
      handler: createContentProcessHandler({
        db,
        // 픽스처 서버가 루프백에 있어 그 주소만 허용한다. 다른 내부 주소는 그대로 막힌다.
        fetchPage: (url) => fetchPage(url, { allowedAddresses: [FIXTURE_ADDRESS] }),
        log,
      }),
    },
  })
  return worker
}

async function saveContent(
  url: string,
  values: Partial<typeof contents.$inferInsert> = {},
): Promise<string> {
  const [user] = await db.drizzle
    .insert(users)
    .values({ email: `w-${randomUUID()}@example.com` })
    .returning()
  createdUserIds.push(user!.id)

  const [row] = await db.drizzle
    .insert(contents)
    .values({
      userId: user!.id,
      url,
      normalizedUrl: url,
      domain: '127.0.0.1',
      source: 'web',
      resurfacingIncluded: true,
      ...values,
    })
    .returning()
  return row!.id
}

async function contentOf(id: string) {
  const [row] = await db.drizzle.select().from(contents).where(eq(contents.id, id))
  return row
}

async function bodyOf(id: string): Promise<string | null> {
  const [row] = await db.drizzle.select().from(contentBodies).where(eq(contentBodies.contentId, id))
  return row?.text ?? null
}

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 40_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (await predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('조건이 시간 안에 만족되지 않았습니다')
}

/** 잡을 넣고 처리 상태가 "처리 중"을 벗어날 때까지 기다린다. */
async function processed(id: string, retry = FAST_RETRY) {
  await worker!.sendContentProcess({ contentId: id }, retry)
  await waitFor(async () => (await contentOf(id))?.metadataStatus !== 'pending')
  return (await contentOf(id))!
}

describe('content-process 잡', () => {
  it('저장 직후의 콘텐츠는 처리 중이다', async () => {
    const id = await saveContent(server.url('/article'))

    expect(await contentOf(id)).toMatchObject({
      metadataStatus: 'pending',
      extractionLevel: 'metadata_only',
      summaryStatus: 'pending',
    })
  })

  it('공개 기사를 처리하면 제목·도메인·이미지가 채워지고 추출 수준이 본문이 된다', async () => {
    await start()
    const id = await saveContent(server.url('/article'))

    const content = await processed(id)

    expect(content).toMatchObject({
      title: '다시 만나는 글',
      description: '저장한 글을 다시 보게 만드는 방법',
      domain: '127.0.0.1',
      imageUrl: server.url('/images/cover.png'),
      extractionLevel: 'full',
      metadataStatus: 'done',
      // 요약은 다음 Issue의 몫이다. 본문이 있으니 "생성 중"으로 둔다.
      summaryStatus: 'pending',
    })
    const body = await bodyOf(id)
    expect(body).toContain(ARTICLE_FIRST_SENTENCE)
    // 원본 HTML이 아니라 텍스트만 저장한다.
    expect(body).not.toMatch(/<\/?[a-z]/i)
  })

  it('본문이 없는 페이지는 메타데이터만으로 완료되고 콘텐츠가 유지된다', async () => {
    await start()
    const id = await saveContent(server.url('/no-body'))

    const content = await processed(id)

    expect(content).toMatchObject({
      title: '로그인이 필요한 앱',
      description: '앱 설명',
      imageUrl: 'https://cdn.example.com/app.png',
      extractionLevel: 'metadata_only',
      metadataStatus: 'done',
      summaryStatus: 'no_content',
      archiveState: 'inbox',
    })
    expect(await bodyOf(id)).toBeNull()
  })

  it('일시 오류는 다시 시도해 결국 처리한다', async () => {
    await start()
    const id = await saveContent(server.url('/flaky'))

    const content = await processed(id)

    expect(content).toMatchObject({ metadataStatus: 'done', extractionLevel: 'full' })
    expect(server.hits('/flaky')).toBe(3)
    expect(logs.filter((entry) => entry.message.includes('will retry'))).toHaveLength(2)
  })

  it('재시도를 다 써도 실패하면 실패로 기록하고 콘텐츠는 남긴다', async () => {
    await start()
    const id = await saveContent(server.url('/down'))

    const content = await processed(id)

    expect(content).toMatchObject({
      metadataStatus: 'failed',
      extractionLevel: 'metadata_only',
      summaryStatus: 'no_content',
      archiveState: 'inbox',
      title: null,
    })
    // 첫 시도 + 재시도 3번
    expect(server.hits('/down')).toBe(4)
  })

  it('실패한 잡 뒤에도 워커가 살아 다음 잡을 처리한다', async () => {
    await start()
    const failing = await saveContent(server.url('/down'))
    const healthy = await saveContent(server.url('/article'))

    expect((await processed(failing)).metadataStatus).toBe('failed')
    expect((await processed(healthy)).metadataStatus).toBe('done')
  })

  it('영구 오류(404)는 다시 시도하지 않고 바로 실패로 기록한다', async () => {
    await start()
    const id = await saveContent(server.url('/gone'))

    const content = await processed(id)

    expect(content).toMatchObject({ metadataStatus: 'failed', summaryStatus: 'no_content' })
    expect(server.hits('/gone')).toBe(1)
  })

  it('내부망 주소로 돌리는 페이지는 따라가지 않고 실패로 기록한다', async () => {
    await start()
    const id = await saveContent(server.url('/to-internal'))

    const content = await processed(id)

    expect(content.metadataStatus).toBe('failed')
    expect(server.hits('/to-internal')).toBe(1)
  })

  it('리다이렉트된 기사도 처리하고 이미지는 마지막 주소 기준으로 푼다', async () => {
    await start()
    const id = await saveContent(server.url('/moved'))

    const content = await processed(id)

    expect(content).toMatchObject({
      metadataStatus: 'done',
      extractionLevel: 'full',
      imageUrl: server.url('/images/cover.png'),
      // 저장한 주소는 바꾸지 않는다.
      url: server.url('/moved'),
    })
  })

  it('저장한 쪽이 먼저 채운 제목은 덮어쓰지 않는다', async () => {
    await start()
    const id = await saveContent(server.url('/article'), { title: '사용자가 본 제목' })

    const content = await processed(id)

    expect(content).toMatchObject({ title: '사용자가 본 제목', metadataStatus: 'done' })
  })

  it('이미 처리가 끝난 콘텐츠의 잡은 아무것도 바꾸지 않는다', async () => {
    await start()
    const id = await saveContent(server.url('/article'), {
      metadataStatus: 'done',
      title: '이전 결과',
    })
    const before = server.hits('/article')

    await worker!.sendContentProcess({ contentId: id }, FAST_RETRY)
    await waitFor(() => Promise.resolve(logs.some((entry) => entry.message.includes('skipped'))))

    expect(server.hits('/article')).toBe(before)
    expect(await contentOf(id)).toMatchObject({ title: '이전 결과', metadataStatus: 'done' })
  })

  it('처리 전에 지워진 콘텐츠의 잡은 조용히 끝난다', async () => {
    await start()

    await worker!.sendContentProcess({ contentId: randomUUID() }, FAST_RETRY)
    await waitFor(() => Promise.resolve(logs.some((entry) => entry.message.includes('skipped'))))

    expect(logs.some((entry) => entry.message.includes('job failed'))).toBe(false)
  })

  it('로그에 저장한 주소를 남기지 않는다', async () => {
    await start()
    const failing = await saveContent(server.url('/down'))
    const healthy = await saveContent(server.url('/article'))
    await processed(failing)
    await processed(healthy)

    expect(JSON.stringify(logs)).not.toContain(server.origin)
  })
})
