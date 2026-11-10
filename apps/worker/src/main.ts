import { loadEnv } from './env.js'
import { startWorker } from './index.js'

const env = loadEnv()
const worker = await startWorker({ connectionString: env.DATABASE_URL })

async function shutdown(signal: string): Promise<void> {
  console.log(`worker: shutting down (${signal})`)
  await worker.stop()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
