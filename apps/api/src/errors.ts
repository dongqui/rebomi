import { ERROR_CODES, type ApiErrorBody } from '@rebomi/api-contract'
import type { FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

/** 모든 에러 응답은 이 함수를 거친다. 포맷이 한 곳에만 있어야 네 클라이언트가 같은 것을 본다. */
export function errorBody(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } }
}

/**
 * 처리되지 않은 예외를 공통 포맷으로 바꾼다.
 *
 * 스택은 로거로만 보낸다 — 응답에 넣으면 내부 구조가 밖으로 나간다.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error, request, reply) => {
    if (error instanceof ZodError) {
      request.log.warn({ issues: error.issues }, 'request validation failed')
      return reply
        .status(400)
        .send(errorBody(ERROR_CODES.VALIDATION_FAILED, '요청이 올바르지 않습니다', error.issues))
    }

    request.log.error({ err: error }, 'unhandled error')
    return reply.status(500).send(errorBody(ERROR_CODES.INTERNAL, '서버 오류가 발생했습니다'))
  })
}
