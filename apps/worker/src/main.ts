import { createDb } from '@rebomi/db'
import { loadEnv } from './env.js'
import { fetchPage } from './fetch-page.js'
import { startWorker } from './index.js'
import { createContentProcessHandler } from './jobs/content-process.js'

const env = loadEnv()
const db = createDb(env.DATABASE_URL)
const log = (message: string, context?: unknown) => console.log(message, context ?? '')

const worker = await startWorker({
  connectionString: env.DATABASE_URL,
  log,
  contentProcess: {
    // 주소 차단을 푸는 옵션은 넘기지 않는다 — 내부망으로는 나가지 않는다.
    handler: createContentProcessHandler({ db, fetchPage: (url) => fetchPage(url), log }),
  },
})

async function shutdown(signal: string): Promise<void> {
  console.log(`worker: shutting down (${signal})`)
  await worker.stop()
  await db.close()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
