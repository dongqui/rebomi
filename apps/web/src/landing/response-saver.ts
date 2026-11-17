/**
 * 설문 응답 저장을 한 번에 하나씩만 보낸다.
 *
 * 요청마다 "지금까지의 답 전체"를 싣기 때문에 순서가 뒤바뀌어 도착하면 옛 답이 새 답을
 * 덮는다. 그래서 보내는 중에 온 것은 기다렸다가, 앞 요청이 끝나면(성공이든 실패든) 가장
 * 최신 것 하나만 보낸다. 사이에 낀 것은 최신 것이 그 내용을 포함하므로 보내지 않는다.
 */
export function createResponseSaver<Body>(send: (body: Body) => Promise<void>): {
  /** 돌려준 약속은 이 내용을 실어 보낸 요청(이것 또는 더 최신 것)의 결과를 따른다. */
  save(body: Body): Promise<void>
} {
  type Waiter = { resolve: () => void; reject: (error: unknown) => void }

  let sending = false
  let next: { body: Body; waiters: Waiter[] } | null = null

  function start(body: Body, waiters: Waiter[]): void {
    sending = true
    // 기다리던 것을 먼저 내보낸 뒤에 결과를 알린다 — 결과를 받은 쪽이 곧바로 다시 저장해도
    // "보내는 중"으로 잘못 보지 않는다.
    const finish = (settle: (waiter: Waiter) => void): void => {
      sending = false
      if (next !== null) {
        const queued = next
        next = null
        start(queued.body, queued.waiters)
      }
      waiters.forEach(settle)
    }
    send(body).then(
      () => finish((waiter) => waiter.resolve()),
      (error: unknown) => finish((waiter) => waiter.reject(error)),
    )
  }

  return {
    save(body) {
      return new Promise<void>((resolve, reject) => {
        const waiter = { resolve, reject }
        if (!sending) {
          start(body, [waiter])
        } else {
          next = { body, waiters: [...(next?.waiters ?? []), waiter] }
        }
      })
    },
  }
}
