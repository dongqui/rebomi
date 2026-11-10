import { z } from 'zod'

/**
 * 공통 에러 코드. 서버가 내는 것과 클라이언트가 만드는 것을 한 곳에 둔다 —
 * 네 클라이언트가 모두 `code` 로만 분기하므로 목록이 갈라지면 안 된다 (스펙 6장).
 */
export const ERROR_CODES = {
  /** 요청이 스키마를 만족하지 않음. 서버가 400으로 낸다. */
  VALIDATION_FAILED: 'VALIDATION_FAILED',
  /** 처리되지 않은 서버 예외. 서버가 500으로 낸다. */
  INTERNAL: 'INTERNAL',
  /** 인증 실패. 서버가 401로 낸다. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** 요청이 서버에 닿지 못했음. 클라이언트가 만든다. */
  NETWORK: 'NETWORK',
  /** 응답이 JSON이 아니거나 계약을 만족하지 않음. 클라이언트가 만든다. */
  MALFORMED_RESPONSE: 'MALFORMED_RESPONSE',
} as const

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES]

/** 모든 에러 응답의 바디 모양. */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional(),
  }),
})

export type ApiErrorBody = z.infer<typeof apiErrorBodySchema>
