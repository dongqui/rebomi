import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StrictMode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { Capture } from '../capture/capture-tab.js'
import {
  accessExpired,
  fakeApi,
  refreshRejected,
  refreshed,
  saved,
  type FakeRequest,
  type FakeResponse,
} from '../test/fake-api.js'
import { Popup } from './Popup.js'

const ARTICLE: Capture = {
  kind: 'page',
  url: 'https://example.com/posts/1?utm_source=x',
  tabTitle: '탭 제목',
  page: { title: '기사 제목', description: '설명', imageUrl: null, body: '사용자가 보던 본문' },
}

function setup(
  handler: (request: FakeRequest) => FakeResponse,
  options: { capture?: () => Promise<Capture>; strict?: boolean } = {},
) {
  const fake = fakeApi(handler)
  const openLogin = vi.fn()
  const capture = vi.fn(options.capture ?? (() => Promise.resolve(ARTICLE)))
  const popup = (
    <Popup client={fake.client} tokens={fake.tokens} openLogin={openLogin} capture={capture} />
  )
  render(options.strict ? <StrictMode>{popup}</StrictMode> : popup)
  return { ...fake, openLogin, capture }
}

const refreshes = (requests: FakeRequest[]) =>
  requests.filter((request) => request.path === '/auth/refresh')
const saves = (requests: FakeRequest[]) => requests.filter((request) => request.path === '/contents')

/** 로그인돼 있고 저장이 `response` 로 끝나는 서버. */
const signedIn =
  (response: FakeResponse) =>
  (request: FakeRequest): FakeResponse =>
    request.path === '/auth/refresh' ? refreshed() : response

describe('확장 팝업의 로그인 상태', () => {
  it('웹에 로그인돼 있으면 따로 로그인하지 않고 그 계정으로 인증된 요청을 보낸다', async () => {
    const { requests, openLogin } = setup(signedIn(saved('created')))

    expect(await screen.findByText('저장했습니다')).toBeTruthy()

    // 갱신 토큰은 웹의 쿠키뿐이다. 확장은 쿠키를 실어 보낼 뿐 본문에 토큰을 넣지 않는다.
    const [refresh] = refreshes(requests)
    expect(refresh?.credentials).toBe('include')
    expect(refresh?.body).toEqual({})

    expect(saves(requests)[0]?.authorization).toBe('Bearer access-1')
    expect(openLogin).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '로그인하기' })).toBeNull()
  })

  it('웹에 로그인돼 있지 않으면 저장하지 않고 로그인이 필요하다고 알리며, 버튼이 웹 로그인 페이지를 연다', async () => {
    const { requests, openLogin, capture } = setup(() => refreshRejected)

    expect(await screen.findByText(/로그인이 필요합니다/)).toBeTruthy()
    // 알리기만 한다. 누르기 전에는 탭을 열지 않는다.
    expect(openLogin).not.toHaveBeenCalled()
    // 로그인하지 않았으면 페이지를 읽지도 보내지도 않는다.
    expect(capture).not.toHaveBeenCalled()
    expect(saves(requests)).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))

    expect(openLogin).toHaveBeenCalledTimes(1)
  })

  it('확인이 끝나기 전에는 로그인 여부도 저장 결과도 말하지 않는다', () => {
    setup(signedIn(saved('created')))

    expect(screen.getByText('확인 중…')).toBeTruthy()
    expect(screen.queryByText('저장했습니다')).toBeNull()
    expect(screen.queryByText(/로그인이 필요합니다/)).toBeNull()
  })

  it('서버에 닿지 못하면 로그인이 필요하다고 하지 않고 오류를 보이며, 다시 시도하면 저장된다', async () => {
    let online = false
    setup((request) => {
      if (!online) return 'offline'
      return request.path === '/auth/refresh' ? refreshed() : saved('created')
    })

    expect((await screen.findByRole('alert')).textContent).toMatch(/서버에 연결할 수 없습니다/)
    expect(screen.queryByRole('button', { name: '로그인하기' })).toBeNull()

    online = true
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('저장했습니다')).toBeTruthy()
  })

  it('액세스 토큰이 만료되면 알아서 갱신하고 요청을 다시 보낸다 — 다시 로그인하지 않는다', async () => {
    let issued = 0
    const { requests, openLogin } = setup((request) => {
      if (request.path === '/auth/refresh') return refreshed(`access-${++issued}`)
      return request.authorization === 'Bearer access-1' ? accessExpired : saved('created')
    })

    expect(await screen.findByText('저장했습니다')).toBeTruthy()

    expect(refreshes(requests)).toHaveLength(2)
    expect(saves(requests).map((request) => request.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ])
    expect(openLogin).not.toHaveBeenCalled()
  })

  it('사용 중에 갱신이 거부되면 로그인이 필요한 상태로 돌아간다', async () => {
    let refreshCount = 0
    setup((request) => {
      if (request.path === '/auth/refresh') {
        return ++refreshCount === 1 ? refreshed() : refreshRejected
      }
      return accessExpired
    })

    expect(await screen.findByRole('button', { name: '로그인하기' })).toBeTruthy()
    await waitFor(() => expect(screen.queryByText('저장했습니다')).toBeNull())
  })
})

describe('확장 팝업의 저장', () => {
  it('열면 바로 지금 페이지를 본문과 함께 저장하고, 성공과 추출 수준을 보인다', async () => {
    const { requests, capture } = setup(signedIn(saved('created', { extractionLevel: 'full' })))

    expect(await screen.findByText('저장했습니다')).toBeTruthy()
    expect(screen.getByText('기사 제목')).toBeTruthy()
    expect(screen.getByText('추출 수준: 본문')).toBeTruthy()

    // 캡처 전에 안내로 막지 않는다 — 누를 것 없이 한 번에 끝난다.
    expect(capture).toHaveBeenCalledTimes(1)
    expect(saves(requests)).toHaveLength(1)
    expect(saves(requests)[0]).toMatchObject({
      method: 'POST',
      body: {
        url: 'https://example.com/posts/1?utm_source=x',
        source: 'extension',
        title: '기사 제목',
        description: '설명',
        body: '사용자가 보던 본문',
      },
    })
  })

  it('이미 저장한 페이지면 중복이라고 알린다', async () => {
    setup(signedIn(saved('duplicate', { extractionLevel: 'full' })))

    expect(await screen.findByText('이미 저장한 페이지입니다')).toBeTruthy()
    expect(screen.queryByText('저장했습니다')).toBeNull()
    expect(screen.getByText('추출 수준: 본문')).toBeTruthy()
  })

  it('본문을 뽑지 못한 페이지도 저장되고 추출 수준이 낮게 표시된다', async () => {
    const { requests } = setup(signedIn(saved('created', { extractionLevel: 'metadata_only' })), {
      capture: () =>
        Promise.resolve({
          kind: 'page',
          url: 'https://example.com/app',
          tabTitle: '탭 제목',
          page: null,
        }),
    })

    expect(await screen.findByText('저장했습니다')).toBeTruthy()
    expect(screen.getByText('추출 수준: 메타데이터만')).toBeTruthy()
    expect(saves(requests)[0]?.body).toEqual({
      url: 'https://example.com/app',
      source: 'extension',
      title: '탭 제목',
    })
  })

  it('저장할 수 없는 탭에서는 이유를 보이고 서버에 보내지 않는다', async () => {
    const { requests } = setup(signedIn(saved('created')), {
      capture: () => Promise.resolve({ kind: 'unsupported' }),
    })

    expect(await screen.findByText(/이 탭은 저장할 수 없습니다/)).toBeTruthy()
    expect(saves(requests)).toHaveLength(0)
    expect(screen.queryByText('저장했습니다')).toBeNull()
  })

  it('API에 닿지 못하면 실패를 보이고 성공으로 보이지 않으며, 다시 시도하면 저장된다', async () => {
    let online = true
    const { capture } = setup((request) => {
      if (request.path === '/auth/refresh') return refreshed()
      return online ? saved('created') : 'offline'
    })
    online = false

    expect((await screen.findByRole('alert')).textContent).toMatch(/저장되지 않았습니다/)
    expect(screen.queryByText('저장했습니다')).toBeNull()

    online = true
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('저장했습니다')).toBeTruthy()
    expect(capture).toHaveBeenCalledTimes(2)
  })

  it('서버가 저장을 거부하면 실패와 코드를 보인다', async () => {
    setup(
      signedIn({ status: 400, body: { error: { code: 'VALIDATION_FAILED', message: '거부' } } }),
    )

    expect((await screen.findByRole('alert')).textContent).toMatch(/VALIDATION_FAILED/)
    expect(screen.queryByText('저장했습니다')).toBeNull()
  })

  it('화면이 두 번 그려져도(StrictMode) 한 번만 저장한다', async () => {
    const { requests, capture } = setup(signedIn(saved('created')), { strict: true })

    expect(await screen.findByText('저장했습니다')).toBeTruthy()
    expect(capture).toHaveBeenCalledTimes(1)
    expect(saves(requests)).toHaveLength(1)
  })
})
