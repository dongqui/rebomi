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
  await worker?.stop()
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
    let calls = 0

    worker = await startWorker({
      connectionString: connectionString!,
      queue: uniqueQueue(),
      schedule: false,
      log: () => {},
      handler: () => {
        calls += 1
        // 첫 잡만 실패시킨다. 실패가 큐 전체를 멈추지 않아야 한다.
        return calls === 1 ? Promise.reject(new Error('의도적 실패')) : Promise.resolve()
      },
    })

    await worker.send({ n: 1 })
    await waitFor(() => calls >= 1)

    await worker.send({ n: 2 })
    await waitFor(() => calls >= 2)

    await worker.send({ n: 3 })
    await waitFor(() => calls >= 3)

    expect(calls).toBeGreaterThanOrEqual(3)
  })
})
