import { randomUUID } from 'node:crypto'
import {
  CONTENT_SAVE_LIMITS,
  contentSchema,
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

const getOne = (app: FastifyInstance, token: string | null, id: string) =>
  app.inject({
    method: 'GET',
    url: `/contents/${id}`,
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

/** 그 콘텐츠의 저장된 본문. 없으면 null. */
async function bodyOf(contentId: string): Promise<string | null> {
  const [row] = await db.drizzle
    .select({ text: schema.contentBodies.text })
    .from(schema.contentBodies)
    .where(eq(schema.contentBodies.contentId, contentId))
  return row?.text ?? null
}

/** 그 사용자의 콘텐츠에 딸린 본문 행의 수. */
async function bodyCount(userId: string): Promise<number> {
  const rows = await db.drizzle
    .select({ id: schema.contentBodies.contentId })
    .from(schema.contentBodies)
    .innerJoin(schema.contents, eq(schema.contents.id, schema.contentBodies.contentId))
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
      // 휴지통의 행은 삭제 시각과 삭제 전 상태가 있어야 한다 (DB 제약).
      ...(values.archiveState === 'trashed'
        ? { trashedAt: new Date(), trashedFrom: 'inbox' as const }
        : {}),
      ...values,
    })
    .returning()
  return row!.id
}

type ContentAction = 'archive' | 'trash' | 'restore'

const act = (app: FastifyInstance, token: string | null, id: string, action: ContentAction) =>
  app.inject({
    method: 'POST',
    url: `/contents/${id}/${action}`,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

/** 성공해야 하는 동작. 본문을 계약으로 파싱해 돌려준다. */
async function actOk(
  app: FastifyInstance,
  token: string,
  id: string,
  action: ContentAction,
): Promise<Content> {
  const response = await act(app, token, id, action)
  expect(response.statusCode).toBe(200)
  return contentSchema.parse(response.json())
}

async function rowOf(id: string) {
  const [row] = await db.drizzle.select().from(schema.contents).where(eq(schema.contents.id, id))
  return row!
}

const idsOf = (body: { items: Content[] }): string[] => body.items.map((item) => item.id)

/** 조건을 유지한 채 끝까지 넘겨 받은 ID들과 페이지 수. */
async function listAll(
  app: FastifyInstance,
  token: string,
  query: string,
): Promise<{ ids: string[]; pages: number }> {
  const ids: string[] = []
  let cursor: string | null = null
  let pages = 0
  do {
    const next: string = cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''
    const body = await listOk(app, token, `${query}${next}`)
    ids.push(...idsOf(body))
    cursor = body.nextCursor
    pages += 1
  } while (cursor !== null && pages < 10)
  return { ids, pages }
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

  describe('본문을 함께 받는 저장 (CAP-2)', () => {
    const BODY = '저장하는 순간과 필요한 순간이 다르다. 그래서 다시 보여 주는 장치가 필요하다.'

    it('본문과 함께 저장하면 추출 수준이 full이고 DB에 본문이 남는다', async () => {
      const app = newApp()
      const user = await newUser()

      const response = await save(app, user.token, {
        url: 'https://example.com/with-body',
        source: 'extension',
        body: BODY,
      })

      expect(response.statusCode).toBe(201)
      const { status, content } = createContentResponseSchema.parse(response.json())
      expect(status).toBe('created')
      expect(content.extractionLevel).toBe('full')
      expect(await bodyOf(content.id)).toBe(BODY)
    })

    it('함께 보낸 제목·설명·대표 이미지가 응답과 목록에 나타난다', async () => {
      const app = newApp()
      const user = await newUser()
      const sent = {
        title: '다시 만나는 글',
        description: '페이지가 밝힌 설명',
        imageUrl: 'https://example.com/cover.png',
      }

      const response = await save(app, user.token, {
        url: 'https://example.com/with-meta',
        source: 'extension',
        ...sent,
      })

      expect(createContentResponseSchema.parse(response.json()).content).toMatchObject(sent)
      expect((await listOk(app, user.token)).items[0]).toMatchObject(sent)
    })

    it('본문 없이 제목만 보내면 추출 수준은 metadata_only이고 본문 행이 없다', async () => {
      const app = newApp()
      const user = await newUser()

      const response = await save(app, user.token, {
        url: 'https://example.com/title-only',
        source: 'extension',
        title: '제목만',
      })

      const { content } = createContentResponseSchema.parse(response.json())
      expect(content.title).toBe('제목만')
      expect(content.extractionLevel).toBe('metadata_only')
      expect(await bodyOf(content.id)).toBeNull()
    })

    it('공백뿐인 본문·제목·설명은 없는 것으로 본다', async () => {
      const app = newApp()
      const user = await newUser()

      const response = await save(app, user.token, {
        url: 'https://example.com/blank',
        source: 'extension',
        title: '  ',
        description: '\n\t',
        body: ' \n\t ',
      })

      expect(response.statusCode).toBe(201)
      const { content } = createContentResponseSchema.parse(response.json())
      expect(content).toMatchObject({
        title: null,
        description: null,
        extractionLevel: 'metadata_only',
      })
      expect(await bodyOf(content.id)).toBeNull()
    })

    it('앞뒤 공백을 떼고 저장한다', async () => {
      const app = newApp()
      const user = await newUser()

      const response = await save(app, user.token, {
        url: 'https://example.com/trim',
        source: 'extension',
        title: '  제목  ',
        body: `\n\n${BODY}\n`,
      })

      const { content } = createContentResponseSchema.parse(response.json())
      expect(content.title).toBe('제목')
      expect(await bodyOf(content.id)).toBe(BODY)
    })

    it('본문이 있어도 처리 잡을 넣고 처리 상태는 pending으로 시작한다', async () => {
      // 본문이 있는 콘텐츠를 가져올지 말지는 워커가 정한다 (#19).
      const app = newApp()
      const user = await newUser()

      const response = await save(app, user.token, {
        url: 'https://example.com/body-job',
        source: 'extension',
        body: BODY,
      })

      const { content } = createContentResponseSchema.parse(response.json())
      expect(content.metadataStatus).toBe('pending')
      expect(await queuedJobsFor(content.id)).toEqual([{ state: 'created' }])
    })

    it('본문은 응답에 실리지 않는다', async () => {
      const app = newApp()
      const user = await newUser()

      const response = await save(app, user.token, {
        url: 'https://example.com/body-hidden',
        source: 'extension',
        body: BODY,
      })

      expect(response.statusCode).toBe(201)
      expect(response.body).not.toContain(BODY)
      expect((await list(app, user.token)).body).not.toContain(BODY)
    })

    it('상한 길이의 본문은 JSON으로 부풀어 1MB를 넘어도 받는다', async () => {
      // 제어 문자는 JSON에서 6바이트(\u0001)가 된다. 기본 요청 크기 제한(1MB)에 걸리면
      // 상한 안의 본문이 계약과 무관한 이유로 거부된다.
      const app = newApp()
      const user = await newUser()
      const body = `가${'\u0001'.repeat(CONTENT_SAVE_LIMITS.body - 2)}나`

      const response = await save(app, user.token, {
        url: 'https://example.com/inflated',
        source: 'extension',
        body,
      })

      expect(response.statusCode).toBe(201)
      const { content } = createContentResponseSchema.parse(response.json())
      expect((await bodyOf(content.id))?.length).toBe(CONTENT_SAVE_LIMITS.body)
    })

    it.each([
      ['body', '가'.repeat(CONTENT_SAVE_LIMITS.body + 1)],
      ['title', '가'.repeat(CONTENT_SAVE_LIMITS.title + 1)],
      ['description', '가'.repeat(CONTENT_SAVE_LIMITS.description + 1)],
      ['imageUrl', `https://example.com/${'a'.repeat(CONTENT_SAVE_LIMITS.imageUrl)}`],
      ['imageUrl', '/cover.png'],
      ['imageUrl', 'data:image/png;base64,AAAA'],
      ['body', 123],
      ['title', null],
    ])(
      '%s 가 상한을 넘거나 모양이 틀리면 400 VALIDATION_FAILED이고 저장되지 않는다',
      async (field, value) => {
        const app = newApp()
        const user = await newUser()

        const response = await save(app, user.token, {
          url: 'https://example.com/rejected',
          source: 'extension',
          [field]: value,
        })

        expect(response.statusCode).toBe(400)
        expect(errorCode(response)).toBe('VALIDATION_FAILED')
        expect(await contentCount(user.id)).toBe(0)
      },
    )

    it('큐에 넣지 못하면 본문도 남지 않는다', async () => {
      const app = newApp({
        enqueueContentProcess: () => Promise.reject(new Error('queue down')),
      })
      const user = await newUser()

      const response = await save(app, user.token, {
        url: 'https://example.com/body-rollback',
        source: 'extension',
        body: BODY,
      })

      expect(response.statusCode).toBe(500)
      expect(await contentCount(user.id)).toBe(0)
      expect(await bodyCount(user.id)).toBe(0)
    })
  })

  describe('이미 저장한 URL을 본문과 함께 다시 저장', () => {
    const BODY = '확장이 페이지에서 직접 읽은 본문이다.'
    const again = (app: FastifyInstance, token: string, path: string, extra: object) =>
      save(app, token, { url: `https://example.com/${path}`, source: 'extension', ...extra })

    it('기존이 metadata_only이면 본문을 넣고 full로 올린다 — 응답은 duplicate다', async () => {
      const app = newApp()
      const user = await newUser()
      const first = await saveOk(app, user.token, 'https://example.com/upgrade')

      const response = await again(app, user.token, 'upgrade?utm_source=x', { body: BODY })

      expect(response.statusCode).toBe(200)
      const { status, content } = createContentResponseSchema.parse(response.json())
      expect(status).toBe('duplicate')
      expect(content).toEqual({ ...first.content, extractionLevel: 'full' })
      expect(await bodyOf(content.id)).toBe(BODY)
      expect(await contentCount(user.id)).toBe(1)
      expect(await queuedJobsFor(content.id)).toHaveLength(1)
    })

    it('본문을 넣을 때 비어 있는 제목·설명·이미지만 채운다', async () => {
      const app = newApp()
      const user = await newUser()
      const id = await insertContent(user.id, 'fill-empty', { title: '원래 제목' })

      const response = await again(app, user.token, 'fill-empty', {
        body: BODY,
        title: '새 제목',
        description: '새 설명',
        imageUrl: 'https://example.com/new.png',
      })

      const { content } = createContentResponseSchema.parse(response.json())
      expect(content).toMatchObject({
        id,
        title: '원래 제목',
        description: '새 설명',
        imageUrl: 'https://example.com/new.png',
        extractionLevel: 'full',
      })
    })

    it('본문이 이미 있으면 아무것도 바꾸지 않는다', async () => {
      const app = newApp()
      const user = await newUser()
      const first = createContentResponseSchema.parse(
        (await again(app, user.token, 'keep', { body: '먼저 저장한 본문' })).json(),
      )

      const response = await again(app, user.token, 'keep', {
        body: BODY,
        title: '나중 제목',
        description: '나중 설명',
        imageUrl: 'https://example.com/later.png',
      })

      const { status, content } = createContentResponseSchema.parse(response.json())
      expect(status).toBe('duplicate')
      expect(content).toEqual(first.content)
      expect(await bodyOf(content.id)).toBe('먼저 저장한 본문')
    })

    it.each([
      ['본문 없이 제목만', { title: '나중 제목' }],
      ['공백뿐인 본문', { body: ' \n ', title: '나중 제목' }],
    ])('%s 다시 저장하면 아무것도 바꾸지 않는다', async (_name, extra) => {
      const app = newApp()
      const user = await newUser()
      const first = await saveOk(app, user.token, 'https://example.com/untouched')

      const response = await again(app, user.token, 'untouched', extra)

      const { content } = createContentResponseSchema.parse(response.json())
      expect(content).toEqual(first.content)
      expect(await bodyOf(content.id)).toBeNull()
    })

    it('본문이 없어 no_content였던 요약 상태는 본문이 생기면 pending으로 돌아간다', async () => {
      // no_content는 "본문 없음"이다. 본문이 생겼는데 그대로면 두 축이 서로 어긋난다.
      const app = newApp()
      const user = await newUser()
      await insertContent(user.id, 'no-content', {
        metadataStatus: 'done',
        summaryStatus: 'no_content',
      })

      const response = await again(app, user.token, 'no-content', { body: BODY })

      const { content } = createContentResponseSchema.parse(response.json())
      expect(content).toMatchObject({
        extractionLevel: 'full',
        summaryStatus: 'pending',
        metadataStatus: 'done',
      })
    })

    it('다른 사용자의 같은 URL 콘텐츠는 건드리지 않는다', async () => {
      const app = newApp()
      const alice = await newUser()
      const bob = await newUser()
      const alices = await saveOk(app, alice.token, 'https://example.com/both')
      await saveOk(app, bob.token, 'https://example.com/both')

      await again(app, bob.token, 'both', { body: BODY })

      expect(await bodyOf(alices.content.id)).toBeNull()
      const mine = contentSchema.parse((await getOne(app, alice.token, alices.content.id)).json())
      expect(mine).toEqual(alices.content)
    })
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
      JSON.stringify([
        'recent',
        "2026-01-01T00:00:00.000000Z'); drop table contents; --",
        randomUUID(),
      ]),
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

describe('GET /contents/:id', () => {
  it('내 콘텐츠 하나를 준다', async () => {
    const app = newApp()
    const user = await newUser()
    const saved = await saveOk(app, user.token, 'https://example.com/one')

    const response = await getOne(app, user.token, saved.content.id)

    expect(response.statusCode).toBe(200)
    expect(contentSchema.parse(response.json())).toEqual(saved.content)
  })

  it('처리가 끝난 뒤에는 바뀐 제목과 처리 상태를 준다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 'processed')
    await db.drizzle
      .update(schema.contents)
      .set({ title: '처리된 제목', metadataStatus: 'done' })
      .where(eq(schema.contents.id, id))

    const body = contentSchema.parse((await getOne(app, user.token, id)).json())

    expect(body.title).toBe('처리된 제목')
    expect(body.metadataStatus).toBe('done')
  })

  it('다른 사용자의 콘텐츠는 404 NOT_FOUND다', async () => {
    const app = newApp()
    const owner = await newUser()
    const other = await newUser()
    const id = await insertContent(owner.id, 'private')

    const response = await getOne(app, other.token, id)

    expect(response.statusCode).toBe(404)
    expect(errorCode(response)).toBe('NOT_FOUND')
  })

  it('없는 ID는 404 NOT_FOUND다', async () => {
    const app = newApp()
    const user = await newUser()

    const response = await getOne(app, user.token, randomUUID())

    expect(response.statusCode).toBe(404)
    expect(errorCode(response)).toBe('NOT_FOUND')
  })

  it('UUID 모양이 아닌 ID는 404 NOT_FOUND다', async () => {
    const app = newApp()
    const user = await newUser()

    const response = await getOne(app, user.token, 'not-a-uuid')

    expect(response.statusCode).toBe(404)
    expect(errorCode(response)).toBe('NOT_FOUND')
  })

  it('휴지통의 콘텐츠는 목록과 같게 404 NOT_FOUND다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 'trashed-one', { archiveState: 'trashed' })

    const response = await getOne(app, user.token, id)

    expect(response.statusCode).toBe(404)
    expect(errorCode(response)).toBe('NOT_FOUND')
  })

  it('인증 없는 요청은 401 UNAUTHORIZED다', async () => {
    const app = newApp()

    const response = await getOne(app, null, randomUUID())

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('UNAUTHORIZED')
  })

  it('응답에 계약에 없는 필드가 없다', async () => {
    const app = newApp()
    const user = await newUser()
    const saved = await saveOk(app, user.token, 'https://example.com/raw-one')

    const response = await getOne(app, user.token, saved.content.id)
    const raw = JSON.parse(response.body) as Record<string, unknown>

    expect(raw).not.toHaveProperty('normalizedUrl')
    expect(raw).not.toHaveProperty('userId')
    expect(response.body).not.toContain(user.id)
  })
})

describe('GET /contents — 보관 상태와 정렬 (LIB-1)', () => {
  it('보관 상태를 지정하면 그 상태의 콘텐츠만 준다', async () => {
    const app = newApp()
    const user = await newUser()
    const inbox = await insertContent(user.id, 'f-inbox')
    const archived = await insertContent(user.id, 'f-archived', { archiveState: 'archived' })
    const trashed = await insertContent(user.id, 'f-trashed', { archiveState: 'trashed' })

    expect(idsOf(await listOk(app, user.token, '?archiveState=inbox'))).toEqual([inbox])
    expect(idsOf(await listOk(app, user.token, '?archiveState=archived'))).toEqual([archived])
    expect(idsOf(await listOk(app, user.token, '?archiveState=trashed'))).toEqual([trashed])
  })

  it('휴지통 목록에도 다른 사용자의 콘텐츠는 나오지 않는다', async () => {
    const app = newApp()
    const alice = await newUser()
    const bob = await newUser()
    await insertContent(alice.id, 'alice-trashed', { archiveState: 'trashed' })

    expect((await listOk(app, bob.token, '?archiveState=trashed')).items).toEqual([])
  })

  it('오래된 순으로 주고, 페이지 사이에서 빠지거나 겹치지 않는다', async () => {
    const app = newApp()
    const user = await newUser()
    const expected: string[] = []
    for (let minute = 0; minute < 5; minute += 1) {
      expected.push(
        await insertContent(user.id, `old-${minute}`, {
          savedAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
        }),
      )
    }

    const { ids, pages } = await listAll(app, user.token, '?sort=oldest&limit=2')

    expect(pages).toBe(3)
    expect(ids).toEqual(expected)
  })

  it('sort=recent는 생략한 것과 같은 순서다', async () => {
    const app = newApp()
    const user = await newUser()
    for (let minute = 0; minute < 3; minute += 1) {
      await insertContent(user.id, `rec-${minute}`, {
        savedAt: new Date(Date.UTC(2026, 0, 1, 0, minute)),
      })
    }

    const explicit = await listAll(app, user.token, '?sort=recent&limit=2')

    expect(explicit.ids).toEqual(idsOf(await listOk(app, user.token)))
  })

  it('오래된 순에서 저장일이 같은 콘텐츠도 빠지거나 겹치지 않는다', async () => {
    const app = newApp()
    const user = await newUser()
    const savedAt = new Date(Date.UTC(2026, 1, 1))
    const expected: string[] = []
    for (let n = 0; n < 5; n += 1) {
      expected.push(await insertContent(user.id, `tie-${n}`, { savedAt }))
    }

    const { ids } = await listAll(app, user.token, '?sort=oldest&limit=2')

    expect([...ids].sort()).toEqual([...expected].sort())
  })

  it('보관 상태 조건과 정렬을 함께 쓰면 그 상태 안에서 페이지가 이어진다', async () => {
    const app = newApp()
    const user = await newUser()
    const expected: string[] = []
    for (let minute = 0; minute < 3; minute += 1) {
      const savedAt = new Date(Date.UTC(2026, 2, 1, 0, minute))
      expected.push(
        await insertContent(user.id, `mix-a-${minute}`, { archiveState: 'archived', savedAt }),
      )
      await insertContent(user.id, `mix-i-${minute}`, { savedAt })
    }

    const { ids, pages } = await listAll(
      app,
      user.token,
      '?archiveState=archived&sort=oldest&limit=2',
    )

    expect(pages).toBe(2)
    expect(ids).toEqual(expected)
  })

  it('다른 정렬로 받은 커서는 400 VALIDATION_FAILED다', async () => {
    const app = newApp()
    const user = await newUser()
    for (let n = 0; n < 3; n += 1) await insertContent(user.id, `cross-${n}`)
    const recent = await listOk(app, user.token, '?limit=1')

    const response = await list(
      app,
      user.token,
      `?sort=oldest&cursor=${encodeURIComponent(recent.nextCursor!)}`,
    )

    expect(response.statusCode).toBe(400)
    expect(errorCode(response)).toBe('VALIDATION_FAILED')
  })

  it.each(['?archiveState=all', '?archiveState=', '?sort=title'])(
    '잘못된 쿼리 "%s" 는 400 VALIDATION_FAILED다',
    async (query) => {
      const app = newApp()
      const user = await newUser()

      const response = await list(app, user.token, query)

      expect(response.statusCode).toBe(400)
      expect(errorCode(response)).toBe('VALIDATION_FAILED')
    },
  )
})

describe('POST /contents/:id/archive (LIB-3)', () => {
  it('Inbox의 콘텐츠를 보관하면 보관됨이 되고 다른 축은 그대로다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 'arc-1', {
      linkState: 'dead',
      extractionLevel: 'full',
      summaryStatus: 'done',
      metadataStatus: 'done',
      resurfacingIncluded: false,
    })
    const before = contentSchema.parse((await getOne(app, user.token, id)).json())

    const after = await actOk(app, user.token, id, 'archive')

    expect(after).toEqual({ ...before, archiveState: 'archived' })
    expect(await rowOf(id)).toMatchObject({
      archiveState: 'archived',
      linkState: 'dead',
      extractionLevel: 'full',
      summaryStatus: 'done',
      metadataStatus: 'done',
      resurfacingIncluded: false,
      trashedAt: null,
      trashedFrom: null,
    })
  })

  it('이미 보관됨이면 바꾸지 않고 200으로 답한다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 'arc-2', { archiveState: 'archived' })

    expect((await actOk(app, user.token, id, 'archive')).archiveState).toBe('archived')
  })

  it('휴지통의 콘텐츠는 409 INVALID_STATE_TRANSITION이고 바뀌지 않는다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 'arc-3', {
      archiveState: 'trashed',
      trashedFrom: 'archived',
    })
    const before = await rowOf(id)

    const response = await act(app, user.token, id, 'archive')

    expect(response.statusCode).toBe(409)
    expect(errorCode(response)).toBe('INVALID_STATE_TRANSITION')
    expect(await rowOf(id)).toEqual(before)
  })
})

describe('POST /contents/:id/trash (LIB-4)', () => {
  it('삭제한 콘텐츠는 기본 목록과 단건 조회에 나오지 않고 휴지통 목록에 나온다', async () => {
    const app = newApp()
    const user = await newUser()
    const kept = await insertContent(user.id, 'tr-kept')
    const id = await insertContent(user.id, 'tr-1')
    const started = Date.now()

    const after = await actOk(app, user.token, id, 'trash')

    expect(after.archiveState).toBe('trashed')
    expect(idsOf(await listOk(app, user.token))).toEqual([kept])
    expect((await getOne(app, user.token, id)).statusCode).toBe(404)
    expect(idsOf(await listOk(app, user.token, '?archiveState=trashed'))).toEqual([id])
    const row = await rowOf(id)
    expect(row.trashedFrom).toBe('inbox')
    // DB 시계로 찍는다. 테스트를 돌리는 쪽 시계와 조금 어긋날 수 있다.
    expect(Math.abs(row.trashedAt!.getTime() - started)).toBeLessThan(60_000)
  })

  it('보관됨에서 삭제하면 삭제 전 상태가 보관됨으로 남고 다른 축은 그대로다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 'tr-2', {
      archiveState: 'archived',
      linkState: 'dead',
      resurfacingIncluded: false,
    })

    await actOk(app, user.token, id, 'trash')

    expect(await rowOf(id)).toMatchObject({
      archiveState: 'trashed',
      trashedFrom: 'archived',
      linkState: 'dead',
      resurfacingIncluded: false,
    })
  })

  it('이미 휴지통이면 바꾸지 않고 200으로 답한다 — 삭제 시각과 삭제 전 상태가 그대로다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 'tr-3', {
      archiveState: 'trashed',
      trashedAt: new Date(Date.UTC(2026, 0, 1)),
      trashedFrom: 'archived',
    })
    const before = await rowOf(id)

    expect((await actOk(app, user.token, id, 'trash')).archiveState).toBe('trashed')
    expect(await rowOf(id)).toEqual(before)
  })
})

describe('POST /contents/:id/restore (LIB-4)', () => {
  it('복구한 콘텐츠는 휴지통 목록에서 사라지고 기본 목록에 다시 나온다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 're-1')
    const before = contentSchema.parse((await getOne(app, user.token, id)).json())
    await actOk(app, user.token, id, 'trash')

    const after = await actOk(app, user.token, id, 'restore')

    expect(after).toEqual(before)
    expect((await listOk(app, user.token, '?archiveState=trashed')).items).toEqual([])
    expect(idsOf(await listOk(app, user.token))).toEqual([id])
    expect((await getOne(app, user.token, id)).statusCode).toBe(200)
    expect(await rowOf(id)).toMatchObject({
      archiveState: 'inbox',
      trashedAt: null,
      trashedFrom: null,
    })
  })

  it('보관됨에서 삭제한 것은 보관됨으로 돌아간다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, 're-2', { archiveState: 'archived' })
    await actOk(app, user.token, id, 'trash')

    expect((await actOk(app, user.token, id, 'restore')).archiveState).toBe('archived')
  })

  it.each(['inbox', 'archived'] as const)(
    '휴지통이 아닌 콘텐츠(%s)는 바꾸지 않고 200으로 답한다',
    async (archiveState) => {
      const app = newApp()
      const user = await newUser()
      const id = await insertContent(user.id, `re-noop-${archiveState}`, { archiveState })

      expect((await actOk(app, user.token, id, 'restore')).archiveState).toBe(archiveState)
    },
  )
})

describe.each(['archive', 'trash', 'restore'] as const)('POST /contents/:id/%s — 공통', (action) => {
  it('다른 사용자의 콘텐츠는 404 NOT_FOUND이고 바뀌지 않는다', async () => {
    const app = newApp()
    const alice = await newUser()
    const bob = await newUser()
    const id = await insertContent(alice.id, `other-${action}`, {
      archiveState: action === 'restore' ? 'trashed' : 'inbox',
    })
    const before = await rowOf(id)

    const response = await act(app, bob.token, id, action)

    expect(response.statusCode).toBe(404)
    expect(errorCode(response)).toBe('NOT_FOUND')
    expect(await rowOf(id)).toEqual(before)
  })

  it.each([randomUUID(), 'not-a-uuid'])('없는 ID "%s" 는 404 NOT_FOUND다', async (id) => {
    const app = newApp()
    const user = await newUser()

    const response = await act(app, user.token, id, action)

    expect(response.statusCode).toBe(404)
    expect(errorCode(response)).toBe('NOT_FOUND')
  })

  it('인증 없는 요청은 401 UNAUTHORIZED이고 바뀌지 않는다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, `anon-${action}`)
    const before = await rowOf(id)

    const response = await act(app, null, id, action)

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('UNAUTHORIZED')
    expect(await rowOf(id)).toEqual(before)
  })

  it('응답에 계약에 없는 필드가 없다', async () => {
    const app = newApp()
    const user = await newUser()
    const id = await insertContent(user.id, `raw-${action}`)

    const response = await act(app, user.token, id, action)
    const raw = JSON.parse(response.body) as Record<string, unknown>

    expect(response.statusCode).toBe(200)
    expect(raw).not.toHaveProperty('trashedAt')
    expect(raw).not.toHaveProperty('trashedFrom')
    expect(raw).not.toHaveProperty('userId')
    expect(response.body).not.toContain(user.id)
  })
})
