import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { defineConfig } from 'drizzle-kit'

config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true })

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL이 없습니다. `cp .env.example .env` 를 먼저 실행하세요.')
}

export default defineConfig({
  schema: './src/schema.ts',
  out: './migrations',
  dialect: 'postgresql',
  dbCredentials: { url },
})
