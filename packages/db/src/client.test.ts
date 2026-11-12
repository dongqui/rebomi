import net from 'node:net'
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

describe('transaction', () => {
  it('커밋하면 drizzle과 executeSql로 쓴 것이 함께 남는다', async () => {
    const db = createDb(connectionString!)
    const first = `tx-${crypto.randomUUID()}@example.com`
    const second = `tx-${crypto.randomUUID()}@example.com`

    const returned = await db.transaction(async (tx) => {
      await tx.drizzle.insert(schema.users).values({ email: first })
      await tx.executeSql('insert into users (email) values ($1)', [second])
      return 'done'
    })

    const rows = await db.drizzle.execute(
      sql`select email from users where email in (${first}, ${second})`,
    )
    expect(returned).toBe('done')
    expect(rows.rows).toHaveLength(2)

    await db.drizzle.execute(sql`delete from users where email in (${first}, ${second})`)
    await db.close()
  })

  it('중간에 던지면 둘 다 버리고 그 오류를 다시 던진다', async () => {
    const db = createDb(connectionString!)
    const first = `tx-${crypto.randomUUID()}@example.com`
    const second = `tx-${crypto.randomUUID()}@example.com`

    const attempt = db.transaction(async (tx) => {
      await tx.drizzle.insert(schema.users).values({ email: first })
      await tx.executeSql('insert into users (email) values ($1)', [second])
      throw new Error('의도적 실패')
    })

    await expect(attempt).rejects.toThrow('의도적 실패')
    const rows = await db.drizzle.execute(
      sql`select email from users where email in (${first}, ${second})`,
    )
    expect(rows.rows).toEqual([])
    await db.close()
  })

  it('트랜잭션이 끝나면 연결을 풀에 돌려준다', async () => {
    // 돌려주지 않으면 풀(기본 10개)이 말라 이후 요청이 전부 매달린다.
    const db = createDb(connectionString!)

    for (let i = 0; i < 25; i += 1) {
      await db.transaction(() => Promise.reject(new Error('x'))).catch(() => undefined)
    }

    await expect(ping(db)).resolves.toBeUndefined()
    await db.close()
  })
})

describe('타임아웃', () => {
  it('TCP는 받지만 응답하지 않는 서버에서 ping이 매달리지 않고 실패한다', async () => {
    // Postgres가 죽는 가장 흔한 형태는 거부가 아니라 무응답이다
    // (docker pause, max_connections 소진, 방화벽 DROP).
    const sockets: net.Socket[] = []
    const blackhole = net.createServer((socket) => sockets.push(socket))
    await new Promise<void>((resolve) => blackhole.listen(0, '127.0.0.1', resolve))
    const { port } = blackhole.address() as net.AddressInfo

    const db = createDb(`postgres://rebomi:rebomi@127.0.0.1:${port}/rebomi`)
    const startedAt = Date.now()

    await expect(ping(db)).rejects.toThrow()
    expect(Date.now() - startedAt).toBeLessThan(15_000)

    await db.close().catch(() => undefined)
    // 열린 소켓이 남으면 close()의 콜백이 영원히 오지 않는다.
    for (const socket of sockets) socket.destroy()
    await new Promise<void>((resolve) => blackhole.close(() => resolve()))
  }, 30_000)
})
