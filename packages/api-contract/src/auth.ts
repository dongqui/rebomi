import { z } from 'zod'
import { toResponseJsonSchema } from './json-schema.js'

/** 로그인 수단 (account.md §4). */
export const authProviderSchema = z.enum(['google', 'apple'])
export type AuthProvider = z.infer<typeof authProviderSchema>

/**
 * 갱신 토큰을 받는 방식.
 *
 * - `body`: 응답 본문으로 받는다. 확장과 모바일이 쓴다.
 * - `cookie`: httpOnly 쿠키로만 받는다. 웹이 쓴다 — 스크립트가 갱신 토큰을 읽을 수 없다.
 */
export const sessionModeSchema = z.enum(['body', 'cookie'])
export type SessionMode = z.infer<typeof sessionModeSchema>

/** `POST /auth/login` 요청. `idToken` 은 Google·Apple이 발급한 신원 토큰(JWT)이다. */
export const loginRequestSchema = z.object({
  provider: authProviderSchema,
  idToken: z.string().min(1).max(8192),
  /** 생략하면 `body`. */
  session: sessionModeSchema.optional(),
})
export type LoginRequest = z.infer<typeof loginRequestSchema>

/** 로그인한 사용자. */
export const authUserSchema = z.object({
  id: z.uuid(),
  email: z.string(),
})
export type AuthUser = z.infer<typeof authUserSchema>

/** `POST /auth/login` 응답. */
export const loginResponseSchema = z.object({
  accessToken: z.string(),
  /** 액세스 토큰이 만료되기까지 남은 초. */
  expiresIn: z.number().int().positive(),
  /** `session: 'cookie'` 로 로그인하면 null이다 — 갱신 토큰은 쿠키에만 있다. */
  refreshToken: z.string().nullable(),
  user: authUserSchema,
})
export type LoginResponse = z.infer<typeof loginResponseSchema>

/**
 * `POST /auth/refresh` 요청. `refreshToken` 이 없으면 서버는 쿠키의 갱신 토큰을 쓴다.
 */
export const refreshRequestSchema = z.object({
  refreshToken: z.string().min(1).max(512).optional(),
})
export type RefreshRequest = z.infer<typeof refreshRequestSchema>

/** `POST /auth/refresh` 응답. 갱신 토큰은 바뀌지 않는다(회전 없음). */
export const refreshResponseSchema = z.object({
  accessToken: z.string(),
  expiresIn: z.number().int().positive(),
})
export type RefreshResponse = z.infer<typeof refreshResponseSchema>

/** `POST /auth/logout` 요청. 응답은 본문 없는 204다. */
export const logoutRequestSchema = refreshRequestSchema
export type LogoutRequest = z.infer<typeof logoutRequestSchema>

export const loginResponseJsonSchema = toResponseJsonSchema(loginResponseSchema)
export const refreshResponseJsonSchema = toResponseJsonSchema(refreshResponseSchema)
