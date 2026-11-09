import { defineConfig } from 'vitest/config'
import { config } from 'dotenv'

// DB 테스트는 실제 Postgres를 쓴다. 루트 .env 의 DATABASE_URL 을 읽는다.
config({ path: new URL('../../.env', import.meta.url).pathname, quiet: true })

export default defineConfig({
  test: { environment: 'node' },
})
