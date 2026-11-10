/**
 * 클라이언트가 던지는 단 하나의 에러 타입. 호출자는 `code` 로 분기한다.
 *
 * `status` 는 응답을 받았을 때의 HTTP 상태이고, 요청이 서버에 닿지 못했으면
 * `null` 이다.
 */
export class ApiError extends Error {
  readonly code: string
  readonly status: number | null
  readonly details: unknown

  constructor(params: {
    code: string
    message: string
    status: number | null
    details?: unknown
    cause?: unknown
  }) {
    super(params.message, { cause: params.cause })
    this.name = 'ApiError'
    this.code = params.code
    this.status = params.status
    this.details = params.details
  }
}
