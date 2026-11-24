import { createApiClient, type ApiClient } from '@rebomi/api-client'
import { vi } from 'vitest'
import { createSessionStore, type SessionStore } from '../auth/session-store'
import {
  createTokenStore,
  type ObservableTokenStore,
  type RefreshTokenStorage,
} from '../auth/token-store'

export type FakeRequest = {
  path: string
  method: string
  body: unknown
  authorization: string | null
}

/** 응답 하나. `'offline'` 은 서버에 닿지 못한 것(fetch가 던진다)이다. */
export type FakeResponse = { status: number; body?: unknown } | 'offline'

export function errorBody(code: string): { error: { code: string; message: string } } {
  return { error: { code, message: code } }
}

/** 보안 저장소 자리의 가짜. 무엇이 쓰였는지 테스트가 본다. */
export type FakeStorage = RefreshTokenStorage & {
  value: string | null
  /** `write` 로 들어온 값 전부. */
  writes: string[]
  removes: number
  /** true면 읽기·쓰기·지우기가 던진다. */
  broken: boolean
}

export function fakeStorage(initial: string | null = null): FakeStorage {
  const storage: FakeStorage = {
    value: initial,
    writes: [],
    removes: 0,
    broken: false,
    read: async () => {
      if (storage.broken) throw new Error('keystore unavailable')
      return storage.value
    },
    write: async (refreshToken) => {
      if (storage.broken) throw new Error('keystore unavailable')
      storage.writes.push(refreshToken)
      storage.value = refreshToken
    },
    remove: async () => {
      if (storage.broken) throw new Error('keystore unavailable')
      storage.removes += 1
      storage.value = null
    },
  }
  return storage
}

/**
 * `fetch` 와 보안 저장소만 가짜로 바꾸고 실제 `api-client`·토큰 저장소·세션을 그대로 쓴다.
 * 앱이 서버에 무엇을 보내고 저장소에 무엇을 남기는지까지 테스트가 본다.
 */
export function fakeApp(
  handler: (request: FakeRequest) => FakeResponse,
  storedRefreshToken: string | null = null,
): {
  api: ApiClient
  tokens: ObservableTokenStore
  session: SessionStore
  storage: FakeStorage
  requests: FakeRequest[]
} {
  const requests: FakeRequest[] = []

  vi.stubGlobal('fetch', (input: string, init: RequestInit = {}) => {
    const request: FakeRequest = {
      path: new URL(input).pathname,
      method: init.method ?? 'GET',
      body: typeof init.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
      authorization: new Headers(init.headers).get('authorization'),
    }
    requests.push(request)

    const response = handler(request)
    if (response === 'offline') return Promise.reject(new TypeError('Network request failed'))

    return Promise.resolve(
      new Response(response.body === undefined ? null : JSON.stringify(response.body), {
        status: response.status,
      }),
    )
  })

  const storage = fakeStorage(storedRefreshToken)
  const tokens = createTokenStore(storage)
  const api = createApiClient({ baseUrl: 'http://api.test', tokenStore: tokens })
  const session = createSessionStore({ client: api, tokens })
  return { api, tokens, session, storage, requests }
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
    refreshToken: 'refresh-1',
    user: { id: '2f1c1c5e-6f0b-4c0e-9d57-0b5a1b1f8a11', email: 'user@example.com' },
  },
}

export const health: FakeResponse = {
  status: 200,
  body: { status: 'ok', db: 'ok', version: '0.1.0' },
}
