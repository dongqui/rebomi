import { randomUUID } from 'node:crypto'
import {
  createContentResponseSchema,
  listContentsResponseSchema,
  type Content,
} from '@rebomi/api-contract'
import { createDb, eq, inArray, schema, sql, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { signAccessToken } from './auth/tokens.js'
import { startJobQueue, type JobQueue, type StartedJobQueue } from './jobs.js'

const connectionString = process.env.DATABASE_URL

const JWT_SECRET = 'test-secret-test-secret-test-secret-0123'

let db: Db
/** 이 파일만 쓰는 큐. 다른 테스트나 개발용 워커의 잡과 섞이지 않는다. */
let jobs: StartedJobQueue

const createdUserIds: string[] = []
let apps: FastifyInstance[] = []

beforeAll(async () => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)
  jobs = await startJobQueue({
    connectionString,
    queue: `content-process-test-${randomUUID()}`,
  })
}, 60_000)

afterEach(async () => {
  for (const app of apps) await app.close()
  apps = []
})

afterAll(async () => {
  // 콘텐츠는 사용자 삭제에 딸려 지워진다.
  if (createdUserIds.length > 0) {
    await db.drizzle.delete(schema.users).where(inArray(schema.users.id, createdUserIds))
  }
  await jobs.destroy()
  await db.close()
}, 60_000)

function newApp(queue: JobQueue = jobs): FastifyInstance {
  const app = buildApp({
    db,
    corsOrigins: ['http://localhost:3000'],
    auth: { jwtSecret: JWT_SECRET, verifiers: {}, secureCookies: false },
    jobs: queue,
  })
  apps.push(app)
  return app
}

/** 사용자를 만들고 그 사용자의 액세스 토큰을 돌려준다. */
async function newUser(): Promise<{ id: string; token: string }> {
  const [user] = await db.drizzle
    .insert(schema.users)
    .values({ email: `contents-${randomUUID()}@example.com` })
    .returning()
  createdUserIds.push(user!.id)
  return { id: user!.id, token: await signAccessToken(JWT_SECRET, user!.id, new Date()) }
}

const save = (app: FastifyInstance, token: string | null, payload: unknown) =>
  app.inject({
    method: 'POST',
    url: '/contents',
    payload: payload as object,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

const list = (app: FastifyInstance, token: string | null, query = '') =>
  app.inject({
    method: 'GET',
    url: `/contents${query}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

/** 성공해야 하는 저장. 본문을 계약으로 파싱해 돌려준다. */
async function saveOk(app: FastifyInstance, token: string, url: string) {
  const response = await save(app, token, { url, source: 'web' })
  expect([200, 201]).toContain(response.statusCode)
  return createContentResponseSchema.parse(response.json())
}

async function listOk(app: FastifyInstance, token: string, query = '') {
  const response = await list(app, token, query)
  expect(response.statusCode).toBe(200)
  return listContentsResponseSchema.parse(response.json())
}

const errorCode = (response: { json(): unknown }): string =>
  (response.json() as { error: { code: string } }).error.code

async function contentCount(userId: string): Promise<number> {
  const rows = await db.drizzle
    .select({ id: schema.contents.id })
    .from(schema.contents)
    .where(eq(schema.contents.userId, userId))
  return rows.length
}

/** 이 테스트의 큐에 들어 있는, 그 콘텐츠를 가리키는 잡들. */
async function queuedJobsFor(contentId: string): Promise<Array<{ state: string }>> {
  const result = await db.drizzle.execute(
    sql`select state from pgboss.job where name = ${jobs.queue} and data->>'contentId' = ${contentId}`,
  )
  return result.rows as Array<{ state: string }>
}

/** 저장일을 직접 정해 콘텐츠를 넣는다. 순서와 페이지 경계를 고정하려고 쓴다. */
async function insertContent(
  userId: string,
  path: string,
  values: Partial<typeof schema.contents.$inferInsert> = {},
): Promise<string> {
  const [row] = await db.drizzle
    .insert(schema.contents)
    .values({
      userId,
      url: `https://example.com/${path}`,
      normalizedUrl: `https://example.com/${path}`,
      domain: 'example.com',
      source: 'web',
      resurfacingIncluded: true,
      ...values,
    })
    .returning()
  return row!.id
}

describe('POST /contents', () => {
  it('유효한 URL을 저장하면 콘텐츠가 생기고 201 created로 응답한다', async () => {
    const app = newApp()
    const user = await newUser()

    const response = await save(app, user.token, {
      url: 'https://www.Example.com/article?id=7',
      source: 'web',
    })

    expect(response.statusCode).toBe(201)
    const body = createContentResponseSchema.parse(response.json())
    expect(body.status).toBe('created')
    expect(body.content).toMatchObject({
      url: 'https://www.Example.com/article?id=7',
      domain: 'example.com',
      title: null,
      description: null,
      imageUrl: null,
      source: 'web',
      archiveState: 'inbox',
      linkState: 'ok',
      extractionLevel: 'metadata_only',
      resurfacingIncluded: true,
    })
    expect(await contentCount(user.id)).toBe(1)
  })

  it('처리 완료를 기다리지 않는다 — 응답한 콘텐츠의 처리 상태가 pending이다', async () => {
    // 이 큐를 소비하는 워커가 없다. 그런데도 응답이 온다는 것이 기다리지 않는다는 뜻이다.
    const app = newApp()
    const user = await newUser()

    const { content } = await saveOk(app, user.token, 'https://example.com/pending')

    expect(content.metadataStatus).toBe('pending')
    expect(content.summaryStatus).toBe('pending')
  })

  it('저장하면 처리 잡이 큐에 들어간다', async () => {
    const app = newApp()
    const user = await newUser()

    const { content } = await saveOk(app, user.token, 'https://example.com/queued')

    expect(await queuedJobsFor(content.id)).toEqual([{ state: 'created' }])
  })

  it('잡에 재시도 정책을 실어 보낸다', async () => {
    const app = newApp()
    const user = await newUser()

    const { content } = await saveOk(app, user.token, 'https://example.com/retry-policy')

    const result = await db.drizzle.execute(
      sql`select retry_limit, retry_delay, retry_backoff from pgboss.job
          where name = ${jobs.queue} and data->>'contentId' = ${content.id}`,
    )
    expect(result.rows).toEqual([{ retry_limit: 3, retry_delay: 30, retry_backoff: true }])
  })

  it('트래킹 파라미터만 다른 두 번째 저장은 중복으로 응답하고 콘텐츠가 늘지 않는다', async () => {
    const app = newApp()
    const user = await newUser()
    const first = await saveOk(app, user.token, 'https://example.com/post?id=1')

    const response = await save(app, user.token, {
      url: 'https://example.com/post?utm_source=newsletter&id=1&fbclid=abc#top',
      source: 'extension',
    })

    expect(response.statusCode).toBe(200)
    const body = createContentResponseSchema.parse(response.json())
    expect(body.status).toBe('duplicate')
    // 기존 콘텐츠를 그대로 준다. 두 번째 요청의 URL과 출처로 덮어쓰지 않는다.
    expect(body.content).toEqual(first.content)
    expect(await contentCount(user.id)).toBe(1)
  })

  it('중복 저장은 잡을 더 넣지 않는다', async () => {
    const app = newApp()
    const user = await newUser()
    const { content } = await saveOk(app, user.token, 'https://example.com/once')

    await saveOk(app, user.token, 'https://example.com/once?utm_medium=x')

    expect(await queuedJobsFor(content.id)).toHaveLength(1)
  })

  it('같은 URL이 동시에 여러 번 와도 하나만 생기고 나머지는 중복이다', async () => {
    const app = newApp()
    const user = await newUser()

    const responses = await Promise.all(
      Array.from({ length: 5 }, () =>
        save(app, user.token, { url: 'https://example.com/race', source: 'web' }),
      ),
    )

    expect(responses.map((response) => response.statusCode).sort()).toEqual([
      200, 200, 200, 200, 201,
    ])
    const ids = new Set(
      responses.map((response) => createContentResponseSchema.parse(response.json()).content.id),
    )
    expect(ids.size).toBe(1)
    expect(await queuedJobsFor([...ids][0]!)).toHaveLength(1)
  })

  it('다른 사용자는 같은 URL을 따로 저장할 수 있다', async () => {
    const app = newApp()
    const alice = await newUser()
    const bob = await newUser()

    const first = await saveOk(app, alice.token, 'https://example.com/shared')
    const second = await saveOk(app, bob.token, 'https://example.com/shared')

    expect(second.status).toBe('created')
    expect(second.content.id).not.toBe(first.content.id)
  })

  it.each([
    'javascript:alert(1)',
    'ftp://example.com/file',
    'file:///etc/passwd',
    'example.com/no-scheme',
    'not a url',
    '   ',
  ])('http(s)가 아닌 입력 "%s" 은 400 VALIDATION_FAILED이고 저장되지 않는다', async (url) => {
    const app = newApp()
    const user = await newUser()

    const response = await save(app, user.token, { url, source: 'web' })

    expect(response.statusCode).toBe(400)
    expect(errorCode(response)).toBe('VALIDATION_FAILED')
    expect(await contentCount(user.id)).toBe(0)
  })

  it.each([
    {},
    { url: 'https://example.com' },
    { url: '', source: 'web' },
    { url: 'https://example.com', source: 'import' },
    { url: 'https://example.com', source: 'fax' },
    { url: `https://example.com/${'a'.repeat(2048)}`, source: 'web' },
  ])('계약에 맞지 않는 요청 %j 은 400 VALIDATION_FAILED다', async (payload) => {
    const app = newApp()
    const user = await newUser()

    const response = await save(app, user.token, payload)

    expect(response.statusCode).toBe(400)
    expect(errorCode(response)).toBe('VALIDATION_FAILED')
  })

  it('인증 없는 요청은 401 UNAUTHORIZED다', async () => {
    const app = newApp()

    const response = await save(app, null, { url: 'https://example.com', source: 'web' })

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('UNAUTHORIZED')
  })

  it('큐에 넣지 못하면 콘텐츠도 남지 않는다', async () => {
    // 행만 남으면 그 콘텐츠는 영원히 "처리 중"이고, 다시 저장해도 중복이라 고칠 길이 없다.
    const app = newApp({
      enqueueContentProcess: () => Promise.reject(new Error('queue down')),
    })
    const user = await newUser()

    const response = await save(app, user.token, { url: 'https://example.com/x', source: 'web' })

    expect(response.statusCode).toBe(500)
    expect(errorCode(response)).toBe('INTERNAL')
    expect(await contentCount(user.id)).toBe(0)
  })

  it('응답에 계약에 없는 필드가 없다', async () => {
    const app = newApp()
    const user = await newUser()

    const response = await save(app, user.token, { url: 'https://example.com/raw', source: 'web' })
    const raw = JSON.parse(response.body) as { content: Record<string, unknown> }

    expect(Object.keys(raw).sort()).toEqual(['content', 'status'])
    expect(Object.keys(raw.content).sort()).toEqual([
      'archiveState',
      'description',
      'domain',
      'extractionLevel',
      'id',
      'imageUrl',
      'linkState',
      'metadataStatus',
      'resurfacingIncluded',
      'savedAt',
      'source',
      'summaryStatus',
      'title',
      'url',
    ])
    expect(response.body).not.toContain(user.id)
  })
})

describe('GET /contents', () => {
  it('요청한 사용자의 콘텐츠만 준다', async () => {
    const app = newApp()
    const alice = await newUser()
    const bob = await newUser()
    const mine = await saveOk(app, alice.token, 'https://example.com/alice')
    await saveOk(app, bob.token, 'https://example.com/bob')

    const body = await listOk(app, alice.token)

    expect(body.items.map((item) => item.id)).toEqual([mine.content.id])
    expect(body.nextCursor).toBeNull()
  })

  it('저장한 순서의 역순(최근순)으로 준다', async () => {
    const app = newApp()
    const user = await newUser()
    const first = await saveOk(app, user.token, 'https://example.com/1')
    const second = await saveOk(app, user.token, 'https://example.com/2')
    const third = await saveOk(app, user.token, 'https://example.com/3')

    const body = await listOk(app, user.token)

    expect(body.items.map((item) => item.id)).toEqual([
      third.content.id,
      second.content.id,
      first.content.id,
    ])
  })

  it('저장한 것이 없으면 빈 목록이다', async () => {
    const app = newApp()
    const user = await newUser()

    expect(await listOk(app, user.token)).toEqual({ items: [], nextCursor: null })
  })

  it('휴지통의 콘텐츠는 나오지 않고 보관됨은 나온다', async () => {
    const app = newApp()
    const user = await newUser()
    const inbox = await insertContent(user.id, 'inbox')
    const archived = await insertContent(user.id, 'archived', { archiveState: 'archived' })
    await insertContent(user.id, 'trashed', { archiveState: 'trashed' })

    const body = await listOk(app, user.token)

    expect(body.items.map((item) => item.id).sort()).toEqual([inbox, archived].sort())
  })

  it('limit만큼 주고 nextCursor로 이어서 빠짐없이, 겹치지 않게 받는다', async () => {
    const app = newApp()
    const user = await newUser()
    const expected: string[] = []
    for (let minute = 0; minute < 5; minute += 1) {
      const id = await insertContent(user.id, `page-${minute}`, {
        savedAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
      })
      expected.unshift(id)
    }

    const seen: Content[] = []
    let cursor: string | null = null
    let pages = 0
    do {
      const query: string = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const body = await listOk(app, user.token, query)
      expect(body.items.length).toBeLessThanOrEqual(2)
      seen.push(...body.items)
      cursor = body.nextCursor
      pages += 1
    } while (cursor !== null && pages < 10)

    expect(pages).toBe(3)
    expect(seen.map((item) => item.id)).toEqual(expected)
  })

  it('마지막 페이지가 limit과 딱 맞으면 nextCursor는 null이다', async () => {
    const app = newApp()
    const user = await newUser()
    await insertContent(user.id, 'a')
    await insertContent(user.id, 'b')

    const body = await listOk(app, user.token, '?limit=2')

    expect(body.items).toHaveLength(2)
    expect(body.nextCursor).toBeNull()
  })

  it('저장일이 같은 콘텐츠도 페이지 사이에서 빠지거나 겹치지 않는다', async () => {
    // 가져오기처럼 한 번에 넣으면 저장일이 같다. 저장일만으로 자르면 경계에서 사라진다.
    const app = newApp()
    const user = await newUser()
    const savedAt = new Date(Date.UTC(2026, 0, 2))
    const ids: string[] = []
    for (let n = 0; n < 5; n += 1) ids.push(await insertContent(user.id, `same-${n}`, { savedAt }))

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const query: string = `?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const body = await listOk(app, user.token, query)
      seen.push(...body.items.map((item) => item.id))
      cursor = body.nextCursor
    } while (cursor !== null && seen.length < 20)

    expect([...seen].sort()).toEqual([...ids].sort())
    expect(new Set(seen).size).toBe(5)
  })

  it('같은 밀리초 안에서 마이크로초만 다른 콘텐츠도 빠지지 않는다', async () => {
    // DB의 now()는 마이크로초까지 찍는다. 커서가 밀리초로 잘리면 여기서 행을 잃는다.
    const app = newApp()
    const user = await newUser()
    const ids: string[] = []
    for (const micros of ['000100', '000200', '000300']) {
      const id = await insertContent(user.id, `micro-${micros}`)
      await db.drizzle.execute(
        sql`update contents set saved_at = ${`2026-01-03T00:00:00.${micros}Z`}::timestamptz where id = ${id}::uuid`,
      )
      ids.unshift(id)
    }

    const seen: string[] = []
    let cursor: string | null = null
    do {
      const query: string = `?limit=1${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`
      const body = await listOk(app, user.token, query)
      seen.push(...body.items.map((item) => item.id))
      cursor = body.nextCursor
    } while (cursor !== null && seen.length < 20)

    expect(seen).toEqual(ids)
  })

  it('다른 사용자의 커서로 그 사용자의 콘텐츠를 볼 수 없다', async () => {
    const app = newApp()
    const alice = await newUser()
    const bob = await newUser()
    for (let n = 0; n < 3; n += 1) await insertContent(alice.id, `a-${n}`)
    await insertContent(bob.id, 'b-0', { savedAt: new Date(Date.UTC(2020, 0, 1)) })
    const alicePage = await listOk(app, alice.token, '?limit=1')

    const body = await listOk(
      app,
      bob.token,
      `?cursor=${encodeURIComponent(alicePage.nextCursor!)}`,
    )

    expect(body.items.every((item) => item.url === 'https://example.com/b-0')).toBe(true)
  })

  it.each(['?limit=0', '?limit=101', '?limit=abc', '?cursor=', '?cursor=not-a-cursor'])(
    '잘못된 쿼리 "%s" 는 400 VALIDATION_FAILED다',
    async (query) => {
      const app = newApp()
      const user = await newUser()

      const response = await list(app, user.token, query)

      expect(response.statusCode).toBe(400)
      expect(errorCode(response)).toBe('VALIDATION_FAILED')
    },
  )

  it('커서에 SQL을 넣어도 400으로 거부한다', async () => {
    const app = newApp()
    const user = await newUser()
    const forged = Buffer.from(
      JSON.stringify(["2026-01-01T00:00:00.000000Z'); drop table contents; --", randomUUID()]),
    ).toString('base64url')

    const response = await list(app, user.token, `?cursor=${forged}`)

    expect(response.statusCode).toBe(400)
    expect(errorCode(response)).toBe('VALIDATION_FAILED')
  })

  it('인증 없는 요청은 401 UNAUTHORIZED다', async () => {
    const app = newApp()

    const response = await list(app, null)

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('UNAUTHORIZED')
  })

  it('응답에 계약에 없는 필드가 없다', async () => {
    const app = newApp()
    const user = await newUser()
    await saveOk(app, user.token, 'https://example.com/raw-list')

    const response = await list(app, user.token)
    const raw = JSON.parse(response.body) as { items: Array<Record<string, unknown>> }

    expect(Object.keys(raw).sort()).toEqual(['items', 'nextCursor'])
    expect(raw.items[0]).not.toHaveProperty('normalizedUrl')
    expect(raw.items[0]).not.toHaveProperty('userId')
    expect(response.body).not.toContain(user.id)
  })
})
