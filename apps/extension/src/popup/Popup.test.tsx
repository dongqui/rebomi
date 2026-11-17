import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import {
  accessExpired,
  emptyList,
  fakeApi,
  refreshRejected,
  refreshed,
  type FakeRequest,
  type FakeResponse,
} from '../test/fake-api.js'
import { Popup } from './Popup.js'

function setup(handler: (request: FakeRequest) => FakeResponse) {
  const fake = fakeApi(handler)
  const openLogin = vi.fn()
  render(<Popup client={fake.client} tokens={fake.tokens} openLogin={openLogin} />)
  return { ...fake, openLogin }
}

const refreshes = (requests: FakeRequest[]) =>
  requests.filter((request) => request.path === '/auth/refresh')
const lists = (requests: FakeRequest[]) => requests.filter((request) => request.path === '/contents')

describe('확장 팝업의 로그인 상태', () => {
  it('웹에 로그인돼 있으면 따로 로그인하지 않고 그 계정으로 인증된 요청을 보낸다', async () => {
    const { requests, openLogin } = setup((request) =>
      request.path === '/auth/refresh' ? refreshed('access-1') : emptyList,
    )

    expect(await screen.findByText('로그인되어 있습니다')).toBeTruthy()
    expect(await screen.findByText('계정 요청 성공')).toBeTruthy()

    // 갱신 토큰은 웹의 쿠키뿐이다. 확장은 쿠키를 실어 보낼 뿐 본문에 토큰을 넣지 않는다.
    const [refresh] = refreshes(requests)
    expect(refresh?.credentials).toBe('include')
    expect(refresh?.body).toEqual({})

    expect(lists(requests)[0]?.authorization).toBe('Bearer access-1')
    expect(openLogin).not.toHaveBeenCalled()
    expect(screen.queryByRole('button', { name: '로그인하기' })).toBeNull()
  })

  it('웹에 로그인돼 있지 않으면 로그인이 필요하다고 알리고, 버튼이 웹 로그인 페이지를 연다', async () => {
    const { requests, openLogin } = setup(() => refreshRejected)

    expect(await screen.findByText(/로그인이 필요합니다/)).toBeTruthy()
    // 알리기만 한다. 누르기 전에는 탭을 열지 않는다.
    expect(openLogin).not.toHaveBeenCalled()
    expect(lists(requests)).toHaveLength(0)

    await userEvent.click(screen.getByRole('button', { name: '로그인하기' }))

    expect(openLogin).toHaveBeenCalledTimes(1)
  })

  it('확인이 끝나기 전에는 로그인 여부를 말하지 않는다', () => {
    setup(() => refreshed())

    expect(screen.getByText('확인 중…')).toBeTruthy()
    expect(screen.queryByText('로그인되어 있습니다')).toBeNull()
    expect(screen.queryByText(/로그인이 필요합니다/)).toBeNull()
  })

  it('서버에 닿지 못하면 로그인이 필요하다고 하지 않고 오류를 보이며, 다시 시도하면 로그인된 상태가 된다', async () => {
    let online = false
    setup((request) => {
      if (!online) return 'offline'
      return request.path === '/auth/refresh' ? refreshed() : emptyList
    })

    expect((await screen.findByRole('alert')).textContent).toMatch(/서버에 연결할 수 없습니다/)
    expect(screen.queryByRole('button', { name: '로그인하기' })).toBeNull()

    online = true
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('로그인되어 있습니다')).toBeTruthy()
  })

  it('액세스 토큰이 만료되면 알아서 갱신하고 요청을 다시 보낸다 — 다시 로그인하지 않는다', async () => {
    let issued = 0
    const { requests, openLogin } = setup((request) => {
      if (request.path === '/auth/refresh') return refreshed(`access-${++issued}`)
      return request.authorization === 'Bearer access-1' ? accessExpired : emptyList
    })

    expect(await screen.findByText('계정 요청 성공')).toBeTruthy()

    expect(refreshes(requests)).toHaveLength(2)
    expect(lists(requests).map((request) => request.authorization)).toEqual([
      'Bearer access-1',
      'Bearer access-2',
    ])
    expect(screen.getByText('로그인되어 있습니다')).toBeTruthy()
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
    await waitFor(() => expect(screen.queryByText('로그인되어 있습니다')).toBeNull())
  })

  it('인증된 요청이 다른 이유로 실패하면 로그인 상태는 두고 실패를 보인다', async () => {
    setup((request) =>
      request.path === '/auth/refresh'
        ? refreshed()
        : { status: 500, body: { error: { code: 'INTERNAL', message: '서버 오류' } } },
    )

    expect((await screen.findByRole('alert')).textContent).toMatch(/계정 요청 실패/)
    expect(screen.getByText('로그인되어 있습니다')).toBeTruthy()
  })
})
