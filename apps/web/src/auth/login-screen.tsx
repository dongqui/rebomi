'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useRef, useState } from 'react'
import { ConnectionError } from './connection-error'
import { loginErrorMessage } from './messages'
import type { LoginMethod } from './methods/types'
import { useSession } from './session'

/**
 * 로그인 화면. 수단은 `methods` 로 받는다 — 화면은 수단이 몇 개인지, 각 수단이 서버에
 * 무엇을 보내는지 모른다.
 */
export function LoginScreen({ methods }: { methods: LoginMethod[] }) {
  const { status, retry } = useSession()
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const running = useRef(false)

  // 로그인에 성공했거나 이미 로그인된 상태로 왔으면 앱 화면으로 보낸다.
  useEffect(() => {
    if (status === 'signed-in') router.replace('/')
  }, [status, router])

  const attempt = useCallback((run: () => Promise<void>) => {
    if (running.current) return
    running.current = true
    setBusy(true)
    setMessage(null)

    run()
      .catch((error: unknown) => setMessage(loginErrorMessage(error)))
      .finally(() => {
        running.current = false
        setBusy(false)
      })
  }, [])

  const fail = useCallback((reason: string) => setMessage(reason), [])

  return (
    <main style={{ maxWidth: '20rem', margin: '0 auto' }}>
      <h1 style={{ fontSize: '1.5rem' }}>Rebomi 로그인</h1>

      {(status === 'checking' || status === 'signed-in') && <p>확인 중…</p>}

      {status === 'unreachable' && <ConnectionError onRetry={retry} />}

      {status === 'signed-out' && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            {methods.map(({ id, Component }) => (
              <Component key={id} disabled={busy} attempt={attempt} fail={fail} />
            ))}
          </div>

          {busy && <p>로그인하는 중…</p>}

          {message !== null && (
            <p role="alert" style={{ color: '#b00' }}>
              {message}
            </p>
          )}
        </>
      )}
    </main>
  )
}
