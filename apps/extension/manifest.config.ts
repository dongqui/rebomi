import { defineManifest } from '@crxjs/vite-plugin'
import { config } from 'dotenv'

// 이 모듈이 평가되는 시점에 환경변수가 있어야 host_permissions 를 채울 수 있다.
config({ path: new URL('../../.env', import.meta.url).pathname, quiet: true })

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
  // 저장 기능이 붙을 때 필요한 권한을 그때 추가한다. 지금은 API 오리진만.
  host_permissions: [`${apiBaseUrl.replace(/\/+$/, '')}/*`],
})
