import type { AuthTokens, TokenStore } from '@rebomi/api-client'

type Listener = (tokens: AuthTokens | null) => void

export type ObservableTokenStore = TokenStore & {
  get(): AuthTokens | null
  /** 토큰이 바뀔 때마다 불린다. 돌려준 함수를 부르면 구독이 끊긴다. */
  subscribe(listener: Listener): () => void
}

/**
 * 웹의 토큰 저장소. 액세스 토큰을 메모리에만 둔다 — 갱신 토큰은 httpOnly 쿠키에 있어
 * 새로고침 뒤에는 `refresh()` 로 다시 받는다.
 *
 * 구독할 수 있는 이유: `api-client` 는 갱신이 거부되면 토큰을 지운다. 화면이 그것을 알아야
 * 사용 중에 세션이 끝났을 때 로그인 화면으로 보낼 수 있다.
 */
export function createTokenStore(): ObservableTokenStore {
  let tokens: AuthTokens | null = null
  const listeners = new Set<Listener>()

  return {
    get: () => tokens,
    set: (next) => {
      tokens = next
      for (const listener of listeners) listener(next)
    },
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
