import { ERROR_CODES, type AuthProvider } from '@rebomi/api-contract'
import type { FastifyReply, FastifyRequest, preHandlerAsyncHookHandler } from 'fastify'
import type { IdentityVerifier } from './auth/providers.js'
import { verifyAccessToken } from './auth/tokens.js'
import { errorBody } from './errors.js'

/** 인증에 필요한 설정. `server.ts` 가 환경변수로 조립하고 테스트는 직접 넣는다. */
export type AuthDeps = {
  /** 액세스 토큰 서명 키(HS256). */
  jwtSecret: string
  /** 설정된 제공자만 들어 있다. 없는 제공자의 로그인은 503이다. */
  verifiers: Partial<Record<AuthProvider, IdentityVerifier>>
  /** 갱신 토큰 쿠키에 Secure 를 붙일지. 운영에서 true. */
  secureCookies: boolean
  /** 테스트가 시간을 움직일 수 있게 한다. */
  now?: () => Date
}

declare module 'fastify' {
  interface FastifyRequest {
    /** `requireAuth` 를 지난 요청의 사용자 ID. 그 밖의 요청에서는 빈 문자열이다. */
    userId: string
  }
  interface FastifyInstance {
    /** 액세스 토큰을 검증해 `request.userId` 를 채우는 preHandler. */
    requireAuth: preHandlerAsyncHookHandler
  }
}

/** RFC 7235: 인증 스킴은 대소문자를 구분하지 않는다. 토큰은 공백이 아닌 문자여야 한다. */
const BEARER = /^Bearer[ \t]+(\S+)\s*$/i

/**
 * 보호할 라우트의 preHandler. 사용자 식별이 라우트마다 흩어지지 않게 여기 한 곳에 둔다.
 *
 * 만료(`ACCESS_TOKEN_EXPIRED`)와 그 밖의 실패(`UNAUTHORIZED`)를 구분한다 — 클라이언트는
 * 만료일 때만 갱신을 시도하고, 나머지는 로그인으로 보낸다.
 */
export function createRequireAuth(auth: AuthDeps): preHandlerAsyncHookHandler {
  return async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const header = request.headers.authorization
    const token = typeof header === 'string' ? BEARER.exec(header)?.[1] : undefined

    // preHandler에서 send 하면 라우트 핸들러까지 가지 않는다.
    if (!token) {
      await reply.status(401).send(errorBody(ERROR_CODES.UNAUTHORIZED, '인증이 필요합니다'))
      return
    }

    const result = await verifyAccessToken(auth.jwtSecret, token, auth.now?.() ?? new Date())
    if (result.ok) {
      request.userId = result.userId
      return
    }

    if (result.reason === 'expired') {
      await reply
        .status(401)
        .send(errorBody(ERROR_CODES.ACCESS_TOKEN_EXPIRED, '액세스 토큰이 만료되었습니다'))
      return
    }
    await reply.status(401).send(errorBody(ERROR_CODES.UNAUTHORIZED, '인증이 필요합니다'))
  }
}
