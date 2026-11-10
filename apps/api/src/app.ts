import cors from '@fastify/cors'
import type { Db } from '@rebomi/db'
import Fastify, { type FastifyInstance } from 'fastify'
import { registerErrorHandler } from './errors.js'
import { registerHealthRoute } from './routes/health.js'

export type BuildAppDeps = {
  /** 주입받는다 — 테스트가 더블을 끼울 수 있어야 한다. 실제 createDb 호출은 server.ts 만. */
  db: Db
  /** 허용 오리진. 웹과 확장(chrome-extension://)이 같은 API를 쓴다. */
  corsOrigins: string[]
  logger?: boolean
}

export function buildApp(deps: BuildAppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false })

  app.register(cors, {
    origin: deps.corsOrigins,
    credentials: true,
  })

  registerErrorHandler(app)
  registerHealthRoute(app, deps.db)

  return app
}
