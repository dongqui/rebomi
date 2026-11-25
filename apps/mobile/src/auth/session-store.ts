import { ApiError, type ApiClient } from '@rebomi/api-client'
import { ERROR_CODES, type AuthProvider } from '@rebomi/api-contract'
import type { ObservableTokenStore } from './token-store'

/**
 * - `checking`: 시작 직후, 저장된 갱신 토큰으로 세션을 복구하는 중
 * - `signed-in` / `signed-out`
 * - `unreachable`: 서버에 닿지 못해 로그인 여부를 모른다. 로그아웃과 구분한다 —
 *   일시적인 연결 문제로 로그인 화면에 보내지 않기 위해서다.
 */
export type SessionStatus = 'checking' | 'signed-in' | 'signed-out' | 'unreachable'

export type SessionStore = {
  getStatus(): SessionStatus
  subscribe(listener: () => void): () => void
  /** 세션 복구를 시작한다. 앱이 뜰 때 한 번 부른다. */
  start(): void
  /** `unreachable` 에서 세션 복구를 다시 시도한다. */
  retry(): void
  /** 제공자의 신원 토큰으로 로그인한다. 실패하면 `ApiError` 를 던진다. */
  signIn(provider: AuthProvider, idToken: string): Promise<void>
  signOut(): Promise<void>
}

type Options = {
  client: Pick<ApiClient, 'login' | 'refresh' | 'logout'>
  tokens: Pick<ObservableTokenStore, 'subscribe'>
}

/** 서버가(또는 `api-client` 가 서버에 묻기 전에) 갱신을 거부했다 — 다시 로그인해야 한다. */
function isRejected(error: unknown): boolean {
  if (!(error instanceof ApiError)) return false
  return (
    error.status === 401 ||
    error.status === 403 ||
    // 저장된 갱신 토큰이 없으면 `api-client` 가 요청 없이 이 코드로 던진다(status는 null).
    error.code === ERROR_CODES.REFRESH_TOKEN_INVALID ||
    error.code === ERROR_CODES.REFRESH_TOKEN_EXPIRED
  )
}

/**
 * 로그인 상태를 쥔 곳. React를 모른다 — 화면은 `./session.tsx` 로 구독한다.
 * 웹의 `SessionProvider`(apps/web/src/auth/session.tsx)와 같은 규칙이다.
 */
export function createSessionStore({ client, tokens }: Options): SessionStore {
  let status: SessionStatus = 'checking'
  /** 진행 중인 복구. 늦게 끝난 이전 시도가 상태를 덮지 않게 한다. */
  let attempt = 0
  const listeners = new Set<() => void>()

  function setStatus(next: SessionStatus) {
    if (next === status) return
    status = next
    for (const listener of listeners) listener()
  }

  function restore() {
    const current = ++attempt
    setStatus('checking')
    client.refresh().then(
      () => {
        if (current === attempt) setStatus('signed-in')
      },
      (error: unknown) => {
        if (current === attempt) setStatus(isRejected(error) ? 'signed-out' : 'unreachable')
      },
    )
  }

  // 사용 중에 갱신이 거부되면 api-client가 토큰을 지운다. 그때 로그아웃 상태로 바꾼다.
  tokens.subscribe((next) => {
    if (next === null && status === 'signed-in') setStatus('signed-out')
  })

  return {
    getStatus: () => status,
    subscribe(listener) {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
    start: restore,
    retry: restore,
    async signIn(provider, idToken) {
      await client.login(provider, idToken)
      // 로그인하는 사이에 끝난 복구가 이 상태를 덮지 않게 한다.
      attempt++
      setStatus('signed-in')
    },
    async signOut() {
      attempt++
      try {
        await client.logout()
      } catch {
        // 서버 폐기가 실패해도 이 기기의 토큰은 지워졌다. 사용자는 로그아웃된 것으로 본다.
      }
      setStatus('signed-out')
    },
  }
}
