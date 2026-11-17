import { vi } from 'vitest'
import { createExtensionApi, type ExtensionApi } from '../auth/api.js'

export type FakeRequest = {
  path: string
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
 * `fetch` 만 가짜로 바꾸고 확장이 실제로 쓰는 `api-client` 구성을 그대로 통과시킨다.
 * 확장이 서버에 무엇을 보내는지(쿠키 포함 여부, 본문, 토큰)까지 테스트가 본다.
 */
export function fakeApi(handler: (request: FakeRequest) => FakeResponse): ExtensionApi & {
  requests: FakeRequest[]
} {
  const requests: FakeRequest[] = []

  vi.stubGlobal('fetch', (input: string, init: RequestInit = {}) => {
    const request: FakeRequest = {
      path: new URL(input).pathname,
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

  return { ...createExtensionApi('http://api.test'), requests }
}

export const refreshed = (accessToken = 'access-1'): FakeResponse => ({
  status: 200,
  body: { accessToken, expiresIn: 900 },
})

export const refreshRejected: FakeResponse = {
  status: 401,
  body: errorBody('REFRESH_TOKEN_INVALID'),
}

export const accessExpired: FakeResponse = {
  status: 401,
  body: errorBody('ACCESS_TOKEN_EXPIRED'),
}

/** 저장 응답. 새로 저장했으면 201, 이미 있으면 200이다. */
export const saved = (
  status: 'created' | 'duplicate',
  content: { title?: string | null; extractionLevel?: 'full' | 'partial' | 'metadata_only' } = {},
): FakeResponse => ({
  status: status === 'created' ? 201 : 200,
  body: {
    status,
    content: {
      id: '0b0e7c7e-7b1f-4d0a-9d55-0d6f2f1f6a11',
      url: 'https://example.com/posts/1?utm_source=x',
      title: '기사 제목',
      description: null,
      domain: 'example.com',
      imageUrl: null,
      savedAt: '2026-11-17T03:00:00.000Z',
      source: 'extension',
      archiveState: 'inbox',
      linkState: 'ok',
      extractionLevel: 'full',
      summaryStatus: 'pending',
      metadataStatus: 'pending',
      resurfacingIncluded: true,
      ...content,
    },
  },
})
