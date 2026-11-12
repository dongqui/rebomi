import { createDb } from '@rebomi/db'
import { buildApp } from './app.js'
import type { AuthDeps } from './auth.js'
import { appleVerifier, googleVerifier } from './auth/providers.js'
import { loadEnv } from './env.js'
import { startJobQueue } from './jobs.js'

const env = loadEnv()
const db = createDb(env.DATABASE_URL)
// 큐가 준비되지 않으면 저장을 받을 수 없다. 뜨지 못하면 기동하지 않는다.
const jobs = await startJobQueue({
  connectionString: env.DATABASE_URL,
  onError: (error) => console.error('api: pg-boss error', error),
})

// 클라이언트 ID가 없는 제공자는 검증기를 만들지 않는다 — 그 로그인은 503이 된다.
const verifiers: AuthDeps['verifiers'] = {}
if (env.GOOGLE_CLIENT_IDS.length > 0) verifiers.google = googleVerifier(env.GOOGLE_CLIENT_IDS)
if (env.APPLE_CLIENT_IDS.length > 0) verifiers.apple = appleVerifier(env.APPLE_CLIENT_IDS)

const app = buildApp({
  db,
  corsOrigins: env.CORS_ORIGINS,
  auth: {
    jwtSecret: env.AUTH_JWT_SECRET,
    verifiers,
    secureCookies: env.NODE_ENV === 'production',
  },
  jobs,
  logger: true,
})

if (!verifiers.google) app.log.warn('GOOGLE_CLIENT_IDS가 비어 있어 Google 로그인을 쓸 수 없습니다')
if (!verifiers.apple) app.log.warn('APPLE_CLIENT_IDS가 비어 있어 Apple 로그인을 쓸 수 없습니다')

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await jobs.stop()
  await db.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

await app.listen({ port: env.PORT, host: '0.0.0.0' })
