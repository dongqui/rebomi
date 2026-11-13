import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { errorBody, fakeApi, loggedIn, refreshRejected, refreshed } from '@/test/fake-api'
import { SessionProvider, useSession } from './session'

function Probe({ onRequest }: { onRequest: () => Promise<unknown> }) {
  const session = useSession()
  return (
    <div>
      <p data-testid="status">{session.status}</p>
      <button onClick={() => void session.signIn('google', 'id-token')}>로그인</button>
      <button onClick={() => void session.signOut()}>로그아웃</button>
      <button onClick={session.retry}>다시 시도</button>
      <button onClick={() => void onRequest().catch(() => undefined)}>요청</button>
    </div>
  )
}

function setup(handler: Parameters<typeof fakeApi>[0]) {
  const fake = fakeApi(handler)
  render(
    <SessionProvider client={fake.api} tokens={fake.tokens}>
      <Probe onRequest={() => fake.api.listContents()} />
    </SessionProvider>,
  )
  return fake
}

const status = () => screen.getByTestId('status').textContent
const accessExpired = { status: 401, body: errorBody('ACCESS_TOKEN_EXPIRED') }

describe('SessionProvider', () => {
  it('시작할 때 갱신 쿠키로 세션을 복구한다 (자동 로그인)', async () => {
    const { requests } = setup(() => refreshed)

    expect(status()).toBe('checking')
    await waitFor(() => expect(status()).toBe('signed-in'))
    expect(requests[0]).toMatchObject({ path: '/auth/refresh', credentials: 'include' })
  })

  it('서버가 갱신을 거부하면 로그아웃 상태다', async () => {
    setup(() => refreshRejected)
    await waitFor(() => expect(status()).toBe('signed-out'))
  })

  it('서버에 닿지 못하면 로그아웃이 아니라 연결 실패 상태이고, 다시 시도하면 복구된다', async () => {
    let online = false
    setup(() => (online ? refreshed : 'offline'))
    await waitFor(() => expect(status()).toBe('unreachable'))

    online = true
    await userEvent.click(screen.getByText('다시 시도'))
    await waitFor(() => expect(status()).toBe('signed-in'))
  })

  it('로그인하면 신원 토큰을 쿠키 방식으로 보내고 로그인 상태가 된다', async () => {
    const { requests } = setup((request) =>
      request.path === '/auth/login' ? loggedIn : refreshRejected,
    )
    await waitFor(() => expect(status()).toBe('signed-out'))

    await userEvent.click(screen.getByText('로그인'))

    await waitFor(() => expect(status()).toBe('signed-in'))
    expect(requests.at(-1)).toMatchObject({
      path: '/auth/login',
      credentials: 'include',
      body: { provider: 'google', idToken: 'id-token', session: 'cookie' },
    })
  })

  it('로그아웃하면 서버에 폐기를 요청하고 로그아웃 상태가 된다', async () => {
    const { requests } = setup((request) =>
      request.path === '/auth/logout' ? { status: 204 } : refreshed,
    )
    await waitFor(() => expect(status()).toBe('signed-in'))

    await userEvent.click(screen.getByText('로그아웃'))

    await waitFor(() => expect(status()).toBe('signed-out'))
    expect(requests.at(-1)).toMatchObject({ path: '/auth/logout', credentials: 'include' })
  })

  it('서버 로그아웃이 실패해도 이 브라우저는 로그아웃 상태가 된다', async () => {
    setup((request) => (request.path === '/auth/logout' ? 'offline' : refreshed))
    await waitFor(() => expect(status()).toBe('signed-in'))

    await userEvent.click(screen.getByText('로그아웃'))

    await waitFor(() => expect(status()).toBe('signed-out'))
  })

  it('사용 중에 갱신 토큰이 만료·폐기되면 로그아웃 상태가 된다', async () => {
    let revoked = false
    setup((request) => {
      if (request.path === '/auth/refresh') return revoked ? refreshRejected : refreshed
      return accessExpired
    })
    await waitFor(() => expect(status()).toBe('signed-in'))

    revoked = true
    await userEvent.click(screen.getByText('요청'))

    await waitFor(() => expect(status()).toBe('signed-out'))
  })

  it('액세스 토큰이 만료되면 갱신한 토큰으로 다시 보내고 로그인 상태를 유지한다', async () => {
    let contentCalls = 0
    const { requests } = setup((request) => {
      if (request.path === '/auth/refresh') return refreshed
      contentCalls += 1
      return contentCalls === 1 ? accessExpired : { status: 200, body: { items: [], nextCursor: null } }
    })
    await waitFor(() => expect(status()).toBe('signed-in'))

    await userEvent.click(screen.getByText('요청'))

    await waitFor(() => expect(contentCalls).toBe(2))
    expect(requests.at(-1)?.authorization).toBe('Bearer access-2')
    expect(status()).toBe('signed-in')
  })
})
