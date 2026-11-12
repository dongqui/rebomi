import { CONTENT_PROCESS_RETRY, QUEUES, type ContentProcessPayload } from '@rebomi/core'
// pg-boss 12는 순수 ESM이고 default export가 없다.
import { PgBoss, type JobWithMetadata } from 'pg-boss'
import type { ContentProcessHandler } from './jobs/content-process.js'
import { createNoopHandler, type NoopPayload } from './jobs/noop.js'

export { QUEUES, type NoopPayload } from './jobs/noop.js'
export {
  createContentProcessHandler,
  type Attempt,
  type ContentProcessDeps,
  type ContentProcessHandler,
} from './jobs/content-process.js'
export { fetchPage, FetchPageError, type FetchedPage } from './fetch-page.js'

export type JobLogger = (message: string, context?: unknown) => void

/** 재시도 정책. 기본은 `CONTENT_PROCESS_RETRY`. */
export type RetryOptions = {
  retryLimit?: number
  retryDelay?: number
  retryBackoff?: boolean
}

export type StartWorkerOptions = {
  connectionString: string
  /** 기본은 `QUEUES.NOOP`. 테스트가 큐를 갈라 서로 간섭하지 않게 한다. */
  queue?: string
  /** 기본은 noop 핸들러. 테스트가 갈아끼운다. */
  handler?: (payload: NoopPayload) => Promise<void>
  /** 1분 주기 스케줄 등록 여부. 기본 true. */
  schedule?: boolean
  /**
   * 콘텐츠 처리 큐의 컨슈머. 넘기지 않으면 그 큐를 소비하지 않는다 — DB 없이 큐
   * 경로만 보는 테스트를 위한 것이고, 운영(`main.ts`)은 항상 넘긴다.
   */
  contentProcess?: {
    handler: ContentProcessHandler
    /** 기본은 `QUEUES.CONTENT_PROCESS`. */
    queue?: string
  }
  log?: JobLogger
}

export type Worker = {
  readonly queue: string
  /** 콘텐츠 처리 큐 이름. 소비하지 않으면 null. */
  readonly contentProcessQueue: string | null
  send(payload: NoopPayload): Promise<string | null>
  /**
   * 콘텐츠 처리 잡을 넣는다. 운영에서는 api가 저장과 같은 트랜잭션으로 넣는다 —
   * 이것은 테스트와 수동 재처리를 위한 것이다.
   */
  sendContentProcess(payload: ContentProcessPayload, retry?: RetryOptions): Promise<string | null>
  stop(): Promise<void>
  /** 큐까지 지우고 멈춘다. 테스트가 쓴다 — 큐를 남기면 pg-boss 유지보수가 계속 훑는다. */
  destroy(): Promise<void>
}

/**
 * pg-boss 컨슈머와 스케줄러를 띄운다.
 *
 * API와 분리한 이유는 생애주기가 다르기 때문이다 — API는 요청 기반, 워커는
 * 상주하며 장시간 작업을 돈다 (스펙 3장).
 */
export async function startWorker(options: StartWorkerOptions): Promise<Worker> {
  const queue = options.queue ?? QUEUES.NOOP
  const contentProcessQueue = options.contentProcess
    ? (options.contentProcess.queue ?? QUEUES.CONTENT_PROCESS)
    : null
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
  // 다만 pg-boss의 error 이벤트는 내부 오류만 받으므로, 잡 실패는 여기서 직접
  // 적는다 — 적지 않으면 1분마다 도는 스케줄러가 조용히 전부 실패해도 보이지 않는다.
  await boss.work<NoopPayload>(queue, { pollingIntervalSeconds: 1, batchSize: 1 }, async (jobs) => {
    for (const job of jobs) {
      try {
        await handle(job.data)
      } catch (error) {
        log('worker: job failed', { queue, jobId: job.id, error })
        throw error
      }
    }
  })

  if (options.contentProcess && contentProcessQueue) {
    const handleContent = options.contentProcess.handler

    // api가 먼저 만들었을 수 있다. 이미 있으면 아무 일도 없다.
    await boss.createQueue(contentProcessQueue)
    await boss.work(
      contentProcessQueue,
      // 재시도 횟수를 알아야 마지막 시도에서 실패를 기록할 수 있다.
      { pollingIntervalSeconds: 1, batchSize: 1, includeMetadata: true },
      async (jobs: JobWithMetadata<ContentProcessPayload>[]) => {
        for (const job of jobs) {
          try {
            await handleContent(job.data, {
              retryCount: job.retryCount,
              isLast: job.retryCount >= job.retryLimit,
            })
          } catch (error) {
            log('worker: job failed', {
              queue: contentProcessQueue,
              jobId: job.id,
              // 오류 객체를 통째로 적지 않는다 — 가져오던 주소가 딸려 나올 수 있다.
              error: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
            })
            throw error
          }
        }
      },
    )
  }

  if (options.schedule ?? true) {
    // 데이터를 함께 보낸다. 스케줄된 잡에 data가 없으면 job.data가 undefined로
    // 도착해 핸들러의 payload 타입이 거짓이 된다.
    await boss.schedule(queue, '* * * * *', { n: 0 })
  }

  log('worker: started', { queue, contentProcessQueue })

  return {
    queue,
    contentProcessQueue,
    // 재시도는 pg-boss의 큐 정책에 맡긴다 (스펙 6장). 소진된 실패는 위
    // work 핸들러의 로그에 남는다.
    send: (payload) => boss.send(queue, payload),
    sendContentProcess: (payload, retry) => {
      if (!contentProcessQueue) throw new Error('콘텐츠 처리 큐를 소비하지 않는 워커입니다')
      return boss.send(contentProcessQueue, payload, { ...CONTENT_PROCESS_RETRY, ...retry })
    },
    stop: () => boss.stop({ graceful: true }),
    destroy: async () => {
      // 큐를 먼저 지운다 — stop() 이후에는 DB 연결이 닫혀 deleteQueue가 실패한다.
      await boss.deleteQueue(queue)
      if (contentProcessQueue) await boss.deleteQueue(contentProcessQueue)
      await boss.stop({ graceful: true })
    },
  }
}
