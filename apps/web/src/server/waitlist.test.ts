// @vitest-environment node
import { randomUUID } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { createDb, eq, inArray, schema, type Db } from '@rebomi/db'
import { config } from 'dotenv'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { saveWaitlistResponse } from './waitlist'

// 실제 Postgres를 쓴다. 루트 .env 의 DATABASE_URL 을 읽는다.
config({ path: fileURLToPath(new URL('../../../../.env', import.meta.url)), quiet: true })

let db: Db
const createdIds: string[] = []

beforeAll(() => {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)
})

afterAll(async () => {
  if (createdIds.length > 0) {
    await db.drizzle
      .delete(schema.waitlistResponses)
      .where(inArray(schema.waitlistResponses.id, createdIds))
  }
  await db.close()
})

function newId(): string {
  const id = randomUUID()
  createdIds.push(id)
  return id
}

const first = { locale: 'ko', headline: 'progress', hero: 'none', occupation: 'employed' }

const put = (id: string, payload: unknown) =>
  saveWaitlistResponse(
    db,
    id,
    new Request(`http://web.test/api/waitlist/responses/${id}`, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: typeof payload === 'string' ? payload : JSON.stringify(payload),
    }),
  )

async function rowOf(id: string) {
  const [row] = await db.drizzle
    .select()
    .from(schema.waitlistResponses)
    .where(eq(schema.waitlistResponses.id, id))
  return row
}

describe('PUT /api/waitlist/responses/:id', () => {
  it('새 ID로 첫 답을 보내면 응답이 생기고, 본문 없이 204다', async () => {
    const id = newId()

    const response = await put(id, { ...first, locale: 'en', headline: 'find', hero: 'notice' })

    expect(response.status).toBe(204)
    expect(await response.text()).toBe('')
    expect(await rowOf(id)).toMatchObject({
      id,
      locale: 'en',
      headline: 'find',
      hero: 'notice',
      occupation: 'employed',
      saveIntent: null,
      email: null,
    })
  })

  it('같은 ID로 다시 보내면 같은 응답이 갱신되고, 보내지 않은 답은 비운다', async () => {
    const id = newId()
    await put(id, { ...first, saveIntent: 'learn' })

    await put(id, { ...first, occupation: 'creator' })

    const rows = await db.drizzle
      .select()
      .from(schema.waitlistResponses)
      .where(eq(schema.waitlistResponses.id, id))
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ occupation: 'creator', saveIntent: null })
  })

  it('"기타"에 적은 글은 그 답이 기타일 때만 남는다', async () => {
    const id = newId()
    await put(id, { ...first, occupation: 'other', occupationOther: ' 육아 중이에요 ' })
    expect(await rowOf(id)).toMatchObject({ occupation: 'other', occupationOther: '육아 중이에요' })

    await put(id, { ...first, occupation: 'studying', occupationOther: '육아 중이에요' })

    expect(await rowOf(id)).toMatchObject({ occupation: 'studying', occupationOther: null })
  })

  it('이메일은 정규화해 남기고, 이메일 없는 요청은 저장된 이메일을 지우지 않는다', async () => {
    const id = newId()
    await put(id, { ...first, email: '  Some.One@Example.COM ' })

    await put(id, { ...first, wantedHelp: 'pick' })

    expect(await rowOf(id)).toMatchObject({ email: 'some.one@example.com', wantedHelp: 'pick' })
  })

  it.each([
    ['이메일 형식', { ...first, email: 'not-an-email' }],
    ['정의되지 않은 답 키', { ...first, wantedHelp: 'tags' }],
    ['모르는 헤드라인', { ...first, headline: 'other' }],
    ['첫 화면 그림 없음', { locale: 'ko', headline: 'progress' }],
    ['깨진 JSON', '{"locale":'],
    ['빈 본문', ''],
  ])('%s: 400 VALIDATION_FAILED이고 저장되지 않는다', async (_name, payload) => {
    const id = newId()

    const response = await put(id, payload)

    expect(response.status).toBe(400)
    expect(((await response.json()) as { error: { code: string } }).error.code).toBe(
      'VALIDATION_FAILED',
    )
    expect(await rowOf(id)).toBeUndefined()
  })

  it.each(['not-a-uuid', '123'])('ID "%s" 는 형식이 틀려 400이다', async (id) => {
    const response = await put(id, first)

    expect(response.status).toBe(400)
  })

  it('4KB를 넘는 본문은 받지 않는다', async () => {
    const id = newId()

    const response = await put(id, { ...first, padding: 'a'.repeat(5_000) })

    expect(response.status).toBe(413)
    expect(await rowOf(id)).toBeUndefined()
  })
})
