import {
  ERROR_CODES,
  HEALTH_ACCEPTED_STATUSES,
  apiErrorBodySchema,
  healthResponseSchema,
  loginResponseSchema,
  refreshResponseSchema,
  type AuthProvider,
  type AuthUser,
  type HealthResponse,
  type SessionMode,
} from '@rebomi/api-contract'
import type { ZodType } from 'zod'
import { ApiError } from './error.js'

/** 응답이 오지 않는 서버에서 화면이 영원히 "확인 중…"에 머물지 않게 한다. */
const DEFAULT_TIMEOUT_MS = 10_000

/** 클라이언트가 보관하는 토큰. 쿠키 방식(웹)에서는 갱신 토큰이 쿠키에만 있어 null이다. */
export type AuthTokens = {
  accessToken: string
  refreshToken: string | null
}

/**
 * 토큰을 두는 곳. 플랫폼마다 이것 하나만 구현한다 — 확장은 `chrome.storage`,
 * 모바일은 `SecureStore`.
 *
 * Promise를 돌려줘도 된다. 두 저장소 모두 비동기 전용이라, 동기 시그니처면 확장과
 * 모바일이 이 인터페이스를 구현할 수 없다.
 */
export type TokenStore = {
  /** 로그인하지 않았으면 null. 요청마다 호출된다. */
  get(): AuthTokens | null | Promise<AuthTokens | null>
  /** 로그인·갱신 때 새 토큰으로, 로그아웃·갱신 실패 때 null로 호출된다. */
  set(tokens: AuthTokens | null): void | Promise<void>
}

export type ApiClientOptions = {
  /** API 서버의 오리진. 환경변수로만 받는다 — 기본값을 두지 않는다. */
  baseUrl: string
  /** 생략하면 메모리에만 둔다(새로고침하면 사라진다). 쿠키 방식의 웹은 그것으로 충분하다. */
  tokenStore?: TokenStore
  /**
   * 갱신 토큰을 받는 방식. 기본 `body`.
   *
   * `cookie` 는 웹용이다. 갱신 토큰을 httpOnly 쿠키로만 받고, `/auth/*` 요청에 쿠키를
   * 실어 보낸다. 새로고침 뒤에는 `refresh()` 로 액세스 토큰을 다시 받는다.
   */
  session?: SessionMode
  /** 응답 대기 제한. 기본 10초. */
  timeoutMs?: number
}

export type ApiClient = {
  health(): Promise<HealthResponse>
  /** Google·Apple이 발급한 신원 토큰으로 로그인하고 받은 토큰을 저장한다. */
  login(provider: AuthProvider, idToken: string): Promise<AuthUser>
  /**
   * 액세스 토큰을 새로 받는다. 보통은 직접 부를 필요가 없다 — 요청이
   * `ACCESS_TOKEN_EXPIRED` 를 받으면 알아서 갱신하고 다시 보낸다.
   *
   * 서버가 갱신을 거부하면 저장한 토큰을 지우고 그 오류를 던진다.
   */
  refresh(): Promise<void>
  /**
   * 갱신 토큰을 폐기하고 저장한 토큰을 지운다. 서버 호출이 실패해도 토큰은 지우고,
   * 그 오류를 던진다 — 서버에는 갱신 토큰이 살아 있을 수 있다는 뜻이다.
   */
  logout(): Promise<void>
}

type RequestInitLike = {
  method?: 'GET' | 'POST'
  body?: unknown
  /** 액세스 토큰을 붙이고, 만료됐으면 갱신 후 다시 보낸다. */
  authenticated?: boolean
  /** 쿠키를 실어 보낸다. 쿠키 방식의 `/auth/*` 요청만. */
  withCookies?: boolean
  /** 예외로 바꾸지 않고 본문을 파싱할 상태 코드. */
  acceptedStatuses?: readonly number[]
}

/** RN에 `AbortSignal.timeout` 이 없을 수 있어 직접 만든다. */
function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
}

function memoryTokenStore(): TokenStore {
  let tokens: AuthTokens | null = null
  return {
    get: () => tokens,
    set: (next) => {
      tokens = next
    },
  }
}

/**
 * 네 클라이언트(웹·확장·iOS·Android)가 공유하는 유일한 HTTP 경로.
 *
 * `fetch` 외의 플랫폼 API를 쓰지 않는다 — React Native 번들러가 깨지지 않게
 * 하는 조건이다. 이 함수가 던지는 것은 언제나 `ApiError` 다.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = options.baseUrl.replace(/\/+$/, '')
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS
  const store = options.tokenStore ?? memoryTokenStore()
  const cookieSession = options.session === 'cookie'

  /** 저장소가 던지는 것도 ApiError로 바꾼다 — "ApiError만 던진다"를 지키기 위해서다. */
  async function saveTokens(tokens: AuthTokens | null): Promise<void> {
    try {
      await store.set(tokens)
    } catch (cause) {
      throw new ApiError({
        code: ERROR_CODES.NETWORK,
        message: '토큰을 저장할 수 없습니다',
        status: null,
        cause,
      })
    }
  }

  /** 요청 한 번. 응답의 상태와 본문 문자열까지만 책임진다. */
  async function send(
    path: string,
    init: RequestInitLike,
  ): Promise<{ status: number; ok: boolean; text: string }> {
    const { signal, clear } = timeoutSignal(timeoutMs)

    let response: Response
    try {
      // 헤더 조립도 이 안에 둔다. Headers는 Latin-1 밖 문자를 담은 토큰에
      // TypeError를 던지는데, 그것이 밖으로 새면 "ApiError만 던진다"가 거짓이 된다.
      const headers = new Headers({ accept: 'application/json' })
      if (init.authenticated) {
        const tokens = await store.get()
        if (tokens) headers.set('authorization', `Bearer ${tokens.accessToken}`)
      }
      if (init.body !== undefined) headers.set('content-type', 'application/json')

      response = await fetch(`${base}${path}`, {
        method: init.method ?? 'GET',
        headers,
        signal,
        ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
        ...(init.withCookies ? { credentials: 'include' as const } : {}),
      })
    } catch (cause) {
      throw new ApiError({
        code: ERROR_CODES.NETWORK,
        message: '서버에 연결할 수 없습니다',
        status: null,
        cause,
      })
    } finally {
      clear()
    }

    try {
      return { status: response.status, ok: response.ok, text: await response.text() }
    } catch (cause) {
      throw new ApiError({
        code: ERROR_CODES.MALFORMED_RESPONSE,
        message: '응답 본문을 읽을 수 없습니다',
        status: response.status,
        cause,
      })
    }
  }

  /**
   * 요청·응답·에러 변환이 모두 여기 모인다. 엔드포인트가 늘어도 이 로직은
   * 복제되지 않는다. `schema` 가 null이면 본문 없는 응답(204)이다.
   */
  async function request<T>(
    path: string,
    schema: ZodType<T> | null,
    init: RequestInitLike = {},
  ): Promise<T> {
    let response = await send(path, init)

    // 만료일 때만, 한 번만 갱신하고 다시 보낸다. 다시 보낸 요청이 또 만료라고 하면
    // 그대로 던진다 — 시계가 어긋난 서버를 상대로 끝없이 돌지 않는다.
    if (init.authenticated && isAccessTokenExpired(response)) {
      await refresh()
      response = await send(path, init)
    }

    if (!response.ok && !init.acceptedStatuses?.includes(response.status)) {
      throw toApiError(response.text, response.status)
    }

    if (schema === null) return undefined as T
    return parseBody(response.text, schema, response.status)
  }

  /** 진행 중인 갱신. 동시에 만료를 만난 요청들이 갱신을 한 번만 보내게 한다. */
  let refreshing: Promise<void> | null = null

  function refresh(): Promise<void> {
    refreshing ??= doRefresh().finally(() => {
      refreshing = null
    })
    return refreshing
  }

  async function doRefresh(): Promise<void> {
    let current: AuthTokens | null
    try {
      current = await store.get()
    } catch (cause) {
      throw new ApiError({
        code: ERROR_CODES.NETWORK,
        message: '토큰을 읽을 수 없습니다',
        status: null,
        cause,
      })
    }

    const refreshToken = current?.refreshToken ?? null
    if (!cookieSession && refreshToken === null) {
      // 보낼 갱신 토큰이 없다. 서버에 물어볼 것도 없이 로그인이 필요하다.
      await saveTokens(null)
      throw new ApiError({
        code: ERROR_CODES.REFRESH_TOKEN_INVALID,
        message: '다시 로그인해 주세요',
        status: null,
      })
    }

    let refreshed
    try {
      refreshed = await request('/auth/refresh', refreshResponseSchema, {
        method: 'POST',
        body: refreshToken === null ? {} : { refreshToken },
        withCookies: cookieSession,
      })
    } catch (error) {
      // 서버가 거부했을 때만 토큰을 버린다. 연결 실패는 일시적일 수 있어, 그때
      // 지우면 지하철에서 로그아웃당한다.
      if (error instanceof ApiError && (error.status === 401 || error.status === 403)) {
        await saveTokens(null)
      }
      throw error
    }

    await saveTokens({ accessToken: refreshed.accessToken, refreshToken })
  }

  async function login(provider: AuthProvider, idToken: string): Promise<AuthUser> {
    const response = await request('/auth/login', loginResponseSchema, {
      method: 'POST',
      body: { provider, idToken, session: cookieSession ? 'cookie' : 'body' },
      withCookies: cookieSession,
    })

    await saveTokens({ accessToken: response.accessToken, refreshToken: response.refreshToken })
    return response.user
  }

  async function logout(): Promise<void> {
    let refreshToken: string | null = null
    try {
      refreshToken = (await store.get())?.refreshToken ?? null
    } catch {
      // 읽지 못해도 로그아웃은 끝까지 한다.
    }

    try {
      // 본문 방식인데 갱신 토큰이 없으면 서버에 폐기할 것이 없다.
      if (cookieSession || refreshToken !== null) {
        await request('/auth/logout', null, {
          method: 'POST',
          body: refreshToken === null ? {} : { refreshToken },
          withCookies: cookieSession,
        })
      }
    } finally {
      await saveTokens(null)
    }
  }

  return {
    health: () =>
      request('/health', healthResponseSchema, {
        authenticated: true,
        acceptedStatuses: HEALTH_ACCEPTED_STATUSES,
      }),
    login,
    refresh,
    logout,
  }
}

/** 401이고 코드가 `ACCESS_TOKEN_EXPIRED` 인가. 다른 401은 갱신으로 풀리지 않는다. */
function isAccessTokenExpired(response: { status: number; text: string }): boolean {
  if (response.status !== 401) return false
  const body = safeJsonParse(response.text)
  const parsed = body === undefined ? null : apiErrorBodySchema.safeParse(body)
  return parsed?.success === true && parsed.data.error.code === ERROR_CODES.ACCESS_TOKEN_EXPIRED
}

/** 에러 응답 본문을 ApiError로 바꾼다. 본문이 계약을 안 지키면 MALFORMED_RESPONSE. */
function toApiError(text: string, status: number): ApiError {
  const body = safeJsonParse(text)
  const parsed = body === undefined ? null : apiErrorBodySchema.safeParse(body)

  if (!parsed?.success) {
    return new ApiError({
      code: ERROR_CODES.MALFORMED_RESPONSE,
      message: `서버가 예상 밖의 응답을 보냈습니다 (HTTP ${status})`,
      status,
    })
  }

  return new ApiError({
    code: parsed.data.error.code,
    message: parsed.data.error.message,
    status,
    details: parsed.data.error.details,
  })
}

/** 성공 응답 본문을 계약에 맞춰 파싱한다. Zod·구문 오류는 밖으로 새지 않는다. */
function parseBody<T>(text: string, schema: ZodType<T>, status: number): T {
  const body = safeJsonParse(text)
  const parsed = body === undefined ? null : schema.safeParse(body)

  if (!parsed?.success) {
    throw new ApiError({
      code: ERROR_CODES.MALFORMED_RESPONSE,
      message: `서버 응답이 계약과 맞지 않습니다 (HTTP ${status})`,
      status,
      details: parsed?.error.issues,
    })
  }

  return parsed.data
}

/** 파싱에 실패하면 undefined. JSON 본문이 `undefined` 일 수는 없으므로 안전한 신호다. */
function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text) as unknown
  } catch {
    return undefined
  }
}
