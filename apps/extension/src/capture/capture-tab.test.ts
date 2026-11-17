import { describe, expect, it, vi } from 'vitest'
import { createTabCapture, toSaveRequest, type CaptureChromeApi } from './capture-tab.js'

const PAGE = { title: '기사 제목', description: '설명', imageUrl: null, body: '본문' }

function fakeChrome(
  tab: { id?: number; url?: string; title?: string } | undefined,
  script: { result?: unknown } | 'blocked' = { result: PAGE },
) {
  const executeScript = vi.fn((injection: object) => {
    if (script === 'blocked') return Promise.reject(new Error('Cannot access contents of the page'))
    return Promise.resolve('func' in injection ? [script] : [{}])
  })
  const chrome: CaptureChromeApi = {
    tabs: { query: () => Promise.resolve(tab ? [tab] : []) },
    scripting: { executeScript },
  }
  return { capture: createTabCapture(chrome, 'assets/content.js'), executeScript }
}

describe('captureActiveTab', () => {
  it('지금 탭에 추출 스크립트를 넣고 결과를 읽어 온다', async () => {
    const { capture, executeScript } = fakeChrome({
      id: 7,
      url: 'https://example.com/a',
      title: '탭 제목',
    })

    expect(await capture()).toEqual({
      kind: 'page',
      url: 'https://example.com/a',
      tabTitle: '탭 제목',
      page: PAGE,
    })
    expect(executeScript.mock.calls[0]?.[0]).toEqual({
      target: { tabId: 7 },
      files: ['assets/content.js'],
    })
  })

  it.each([
    ['브라우저 내부 페이지', { id: 1, url: 'chrome://extensions/' }],
    ['파일', { id: 1, url: 'file:///C:/a.html' }],
    ['주소를 알 수 없는 탭', { id: 1 }],
    ['탭이 없음', undefined],
  ])('%s 은 저장할 수 없는 탭이고 스크립트를 넣지 않는다', async (_name, tab) => {
    const { capture, executeScript } = fakeChrome(tab)

    expect(await capture()).toEqual({ kind: 'unsupported' })
    expect(executeScript).not.toHaveBeenCalled()
  })

  it('스크립트를 넣을 수 없는 페이지는 실패가 아니다 — URL과 탭 제목만 남긴다', async () => {
    const { capture } = fakeChrome(
      { id: 3, url: 'https://chromewebstore.google.com/', title: ' 스토어 ' },
      'blocked',
    )

    expect(await capture()).toEqual({
      kind: 'page',
      url: 'https://chromewebstore.google.com/',
      tabTitle: '스토어',
      page: null,
    })
  })

  it('읽어 온 값의 모양이 다르면 버린다', async () => {
    const { capture } = fakeChrome(
      { id: 3, url: 'https://example.com/' },
      { result: { title: 1, body: {} } },
    )

    expect(await capture()).toMatchObject({ kind: 'page', page: null, tabTitle: null })
  })
})

describe('toSaveRequest', () => {
  it('뽑은 값을 함께 보내고 출처는 확장이다', () => {
    expect(
      toSaveRequest({ kind: 'page', url: 'https://example.com/a', tabTitle: '탭 제목', page: PAGE }),
    ).toEqual({
      url: 'https://example.com/a',
      source: 'extension',
      title: '기사 제목',
      description: '설명',
      body: '본문',
    })
  })

  it('뽑지 못했으면 URL과 탭 제목만 보낸다', () => {
    expect(
      toSaveRequest({ kind: 'page', url: 'https://example.com/a', tabTitle: '탭 제목', page: null }),
    ).toEqual({ url: 'https://example.com/a', source: 'extension', title: '탭 제목' })
  })

  it('페이지에 제목이 없으면 탭 제목을 상한에 맞춰 쓴다', () => {
    const request = toSaveRequest({
      kind: 'page',
      url: 'https://example.com/a',
      tabTitle: '가'.repeat(600),
      page: { ...PAGE, title: null },
    })

    expect(request.title).toHaveLength(500)
  })
})
