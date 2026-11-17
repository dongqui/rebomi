import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createExtensionApi } from '../auth/api.js'
import { loginUrl } from '../auth/login-url.js'
import { createTabCapture, type CaptureChromeApi } from '../capture/capture-tab.js'
// 빌드된 추출 스크립트의 경로. 페이지에 넣을 수 있게 한 파일(IIFE)로 묶인다.
import contentScript from '../capture/content.ts?script&iife'
import { Popup } from './Popup.js'

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
const webBaseUrl = import.meta.env.VITE_WEB_BASE_URL as string | undefined

// 조용히 localhost로 폴백하지 않는다 — 잘못된 주소를 가리키는 확장이 더 나쁘다.
if (!apiBaseUrl || !webBaseUrl) {
  throw new Error(
    'VITE_API_BASE_URL 또는 VITE_WEB_BASE_URL이 없습니다. `.env.example` 을 참고해 `.env` 를 채우세요.',
  )
}

/** 이 확장이 쓰는 확장 API만 선언한다. 탭을 여는 데는 권한이 필요 없다. */
declare const chrome: CaptureChromeApi & {
  tabs: { create(options: { url: string }): Promise<unknown> }
}

const container = document.getElementById('root')

if (!container) {
  throw new Error('#root 엘리먼트가 없습니다')
}

const { client, tokens } = createExtensionApi(apiBaseUrl)
const login = loginUrl(webBaseUrl)
const capture = createTabCapture(chrome, contentScript)

createRoot(container).render(
  <StrictMode>
    <Popup
      client={client}
      tokens={tokens}
      capture={capture}
      openLogin={() => {
        void chrome.tabs.create({ url: login })
      }}
    />
  </StrictMode>,
)
