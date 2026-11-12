import { describe, it, expect, vi, afterEach } from 'vitest'
import { ApiError, createApiClient, type AuthTokens, type TokenStore } from './index.js'

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

/** 메모리 토큰 저장소. `state.current` 로 지금 들어 있는 값을 본다. */
function memoryStore(initial: AuthTokens | null = null) {
  const state = { current: initial }
  const store: TokenStore = {
    get: () => state.current,
    set: (tokens) => {
      state.current = tokens
    },
  }
  return { store, state }
}

const storeWith = (accessToken: string): TokenStore =>
  memoryStore({ accessToken, refreshToken: 'r' }).store

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
  it('저장소에 토큰이 있으면 Authorization 헤더를 붙인다', async () => {
    const spy = stubFetch(() => Promise.resolve(json(okHealth)))
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: storeWith('t0ken') })

    await client.health()

    const headers = new Headers(spy.mock.calls[0]?.[1]?.headers)
    expect(headers.get('authorization')).toBe('Bearer t0ken')
  })

  it('저장소가 비어 있으면 Authorization 헤더를 붙이지 않는다', async () => {
    const spy = stubFetch(() => Promise.resolve(json(okHealth)))
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore().store })

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
      const client = createApiClient({
        baseUrl: 'http://api.test',
        tokenStore: storeWith(badToken),
      })

      const error = await client.health().then(
        () => null,
        (caught: unknown) => caught,
      )

      expect(error).toBeInstanceOf(ApiError)
    }
  })
})

describe('비동기 토큰', () => {
  it('저장소가 Promise를 돌려줘도 Authorization 헤더를 붙인다', async () => {
    // MV3의 chrome.storage와 Expo SecureStore는 비동기 전용이다.
    const spy = stubFetch(() => Promise.resolve(json(okHealth)))
    const client = createApiClient({
      baseUrl: 'http://api.test',
      tokenStore: {
        get: () => Promise.resolve({ accessToken: 't0ken', refreshToken: 'r' }),
        set: () => Promise.resolve(),
      },
    })

    await client.health()

    const headers = new Headers(spy.mock.calls[0]?.[1]?.headers)
    expect(headers.get('authorization')).toBe('Bearer t0ken')
  })
})

const USER = { id: '0b0e7c7e-7b1f-4d0a-9d55-0d6f2f1f6a11', email: 'a@example.com' }
const expired = () =>
  json({ error: { code: 'ACCESS_TOKEN_EXPIRED', message: '액세스 토큰이 만료되었습니다' } }, 401)
const refreshed = (accessToken = 'new-access') => json({ accessToken, expiresIn: 900 })

/** 호출을 `METHOD 경로` 로 요약한다. */
const calls = (spy: ReturnType<typeof stubFetch>): string[] =>
  spy.mock.calls.map(([url, init]) => `${init?.method ?? 'GET'} ${new URL(url).pathname}`)

const bodyOf = (init?: RequestInit): unknown => JSON.parse(String(init?.body))
const bearerOf = (init?: RequestInit): string | null =>
  new Headers(init?.headers).get('authorization')

const caught = (promise: Promise<unknown>): Promise<ApiError> =>
  promise.then(
    () => {
      throw new Error('던져야 하는데 성공했다')
    },
    (error: unknown) => error as ApiError,
  )

describe('login()', () => {
  it('신원 토큰을 보내고 받은 토큰을 저장한 뒤 사용자를 돌려준다', async () => {
    const spy = stubFetch(() =>
      Promise.resolve(
        json({ accessToken: 'access', expiresIn: 900, refreshToken: 'refresh', user: USER }),
      ),
    )
    const { store, state } = memoryStore()
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const user = await client.login('google', 'id-token')

    expect(user).toEqual(USER)
    expect(state.current).toEqual({ accessToken: 'access', refreshToken: 'refresh' })
    expect(calls(spy)).toEqual(['POST /auth/login'])
    expect(bodyOf(spy.mock.calls[0]?.[1])).toEqual({
      provider: 'google',
      idToken: 'id-token',
      session: 'body',
    })
    expect(spy.mock.calls[0]?.[1]?.credentials).toBeUndefined()
  })

  it('로그인이 거부되면 그 코드의 ApiError를 던지고 저장소는 그대로다', async () => {
    stubFetch(() =>
      Promise.resolve(json({ error: { code: 'INVALID_PROVIDER_TOKEN', message: 'x' } }, 401)),
    )
    const { store, state } = memoryStore()
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const error = await caught(client.login('apple', 'bad'))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('INVALID_PROVIDER_TOKEN')
    expect(state.current).toBeNull()
  })
})

describe('액세스 토큰 자동 갱신', () => {
  it('ACCESS_TOKEN_EXPIRED를 받으면 갱신하고 원래 요청을 다시 보낸다', async () => {
    const spy = stubFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) return Promise.resolve(refreshed())
      return Promise.resolve(bearerOf(init) === 'Bearer old-access' ? expired() : json(okHealth))
    })
    const { store, state } = memoryStore({ accessToken: 'old-access', refreshToken: 'refresh' })
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const result = await client.health()

    expect(result).toEqual(okHealth)
    expect(calls(spy)).toEqual(['GET /health', 'POST /auth/refresh', 'GET /health'])
    expect(bodyOf(spy.mock.calls[1]?.[1])).toEqual({ refreshToken: 'refresh' })
    expect(bearerOf(spy.mock.calls[2]?.[1])).toBe('Bearer new-access')
    // 갱신 토큰은 그대로다(회전 없음).
    expect(state.current).toEqual({ accessToken: 'new-access', refreshToken: 'refresh' })
  })

  it('갱신이 거부되면 저장소를 비우고 그 인증 오류를 돌려준다', async () => {
    stubFetch((url) =>
      Promise.resolve(
        url.endsWith('/auth/refresh')
          ? json({ error: { code: 'REFRESH_TOKEN_EXPIRED', message: '다시 로그인해 주세요' } }, 401)
          : expired(),
      ),
    )
    const { store, state } = memoryStore({ accessToken: 'old-access', refreshToken: 'refresh' })
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const error = await caught(client.health())

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('REFRESH_TOKEN_EXPIRED')
    expect(error.status).toBe(401)
    expect(state.current).toBeNull()
  })

  it('갱신 요청이 서버에 닿지 못하면 토큰을 지우지 않는다', async () => {
    stubFetch((url) =>
      url.endsWith('/auth/refresh')
        ? Promise.reject(new TypeError('Failed to fetch'))
        : Promise.resolve(expired()),
    )
    const tokens = { accessToken: 'old-access', refreshToken: 'refresh' }
    const { store, state } = memoryStore(tokens)
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const error = await caught(client.health())

    expect(error.code).toBe('NETWORK')
    expect(state.current).toEqual(tokens)
  })

  it('갱신 토큰이 없으면 서버에 묻지 않고 REFRESH_TOKEN_INVALID를 던진다', async () => {
    const spy = stubFetch(() => Promise.resolve(expired()))
    const { store, state } = memoryStore({ accessToken: 'old-access', refreshToken: null })
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const error = await caught(client.health())

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('REFRESH_TOKEN_INVALID')
    expect(calls(spy)).toEqual(['GET /health'])
    expect(state.current).toBeNull()
  })

  it('만료가 아닌 401(UNAUTHORIZED)에는 갱신하지 않는다', async () => {
    const spy = stubFetch(() =>
      Promise.resolve(json({ error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } }, 401)),
    )
    const tokens = { accessToken: 'broken', refreshToken: 'refresh' }
    const { store, state } = memoryStore(tokens)
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const error = await caught(client.health())

    expect(error.code).toBe('UNAUTHORIZED')
    expect(calls(spy)).toEqual(['GET /health'])
    expect(state.current).toEqual(tokens)
  })

  // Review Focus 4
  it('동시에 만료를 만난 요청들이 갱신을 한 번만 보낸다', async () => {
    const spy = stubFetch(async (url, init) => {
      // 응답을 늦춰 세 요청이 모두 만료를 본 뒤에 갱신이 끝나게 한다.
      await new Promise((resolve) => setTimeout(resolve, 5))
      if (url.endsWith('/auth/refresh')) return refreshed()
      return bearerOf(init) === 'Bearer old-access' ? expired() : json(okHealth)
    })
    const { store } = memoryStore({ accessToken: 'old-access', refreshToken: 'refresh' })
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const results = await Promise.all([client.health(), client.health(), client.health()])

    expect(results).toEqual([okHealth, okHealth, okHealth])
    expect(calls(spy).filter((call) => call === 'POST /auth/refresh')).toHaveLength(1)
  })

  // Review Focus 5
  it('다시 보낸 요청이 또 만료라고 해도 한 번만 갱신하고 그 오류를 던진다', async () => {
    const spy = stubFetch((url) =>
      Promise.resolve(url.endsWith('/auth/refresh') ? refreshed() : expired()),
    )
    const { store } = memoryStore({ accessToken: 'old-access', refreshToken: 'refresh' })
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const error = await caught(client.health())

    expect(error.code).toBe('ACCESS_TOKEN_EXPIRED')
    expect(calls(spy)).toEqual(['GET /health', 'POST /auth/refresh', 'GET /health'])
  })
})

describe('logout()', () => {
  it('갱신 토큰을 서버에 보내 폐기하고 저장소를 비운다', async () => {
    const spy = stubFetch(() => Promise.resolve(new Response(null, { status: 204 })))
    const { store, state } = memoryStore({ accessToken: 'access', refreshToken: 'refresh' })
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    await client.logout()

    expect(calls(spy)).toEqual(['POST /auth/logout'])
    expect(bodyOf(spy.mock.calls[0]?.[1])).toEqual({ refreshToken: 'refresh' })
    expect(state.current).toBeNull()
  })

  it('서버 호출이 실패해도 저장소를 비우고 그 오류를 던진다', async () => {
    stubFetch(() => Promise.reject(new TypeError('Failed to fetch')))
    const { store, state } = memoryStore({ accessToken: 'access', refreshToken: 'refresh' })
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const error = await caught(client.logout())

    expect(error.code).toBe('NETWORK')
    expect(state.current).toBeNull()
  })

  it('로그인하지 않은 상태에서는 서버를 부르지 않는다', async () => {
    const spy = stubFetch(() => Promise.resolve(new Response(null, { status: 204 })))
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: memoryStore().store })

    await client.logout()

    expect(spy).not.toHaveBeenCalled()
  })
})

describe('쿠키 방식 (웹)', () => {
  it('로그인은 session: cookie 와 credentials: include 로 보내고 갱신 토큰 없이 저장한다', async () => {
    const spy = stubFetch(() =>
      Promise.resolve(
        json({ accessToken: 'access', expiresIn: 900, refreshToken: null, user: USER }),
      ),
    )
    const { store, state } = memoryStore()
    const client = createApiClient({
      baseUrl: 'http://api.test',
      tokenStore: store,
      session: 'cookie',
    })

    await client.login('google', 'id-token')

    expect(bodyOf(spy.mock.calls[0]?.[1])).toMatchObject({ session: 'cookie' })
    expect(spy.mock.calls[0]?.[1]?.credentials).toBe('include')
    expect(state.current).toEqual({ accessToken: 'access', refreshToken: null })
  })

  it('새로고침 뒤 저장소가 비어 있어도 refresh()가 쿠키로 세션을 되살린다', async () => {
    const spy = stubFetch((url) =>
      Promise.resolve(url.endsWith('/auth/refresh') ? refreshed('revived') : json(okHealth)),
    )
    const client = createApiClient({ baseUrl: 'http://api.test', session: 'cookie' })

    await client.refresh()
    await client.health()

    expect(bodyOf(spy.mock.calls[0]?.[1])).toEqual({})
    expect(spy.mock.calls[0]?.[1]?.credentials).toBe('include')
    expect(bearerOf(spy.mock.calls[1]?.[1])).toBe('Bearer revived')
  })

  it('일반 요청에는 쿠키를 실어 보내지 않는다', async () => {
    const spy = stubFetch(() => Promise.resolve(json(okHealth)))
    const client = createApiClient({ baseUrl: 'http://api.test', session: 'cookie' })

    await client.health()

    expect(spy.mock.calls[0]?.[1]?.credentials).toBeUndefined()
  })

  it('로그아웃은 저장한 갱신 토큰이 없어도 쿠키로 서버를 부른다', async () => {
    const spy = stubFetch(() => Promise.resolve(new Response(null, { status: 204 })))
    const client = createApiClient({ baseUrl: 'http://api.test', session: 'cookie' })

    await client.logout()

    expect(calls(spy)).toEqual(['POST /auth/logout'])
    expect(spy.mock.calls[0]?.[1]?.credentials).toBe('include')
  })
})

describe('토큰 저장소 실패', () => {
  it('저장소가 던져도 ApiError로 바꾼다', async () => {
    stubFetch(() =>
      Promise.resolve(
        json({ accessToken: 'access', expiresIn: 900, refreshToken: 'refresh', user: USER }),
      ),
    )
    const client = createApiClient({
      baseUrl: 'http://api.test',
      tokenStore: {
        get: () => null,
        set: () => {
          throw new Error('disk full')
        },
      },
    })

    const error = await caught(client.login('google', 'id-token'))

    expect(error).toBeInstanceOf(ApiError)
  })
})

const CONTENT = {
  id: '5d3c1f0a-6c0e-4c57-9d0b-2f4c8b1a7e11',
  url: 'https://example.com/a',
  title: null,
  description: null,
  domain: 'example.com',
  imageUrl: null,
  savedAt: '2026-11-12T03:00:00.000Z',
  source: 'web',
  archiveState: 'inbox',
  linkState: 'ok',
  extractionLevel: 'metadata_only',
  summaryStatus: 'pending',
  metadataStatus: 'pending',
  resurfacingIncluded: true,
}

describe('saveContent()', () => {
  it('새로 저장하면(201) status created와 콘텐츠를 돌려준다', async () => {
    const spy = stubFetch(() => Promise.resolve(json({ status: 'created', content: CONTENT }, 201)))
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: storeWith('t0ken') })

    const result = await client.saveContent({ url: 'https://example.com/a', source: 'web' })

    expect(result).toEqual({ status: 'created', content: CONTENT })
    expect(calls(spy)).toEqual(['POST /contents'])
    expect(bodyOf(spy.mock.calls[0]?.[1])).toEqual({ url: 'https://example.com/a', source: 'web' })
    expect(bearerOf(spy.mock.calls[0]?.[1])).toBe('Bearer t0ken')
  })

  it('이미 저장한 URL이면(200) 던지지 않고 status duplicate와 기존 콘텐츠를 돌려준다', async () => {
    stubFetch(() => Promise.resolve(json({ status: 'duplicate', content: CONTENT }, 200)))
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: storeWith('t0ken') })

    const result = await client.saveContent({
      url: 'https://example.com/a?utm_source=x',
      source: 'web',
    })

    expect(result.status).toBe('duplicate')
    expect(result.content.id).toBe(CONTENT.id)
  })

  it('검증 실패(400)는 VALIDATION_FAILED 코드의 ApiError로 던진다', async () => {
    stubFetch(() =>
      Promise.resolve(
        json({ error: { code: 'VALIDATION_FAILED', message: 'http 또는 https 주소만' } }, 400),
      ),
    )
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: storeWith('t0ken') })

    const error = await caught(client.saveContent({ url: 'ftp://example.com', source: 'web' }))

    expect(error).toBeInstanceOf(ApiError)
    expect(error.code).toBe('VALIDATION_FAILED')
    expect(error.status).toBe(400)
  })

  it('액세스 토큰이 만료됐으면 갱신한 뒤 같은 본문으로 다시 보낸다', async () => {
    const spy = stubFetch((url, init) => {
      if (url.endsWith('/auth/refresh')) return Promise.resolve(refreshed())
      return Promise.resolve(
        bearerOf(init) === 'Bearer old-access'
          ? expired()
          : json({ status: 'created', content: CONTENT }, 201),
      )
    })
    const { store } = memoryStore({ accessToken: 'old-access', refreshToken: 'refresh' })
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: store })

    const result = await client.saveContent({ url: 'https://example.com/a', source: 'mobile' })

    expect(result.status).toBe('created')
    expect(calls(spy)).toEqual(['POST /contents', 'POST /auth/refresh', 'POST /contents'])
    expect(bodyOf(spy.mock.calls[2]?.[1])).toEqual({
      url: 'https://example.com/a',
      source: 'mobile',
    })
  })

  it('계약과 다른 성공 응답은 MALFORMED_RESPONSE다', async () => {
    stubFetch(() => Promise.resolve(json({ status: 'updated', content: CONTENT }, 200)))
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: storeWith('t0ken') })

    const error = await caught(client.saveContent({ url: 'https://example.com/a', source: 'web' }))

    expect(error.code).toBe('MALFORMED_RESPONSE')
  })
})

describe('listContents()', () => {
  it('조건 없이 부르면 쿼리 없이 요청하고 목록을 돌려준다', async () => {
    const spy = stubFetch(() => Promise.resolve(json({ items: [CONTENT], nextCursor: 'next' })))
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: storeWith('t0ken') })

    const result = await client.listContents()

    expect(result).toEqual({ items: [CONTENT], nextCursor: 'next' })
    expect(spy.mock.calls[0]?.[0]).toBe('http://api.test/contents')
    expect(bearerOf(spy.mock.calls[0]?.[1])).toBe('Bearer t0ken')
  })

  it('limit과 cursor를 쿼리로 보낸다. cursor는 인코딩한다', async () => {
    const spy = stubFetch(() => Promise.resolve(json({ items: [], nextCursor: null })))
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: storeWith('t0ken') })

    await client.listContents({ limit: 20, cursor: 'a+b/c=&x' })

    const url = new URL(spy.mock.calls[0]![0])
    expect(url.pathname).toBe('/contents')
    expect(url.searchParams.get('limit')).toBe('20')
    expect(url.searchParams.get('cursor')).toBe('a+b/c=&x')
  })

  it('잘못된 커서(400)는 VALIDATION_FAILED 코드의 ApiError로 던진다', async () => {
    stubFetch(() =>
      Promise.resolve(json({ error: { code: 'VALIDATION_FAILED', message: 'x' } }, 400)),
    )
    const client = createApiClient({ baseUrl: 'http://api.test', tokenStore: storeWith('t0ken') })

    const error = await caught(client.listContents({ cursor: 'bad' }))

    expect(error.code).toBe('VALIDATION_FAILED')
  })

  it('로그인하지 않았으면 서버의 UNAUTHORIZED를 그대로 던진다', async () => {
    stubFetch(() =>
      Promise.resolve(json({ error: { code: 'UNAUTHORIZED', message: '인증이 필요합니다' } }, 401)),
    )
    const client = createApiClient({ baseUrl: 'http://api.test' })

    const error = await caught(client.listContents())

    expect(error.code).toBe('UNAUTHORIZED')
  })
})
