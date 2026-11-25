import type { AuthTokens, TokenStore } from '@rebomi/api-client'

type Listener = (tokens: AuthTokens | null) => void

/**
 * 갱신 토큰 하나를 두는 곳. 기기에서는 `SecureStore`(./secure-storage.ts)이고 테스트에서는 가짜다.
 */
export type RefreshTokenStorage = {
  read(): Promise<string | null>
  write(refreshToken: string): Promise<void>
  remove(): Promise<void>
}

export type ObservableTokenStore = TokenStore & {
  /** 토큰이 바뀔 때마다 불린다. 돌려준 함수를 부르면 구독이 끊긴다. */
  subscribe(listener: Listener): () => void
}

/**
 * 모바일의 토큰 저장소 (architecture §3).
 *
 * - 갱신 토큰은 보안 저장소에만 둔다. 다른 곳에 쓰지 않고 로그에도 남기지 않는다.
 * - 액세스 토큰은 메모리에만 둔다. 앱을 다시 열면 갱신 토큰으로 새로 받는다 — 그 전까지
 *   `get()` 은 빈 액세스 토큰을 돌려준다. 세션이 복구되기 전에는 인증 요청을 보내지 않는다.
 *
 * 구독할 수 있는 이유: `api-client` 는 갱신이 거부되면 토큰을 지운다. 화면이 그것을 알아야
 * 사용 중에 세션이 끝났을 때 로그인 화면으로 보낼 수 있다.
 */
export function createTokenStore(storage: RefreshTokenStorage): ObservableTokenStore {
  let accessToken: string | null = null
  /** 보안 저장소에서 읽어 온 값. 아직 읽지 않았으면 undefined. */
  let refreshToken: string | null | undefined
  const listeners = new Set<Listener>()

  return {
    async get() {
      if (refreshToken === undefined) refreshToken = await storage.read()
      if (refreshToken === null) return null
      return { accessToken: accessToken ?? '', refreshToken }
    },

    async set(next) {
      const nextRefresh = next?.refreshToken ?? null

      if (next === null || nextRefresh === null) {
        // 메모리부터 지운다. 저장소가 실패해도 이 실행에서는 로그아웃된 상태다.
        accessToken = null
        refreshToken = null
        try {
          await storage.remove()
        } finally {
          for (const listener of listeners) listener(null)
        }
        return
      }

      // 갱신 때는 갱신 토큰이 그대로다(회전 없음). 바뀌었을 때만 저장소에 쓴다.
      if (nextRefresh !== refreshToken) await storage.write(nextRefresh)
      refreshToken = nextRefresh
      accessToken = next.accessToken
      for (const listener of listeners) listener(next)
    },

    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }
}
