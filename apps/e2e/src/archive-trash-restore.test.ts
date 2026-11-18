import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import { buildApp, signAccessToken, startJobQueue, type StartedJobQueue } from '@rebomi/api'
import { ApiError, createApiClient, type ApiClient } from '@rebomi/api-client'
import { createDb, eq, schema, type Db } from '@rebomi/db'
import { afterAll, beforeAll, expect, it } from 'vitest'

/*
 * 저장 → 보관 → 삭제 → 휴지통 목록 → 복구의 연결 검증 (library.md LIB-3·LIB-4,
 * architecture.md §4 전이 규칙).
 *
 * 실제 Postgres 위에 api를 띄우고 클라이언트가 쓰는 경로(`@rebomi/api-client` → HTTP)
 * 그대로 부른다. 전이 하나하나의 세부는 api의 테스트가 본다 — 여기서는 계약·서버·
 * 클라이언트가 이어져 있는지만 본다.
 *
 * 워커는 띄우지 않는다. 보관 상태는 처리 상태와 다른 축이라 처리를 기다리지 않는다.
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
  await app?.close()
  // 처리할 워커가 없어 남은 잡을 큐와 함께 지운다.
  await jobs?.destroy()
  // 콘텐츠는 사용자 삭제에 딸려 지워진다.
  if (userId) await db.drizzle.delete(schema.users).where(eq(schema.users.id, userId))
  await db?.close()
})

const ids = (page: { items: { id: string }[] }): string[] => page.items.map((item) => item.id)

it('저장한 콘텐츠를 보관하고, 삭제하면 휴지통 목록으로 가고, 복구하면 보관됨으로 돌아온다', async () => {
  const kept = await client.saveContent({ url: 'https://example.com/e2e/kept', source: 'web' })
  const saved = await client.saveContent({ url: 'https://example.com/e2e/moved', source: 'web' })
  const id = saved.content.id
  expect(saved.content.archiveState).toBe('inbox')

  // 보관: 보관 상태만 바뀐다.
  const archived = await client.archiveContent(id)
  expect(archived).toEqual({ ...saved.content, archiveState: 'archived' })
  expect(ids(await client.listContents({ archiveState: 'archived' }))).toEqual([id])
  expect(ids(await client.listContents({ archiveState: 'inbox' }))).toEqual([kept.content.id])

  // 삭제: 기본 목록과 단건 조회에서 빠지고 휴지통 목록에 나온다.
  const trashed = await client.trashContent(id)
  expect(trashed.archiveState).toBe('trashed')
  expect(ids(await client.listContents())).toEqual([kept.content.id])
  expect(ids(await client.listContents({ archiveState: 'trashed' }))).toEqual([id])
  await expect(client.getContent(id)).rejects.toMatchObject({ code: 'NOT_FOUND' })

  // 휴지통의 콘텐츠는 보관할 수 없고, 거부된 뒤에도 휴지통에 그대로 있다.
  const rejected = await client.archiveContent(id).catch((error: unknown) => error)
  expect(rejected).toBeInstanceOf(ApiError)
  expect(rejected).toMatchObject({ code: 'INVALID_STATE_TRANSITION', status: 409 })
  expect(ids(await client.listContents({ archiveState: 'trashed' }))).toEqual([id])

  // 복구: 삭제하기 직전 상태(보관됨)로 돌아가고 휴지통 목록에서 사라진다.
  const restored = await client.restoreContent(id)
  expect(restored).toEqual(archived)
  expect(ids(await client.listContents({ archiveState: 'trashed' }))).toEqual([])
  expect(await client.getContent(id)).toEqual(archived)

  // 기본 목록에 다시 나오고, 정렬을 뒤집으면 순서가 뒤집힌다.
  const recent = ids(await client.listContents())
  expect(recent).toEqual([id, kept.content.id])
  expect(ids(await client.listContents({ sort: 'oldest' }))).toEqual([kept.content.id, id])
})
