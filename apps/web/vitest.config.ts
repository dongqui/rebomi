import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // tsconfig의 `jsx: preserve` 는 Next용이다. 테스트에서는 여기서 JSX를 변환한다.
  oxc: { jsx: { runtime: 'automatic' } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
})
