import { sql } from 'drizzle-orm'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import * as schema from './schema.js'

export type Db = {
  drizzle: NodePgDatabase<typeof schema>
  close(): Promise<void>
}

/**
 * 커넥션 풀과 Drizzle 인스턴스를 묶어 돌려준다.
 *
 * 질의는 내보내지 않는다 — 스키마와 이 팩토리만이 이 패키지의 표면이고,
 * 질의는 apps/api 와 apps/worker 가 각자 작성한다 (스펙 3장).
 */
export function createDb(connectionString: string): Db {
  const pool = new Pool({ connectionString })
  return {
    drizzle: drizzle(pool, { schema }),
    close: () => pool.end(),
  }
}

/** 연결이 살아 있는지 확인한다. `/health` 가 이것으로 db 상태를 판단한다. */
export async function ping(db: Db): Promise<void> {
  await db.drizzle.execute(sql`select 1`)
}
