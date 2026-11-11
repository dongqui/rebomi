import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import type { Db } from '@rebomi/db'
import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify'
import { createRequireAuth, type AuthDeps } from './auth.js'
import { registerErrorHandler } from './errors.js'
import { registerAuthRoutes } from './routes/auth.js'
import { registerHealthRoute } from './routes/health.js'

export type BuildAppDeps = {
  /** 주입받는다 — 테스트가 더블을 끼울 수 있어야 한다. 실제 createDb 호출은 server.ts 만. */
  db: Db
  /** 허용 오리진. 웹과 확장(chrome-extension://)이 같은 API를 쓴다. */
  corsOrigins: string[]
  /** 토큰 서명 키와 제공자 검증기. 환경변수는 server.ts 만 읽는다. */
  auth: AuthDeps
  logger?: FastifyServerOptions['logger']
}

export function buildApp(deps: BuildAppDeps): FastifyInstance {
  const app = Fastify({ logger: deps.logger ?? false })

  app.register(cors, {
    origin: deps.corsOrigins,
    credentials: true,
  })
  app.register(cookie)

  app.decorateRequest('userId', '')
  app.decorate('requireAuth', createRequireAuth(deps.auth))

  registerErrorHandler(app)
  registerHealthRoute(app, deps.db)
  registerAuthRoutes(app, { db: deps.db, auth: deps.auth, allowedOrigins: deps.corsOrigins })

  return app
}
