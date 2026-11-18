import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { buildApp, signAccessToken, startJobQueue, type StartedJobQueue } from '@rebomi/api'
import { createApiClient, type ApiClient } from '@rebomi/api-client'
import { createDb, eq, schema, type Db } from '@rebomi/db'
import { afterAll, beforeAll, expect, it } from 'vitest'

/*
 * 저장 → 키워드 검색의 연결 검증 (search.md SRCH-1, SRCH-4).
 *
 * 실제 Postgres(PGroonga) 위에 api를 띄우고 클라이언트가 쓰는 경로(`@rebomi/api-client`
 * → HTTP) 그대로 부른다. 일치 규칙의 세부는 api의 테스트가 본다 — 여기서는 계약·서버·
 * 클라이언트가 이어져 있는지만 본다.
 *
 * 워커는 띄우지 않는다. 저장하는 쪽이 보낸 제목과 본문은 처리를 기다리지 않고 검색된다.
 */

const connectionString = process.env.DATABASE_URL

const JWT_SECRET = 'e2e-secret-e2e-secret-e2e-secret-0123456'

let db: Db
let jobs: StartedJobQueue
let app: ReturnType<typeof buildApp>
let client: ApiClient
let userId: string

beforeAll(async () => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)

  // 이 테스트만 쓰는 큐. 기본 큐를 쓰면 로컬에 떠 있는 개발용 워커가 잡을 가져가
  // 저장한 주소를 실제로 요청한다.
  jobs = await startJobQueue({ connectionString, queue: `content-process-e2e-${randomUUID()}` })

  app = buildApp({
    db,
    corsOrigins: [],
    auth: { jwtSecret: JWT_SECRET, verifiers: {}, secureCookies: false },
    jobs,
  })
  await app.listen({ port: 0, host: '127.0.0.1' })
  const { port } = app.server.address() as AddressInfo

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
  await app?.close()
  await jobs?.destroy()
  if (userId) await db.drizzle.delete(schema.users).where(eq(schema.users.id, userId))
  await db?.close()
})

it('저장한 콘텐츠가 제목·본문·주소의 단어로 검색되고, 휴지통으로 보내면 빠진다', async () => {
  const withBody = await client.saveContent({
    url: 'https://example.com/e2e/search-engine',
    source: 'extension',
    title: '검색엔진을 만드는 방법',
    body: 'PostgreSQL 전문검색과 한국어 형태소 분석을 다룬다.',
  })
  const metadataOnly = await client.saveContent({
    url: 'https://example.com/e2e/kimchi-recipe',
    source: 'web',
  })

  // 한국어와 영어가 섞인 검색어: 단어 하나는 제목에, 하나는 본문에 있다.
  const mixed = await client.searchContents({ query: '검색 postgres' })
  expect(mixed.items.map((item) => item.content.id)).toEqual([withBody.content.id])
  expect(mixed.items[0]!.content.extractionLevel).toBe('full')
  expect(mixed.nextCursor).toBeNull()
  const [title, body] = mixed.items[0]!.matches
  expect(title).toEqual({
    field: 'title',
    text: '검색엔진을 만드는 방법',
    ranges: [{ start: 0, end: 2 }],
  })
  expect(body!.field).toBe('body')
  expect(body!.ranges.map((range) => body!.text.slice(range.start, range.end))).toEqual([
    'PostgreS',
    '검색',
  ])

  // 본문이 없는 콘텐츠는 주소로 검색된다.
  const byUrl = await client.searchContents({ query: 'kimchi' })
  expect(byUrl.items.map((item) => item.content.id)).toEqual([metadataOnly.content.id])
  expect(byUrl.items[0]!.content.extractionLevel).toBe('metadata_only')
  expect(byUrl.items[0]!.matches.map((match) => match.field)).toEqual(['url'])

  // 일치가 없으면 빈 결과다.
  expect(await client.searchContents({ query: '어디에도없는말' })).toEqual({
    items: [],
    nextCursor: null,
  })

  // 빈 검색어는 거부된다.
  await expect(client.searchContents({ query: '  ' })).rejects.toMatchObject({
    code: 'VALIDATION_FAILED',
    status: 400,
  })

  // 휴지통으로 보낸 콘텐츠는 검색에서 빠진다.
  await client.trashContent(withBody.content.id)
  expect((await client.searchContents({ query: '검색엔진' })).items).toEqual([])
})
