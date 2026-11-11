import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { drizzle } from 'drizzle-orm/node-postgres'
import { migrate } from 'drizzle-orm/node-postgres/migrator'
import { Pool } from 'pg'

/**
 * 마이그레이션이 빈 DB와 기존 DB(이전 마이그레이션까지만 적용된 상태) 양쪽에서
 * 통과하는지 일회용 데이터베이스로 확인한다. 개발 DB는 건드리지 않는다.
 */
const connectionString = process.env.DATABASE_URL
const migrationsFolder = fileURLToPath(new URL('../migrations', import.meta.url))

/** `contents` 가 생기기 전 마지막 마이그레이션. 기존 DB는 여기까지 적용된 상태다. */
const BASELINE_TAG = '0001_users'

type Journal = { entries: { tag: string }[] }

let admin: Pool
const scratchDatabases: string[] = []
const scratchFolders: string[] = []

beforeAll(() => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  admin = new Pool({ connectionString })
})

afterAll(async () => {
  for (const name of scratchDatabases) {
    await admin.query(`drop database if exists "${name}" with (force)`)
  }
  await admin.end()
  for (const folder of scratchFolders) rmSync(folder, { recursive: true, force: true })
})

async function withScratchDatabase<T>(run: (pool: Pool) => Promise<T>): Promise<T> {
  const name = `rebomi_migrate_test_${crypto.randomUUID().replaceAll('-', '')}`
  await admin.query(`create database "${name}"`)
  scratchDatabases.push(name)

  const url = new URL(connectionString!)
  url.pathname = `/${name}`
  const pool = new Pool({ connectionString: url.toString() })
  try {
    return await run(pool)
  } finally {
    await pool.end()
  }
}

/** 저널을 `lastTag` 까지로 자른 마이그레이션 폴더 사본을 만든다. */
function migrationsUpTo(lastTag: string): string {
  const folder = mkdtempSync(join(tmpdir(), 'rebomi-migrations-'))
  scratchFolders.push(folder)
  cpSync(migrationsFolder, folder, { recursive: true })

  const journalPath = join(folder, 'meta', '_journal.json')
  const journal = JSON.parse(readFileSync(journalPath, 'utf8')) as Journal
  const lastIndex = journal.entries.findIndex((entry) => entry.tag === lastTag)
  if (lastIndex === -1) throw new Error(`저널에 ${lastTag} 가 없습니다`)
  journal.entries = journal.entries.slice(0, lastIndex + 1)
  writeFileSync(journalPath, JSON.stringify(journal))
  return folder
}

async function tableNames(pool: Pool): Promise<string[]> {
  const result = await pool.query<{ table_name: string }>(
    `select table_name from information_schema.tables where table_schema = 'public'`,
  )
  return result.rows.map((row) => row.table_name)
}

describe('마이그레이션 적용', () => {
  it('빈 DB에 전체를 적용하면 모든 테이블이 생긴다', async () => {
    await withScratchDatabase(async (pool) => {
      await migrate(drizzle(pool), { migrationsFolder })

      expect(await tableNames(pool)).toEqual(
        expect.arrayContaining(['users', 'contents', 'auth_identities', 'refresh_tokens']),
      )
    })
  }, 60_000)

  it('contents까지 있는 기존 DB에 적용하면 기존 행을 유지한 채 인증 테이블이 생긴다', async () => {
    await withScratchDatabase(async (pool) => {
      await migrate(drizzle(pool), { migrationsFolder: migrationsUpTo('0002_contents') })
      expect(await tableNames(pool)).not.toContain('auth_identities')
      await pool.query(`insert into users (email) values ('existing@example.com')`)

      await migrate(drizzle(pool), { migrationsFolder })

      expect(await tableNames(pool)).toEqual(
        expect.arrayContaining(['auth_identities', 'refresh_tokens']),
      )
      const users = await pool.query<{ email: string }>('select email from users')
      expect(users.rows).toEqual([{ email: 'existing@example.com' }])
    })
  }, 60_000)

  it('users만 있는 기존 DB에 적용하면 기존 사용자를 유지한 채 contents가 생긴다', async () => {
    await withScratchDatabase(async (pool) => {
      await migrate(drizzle(pool), { migrationsFolder: migrationsUpTo(BASELINE_TAG) })
      expect(await tableNames(pool)).not.toContain('contents')
      await pool.query(`insert into users (email) values ('existing@example.com')`)

      await migrate(drizzle(pool), { migrationsFolder })

      expect(await tableNames(pool)).toContain('contents')
      const users = await pool.query<{ email: string }>('select email from users')
      expect(users.rows).toEqual([{ email: 'existing@example.com' }])
    })
  }, 60_000)
})
