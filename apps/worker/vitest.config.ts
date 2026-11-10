import { config } from 'dotenv'
import { defineConfig } from 'vitest/config'

// 워커 테스트는 실제 Postgres를 쓴다. pg-boss가 자기 스키마를 만든다.
config({ path: new URL('../../.env', import.meta.url).pathname, quiet: true })

export default defineConfig({
  test: { environment: 'node', testTimeout: 60_000, hookTimeout: 60_000 },
})
