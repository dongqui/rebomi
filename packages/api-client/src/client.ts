import {
  ERROR_CODES,
  HEALTH_ACCEPTED_STATUSES,
  apiErrorBodySchema,
  healthResponseSchema,
  type HealthResponse,
} from '@rebomi/api-contract'
import type { ZodType } from 'zod'
import { ApiError } from './error.js'

/** 응답이 오지 않는 서버에서 화면이 영원히 "확인 중…"에 머물지 않게 한다. */
const DEFAULT_TIMEOUT_MS = 10_000

export type ApiClientOptions = {
  /** API 서버의 오리진. 환경변수로만 받는다 — 기본값을 두지 않는다. */
  baseUrl: string
  /**
   * 요청마다 호출된다. null을 주면 Authorization 헤더를 붙이지 않는다.
   *
   * Promise를 돌려줘도 된다 — MV3의 `chrome.storage` 와 Expo `SecureStore` 는
   * 비동기 전용이라, 동기 시그니처면 확장과 모바일이 이 인터페이스를 구현할 수 없다.
   */
  getToken?: () => string | null | Promise<string | null>
  /** 응답 대기 제한. 기본 10초. */
  timeoutMs?: number
}

export type ApiClient = {
  health(): Promise<HealthResponse>
}

/** RN에 `AbortSignal.timeout` 이 없을 수 있어 직접 만든다. */
function timeoutSignal(ms: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), ms)
  return { signal: controller.signal, clear: () => clearTimeout(timer) }
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

  /**
   * 요청·응답·에러 변환이 모두 여기 모인다. 엔드포인트가 늘어도 이 로직은
   * 복제되지 않는다.
   *
   * @param acceptedStatuses 예외로 바꾸지 않고 본문을 파싱할 상태 코드.
   */
  async function request<T>(
    path: string,
    schema: ZodType<T>,
    acceptedStatuses: readonly number[],
  ): Promise<T> {
    const { signal, clear } = timeoutSignal(timeoutMs)

    let response: Response
    try {
      // 헤더 조립도 이 안에 둔다. Headers는 Latin-1 밖 문자를 담은 토큰에
      // TypeError를 던지는데, 그것이 밖으로 새면 "ApiError만 던진다"가 거짓이 된다.
      const headers = new Headers({ accept: 'application/json' })
      const token = await options.getToken?.()
      if (token) {
        headers.set('authorization', `Bearer ${token}`)
      }

      response = await fetch(`${base}${path}`, { headers, signal })
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

    let text: string
    try {
      text = await response.text()
    } catch (cause) {
      throw new ApiError({
        code: ERROR_CODES.MALFORMED_RESPONSE,
        message: '응답 본문을 읽을 수 없습니다',
        status: response.status,
        cause,
      })
    }

    if (!response.ok && !acceptedStatuses.includes(response.status)) {
      throw toApiError(text, response.status)
    }

    return parseBody(text, schema, response.status)
  }

  return {
    health: () => request('/health', healthResponseSchema, HEALTH_ACCEPTED_STATUSES),
  }
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
