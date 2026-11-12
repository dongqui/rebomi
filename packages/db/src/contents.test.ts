import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { eq, sql } from 'drizzle-orm'
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
  // 콘텐츠는 사용자 삭제에 딸려 지워진다.
  for (const id of createdUserIds) {
    await db.drizzle.delete(schema.users).where(eq(schema.users.id, id))
  }
  await db.close()
})

async function createUser(): Promise<string> {
  const [user] = await db.drizzle
    .insert(schema.users)
    .values({ email: `c-${crypto.randomUUID()}@example.com` })
    .returning()
  createdUserIds.push(user!.id)
  return user!.id
}

const contentValues = (userId: string, normalizedUrl = 'https://example.com/a') => ({
  userId,
  url: `${normalizedUrl}?utm_source=x`,
  normalizedUrl,
  domain: 'example.com',
  source: 'web' as const,
  resurfacingIncluded: true,
})

/** drizzle은 pg 오류를 DrizzleQueryError.cause 로 감싼다. */
const pgCode = (promise: Promise<unknown>): Promise<string | undefined> =>
  promise.then(
    () => undefined,
    (caught: unknown) => (caught as { cause?: { code?: string } }).cause?.code,
  )

describe('contents 테이블', () => {
  it('필수 값만 넣으면 상태 축들이 저장 직후의 기본값으로 채워진다', async () => {
    const userId = await createUser()

    const [row] = await db.drizzle.insert(schema.contents).values(contentValues(userId)).returning()

    expect(row).toMatchObject({
      userId,
      url: 'https://example.com/a?utm_source=x',
      normalizedUrl: 'https://example.com/a',
      title: null,
      description: null,
      domain: 'example.com',
      imageUrl: null,
      source: 'web',
      archiveState: 'inbox',
      linkState: 'ok',
      extractionLevel: 'metadata_only',
      summaryStatus: 'pending',
      metadataStatus: 'pending',
      resurfacingIncluded: true,
    })
    expect(row?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-/)
    expect(row?.savedAt).toBeInstanceOf(Date)
  })

  it('다섯 상태 축과 메타데이터 처리 상태가 서로 다른 컬럼이다', async () => {
    const result = await db.drizzle.execute(
      sql`select column_name from information_schema.columns
          where table_schema = 'public' and table_name = 'contents'`,
    )
    const columns = result.rows.map((row) => row.column_name)

    expect(columns).toEqual(
      expect.arrayContaining([
        'archive_state',
        'link_state',
        'extraction_level',
        'summary_status',
        'resurfacing_included',
        'metadata_status',
      ]),
    )
  })

  it('한 축을 바꿔도 다른 축은 그대로다', async () => {
    const userId = await createUser()
    const [row] = await db.drizzle.insert(schema.contents).values(contentValues(userId)).returning()

    const [updated] = await db.drizzle
      .update(schema.contents)
      .set({ archiveState: 'trashed' })
      .where(eq(schema.contents.id, row!.id))
      .returning()

    expect(updated).toMatchObject({
      archiveState: 'trashed',
      linkState: 'ok',
      extractionLevel: 'metadata_only',
      summaryStatus: 'pending',
      metadataStatus: 'pending',
      resurfacingIncluded: true,
    })
  })

  it('같은 사용자가 같은 정규화 URL을 두 번 넣으면 unique 제약으로 거부한다', async () => {
    const userId = await createUser()
    await db.drizzle.insert(schema.contents).values(contentValues(userId))

    // 원본 URL이 달라도 정규화 URL이 같으면 중복이다. 23505 = unique_violation.
    const code = await pgCode(
      db.drizzle
        .insert(schema.contents)
        .values({ ...contentValues(userId), url: 'https://example.com/a?fbclid=y' }),
    )

    expect(code).toBe('23505')
  })

  it('다른 사용자는 같은 정규화 URL을 넣을 수 있다', async () => {
    const first = await createUser()
    const second = await createUser()
    await db.drizzle.insert(schema.contents).values(contentValues(first))

    const [row] = await db.drizzle.insert(schema.contents).values(contentValues(second)).returning()

    expect(row?.userId).toBe(second)
  })

  it.each([
    ['source', 'fax'],
    ['archive_state', 'dead'],
    ['link_state', 'archived'],
    ['extraction_level', 'done'],
    ['summary_status', 'inbox'],
    ['metadata_status', 'no_content'],
  ])('%s 에 정의되지 않은 값 %s 를 넣으면 check 제약으로 거부한다', async (column, value) => {
    const userId = await createUser()
    const [row] = await db.drizzle.insert(schema.contents).values(contentValues(userId)).returning()

    // 23514 = check_violation. 타입을 우회하는 원시 SQL로 DB 자체가 막는지 본다.
    const code = await pgCode(
      db.drizzle.execute(
        sql`update contents set ${sql.identifier(column)} = ${value} where id = ${row!.id}`,
      ),
    )

    expect(code).toBe('23514')
  })

  it('사용자를 지우면 그 사용자의 콘텐츠도 지워진다', async () => {
    const userId = await createUser()
    await db.drizzle.insert(schema.contents).values(contentValues(userId))

    await db.drizzle.delete(schema.users).where(eq(schema.users.id, userId))

    const rows = await db.drizzle
      .select()
      .from(schema.contents)
      .where(eq(schema.contents.userId, userId))
    expect(rows).toEqual([])
  })
})

describe('content_bodies 테이블', () => {
  it('콘텐츠 하나에 본문 하나를 둔다', async () => {
    const userId = await createUser()
    const [content] = await db.drizzle
      .insert(schema.contents)
      .values(contentValues(userId, 'https://example.com/body-1'))
      .returning()

    const [body] = await db.drizzle
      .insert(schema.contentBodies)
      .values({ contentId: content!.id, text: '본문' })
      .returning()

    expect(body).toMatchObject({ contentId: content!.id, text: '본문' })
    expect(body?.extractedAt).toBeInstanceOf(Date)
    expect(
      await pgCode(
        db.drizzle.insert(schema.contentBodies).values({ contentId: content!.id, text: '둘째' }),
      ),
    ).toBe('23505')
  })

  it('콘텐츠를 지우면 본문도 지워진다', async () => {
    const userId = await createUser()
    const [content] = await db.drizzle
      .insert(schema.contents)
      .values(contentValues(userId, 'https://example.com/body-2'))
      .returning()
    await db.drizzle.insert(schema.contentBodies).values({ contentId: content!.id, text: '본문' })

    await db.drizzle.delete(schema.contents).where(eq(schema.contents.id, content!.id))

    const rows = await db.drizzle
      .select()
      .from(schema.contentBodies)
      .where(eq(schema.contentBodies.contentId, content!.id))
    expect(rows).toEqual([])
  })

  it('없는 콘텐츠의 본문은 넣을 수 없다', async () => {
    expect(
      await pgCode(
        db.drizzle
          .insert(schema.contentBodies)
          .values({ contentId: crypto.randomUUID(), text: '본문' }),
      ),
    ).toBe('23503')
  })
})
