import type { AuthTokens, TokenStore } from '@rebomi/api-client'

type Listener = (tokens: AuthTokens | null) => void

export type ObservableTokenStore = TokenStore & {
  get(): AuthTokens | null
  /** 토큰이 바뀔 때마다 불린다. 돌려준 함수를 부르면 구독이 끊긴다. */
  subscribe(listener: Listener): () => void
}

/**
 * 확장의 토큰 저장소. 액세스 토큰을 메모리에만 둔다 — `chrome.storage` 에 쓰지 않는다.
 * 갱신 토큰은 웹이 받은 httpOnly 쿠키뿐이라 확장은 그것을 읽지도 보관하지도 않는다
 * (account ACC-9). 팝업이 닫히면 토큰도 사라지고, 다시 열 때 `refresh()` 로 받는다.
 *
 * 구독할 수 있는 이유: `api-client` 는 갱신이 거부되면 토큰을 지운다. 화면이 그것을 알아야
 * 사용 중에 세션이 끝났을 때 로그인이 필요한 상태로 돌아갈 수 있다.
 *
 * 웹의 `apps/web/src/auth/token-store.ts` 와 같은 모양이다.
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
