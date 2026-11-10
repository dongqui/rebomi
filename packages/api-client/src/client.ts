import {
  ERROR_CODES,
  HEALTH_ACCEPTED_STATUSES,
  apiErrorBodySchema,
  healthResponseSchema,
  type HealthResponse,
} from '@rebomi/api-contract'
import type { ZodType } from 'zod'
import { ApiError } from './error.js'

export type ApiClientOptions = {
  /** API 서버의 오리진. 환경변수로만 받는다 — 기본값을 두지 않는다. */
  baseUrl: string
  /** 요청마다 호출된다. null을 주면 Authorization 헤더를 붙이지 않는다. */
  getToken?: () => string | null
}

export type ApiClient = {
  health(): Promise<HealthResponse>
}

/**
 * 네 클라이언트(웹·확장·iOS·Android)가 공유하는 유일한 HTTP 경로.
 *
 * `fetch` 외의 플랫폼 API를 쓰지 않는다 — React Native 번들러가 깨지지 않게
 * 하는 조건이다.
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const base = options.baseUrl.replace(/\/+$/, '')

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
    const headers = new Headers({ accept: 'application/json' })
    const token = options.getToken?.()
    if (token) {
      headers.set('authorization', `Bearer ${token}`)
    }

    let response: Response
    try {
      response = await fetch(`${base}${path}`, { headers })
    } catch (cause) {
      throw new ApiError({
        code: ERROR_CODES.NETWORK,
        message: '서버에 연결할 수 없습니다',
        status: null,
        cause,
      })
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
