import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  errorBody,
  fakeApi,
  loggedIn,
  refreshRejected,
  refreshed,
  type FakeResponse,
} from '@/test/fake-api'
import { fakeAppleSdk, fakeGoogleSdk } from '@/test/fake-sdk'
import { LoginScreen } from './login-screen'
import { createAppleMethod } from './methods/apple'
import { createGoogleMethod } from './methods/google'
import type { LoginMethod } from './methods/types'
import { SessionProvider } from './session'

const replace = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ replace }) }))

beforeEach(() => {
  replace.mockReset()
})

function google(sdk = fakeGoogleSdk().sdk): LoginMethod {
  return createGoogleMethod({ clientId: 'google-client', loadSdk: () => Promise.resolve(sdk) })
}

function apple(outcome: Parameters<typeof fakeAppleSdk>[0]): LoginMethod {
  return createAppleMethod({
    clientId: 'apple-service-id',
    redirectUri: () => 'http://localhost:3000/login',
    loadSdk: () => Promise.resolve(fakeAppleSdk(outcome).sdk),
  })
}

/** 로그아웃 상태로 시작하는 로그인 화면. `login` 은 `/auth/login` 의 응답이다. */
function setup(methods: LoginMethod[], login: FakeResponse = loggedIn) {
  const fake = fakeApi((request) => (request.path === '/auth/login' ? login : refreshRejected))
  render(
    <SessionProvider client={fake.api} tokens={fake.tokens}>
      <LoginScreen methods={methods} />
    </SessionProvider>,
  )
  return fake
}

const loginRequests = (requests: { path: string }[]) =>
  requests.filter((request) => request.path === '/auth/login')

describe('LoginScreen', () => {
  it('Google로 로그인하면 신원 토큰을 서버에 보내고 앱 화면으로 간다', async () => {
    const { requests } = setup([google()])

    await userEvent.click(await screen.findByText('Google로 로그인'))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(loginRequests(requests)[0]).toMatchObject({
      body: { provider: 'google', idToken: 'google-id-token', session: 'cookie' },
    })
  })

  it('Apple로 로그인하면 신원 토큰을 서버에 보내고 앱 화면으로 간다', async () => {
    const { requests } = setup([apple({ idToken: 'apple-id-token' })])

    await userEvent.click(await screen.findByRole('button', { name: 'Apple로 로그인' }))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(loginRequests(requests)[0]).toMatchObject({
      body: { provider: 'apple', idToken: 'apple-id-token', session: 'cookie' },
    })
  })

  it('Apple 로그인 창을 닫으면 취소했다고 알리고 서버에 로그인을 보내지 않는다', async () => {
    const { requests } = setup([apple({ error: 'popup_closed_by_user' })])

    await userEvent.click(await screen.findByRole('button', { name: 'Apple로 로그인' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/취소/)
    expect(loginRequests(requests)).toHaveLength(0)
    expect(replace).not.toHaveBeenCalled()
  })

  it('Apple 로그인이 다른 이유로 실패하면 실패를 알린다', async () => {
    setup([apple({ error: 'invalid_client' })])

    await userEvent.click(await screen.findByRole('button', { name: 'Apple로 로그인' }))

    expect((await screen.findByRole('alert')).textContent).toMatch(/Apple 로그인에 실패/)
    expect(replace).not.toHaveBeenCalled()
  })

  it('Google이 신원 토큰을 주지 않으면 실패를 알린다', async () => {
    const { requests } = setup([google(fakeGoogleSdk('').sdk)])

    await userEvent.click(await screen.findByText('Google로 로그인'))

    expect((await screen.findByRole('alert')).textContent).toMatch(/Google/)
    expect(loginRequests(requests)).toHaveLength(0)
  })

  it('로그인 스크립트를 불러오지 못하면 그 수단을 쓸 수 없다고 알린다', async () => {
    setup([
      createGoogleMethod({
        clientId: 'google-client',
        loadSdk: () => Promise.reject(new Error('blocked')),
      }),
    ])

    expect((await screen.findByRole('alert')).textContent).toMatch(/Google 로그인을 불러오지 못했습니다/)
  })

  it.each([
    ['INVALID_PROVIDER_TOKEN', 401, /로그인 정보를 확인하지 못했습니다/],
    ['EMAIL_NOT_VERIFIED', 403, /이메일이 확인되지 않은 계정/],
    ['PROVIDER_NOT_CONFIGURED', 503, /지금은 이 로그인 수단을 쓸 수 없습니다/],
  ])('서버가 %s 로 거부하면 이유를 보이고 로그인되지 않는다', async (code, status, message) => {
    setup([google()], { status, body: errorBody(code) })

    await userEvent.click(await screen.findByText('Google로 로그인'))

    expect((await screen.findByRole('alert')).textContent).toMatch(message)
    expect(replace).not.toHaveBeenCalled()
  })

  it('로그인 중 서버에 닿지 못하면 연결 오류를 보인다', async () => {
    setup([google()], 'offline')

    await userEvent.click(await screen.findByText('Google로 로그인'))

    expect((await screen.findByRole('alert')).textContent).toMatch(/서버에 연결할 수 없습니다/)
    expect(replace).not.toHaveBeenCalled()
  })

  it('실패한 뒤 다시 시도해 성공하면 오류가 사라지고 앱 화면으로 간다', async () => {
    let attempts = 0
    const fake = fakeApi((request) => {
      if (request.path !== '/auth/login') return refreshRejected
      attempts += 1
      return attempts === 1 ? { status: 401, body: errorBody('INVALID_PROVIDER_TOKEN') } : loggedIn
    })
    render(
      <SessionProvider client={fake.api} tokens={fake.tokens}>
        <LoginScreen methods={[google()]} />
      </SessionProvider>,
    )

    await userEvent.click(await screen.findByText('Google로 로그인'))
    await screen.findByRole('alert')
    await userEvent.click(screen.getByText('Google로 로그인'))

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('이미 로그인된 상태로 오면 로그인 수단을 보이지 않고 앱 화면으로 보낸다', async () => {
    const fake = fakeApi(() => refreshed)
    render(
      <SessionProvider client={fake.api} tokens={fake.tokens}>
        <LoginScreen methods={[google()]} />
      </SessionProvider>,
    )

    await waitFor(() => expect(replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByText('Google로 로그인')).toBeNull()
  })

  it('서버에 닿지 못해 로그인 여부를 모르면 연결 오류와 다시 시도를 보인다', async () => {
    const fake = fakeApi(() => 'offline')
    render(
      <SessionProvider client={fake.api} tokens={fake.tokens}>
        <LoginScreen methods={[google()]} />
      </SessionProvider>,
    )

    expect((await screen.findByRole('alert')).textContent).toMatch(/서버에 연결할 수 없습니다/)
    expect(screen.getByRole('button', { name: '다시 시도' })).toBeTruthy()
  })

  it('목록에 넣은 수단을 모두 보인다 (수단은 목록으로 늘린다)', async () => {
    const email: LoginMethod = {
      id: 'email',
      Component: ({ attempt }) => (
        <button onClick={() => attempt(() => Promise.reject(new Error('아직 없음')))}>
          이메일로 로그인
        </button>
      ),
    }
    setup([google(), email])

    expect(await screen.findByText('Google로 로그인')).toBeTruthy()
    await userEvent.click(screen.getByText('이메일로 로그인'))
    expect((await screen.findByRole('alert')).textContent).toMatch(/로그인하지 못했습니다/)
  })
})
