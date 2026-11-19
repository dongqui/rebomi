import { randomUUID } from 'node:crypto'
import { createDb, eq, inArray, schema, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import type { JobQueue } from './jobs.js'
import { WAITLIST_RATE_LIMIT } from './routes/waitlist.js'

const connectionString = process.env.DATABASE_URL

let db: Db
const createdIds: string[] = []
let apps: FastifyInstance[] = []

/** 이 경로는 큐를 쓰지 않는다. */
const noJobs: JobQueue = {
  enqueueContentProcess: () => Promise.reject(new Error('큐를 쓰면 안 됩니다')),
}

beforeAll(() => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)
})

afterEach(async () => {
  for (const app of apps) await app.close()
  apps = []
})

afterAll(async () => {
  if (createdIds.length > 0) {
    await db.drizzle
      .delete(schema.waitlistResponses)
      .where(inArray(schema.waitlistResponses.id, createdIds))
  }
  await db.close()
})

function newApp(): FastifyInstance {
  const app = buildApp({
    db,
    corsOrigins: ['http://localhost:3000'],
    auth: {
      jwtSecret: 'test-secret-test-secret-test-secret-0123',
      verifiers: {},
      secureCookies: false,
    },
    jobs: noJobs,
  })
  apps.push(app)
  return app
}

/** 브라우저가 만드는 응답 ID. */
function newId(): string {
  const id = randomUUID()
  createdIds.push(id)
  return id
}

const first = { locale: 'ko', headline: 'progress', hero: 'none', occupation: 'employed' }

/** 인증 헤더 없이 보낸다 — 이 경로는 로그인을 요구하지 않는다. */
const put = (app: FastifyInstance, id: string, payload: unknown) =>
  app.inject({ method: 'PUT', url: `/waitlist/responses/${id}`, payload: payload as object })

async function rowOf(id: string) {
  const [row] = await db.drizzle
    .select()
    .from(schema.waitlistResponses)
    .where(eq(schema.waitlistResponses.id, id))
  return row
}

const errorCode = (response: { json(): unknown }): string =>
  (response.json() as { error: { code: string } }).error.code

describe('PUT /waitlist/responses/:id', () => {
  it('새 ID로 첫 질문의 답만 보내면 응답이 생기고 이메일 없이 남는다', async () => {
    const app = newApp()
    const id = newId()

    const response = await put(app, id, {
      locale: 'en',
      headline: 'scattered',
      hero: 'card',
      occupation: 'freelance',
    })

    expect(response.statusCode).toBe(204)
    expect(await rowOf(id)).toMatchObject({
      id,
      locale: 'en',
      headline: 'scattered',
      hero: 'card',
      occupation: 'freelance',
      occupationOther: null,
      saveIntent: null,
      frustration: null,
      wantedHelp: null,
      email: null,
    })
  })

  it('같은 ID로 다시 보내면 응답이 늘지 않고 답이 갱신된다', async () => {
    const app = newApp()
    const id = newId()
    await put(app, id, first)

    const response = await put(app, id, {
      ...first,
      occupation: 'creator',
      saveIntent: 'learn',
      frustration: 'forget',
    })

    expect(response.statusCode).toBe(204)
    const rows = await db.drizzle
      .select()
      .from(schema.waitlistResponses)
      .where(eq(schema.waitlistResponses.id, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      occupation: 'creator',
      saveIntent: 'learn',
      frustration: 'forget',
      wantedHelp: null,
    })
  })

  it('"기타"를 고르고 적은 글은 앞뒤 공백을 떼고 남는다', async () => {
    const app = newApp()
    const id = newId()

    await put(app, id, { ...first, occupation: 'other', occupationOther: '  육아 중이에요 ' })

    expect(await rowOf(id)).toMatchObject({
      occupation: 'other',
      occupationOther: '육아 중이에요',
    })
  })

  it('"기타"에서 다른 답으로 바꾸면 적어 둔 글은 지워진다', async () => {
    const app = newApp()
    const id = newId()
    await put(app, id, { ...first, occupation: 'other', occupationOther: '육아 중이에요' })

    await put(app, id, { ...first, occupation: 'studying', occupationOther: '육아 중이에요' })

    expect(await rowOf(id)).toMatchObject({ occupation: 'studying', occupationOther: null })
  })

  it('보내지 않은 답은 비운다 — 요청이 지금까지의 답 전체다', async () => {
    const app = newApp()
    const id = newId()
    await put(app, id, { ...first, saveIntent: 'learn', wantedHelp: 'find' })

    await put(app, id, { locale: 'ko', headline: 'progress', hero: 'none' })

    expect(await rowOf(id)).toMatchObject({
      occupation: null,
      saveIntent: null,
      wantedHelp: null,
    })
  })

  it('같은 ID로 이메일을 보내면 그 응답에 정규화된 이메일이 남는다', async () => {
    const app = newApp()
    const id = newId()
    const answers = {
      ...first,
      saveIntent: 'work',
      frustration: 'too_many',
      wantedHelp: 'rediscover',
    }
    await put(app, id, answers)

    const response = await put(app, id, { ...answers, email: '  Some.One@Example.COM ' })

    expect(response.statusCode).toBe(204)
    expect(await rowOf(id)).toMatchObject({
      ...answers,
      email: 'some.one@example.com',
    })
  })

  it('이메일 없는 요청은 이미 저장된 이메일을 지우지 않는다', async () => {
    const app = newApp()
    const id = newId()
    await put(app, id, { ...first, email: 'kept@example.com' })

    await put(app, id, { ...first, wantedHelp: 'pick' })

    expect(await rowOf(id)).toMatchObject({ email: 'kept@example.com', wantedHelp: 'pick' })
  })

  it('이메일을 낸 뒤에도 같은 ID로 이메일을 바꿀 수 있다', async () => {
    const app = newApp()
    const id = newId()
    await put(app, id, { ...first, email: 'typo@exmaple.com' })

    await put(app, id, { ...first, email: 'fixed@example.com' })

    expect((await rowOf(id))?.email).toBe('fixed@example.com')
  })

  it('서로 다른 ID로 같은 이메일을 내면 응답이 두 개 남는다', async () => {
    const app = newApp()
    const email = `twice-${randomUUID()}@example.com`

    const one = await put(app, newId(), { ...first, email })
    const two = await put(app, newId(), { ...first, email })

    expect([one.statusCode, two.statusCode]).toEqual([204, 204])
    const rows = await db.drizzle
      .select()
      .from(schema.waitlistResponses)
      .where(eq(schema.waitlistResponses.email, email))
    expect(rows).toHaveLength(2)
  })

  it('갱신해도 처음 만든 시각은 그대로이고 마지막 갱신 시각만 바뀐다', async () => {
    const app = newApp()
    const id = newId()
    await put(app, id, first)
    const before = await rowOf(id)
    await new Promise((resolve) => setTimeout(resolve, 15))

    await put(app, id, { ...first, saveIntent: 'try' })

    const after = await rowOf(id)
    expect(after!.createdAt).toEqual(before!.createdAt)
    expect(after!.updatedAt.getTime()).toBeGreaterThan(before!.updatedAt.getTime())
  })
  it('성공 응답은 본문이 없다 — 저장된 이메일과 답을 돌려주지 않는다', async () => {
    const app = newApp()
    const id = newId()

    const response = await put(app, id, { ...first, email: 'secret@example.com' })

    expect(response.statusCode).toBe(204)
    expect(response.body).toBe('')
  })

  it('저장된 응답을 읽는 경로가 없다', async () => {
    const app = newApp()
    const id = newId()
    await put(app, id, { ...first, email: 'secret@example.com' })

    const one = await app.inject({ method: 'GET', url: `/waitlist/responses/${id}` })
    const all = await app.inject({ method: 'GET', url: '/waitlist/responses' })

    expect([one.statusCode, all.statusCode]).toEqual([404, 404])
    expect(one.body + all.body).not.toContain('secret@example.com')
  })

  it('응답 저장은 사용자를 만들지 않는다', async () => {
    const app = newApp()
    const email = `not-a-user-${randomUUID()}@example.com`

    await put(app, newId(), { ...first, email })

    const users = await db.drizzle.select().from(schema.users).where(eq(schema.users.email, email))
    expect(users).toHaveLength(0)
  })

  it.each([
    ['이메일 형식', { ...first, email: 'not-an-email' }],
    ['빈 이메일', { ...first, email: '   ' }],
    ['정의되지 않은 답 키', { ...first, wantedHelp: 'tags' }],
    ['여러 개를 고른 답', { ...first, occupation: ['employed', 'creator'] }],
    ['너무 긴 기타 글', { ...first, occupation: 'other', occupationOther: 'a'.repeat(501) }],
    ['모르는 첫 화면 그림', { ...first, hero: 'video' }],
    ['모르는 언어', { ...first, locale: 'ja' }],
    ['모르는 헤드라인', { ...first, headline: 'other' }],
    ['언어 없음', { headline: 'progress', hero: 'none' }],
    ['빈 본문', {}],
  ])('%s: 400 VALIDATION_FAILED이고 저장되지 않는다', async (_name, payload) => {
    const app = newApp()
    const id = newId()

    const response = await put(app, id, payload)

    expect(response.statusCode).toBe(400)
    expect(errorCode(response)).toBe('VALIDATION_FAILED')
    expect(await rowOf(id)).toBeUndefined()
  })

  it('잘못된 요청은 이미 있는 응답을 바꾸지 않는다', async () => {
    const app = newApp()
    const id = newId()
    await put(app, id, { ...first, saveIntent: 'learn' })

    const response = await put(app, id, { ...first, saveIntent: 'hoard' })

    expect(response.statusCode).toBe(400)
    expect((await rowOf(id))?.saveIntent).toBe('learn')
  })

  it.each(['not-a-uuid', '123', `${randomUUID()}x`])(
    'ID "%s" 는 형식이 틀려 400 VALIDATION_FAILED다',
    async (id) => {
      const app = newApp()

      const response = await put(app, id, first)

      expect(response.statusCode).toBe(400)
      expect(errorCode(response)).toBe('VALIDATION_FAILED')
    },
  )

  it('4KB를 넘는 본문은 받지 않는다', async () => {
    const app = newApp()
    const id = newId()

    const response = await put(app, id, { ...first, padding: 'a'.repeat(5_000) })

    expect(response.statusCode).toBe(413)
    expect(await rowOf(id)).toBeUndefined()
  })

  it('한 출처가 1분 한도를 넘겨 보내면 429 RATE_LIMITED로 거부하고 저장하지 않는다', async () => {
    const app = newApp()
    const id = newId()
    for (let n = 0; n < WAITLIST_RATE_LIMIT.max; n += 1) {
      const response = await put(app, id, first)
      expect(response.statusCode).toBe(204)
    }

    const response = await put(app, id, { ...first, saveIntent: 'learn' })

    expect(response.statusCode).toBe(429)
    expect(errorCode(response)).toBe('RATE_LIMITED')
    expect((await rowOf(id))?.saveIntent).toBeNull()
  })

  it('한도는 이 경로에만 걸린다', async () => {
    const app = newApp()
    for (let n = 0; n < WAITLIST_RATE_LIMIT.max + 1; n += 1) await put(app, newId(), first)

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
  })
})

describe('CORS', () => {
  it('허용된 오리진의 브라우저가 PUT을 보낼 수 있다고 사전 요청에 답한다', async () => {
    const app = newApp()

    const response = await app.inject({
      method: 'OPTIONS',
      url: `/waitlist/responses/${randomUUID()}`,
      headers: {
        origin: 'http://localhost:3000',
        'access-control-request-method': 'PUT',
        'access-control-request-headers': 'content-type',
      },
    })

    expect(response.statusCode).toBe(204)
    expect(response.headers['access-control-allow-origin']).toBe('http://localhost:3000')
    expect(String(response.headers['access-control-allow-methods'])).toContain('PUT')
  })
})
