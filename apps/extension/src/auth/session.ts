import { ApiError, type ApiClient } from '@rebomi/api-client'
import { useCallback, useEffect, useState } from 'react'
import type { ObservableTokenStore } from './token-store.js'

/**
 * - `checking`: 열린 직후, 웹의 갱신 쿠키로 세션을 확인하는 중
 * - `signed-in` / `signed-out`
 * - `unreachable`: 서버에 닿지 못해 로그인 여부를 모른다. 로그아웃과 구분한다 —
 *   일시적인 연결 문제로 로그인하라고 하지 않기 위해서다.
 */
export type SessionStatus = 'checking' | 'signed-in' | 'signed-out' | 'unreachable'

export type Session = {
  status: SessionStatus
  /** `unreachable` 에서 다시 확인한다. */
  retry(): void
}

/**
 * 확장의 로그인 상태. 확장에는 로그인·로그아웃이 없다 — 웹에서 로그인하면 로그인된
 * 상태이고, 웹에서 로그아웃하면 다음 확인 때 로그아웃된 상태다.
 */
export function useSession(
  client: Pick<ApiClient, 'refresh'>,
  tokens: Pick<ObservableTokenStore, 'subscribe'>,
): Session {
  const [status, setStatus] = useState<SessionStatus>('checking')
  const [attempt, setAttempt] = useState(0)

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

  // 사용 중에 갱신이 거부되면 api-client가 토큰을 지운다. 그때 로그인이 필요한 상태로 바꾼다.
  useEffect(
    () =>
      tokens.subscribe((next) => {
        if (next === null) setStatus((current) => (current === 'signed-in' ? 'signed-out' : current))
      }),
    [tokens],
  )

  const retry = useCallback(() => {
    setStatus('checking')
    setAttempt((current) => current + 1)
  }, [])

  return { status, retry }
}
