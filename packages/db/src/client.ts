import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

/**
 * 열려 있는 트랜잭션 하나. `drizzle` 과 `executeSql` 이 같은 연결을 쓴다.
 *
 * `executeSql` 은 pg-boss가 요구하는 모양이다 — 잡 삽입을 이 트랜잭션에 실어, 행과 잡이
 * 함께 커밋되거나 함께 버려지게 한다.
 */
export type DbTransaction = {
  drizzle: NodePgDatabase<typeof schema>
  executeSql(text: string, values?: unknown[]): Promise<{ rows: unknown[] }>
}

export type Db = {
  drizzle: NodePgDatabase<typeof schema>
  /** `run` 이 던지면 롤백하고 그 오류를 다시 던진다. 아니면 커밋하고 결과를 돌려준다. */
  transaction<T>(run: (tx: DbTransaction) => Promise<T>): Promise<T>
  close(): Promise<void>
}

/**
 * 커넥션 풀과 Drizzle 인스턴스를 묶어 돌려준다.
 *
 * 질의는 내보내지 않는다 — 스키마와 이 팩토리만이 이 패키지의 표면이고,
 * 질의는 apps/api 와 apps/worker 가 각자 작성한다 (스펙 3장).
 */
/**
 * 타임아웃이 없으면 가장 흔한 DB 장애(무응답)에서 호출이 영원히 매달린다 —
 * docker pause, max_connections 소진, 방화벽 DROP. 그러면 `/health` 가 503을
 * 돌려주지 못하고 멈춰서, 모니터링이 degraded 를 보지 못한다.
 */
const DEFAULT_TIMEOUT_MS = 5_000

export type CreateDbOptions = {
  /** 연결 수립(핸드셰이크 포함) 제한. */
  connectionTimeoutMs?: number
  /** 개별 질의 제한. */
  statementTimeoutMs?: number
}

export function createDb(connectionString: string, options: CreateDbOptions = {}): Db {
  const connectionTimeoutMillis = options.connectionTimeoutMs ?? DEFAULT_TIMEOUT_MS
  const statementTimeout = options.statementTimeoutMs ?? DEFAULT_TIMEOUT_MS

  const pool = new Pool({
    connectionString,
    connectionTimeoutMillis,
    statement_timeout: statementTimeout,
    query_timeout: statementTimeout,
    idleTimeoutMillis: 30_000,
  })
  return {
    drizzle: drizzle(pool, { schema }),
    transaction: async (run) => {
      const client = await pool.connect()
      try {
        await client.query('begin')
        const result = await run({
          drizzle: drizzle(client, { schema }),
          executeSql: (text, values) => client.query(text, values),
        })
        await client.query('commit')
        return result
      } catch (error) {
        // 연결이 이미 끊겼으면 롤백도 실패한다. 원래 오류를 가리지 않게 삼킨다.
        await client.query('rollback').catch(() => undefined)
        throw error
      } finally {
        client.release()
      }
    },
    close: () => pool.end(),
  }
}

/** 연결이 살아 있는지 확인한다. `/health` 가 이것으로 db 상태를 판단한다. */
export async function ping(db: Db): Promise<void> {
  await db.drizzle.execute(sql`select 1`)
}
