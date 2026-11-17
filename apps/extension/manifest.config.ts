import { fileURLToPath } from 'node:url'
import { defineManifest } from '@crxjs/vite-plugin'
import { config } from 'dotenv'

// 이 모듈이 평가되는 시점에 환경변수가 있어야 host_permissions 를 채울 수 있다.
config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), quiet: true })

const apiBaseUrl = process.env.VITE_API_BASE_URL

if (!apiBaseUrl) {
  throw new Error('VITE_API_BASE_URL이 없습니다. `cp .env.example .env` 를 실행하세요.')
}

export default defineManifest({
  manifest_version: 3,
  name: 'Rebomi',
  version: '0.1.0',
  description: '저장한 콘텐츠를 잊지 않게 다시 보여준다',
  action: { default_popup: 'src/popup/index.html' },
  // 권한은 API 오리진 하나뿐이다. 이것이 있어야 Chrome이 팝업의 요청에 웹의 갱신 쿠키
  // (SameSite=Lax)를 붙여 준다 — 확장이 웹 로그인을 재사용하는 방법이다(account ACC-9).
  // 쿠키를 직접 읽지 않으므로 `cookies` 권한은 없고, 토큰을 저장하지 않으므로 `storage` 도
  // 없다. 로그인 페이지를 새 탭으로 여는 데는 권한이 필요 없다.
  host_permissions: [`${apiBaseUrl.replace(/\/+$/, '')}/*`],
})
