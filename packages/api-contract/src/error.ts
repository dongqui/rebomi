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
  /** 액세스 토큰이 없거나 형식·서명이 틀림. 서버가 401로 낸다. */
  UNAUTHORIZED: 'UNAUTHORIZED',
  /** 액세스 토큰 만료. 서버가 401로 낸다. 클라이언트는 이 코드일 때만 자동 갱신한다. */
  ACCESS_TOKEN_EXPIRED: 'ACCESS_TOKEN_EXPIRED',
  /** Google·Apple 신원 토큰의 서명·만료·발급자·대상 검증 실패. 서버가 401로 낸다. */
  INVALID_PROVIDER_TOKEN: 'INVALID_PROVIDER_TOKEN',
  /** 갱신 토큰 만료. 서버가 401로 낸다. 다시 로그인해야 한다. */
  REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
  /** 폐기되었거나 모르는 갱신 토큰, 또는 갱신 토큰 없음. 서버가 401로 낸다. */
  REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
  /** 처음 보는 신원인데 제공자가 검증한 이메일이 없음. 서버가 403으로 낸다. */
  EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
  /** 그 로그인 수단이 서버에 설정되지 않음. 서버가 503으로 낸다. */
  PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
  /** 그 경로가 없다. 서버가 404로 낸다. */
  NOT_FOUND: 'NOT_FOUND',
  /** 그 밖의 클라이언트 잘못(415 등). 서버가 해당 4xx로 낸다. */
  BAD_REQUEST: 'BAD_REQUEST',
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
