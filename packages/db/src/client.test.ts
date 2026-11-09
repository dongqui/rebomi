import { describe, it, expect, beforeAll } from 'vitest'
import { sql } from 'drizzle-orm'
import { createDb, ping, schema } from './index.js'

const connectionString = process.env.DATABASE_URL

beforeAll(() => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
})

describe('createDb', () => {
  it('연결해 ping이 통과한다', async () => {
    const db = createDb(connectionString!)
    await expect(ping(db)).resolves.toBeUndefined()
    await db.close()
  })
})

describe('마이그레이션', () => {
  it('pgroonga와 vector 확장을 활성화했다', async () => {
    const db = createDb(connectionString!)
    const result = await db.drizzle.execute(
      sql`select extname from pg_extension where extname in ('pgroonga', 'vector')`,
    )
    expect(result.rows.map((row) => row.extname).sort()).toEqual(['pgroonga', 'vector'])
    await db.close()
  })
})

describe('users 테이블', () => {
  it('insert하면 id와 created_at이 채워지고 email로 조회된다', async () => {
    const db = createDb(connectionString!)
    const email = `t-${crypto.randomUUID()}@example.com`

    const [inserted] = await db.drizzle.insert(schema.users).values({ email }).returning()

    expect(inserted?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    expect(inserted?.createdAt).toBeInstanceOf(Date)
    expect(inserted?.email).toBe(email)

    await db.drizzle.delete(schema.users).where(sql`email = ${email}`)
    await db.close()
  })

  it('같은 email을 두 번 넣으면 unique 제약으로 거부한다', async () => {
    const db = createDb(connectionString!)
    const email = `dup-${crypto.randomUUID()}@example.com`

    await db.drizzle.insert(schema.users).values({ email })

    // drizzle은 pg 오류를 DrizzleQueryError.cause 로 감싼다. 23505 = unique_violation.
    const error: unknown = await db.drizzle
      .insert(schema.users)
      .values({ email })
      .then(
        () => null,
        (caught: unknown) => caught,
      )

    expect(error).not.toBeNull()
    expect((error as { cause?: { code?: string } }).cause?.code).toBe('23505')

    await db.drizzle.delete(schema.users).where(sql`email = ${email}`)
    await db.close()
  })
})
