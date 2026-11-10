import { randomUUID } from 'node:crypto'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { startWorker, type Worker } from '../index.js'
import type { NoopPayload } from './noop.js'

const connectionString = process.env.DATABASE_URL

beforeAll(() => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
})

let worker: Worker | undefined

afterEach(async () => {
  await worker?.destroy()
  worker = undefined
})

/** 테스트마다 다른 큐를 쓴다 — 같은 큐를 공유하면 남은 잡이 다음 테스트로 번진다. */
const uniqueQueue = () => `noop-test-${randomUUID()}`

async function waitFor(predicate: () => boolean, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate()) return
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('조건이 시간 안에 만족되지 않았습니다')
}

describe('noop 잡', () => {
  it('큐에 넣은 잡을 핸들러가 payload 그대로 처리한다', async () => {
    const seen: NoopPayload[] = []

    worker = await startWorker({
      connectionString: connectionString!,
      queue: uniqueQueue(),
      schedule: false,
      log: () => {},
      handler: (payload) => {
        seen.push(payload)
        return Promise.resolve()
      },
    })

    await worker.send({ n: 1 })
    await waitFor(() => seen.length >= 1)

    expect(seen).toEqual([{ n: 1 }])
  })

  // Review Focus 5
  it('핸들러가 던져도 워커가 살아 있어 다음 잡을 계속 처리한다', async () => {
    const seen: number[] = []

    worker = await startWorker({
      connectionString: connectionString!,
      queue: uniqueQueue(),
      schedule: false,
      log: () => {},
      handler: (payload) => {
        seen.push(payload.n)
        // n=1 은 언제나 실패한다. 실패가 큐 전체를 멈추지 않아야 한다.
        return payload.n === 1 ? Promise.reject(new Error('의도적 실패')) : Promise.resolve()
      },
    })

    await worker.send({ n: 1 })
    await waitFor(() => seen.includes(1))

    await worker.send({ n: 2 })
    await waitFor(() => seen.includes(2))

    await worker.send({ n: 3 })
    await waitFor(() => seen.includes(3))

    // 횟수가 아니라 어떤 잡이 처리됐는지를 단정한다 — 1번을 세 번 재시도하는
    // 상태에서도 통과하던 동어반복을 막는다.
    expect(seen).toContain(2)
    expect(seen).toContain(3)
  })

  it('잡이 실패하면 로그를 남긴다', async () => {
    // pg-boss의 error 이벤트는 내부 오류만 받는다. 잡 실패를 따로 적지 않으면
    // 1분마다 도는 스케줄러가 조용히 전부 실패해도 운영에서 보이지 않는다.
    const messages: string[] = []

    worker = await startWorker({
      connectionString: connectionString!,
      queue: uniqueQueue(),
      schedule: false,
      log: (message) => messages.push(message),
      handler: () => Promise.reject(new Error('의도적 실패')),
    })

    await worker.send({ n: 1 })
    await waitFor(() => messages.some((message) => message.includes('job failed')))

    expect(messages.some((message) => message.includes('job failed'))).toBe(true)
  })
})
