'use client'

import { ApiError, type ApiClient } from '@rebomi/api-client'
import type { AuthProvider } from '@rebomi/api-contract'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { ObservableTokenStore } from './token-store'

/**
 * - `checking`: 시작 직후, 갱신 쿠키로 세션을 복구하는 중
 * - `signed-in` / `signed-out`
 * - `unreachable`: 서버에 닿지 못해 로그인 여부를 모른다. 로그아웃과 구분한다 —
 *   일시적인 연결 문제로 로그인 화면에 보내지 않기 위해서다.
 */
export type SessionStatus = 'checking' | 'signed-in' | 'signed-out' | 'unreachable'

export type Session = {
  status: SessionStatus
  /** 제공자의 신원 토큰으로 로그인한다. 실패하면 `ApiError` 를 던진다. */
  signIn(provider: AuthProvider, idToken: string): Promise<void>
  signOut(): Promise<void>
  /** `unreachable` 에서 세션 복구를 다시 시도한다. */
  retry(): void
}

const SessionContext = createContext<Session | null>(null)

export function useSession(): Session {
  const session = useContext(SessionContext)
  if (!session) throw new Error('SessionProvider 안에서만 쓸 수 있습니다')
  return session
}

type Props = {
  client: Pick<ApiClient, 'login' | 'refresh' | 'logout'>
  tokens: Pick<ObservableTokenStore, 'subscribe'>
  children: ReactNode
}

export function SessionProvider({ client, tokens, children }: Props) {
  const [status, setStatus] = useState<SessionStatus>('checking')
  const [attempt, setAttempt] = useState(0)

  // 시작할 때(그리고 다시 시도할 때) 갱신 쿠키로 세션을 복구한다.
  useEffect(() => {
    let cancelled = false

    client.refresh().then(
      () => {
        if (!cancelled) setStatus('signed-in')
      },
      (error: unknown) => {
        if (cancelled) return
        const rejected = error instanceof ApiError && (error.status === 401 || error.status === 403)
        setStatus(rejected ? 'signed-out' : 'unreachable')
      },
    )

    return () => {
      cancelled = true
    }
  }, [client, attempt])

  // 사용 중에 갱신이 거부되면 api-client가 토큰을 지운다. 그때 로그아웃 상태로 바꾼다.
  useEffect(
    () =>
      tokens.subscribe((next) => {
        if (next === null) setStatus((current) => (current === 'signed-in' ? 'signed-out' : current))
      }),
    [tokens],
  )

  const signIn = useCallback(
    async (provider: AuthProvider, idToken: string) => {
      await client.login(provider, idToken)
      setStatus('signed-in')
    },
    [client],
  )

  const signOut = useCallback(async () => {
    try {
      await client.logout()
    } catch {
      // 서버 폐기가 실패해도 이 브라우저의 토큰은 지워졌다. 사용자는 로그아웃된 것으로 본다.
    }
    setStatus('signed-out')
  }, [client])

  const retry = useCallback(() => {
    setStatus('checking')
    setAttempt((current) => current + 1)
  }, [])

  const session = useMemo(
    () => ({ status, signIn, signOut, retry }),
    [status, signIn, signOut, retry],
  )

  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>
}
