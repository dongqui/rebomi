import {
  ERROR_CODES,
  loginRequestSchema,
  loginResponseJsonSchema,
  logoutRequestSchema,
  refreshRequestSchema,
  refreshResponseJsonSchema,
  type LoginResponse,
  type RefreshResponse,
} from '@rebomi/api-contract'
import type { Db } from '@rebomi/db'
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import type { AuthDeps } from '../auth.js'
import {
  findOrCreateUser,
  revokeRefreshToken,
  storeRefreshToken,
  useRefreshToken,
} from '../auth/accounts.js'
import { InvalidProviderTokenError } from '../auth/providers.js'
import {
  ACCESS_TOKEN_TTL_SECONDS,
  REFRESH_TOKEN_TTL_SECONDS,
  hashRefreshToken,
  newRefreshToken,
  signAccessToken,
} from '../auth/tokens.js'
import { errorBody } from '../errors.js'

/** 웹의 갱신 토큰 쿠키. 스크립트가 읽을 수 없고(`HttpOnly`) `/auth` 경로에만 실린다. */
const REFRESH_COOKIE = 'rebomi_refresh'
const COOKIE_PATH = '/auth'

/**
 * 성공 응답만 계약의 JSON 스키마로 직렬화한다. 에러 응답은 `errorBody` 한 모양이다.
 * 상태 코드를 넓은 타입으로 두지 않으면 Fastify가 `reply.status(401)` 을 막는다.
 */
const successSchema = (jsonSchema: Record<string, unknown>): Record<number, unknown> => ({
  200: jsonSchema,
})

export type AuthRouteDeps = {
  db: Db
  auth: AuthDeps
  /** 쿠키로 온 요청을 받아 줄 오리진. CORS 허용 목록과 같다. */
  allowedOrigins: string[]
}

/** 요청에서 찾은 갱신 토큰과 그것이 온 경로. */
type PresentedToken =
  { from: 'body' | 'cookie'; token: string } | { from: 'none' } | { from: 'forbidden' }

export function registerAuthRoutes(app: FastifyInstance, deps: AuthRouteDeps): void {
  const { db, auth } = deps
  const now = (): Date => auth.now?.() ?? new Date()

  const cookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    path: COOKIE_PATH,
    secure: auth.secureCookies,
  } as const

  const setRefreshCookie = (reply: FastifyReply, token: string): void => {
    void reply.setCookie(REFRESH_COOKIE, token, {
      ...cookieOptions,
      maxAge: REFRESH_TOKEN_TTL_SECONDS,
    })
  }

  const clearRefreshCookie = (reply: FastifyReply): void => {
    void reply.setCookie(REFRESH_COOKIE, '', { ...cookieOptions, maxAge: 0 })
  }

  /**
   * 본문의 갱신 토큰이 먼저고, 없으면 쿠키를 본다.
   *
   * 쿠키는 브라우저가 알아서 붙이므로 다른 사이트가 사용자 몰래 이 요청을 보낼 수
   * 있다. 그래서 쿠키를 쓰는 요청은 허용한 오리진에서 온 것만 받는다.
   */
  function presentedToken(request: FastifyRequest, bodyToken: string | undefined): PresentedToken {
    if (bodyToken) return { from: 'body', token: bodyToken }

    const cookie = request.cookies[REFRESH_COOKIE]
    if (!cookie) return { from: 'none' }

    const origin = request.headers.origin
    if (typeof origin !== 'string' || !deps.allowedOrigins.includes(origin)) {
      return { from: 'forbidden' }
    }
    return { from: 'cookie', token: cookie }
  }

  const forbiddenOrigin = (request: FastifyRequest, reply: FastifyReply) => {
    request.log.warn('auth: cookie request from disallowed origin')
    return reply.status(403).send(errorBody(ERROR_CODES.BAD_REQUEST, '권한이 없습니다'))
  }

  app.post(
    '/auth/login',
    { schema: { response: successSchema(loginResponseJsonSchema) } },
    async (request, reply) => {
      const body = loginRequestSchema.parse(request.body)

      const verify = auth.verifiers[body.provider]
      if (!verify) {
        request.log.error({ provider: body.provider }, 'auth: provider not configured')
        return reply
          .status(503)
          .send(
            errorBody(ERROR_CODES.PROVIDER_NOT_CONFIGURED, '이 로그인 수단은 아직 쓸 수 없습니다'),
          )
      }

      let identity
      try {
        identity = await verify(body.idToken)
      } catch (error) {
        if (!(error instanceof InvalidProviderTokenError)) throw error
        // 사유 코드만 남긴다. 토큰과 그 내용은 로그에 쓰지 않는다.
        request.log.warn(
          { provider: body.provider, reason: error.reason },
          'auth: provider token rejected',
        )
        return reply
          .status(401)
          .send(errorBody(ERROR_CODES.INVALID_PROVIDER_TOKEN, '로그인 정보를 확인할 수 없습니다'))
      }

      const user = await findOrCreateUser(db, body.provider, identity)
      if (user === 'email_not_verified') {
        request.log.warn({ provider: body.provider }, 'auth: identity without verified email')
        return reply
          .status(403)
          .send(
            errorBody(
              ERROR_CODES.EMAIL_NOT_VERIFIED,
              '이메일이 확인된 계정으로만 로그인할 수 있습니다',
            ),
          )
      }

      const issuedAt = now()
      const refresh = newRefreshToken()
      await storeRefreshToken(db, user.id, refresh.hash, issuedAt)

      const useCookie = body.session === 'cookie'
      if (useCookie) setRefreshCookie(reply, refresh.token)

      const response: LoginResponse = {
        accessToken: await signAccessToken(auth.jwtSecret, user.id, issuedAt),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
        refreshToken: useCookie ? null : refresh.token,
        user,
      }
      return reply.status(200).send(response)
    },
  )

  app.post(
    '/auth/refresh',
    { schema: { response: successSchema(refreshResponseJsonSchema) } },
    async (request, reply) => {
      const body = refreshRequestSchema.parse(request.body ?? {})
      const presented = presentedToken(request, body.refreshToken)

      if (presented.from === 'forbidden') return forbiddenOrigin(request, reply)
      if (presented.from === 'none') {
        return reply
          .status(401)
          .send(errorBody(ERROR_CODES.REFRESH_TOKEN_INVALID, '다시 로그인해 주세요'))
      }

      const usedAt = now()
      const result = await useRefreshToken(db, hashRefreshToken(presented.token), usedAt)

      if (result === 'expired' || result === 'invalid') {
        // 쓸 수 없는 쿠키를 브라우저에 남겨 두지 않는다.
        if (presented.from === 'cookie') clearRefreshCookie(reply)
        request.log.warn({ result }, 'auth: refresh token rejected')
        const code =
          result === 'expired'
            ? ERROR_CODES.REFRESH_TOKEN_EXPIRED
            : ERROR_CODES.REFRESH_TOKEN_INVALID
        return reply.status(401).send(errorBody(code, '다시 로그인해 주세요'))
      }

      // 서버의 만료가 60일 뒤로 밀렸으니 쿠키의 수명도 같이 민다.
      if (presented.from === 'cookie') setRefreshCookie(reply, presented.token)

      const response: RefreshResponse = {
        accessToken: await signAccessToken(auth.jwtSecret, result.userId, usedAt),
        expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      }
      return reply.status(200).send(response)
    },
  )

  // 멱등이다. 모르는 토큰이거나 토큰이 없어도 204 — 클라이언트는 어차피 로그아웃 상태가 된다.
  app.post('/auth/logout', async (request, reply) => {
    const body = logoutRequestSchema.parse(request.body ?? {})
    const presented = presentedToken(request, body.refreshToken)

    if (presented.from === 'forbidden') return forbiddenOrigin(request, reply)
    if (presented.from !== 'none') {
      await revokeRefreshToken(db, hashRefreshToken(presented.token), now())
    }
    if (request.cookies[REFRESH_COOKIE]) clearRefreshCookie(reply)

    return reply.status(204).send()
  })
}
