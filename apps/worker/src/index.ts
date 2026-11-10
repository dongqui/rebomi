// pg-boss 12는 순수 ESM이고 default export가 없다.
import { PgBoss } from 'pg-boss'
import { QUEUES, createNoopHandler, type NoopPayload } from './jobs/noop.js'

export { QUEUES, type NoopPayload } from './jobs/noop.js'

export type JobLogger = (message: string, context?: unknown) => void

export type StartWorkerOptions = {
  connectionString: string
  /** 기본은 `QUEUES.NOOP`. 테스트가 큐를 갈라 서로 간섭하지 않게 한다. */
  queue?: string
  /** 기본은 noop 핸들러. 테스트가 갈아끼운다. */
  handler?: (payload: NoopPayload) => Promise<void>
  /** 1분 주기 스케줄 등록 여부. 기본 true. */
  schedule?: boolean
  log?: JobLogger
}

export type Worker = {
  readonly queue: string
  send(payload: NoopPayload): Promise<string | null>
  stop(): Promise<void>
}

/**
 * pg-boss 컨슈머와 스케줄러를 띄운다.
 *
 * API와 분리한 이유는 생애주기가 다르기 때문이다 — API는 요청 기반, 워커는
 * 상주하며 장시간 작업을 돈다 (스펙 3장).
 */
export async function startWorker(options: StartWorkerOptions): Promise<Worker> {
  const queue = options.queue ?? QUEUES.NOOP
  const log: JobLogger = options.log ?? ((message, context) => console.log(message, context ?? ''))
  const handle = options.handler ?? createNoopHandler(log)

  const boss = new PgBoss(options.connectionString)

  // 반드시 붙인다. error 이벤트에 리스너가 없으면 Node가 프로세스를 죽인다.
  boss.on('error', (error) => {
    log('worker: pg-boss error', error)
  })

  await boss.start()
  await boss.createQueue(queue)

  // 핸들러가 던지면 pg-boss가 그 잡만 실패 처리하고 워커는 계속 돈다.
  await boss.work<NoopPayload>(queue, { pollingIntervalSeconds: 1, batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      await handle(job.data)
    }
  })

  if (options.schedule ?? true) {
    // 데이터를 함께 보낸다. 스케줄된 잡에 data가 없으면 job.data가 undefined로
    // 도착해 핸들러의 payload 타입이 거짓이 된다.
    await boss.schedule(queue, '* * * * *', { n: 0 })
  }

  log('worker: started', { queue })

  return {
    queue,
    // retryLimit 0 — 스캐폴드에서는 실패한 잡을 되돌리지 않는다. 실제 잡은
    // 큐별 정책으로 재시도를 정한다.
    send: (payload) => boss.send(queue, payload, { retryLimit: 0 }),
    stop: () => boss.stop({ graceful: true }),
  }
}
