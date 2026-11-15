import { createApiClient, type ApiClient } from '@rebomi/api-client'
import { vi } from 'vitest'
import { createTokenStore, type ObservableTokenStore } from '@/auth/token-store'

export type FakeRequest = {
  path: string
  /** 쿼리 문자열. 없으면 빈 문자열, 있으면 `?` 로 시작한다. */
  search: string
  method: string
  body: unknown
  credentials: RequestCredentials | undefined
  authorization: string | null
}

/** 응답 하나. `'offline'` 은 서버에 닿지 못한 것(fetch가 던진다)이다. */
export type FakeResponse = { status: number; body?: unknown } | 'offline'

export function errorBody(code: string): { error: { code: string; message: string } } {
  return { error: { code, message: code } }
}

/**
 * `fetch` 만 가짜로 바꾸고 실제 `api-client` 를 그대로 쓴다. 웹이 서버에 무엇을 보내는지
 * (쿠키 포함 여부, 본문)까지 테스트가 본다.
 */
export function fakeApi(handler: (request: FakeRequest) => FakeResponse): {
  api: ApiClient
  tokens: ObservableTokenStore
  requests: FakeRequest[]
} {
  const requests: FakeRequest[] = []

  vi.stubGlobal('fetch', (input: string, init: RequestInit = {}) => {
    const request: FakeRequest = {
      path: new URL(input).pathname,
      search: new URL(input).search,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      credentials: init.credentials,
      authorization: new Headers(init.headers).get('authorization'),
    }
    requests.push(request)

    const response = handler(request)
    if (response === 'offline') return Promise.reject(new TypeError('Failed to fetch'))

    return Promise.resolve(
      new Response(response.body === undefined ? null : JSON.stringify(response.body), {
        status: response.status,
      }),
    )
  })

  const tokens = createTokenStore()
  const api = createApiClient({ baseUrl: 'http://api.test', session: 'cookie', tokenStore: tokens })
  return { api, tokens, requests }
}

export const refreshed: FakeResponse = {
  status: 200,
  body: { accessToken: 'access-2', expiresIn: 900 },
}

export const refreshRejected: FakeResponse = {
  status: 401,
  body: errorBody('REFRESH_TOKEN_INVALID'),
}

export const loggedIn: FakeResponse = {
  status: 200,
  body: {
    accessToken: 'access-1',
    expiresIn: 900,
    refreshToken: null,
    user: { id: '2f1c1c5e-6f0b-4c0e-9d57-0b5a1b1f8a11', email: 'user@example.com' },
  },
}
