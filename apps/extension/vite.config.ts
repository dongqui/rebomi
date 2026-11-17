import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { crx } from '@crxjs/vite-plugin'
import react from '@vitejs/plugin-react'
import { defineConfig, type Plugin } from 'vite'
import manifest from './manifest.config.js'

// 환경변수는 모노레포 루트의 .env 하나로 관리한다. Vite가 VITE_* 를 번들에
// 인라인할 때 이 디렉터리에서 읽는다.
const workspaceRoot = fileURLToPath(new URL('../..', import.meta.url))

/**
 * crxjs는 `?script` 로 가져온 추출 스크립트를 `web_accessible_resources` 에 넣는다.
 * `chrome.scripting.executeScript` 로 넣는 스크립트에는 필요 없고, 남겨 두면 아무 웹
 * 페이지나 그 파일을 요청해 이 확장이 설치돼 있는지 알아낼 수 있다. 빌드 결과에서 뺀다.
 */
function withoutWebAccessibleResources(): Plugin {
  let outDir = ''
  return {
    name: 'rebomi:strip-web-accessible-resources',
    apply: 'build',
    enforce: 'post',
    configResolved(config) {
      outDir = config.build.outDir
    },
    async closeBundle() {
      const path = fileURLToPath(new URL(`./${outDir}/manifest.json`, import.meta.url))
      const built = JSON.parse(await readFile(path, 'utf8')) as Record<string, unknown>
      delete built.web_accessible_resources
      await writeFile(path, `${JSON.stringify(built, null, 2)}\n`)
    },
  }
}

export default defineConfig({
  envDir: workspaceRoot,
  plugins: [react(), crx({ manifest }), withoutWebAccessibleResources()],
})
