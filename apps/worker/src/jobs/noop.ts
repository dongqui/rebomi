/** 큐 이름은 한 곳에만 둔다 — 보내는 쪽과 받는 쪽이 문자열을 따로 쓰면 조용히 어긋난다. */
export const QUEUES = {
  NOOP: 'noop',
} as const

export type NoopPayload = { n: number }

/**
 * 스캐폴드용 잡. 큐와 스케줄러 경로가 살아 있는지 로그로 보이게 하는 것이 전부다.
 * 실제 잡(요약·임베딩·링크 생존 확인·재노출 선정)이 이 자리에 들어온다.
 */
export function createNoopHandler(log: (message: string, context?: unknown) => void) {
  return (payload: NoopPayload): Promise<void> => {
    log('worker: noop job processed', payload)
    return Promise.resolve()
  }
}
