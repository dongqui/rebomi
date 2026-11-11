import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  loginRequestSchema,
  loginResponseJsonSchema,
  loginResponseSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  refreshResponseSchema,
  type LoginResponse,
} from './index.js'

describe('loginRequestSchema', () => {
  it('provider와 idToken만 있어도 받아들인다 (session은 생략 가능)', () => {
    const request = { provider: 'google', idToken: 'a.b.c' }

    expect(loginRequestSchema.parse(request)).toEqual(request)
  })

  it.each(['body', 'cookie'])('session "%s" 를 받아들인다', (session) => {
    expect(loginRequestSchema.safeParse({ provider: 'apple', idToken: 'x', session }).success).toBe(
      true,
    )
  })

  it.each([
    { provider: 'kakao', idToken: 'x' },
    { provider: 'google', idToken: '' },
    { provider: 'google' },
    { provider: 'google', idToken: 'x', session: 'header' },
    { provider: 'google', idToken: 'x'.repeat(8193) },
  ])('잘못된 요청 %j 를 거부한다', (request) => {
    expect(loginRequestSchema.safeParse(request).success).toBe(false)
  })
})

describe('loginResponseSchema', () => {
  const response: LoginResponse = {
    accessToken: 'access',
    expiresIn: 900,
    refreshToken: 'refresh',
    user: { id: '0b0e7c7e-7b1f-4d0a-9d55-0d6f2f1f6a11', email: 'a@example.com' },
  }

  it('본문 방식 응답을 받아들인다', () => {
    expect(loginResponseSchema.parse(response)).toEqual(response)
  })

  it('쿠키 방식 응답은 refreshToken이 null이다', () => {
    expect(loginResponseSchema.parse({ ...response, refreshToken: null }).refreshToken).toBeNull()
  })

  it('JSON 스키마는 계약에 없는 필드를 허용하지 않는다', () => {
    expect(loginResponseJsonSchema.additionalProperties).toBe(false)
  })
})

describe('갱신·로그아웃 요청', () => {
  it('갱신 토큰이 없는 빈 본문을 받아들인다 (쿠키 방식)', () => {
    expect(refreshRequestSchema.parse({})).toEqual({})
    expect(logoutRequestSchema.parse({})).toEqual({})
  })

  it('빈 문자열 갱신 토큰을 거부한다', () => {
    expect(refreshRequestSchema.safeParse({ refreshToken: '' }).success).toBe(false)
  })

  it('갱신 응답에는 갱신 토큰이 없다', () => {
    expect(Object.keys(refreshResponseSchema.shape).sort()).toEqual(['accessToken', 'expiresIn'])
  })
})

describe('인증 에러 코드', () => {
  it('원인별 코드가 ERROR_CODES에 있다', () => {
    expect(ERROR_CODES).toMatchObject({
      UNAUTHORIZED: 'UNAUTHORIZED',
      ACCESS_TOKEN_EXPIRED: 'ACCESS_TOKEN_EXPIRED',
      INVALID_PROVIDER_TOKEN: 'INVALID_PROVIDER_TOKEN',
      REFRESH_TOKEN_EXPIRED: 'REFRESH_TOKEN_EXPIRED',
      REFRESH_TOKEN_INVALID: 'REFRESH_TOKEN_INVALID',
      EMAIL_NOT_VERIFIED: 'EMAIL_NOT_VERIFIED',
      PROVIDER_NOT_CONFIGURED: 'PROVIDER_NOT_CONFIGURED',
    })
  })
})
