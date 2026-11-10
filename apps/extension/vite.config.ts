import { fileURLToPath } from 'node:url'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import manifest from './manifest.config.js'

// 환경변수는 모노레포 루트의 .env 하나로 관리한다. Vite가 VITE_* 를 번들에
// 인라인할 때 이 디렉터리에서 읽는다.
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

export default defineConfig({
  envDir: workspaceRoot,
  plugins: [react(), crx({ manifest })],
})
