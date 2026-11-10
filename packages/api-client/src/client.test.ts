import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiError, createApiClient } from './index.js'

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  })

const okHealth = { status: 'ok', db: 'ok', version: '0.0.0' }

/** fetch를 대체하고, 호출 인자를 돌려준다. */
function stubFetch(impl: (url: string, init?: RequestInit) => Promise<Response>) {
  const spy = vi.fn(impl)
  vi.stubGlobal('fetch', spy)
  return spy
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('health()', () => {
  it('200 응답을 파싱해 반환한다', async () => {
    stubFetch(() => Promise.resolve(json(okHealth)))
    const client = createApiClient({ baseUrl: 'http://api.test' })

    await expect(client.health()).resolves.toEqual(okHealth)
  })

  it('503 degraded 응답도 던지지 않고 반환한다', async () => {
    stubFetch(() =>
      Promise.resolve(json({ status: 'degraded', db: 'error', version: '0.0.0' }, 503)),
    )
    const client = createApiClient({ baseUrl: 'http://api.test' })

    const result = await client.health()

    expect(result.status).toBe('degraded')
    expect(result.db).toBe('error')
  })
})

describe('에러 변환', () => {
  it('4xx 에러 바디를 code가 담긴 ApiError로 던진다', async () => {
    stubFetch(() =>
      Promise.resolve(json({ error: { code: 'UNAUTHORIZED', message: '토큰이 없습니다' } }, 401)),
    )
    const client = createApiClient({ baseUrl: 'http://api.test' })

    const error = await client.health().then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('UNAUTHORIZED')
    expect((error as ApiError).status).toBe(401)
  })

  it('fetch가 거부되면 NETWORK 코드의 ApiError를 던진다', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    const client = createApiClient({ baseUrl: 'http://api.test' })

    const error = await client.health().then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('NETWORK')
    expect((error as ApiError).status).toBeNull()
  })

  // Review Focus 3
  it('JSON이 아닌 응답을 MALFORMED_RESPONSE ApiError로 바꾼다', async () => {
    const cases: Response[] = [
      new Response('<html>502 Bad Gateway</html>', {
        status: 503,
        headers: { 'content-type': 'text/html' },
      }),
      new Response('', { status: 200 }),
    ]

    for (const response of cases) {
      stubFetch(() => Promise.resolve(response))
      const client = createApiClient({ baseUrl: 'http://api.test' })

      const error = await client.health().then(
        () => null,
        (caught: unknown) => caught,
      )

      expect(error).toBeInstanceOf(ApiError)
      expect((error as ApiError).code).toBe('MALFORMED_RESPONSE')
    }
  })
})

describe('인증 헤더', () => {
  it('getToken이 값을 주면 Authorization 헤더를 붙인다', async () => {
    const spy = stubFetch(() => Promise.resolve(json(okHealth)))
    const client = createApiClient({ baseUrl: 'http://api.test', getToken: () => 't0ken' })

    await client.health()

    const headers = new Headers(spy.mock.calls[0]?.[1]?.headers)
    expect(headers.get('authorization')).toBe('Bearer t0ken')
  })

  it('getToken이 null을 주면 Authorization 헤더를 붙이지 않는다', async () => {
    const spy = stubFetch(() => Promise.resolve(json(okHealth)))
    const client = createApiClient({ baseUrl: 'http://api.test', getToken: () => null })

    await client.health()

    const headers = new Headers(spy.mock.calls[0]?.[1]?.headers)
    expect(headers.has('authorization')).toBe(false)
  })
})

describe('타임아웃', () => {
  it('응답이 오지 않으면 NETWORK 코드의 ApiError로 끊는다', async () => {
    stubFetch(
      (_url, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () => {
            reject(new Error('aborted'))
          })
        }),
    )
    const client = createApiClient({ baseUrl: 'http://api.test', timeoutMs: 50 })

    const error = await client.health().then(
      () => null,
      (caught: unknown) => caught,
    )

    expect(error).toBeInstanceOf(ApiError)
    expect((error as ApiError).code).toBe('NETWORK')
  })
})

describe('요청 조립 실패', () => {
  it('헤더로 쓸 수 없는 토큰이 와도 ApiError로 던진다', async () => {
    // Headers는 Latin-1 밖 문자에 TypeError를 던진다. 그것이 호출자에게
    // 그대로 새면 "클라이언트는 ApiError만 던진다"는 계약이 거짓이 된다.
    for (const badToken of ['토큰', 'abc def\u0000']) {
      stubFetch(() => Promise.resolve(json(okHealth)))
      const client = createApiClient({ baseUrl: 'http://api.test', getToken: () => badToken })

      const error = await client.health().then(
        () => null,
        (caught: unknown) => caught,
      )

      expect(error).toBeInstanceOf(ApiError)
    }
  })
})

describe('비동기 토큰', () => {
  it('getToken이 Promise를 돌려줘도 Authorization 헤더를 붙인다', async () => {
    // MV3의 chrome.storage와 Expo SecureStore는 비동기 전용이다.
    const spy = stubFetch(() => Promise.resolve(json(okHealth)))
    const client = createApiClient({
      baseUrl: 'http://api.test',
      getToken: () => Promise.resolve('t0ken'),
    })

    await client.health()

    const headers = new Headers(spy.mock.calls[0]?.[1]?.headers)
    expect(headers.get('authorization')).toBe('Bearer t0ken')
  })
})
