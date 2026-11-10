import { healthResponseJsonSchema, type HealthResponse } from '@rebomi/api-contract'
import { ping, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { VERSION } from '../version.js'

/**
 * `GET /health` — DB 핑까지 포함한다.
 *
 * DB가 죽으면 200이 아니라 503을 돌려준다. 200으로 "ok"처럼 보이면 모니터링이
 * 장애를 잡지 못한다. 바디는 두 경우 모두 계약(healthResponseSchema)을 만족한다.
 */
export function registerHealthRoute(app: FastifyInstance, db: Db): void {
  app.get(
    '/health',
    {
      // 계약을 직렬화 시점에 강제한다. TS의 초과 속성 검사는 spread 나 as 로
      // 우회되지만, 이 스키마는 계약에 없는 필드를 응답에서 떨어뜨린다.
      schema: {
        response: {
          200: healthResponseJsonSchema,
          503: healthResponseJsonSchema,
        },
      },
    },
    async (_request, reply) => {
      let dbStatus: HealthResponse['db'] = 'ok'

      try {
        await ping(db)
      } catch (error) {
        app.log.error({ err: error }, 'health: db ping failed')
        dbStatus = 'error'
      }

      const body: HealthResponse = {
        status: dbStatus === 'ok' ? 'ok' : 'degraded',
        db: dbStatus,
        version: VERSION,
      }

      return reply.status(dbStatus === 'ok' ? 200 : 503).send(body)
    },
  )
}
