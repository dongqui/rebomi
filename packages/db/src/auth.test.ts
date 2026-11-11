import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq } from 'drizzle-orm'
import { createDb, schema, type Db } from './index.js'

const connectionString = process.env.DATABASE_URL

let db: Db
const createdUserIds: string[] = []

beforeAll(() => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)
})

afterAll(async () => {
  for (const id of createdUserIds) {
    await db.drizzle.delete(schema.users).where(eq(schema.users.id, id))
  }
  await db.close()
})

async function createUser(): Promise<string> {
  const [user] = await db.drizzle
    .insert(schema.users)
    .values({ email: `a-${crypto.randomUUID()}@example.com` })
    .returning()
  createdUserIds.push(user!.id)
  return user!.id
}

/** drizzle은 pg 오류를 DrizzleQueryError.cause 로 감싼다. */
const pgCode = (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (caught: unknown) => (caught as { cause?: { code?: string } }).cause?.code,
  )

const UNIQUE_VIOLATION = '23505'
const CHECK_VIOLATION = '23514'

describe('auth_identities 테이블', () => {
  it('같은 제공자의 같은 subject를 두 번 넣으면 unique 제약으로 거부한다', async () => {
    const subject = crypto.randomUUID()
    const first = await createUser()
    const second = await createUser()
    await db.drizzle
      .insert(schema.authIdentities)
      .values({ userId: first, provider: 'google', subject })

    const code = await pgCode(
      db.drizzle
        .insert(schema.authIdentities)
        .values({ userId: second, provider: 'google', subject }),
    )

    expect(code).toBe(UNIQUE_VIOLATION)
  })

  it('한 계정에 Google과 Apple 신원이 각각 붙는다', async () => {
    const userId = await createUser()
    const subject = crypto.randomUUID()

    await db.drizzle.insert(schema.authIdentities).values([
      { userId, provider: 'google', subject },
      { userId, provider: 'apple', subject },
    ])

    const rows = await db.drizzle
      .select()
      .from(schema.authIdentities)
      .where(eq(schema.authIdentities.userId, userId))
    expect(rows.map((row) => row.provider).sort()).toEqual(['apple', 'google'])
  })

  it('모르는 제공자를 check 제약으로 거부한다', async () => {
    const userId = await createUser()

    const code = await pgCode(
      db.drizzle.insert(schema.authIdentities).values({
        userId,
        provider: 'kakao' as 'google',
        subject: crypto.randomUUID(),
      }),
    )

    expect(code).toBe(CHECK_VIOLATION)
  })
})

describe('refresh_tokens 테이블', () => {
  it('같은 해시를 두 번 넣으면 unique 제약으로 거부한다', async () => {
    const userId = await createUser()
    const values = {
      userId,
      tokenHash: crypto.randomUUID(),
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    }
    await db.drizzle.insert(schema.refreshTokens).values(values)

    expect(await pgCode(db.drizzle.insert(schema.refreshTokens).values(values))).toBe(
      UNIQUE_VIOLATION,
    )
  })

  it('새 토큰은 폐기되지 않은 상태다', async () => {
    const userId = await createUser()

    const [row] = await db.drizzle
      .insert(schema.refreshTokens)
      .values({
        userId,
        tokenHash: crypto.randomUUID(),
        expiresAt: new Date('2027-01-01T00:00:00Z'),
      })
      .returning()

    expect(row).toMatchObject({ revokedAt: null, lastUsedAt: null })
  })
})

describe('사용자 삭제', () => {
  it('신원과 갱신 토큰이 함께 지워진다', async () => {
    const userId = await createUser()
    await db.drizzle
      .insert(schema.authIdentities)
      .values({ userId, provider: 'apple', subject: crypto.randomUUID() })
    await db.drizzle.insert(schema.refreshTokens).values({
      userId,
      tokenHash: crypto.randomUUID(),
      expiresAt: new Date('2027-01-01T00:00:00Z'),
    })

    await db.drizzle.delete(schema.users).where(eq(schema.users.id, userId))

    const identities = await db.drizzle
      .select()
      .from(schema.authIdentities)
      .where(eq(schema.authIdentities.userId, userId))
    const tokens = await db.drizzle
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, userId))
    expect(identities).toEqual([])
    expect(tokens).toEqual([])
  })
})
