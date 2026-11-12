import { ERROR_CODES, type ApiErrorBody } from '@rebomi/api-contract'
import type { FastifyError, FastifyInstance } from 'fastify'
import { ZodError } from 'zod'

/** 모든 에러 응답은 이 함수를 거친다. 포맷이 한 곳에만 있어야 네 클라이언트가 같은 것을 본다. */
export function errorBody(code: string, message: string, details?: unknown): ApiErrorBody {
  return { error: { code, message, ...(details === undefined ? {} : { details }) } }
}

/** 상태 코드별 공개 메시지. 내부 사정은 어떤 경로로도 응답에 넣지 않는다. */
const CLIENT_ERRORS: Record<number, { code: string; message: string }> = {
  400: { code: ERROR_CODES.VALIDATION_FAILED, message: '요청이 올바르지 않습니다' },
  401: { code: ERROR_CODES.UNAUTHORIZED, message: '인증이 필요합니다' },
  403: { code: ERROR_CODES.BAD_REQUEST, message: '권한이 없습니다' },
  404: { code: ERROR_CODES.NOT_FOUND, message: '요청한 경로가 없습니다' },
  415: { code: ERROR_CODES.BAD_REQUEST, message: '지원하지 않는 Content-Type 입니다' },
}

const FALLBACK_CLIENT_ERROR = {
  code: ERROR_CODES.BAD_REQUEST,
  message: '요청을 처리할 수 없습니다',
}

/**
 * 모든 에러 응답을 공통 포맷으로 바꾼다.
 *
 * Fastify가 스스로 만드는 4xx(깨진 JSON, 지원하지 않는 Content-Type, 스키마
 * 검증 실패)도 여기를 지난다. 그것들을 500으로 뭉개면 클라이언트 잘못이 서버
 * 장애로 보고돼 재시도 로직이 틀린 판단을 하고, 전부 알람이 된다.
 *
 * 스택과 원본 메시지는 로거로만 보낸다.
 */
export function registerErrorHandler(app: FastifyInstance): void {
  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      request.log.warn({ issues: error.issues }, 'validation failed')
      return reply
        .status(400)
        .send(errorBody(ERROR_CODES.VALIDATION_FAILED, '요청이 올바르지 않습니다', error.issues))
    }

    // Fastify의 라우트 스키마 검증 실패.
    if (error.validation) {
      request.log.warn({ validation: error.validation }, 'request validation failed')
      return reply
        .status(error.statusCode ?? 400)
        .send(errorBody(ERROR_CODES.VALIDATION_FAILED, '요청이 올바르지 않습니다'))
    }

    const status = typeof error.statusCode === 'number' ? error.statusCode : 500

    if (status >= 400 && status < 500) {
      request.log.warn({ err: error }, 'client error')
      const mapped = CLIENT_ERRORS[status] ?? FALLBACK_CLIENT_ERROR
      return reply.status(status).send(errorBody(mapped.code, mapped.message))
    }

    request.log.error({ err: error }, 'unhandled error')
    return reply.status(500).send(errorBody(ERROR_CODES.INTERNAL, '서버 오류가 발생했습니다'))
  })

  // 기본 404는 공통 포맷을 우회한다. 클라이언트가 "경로가 없다"와 "프록시가
  // HTML을 돌려줬다"를 구분할 수 있어야 한다.
  app.setNotFoundHandler((request, reply) => {
    request.log.warn({ url: request.url }, 'route not found')
    return reply
      .status(404)
      .send(errorBody(ERROR_CODES.NOT_FOUND, '요청한 경로가 없습니다'))
  })
}
