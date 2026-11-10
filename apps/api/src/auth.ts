import { ERROR_CODES } from '@rebomi/api-contract'
import type { FastifyReply, FastifyRequest } from 'fastify'
import { errorBody } from './errors.js'

/** RFC 7235: 인증 스킴은 대소문자를 구분하지 않는다. 토큰은 공백이 아닌 문자여야 한다. */
const BEARER = /^Bearer[ \t]+(\S+)\s*$/i

/**
 * 인증이 붙을 자리. 토큰을 실제로 검증하지는 않고, Bearer 형식이 아닌 요청만 막는다
 * (스펙 1장 "범위 밖"). 아직 적용된 라우트는 없다.
 *
 * 이 껍데기를 미리 두는 이유는, 인증이 붙을 때 라우트마다 흩어지지 않게 하는 것이다.
 */
export async function requireAuth(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const header = request.headers.authorization
  const token = typeof header === 'string' ? BEARER.exec(header)?.[1] : undefined

  if (!token) {
    // preHandler에서 send 하면 라우트 핸들러까지 가지 않는다.
    await reply.status(401).send(errorBody(ERROR_CODES.UNAUTHORIZED, '인증이 필요합니다'))
  }
}
