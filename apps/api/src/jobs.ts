import { QUEUES, type ContentProcessPayload } from '@rebomi/core'
import type { DbTransaction } from '@rebomi/db'
// pg-boss 12는 순수 ESM이고 default export가 없다.
import { PgBoss } from 'pg-boss'

/** API가 워커에게 일을 넘기는 창구. 라우트는 pg-boss를 직접 알지 못한다. */
export type JobQueue = {
  /**
   * 저장된 콘텐츠의 처리 잡을 `tx` 안에 넣는다. 콘텐츠 행과 같은 트랜잭션이므로
   * 행만 남고 잡이 없는 상태(영원히 "처리 중")가 생기지 않는다.
   */
  enqueueContentProcess(tx: DbTransaction, payload: ContentProcessPayload): Promise<void>
}

export type StartedJobQueue = JobQueue & {
  readonly queue: string
  stop(): Promise<void>
  /** 큐까지 지우고 멈춘다. 테스트가 쓴다. */
  destroy(): Promise<void>
}

export type StartJobQueueOptions = {
  connectionString: string
  /** 기본은 `QUEUES.CONTENT_PROCESS`. 테스트가 큐를 갈라 서로 간섭하지 않게 한다. */
  queue?: string
  onError?: (error: unknown) => void
}

/**
 * 보내기 전용 pg-boss를 띄운다. 잡을 꺼내 처리하는 것과 유지보수·스케줄은
 * `apps/worker` 의 몫이라 여기서는 끈다.
 */
export async function startJobQueue(options: StartJobQueueOptions): Promise<StartedJobQueue> {
  const queue = options.queue ?? QUEUES.CONTENT_PROCESS
  const boss = new PgBoss({
    connectionString: options.connectionString,
    supervise: false,
    schedule: false,
  })

  // 반드시 붙인다. error 이벤트에 리스너가 없으면 Node가 프로세스를 죽인다.
  boss.on('error', (error) => options.onError?.(error))

  await boss.start()
  // 워커보다 API가 먼저 뜰 수 있다. 이미 있으면 아무 일도 없다.
  await boss.createQueue(queue)

  return {
    queue,
    enqueueContentProcess: async (tx, payload) => {
      const jobId = await boss.send(queue, payload, { db: tx })
      // null은 "넣지 않았다"는 뜻이다. 조용히 넘기면 처리되지 않는 콘텐츠가 남는다.
      if (jobId === null) throw new Error(`잡을 큐에 넣지 못했습니다: ${queue}`)
    },
    stop: () => boss.stop({ graceful: true }),
    destroy: async () => {
      // 큐를 먼저 지운다 — stop() 이후에는 DB 연결이 닫혀 deleteQueue가 실패한다.
      await boss.deleteQueue(queue)
      await boss.stop({ graceful: true })
    },
  }
}
