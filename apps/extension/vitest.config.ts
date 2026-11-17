import { defineConfig } from 'vitest/config'

// `vite.config.ts` 를 쓰지 않는다 — 그쪽은 확장 매니페스트를 만들면서 환경변수를 요구한다.
// 테스트는 환경변수 없이 돈다.
export default defineConfig({
  oxc: { jsx: { runtime: 'automatic' } },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
