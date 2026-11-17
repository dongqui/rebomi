import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { inArray } from 'drizzle-orm'
import { createDb, schema, type Db } from './index.js'

const connectionString = process.env.DATABASE_URL

let db: Db
const createdIds: string[] = []

beforeAll(() => {
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

/** ID는 넣는 쪽(브라우저)이 만든다. */
function newId(): string {
  const id = crypto.randomUUID()
  createdIds.push(id)
  return id
}

const base = { locale: 'ko' as const, headline: 'forgot' as const }

/** drizzle은 pg 오류를 DrizzleQueryError.cause 로 감싼다. */
const pgCode = (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (caught: unknown) => (caught as { cause?: { code?: string } }).cause?.code,
  )

const CHECK_VIOLATION = '23514'
const NOT_NULL_VIOLATION = '23502'

describe('waitlist_responses 테이블', () => {
  it('첫 답만 있는 응답은 나머지 답과 이메일이 비어 있다', async () => {
    const id = newId()

    const [row] = await db.drizzle
      .insert(schema.waitlistResponses)
      .values({ id, ...base, savePlaces: ['instagram'] })
      .returning()

    expect(row).toMatchObject({
      id,
      locale: 'ko',
      headline: 'forgot',
      savePlaces: ['instagram'],
      revisitFrequency: null,
      mostHelpful: null,
      willingnessToPay: null,
      email: null,
    })
    expect(row!.createdAt).toBeInstanceOf(Date)
    expect(row!.updatedAt).toBeInstanceOf(Date)
  })

  it('ID를 주지 않으면 넣을 수 없다 — DB가 대신 만들지 않는다', async () => {
    const insert = db.drizzle.execute(
      `insert into waitlist_responses (locale, headline) values ('ko', 'forgot')`,
    )

    expect(await pgCode(insert)).toBe(NOT_NULL_VIOLATION)
  })

  it('같은 이메일의 응답을 여러 개 둘 수 있다', async () => {
    const email = `same-${crypto.randomUUID()}@example.com`

    await db.drizzle.insert(schema.waitlistResponses).values([
      { id: newId(), ...base, email },
      { id: newId(), ...base, email },
    ])

    const rows = await db.drizzle
      .select()
      .from(schema.waitlistResponses)
      .where(inArray(schema.waitlistResponses.id, createdIds.slice(-2)))
    expect(rows.map((row) => row.email)).toEqual([email, email])
  })

  it.each([
    ['save_places', `'{tiktok}'`],
    ['revisit_frequency', `'daily'`],
    ['most_helpful', `'tags'`],
    ['willingness_to_pay', `'sure'`],
    ['locale', `'ja'`],
    ['headline', `'other'`],
  ])('%s 에 정의되지 않은 값 %s 는 넣을 수 없다', async (column, value) => {
    const id = newId()
    const columns = ['id', 'locale', 'headline']
    const values = [`'${id}'`, `'ko'`, `'forgot'`]
    const at = columns.indexOf(column)
    if (at === -1) {
      columns.push(column)
      values.push(value)
    } else {
      values[at] = value
    }

    const insert = db.drizzle.execute(
      `insert into waitlist_responses (${columns.join(', ')}) values (${values.join(', ')})`,
    )

    expect(await pgCode(insert)).toBe(CHECK_VIOLATION)
  })
})
