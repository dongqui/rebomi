import type { HealthResponse } from '@rebomi/api-contract'
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
  app.get('/health', async (_request, reply) => {
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
  })
}
