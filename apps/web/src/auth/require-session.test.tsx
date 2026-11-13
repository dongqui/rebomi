import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fakeApi, refreshRejected, refreshed } from '@/test/fake-api'
import { RequireSession } from './require-session'
import { SessionProvider } from './session'
import { SignOutButton } from './sign-out-button'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

beforeEach(() => {
  replace.mockReset()
})

function setup(handler: Parameters<typeof fakeApi>[0]) {
  const fake = fakeApi(handler)
  render(
    <SessionProvider client={fake.api} tokens={fake.tokens}>
      <RequireSession>
        <p>앱 화면</p>
        <SignOutButton />
      </RequireSession>
    </SessionProvider>,
  )
  return fake
}

describe('RequireSession', () => {
  it('로그인하지 않았으면 앱 화면을 보이지 않고 로그인 화면으로 보낸다', async () => {
    setup(() => refreshRejected)

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(screen.queryByText('앱 화면')).toBeNull()
  })

  it('로그인돼 있으면 앱 화면을 보인다', async () => {
    setup(() => refreshed)

    expect(await screen.findByText('앱 화면')).toBeTruthy()
    expect(replace).not.toHaveBeenCalled()
  })

  it('확인이 끝나기 전에는 앱 화면을 보이지 않는다', () => {
    setup(() => refreshed)

    expect(screen.queryByText('앱 화면')).toBeNull()
  })

  it('서버에 닿지 못하면 로그인 화면으로 보내지 않고 오류를 보이며, 다시 시도하면 앱 화면이 뜬다', async () => {
    let online = false
    setup(() => (online ? refreshed : 'offline'))

    expect((await screen.findByRole('alert')).textContent).toMatch(/서버에 연결할 수 없습니다/)
    expect(replace).not.toHaveBeenCalled()

    online = true
    await userEvent.click(screen.getByRole('button', { name: '다시 시도' }))

    expect(await screen.findByText('앱 화면')).toBeTruthy()
  })

  it('로그아웃하면 로그인 화면으로 보낸다', async () => {
    const { requests } = setup((request) =>
      request.path === '/auth/logout' ? { status: 204 } : refreshed,
    )

    await userEvent.click(await screen.findByRole('button', { name: '로그아웃' }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/login'))
    expect(requests.some((request) => request.path === '/auth/logout')).toBe(true)
    expect(screen.queryByText('앱 화면')).toBeNull()
  })
})
