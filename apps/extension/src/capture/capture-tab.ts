import { CONTENT_SAVE_LIMITS, type CreateContentRequest } from '@rebomi/api-contract'
import type { CapturedPage } from './extract.js'

/** 넣은 스크립트가 결과를 두는 전역의 이름. */
export const CAPTURE_RESULT_KEY = '__rebomiCapture'

/** 이 모듈이 쓰는 확장 API. `activeTab` + `scripting` 권한으로 되는 것만이다. */
export type CaptureChromeApi = {
  tabs: {
    query(query: {
      active: true
      currentWindow: true
    }): Promise<{ id?: number; url?: string; title?: string }[]>
  }
  scripting: {
    executeScript(
      injection:
        | { target: { tabId: number }; files: string[] }
        | { target: { tabId: number }; func: () => unknown },
    ): Promise<{ result?: unknown }[]>
  }
}

export type Capture =
  /** 저장할 수 없는 탭: 브라우저 내부 페이지, 파일, 주소를 알 수 없는 탭. */
  | { kind: 'unsupported' }
  | {
      kind: 'page'
      url: string
      /** 탭에 보이는 제목. 페이지에서 제목을 뽑지 못했을 때 쓴다. */
      tabTitle: string | null
      /** 페이지에서 뽑은 것. 스크립트를 넣을 수 없는 페이지면 null — URL만 저장한다. */
      page: CapturedPage | null
    }

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false
  try {
    const { protocol } = new URL(value)
    return protocol === 'http:' || protocol === 'https:'
  } catch {
    return false
  }
}

const textOrNull = (value: unknown): value is string | null =>
  value === null || typeof value === 'string'

/** 다른 실행 환경에서 넘어온 값이라 모양을 확인한다. */
function asCapturedPage(value: unknown): CapturedPage | null {
  if (typeof value !== 'object' || value === null) return null
  const { title, description, imageUrl, body } = value as Record<string, unknown>
  if (![title, description, imageUrl, body].every(textOrNull)) return null
  return { title, description, imageUrl, body } as CapturedPage
}

/**
 * 지금 보고 있는 탭을 캡처한다 (capture.md CAP-2).
 *
 * 추출 스크립트(`scriptFile`)를 그 탭에 넣어 실행하고 결과를 읽어 온다. 스크립트를 넣을 수
 * 없는 페이지(Chrome 웹 스토어, PDF 뷰어 등)는 실패로 보지 않는다 — 추출이 실패해도
 * 저장은 성공해야 하므로 URL만 가진 캡처를 돌려준다.
 */
export function createTabCapture(chrome: CaptureChromeApi, scriptFile: string) {
  return async function captureActiveTab(): Promise<Capture> {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    if (!tab || tab.id === undefined || !isHttpUrl(tab.url)) return { kind: 'unsupported' }

    const target = { tabId: tab.id }
    let page: CapturedPage | null = null
    try {
      await chrome.scripting.executeScript({ target, files: [scriptFile] })
      const [read] = await chrome.scripting.executeScript({
        target,
        // 페이지 쪽으로 직렬화돼 넘어간다 — 바깥의 값을 참조하면 안 된다.
        func: () => (globalThis as Record<string, unknown>)['__rebomiCapture'],
      })
      page = asCapturedPage(read?.result)
    } catch {
      // URL만 저장한다.
    }

    return { kind: 'page', url: tab.url, tabTitle: tab.title?.trim() || null, page }
  }
}

/** 캡처를 저장 요청으로 바꾼다. 없는 값은 보내지 않는다 — 서버가 나중에 채운다. */
export function toSaveRequest(capture: Extract<Capture, { kind: 'page' }>): CreateContentRequest {
  const title = capture.page?.title ?? capture.tabTitle?.slice(0, CONTENT_SAVE_LIMITS.title) ?? null
  const { description = null, imageUrl = null, body = null } = capture.page ?? {}

  return {
    url: capture.url,
    source: 'extension',
    ...(title === null ? {} : { title }),
    ...(description === null ? {} : { description }),
    ...(imageUrl === null ? {} : { imageUrl }),
    ...(body === null ? {} : { body }),
  }
}
