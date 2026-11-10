import { createDb } from '@rebomi/db'
import { buildApp } from './app.js'
import { loadEnv } from './env.js'

const env = loadEnv()
const db = createDb(env.DATABASE_URL)
const app = buildApp({ db, corsOrigins: env.CORS_ORIGINS, logger: true })

async function shutdown(signal: string): Promise<void> {
  app.log.info({ signal }, 'shutting down')
  await app.close()
  await db.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))

await app.listen({ port: env.PORT, host: '0.0.0.0' })
