'use client'

import { ApiError } from '@rebomi/api-client'
import type { HealthResponse } from '@rebomi/api-contract'
import { useEffect, useState } from 'react'
import { SignOutButton } from '@/auth/sign-out-button'
import { api, apiBaseUrl } from '@/lib/api'

type State =
  | { kind: 'loading' }
  | { kind: 'loaded'; health: HealthResponse }
  | { kind: 'failed'; code: string; message: string }

/**
 * 스캐폴드가 증명하는 경로: 브라우저 → @rebomi/api-client → GET /health → DB.
 *
 * 클라이언트 컴포넌트인 것이 요점이다. 서버 컴포넌트에서 호출하면 확장·모바일이
 * 실제로 쓰는 브라우저→API 경로와 CORS가 검증되지 않는다.
 */
export default function Home() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    api
      .health()
      .then((health) => {
        if (!cancelled) setState({ kind: 'loaded', health })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const apiError = error instanceof ApiError ? error : null
        setState({
          kind: 'failed',
          code: apiError?.code ?? 'UNKNOWN',
          message: apiError?.message ?? String(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <main style={{ maxWidth: '40rem', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem', marginBottom: '0.25rem' }}>Rebomi</h1>
        <SignOutButton />
      </header>
      <p style={{ color: '#666', marginTop: 0, fontSize: '0.875rem' }}>
        API: <code>{apiBaseUrl}</code>
      </p>

      <section
        data-testid="health"
        style={{
          marginTop: '2rem',
          padding: '1rem 1.25rem',
          border: '1px solid #ddd',
          borderRadius: '0.5rem',
        }}
      >
        {state.kind === 'loading' && <p style={{ margin: 0 }}>확인 중…</p>}

        {state.kind === 'loaded' && (
          <p style={{ margin: 0 }}>
            status: <strong>{state.health.status}</strong> · db: <strong>{state.health.db}</strong>{' '}
            · version: <strong>{state.health.version}</strong>
          </p>
        )}

        {state.kind === 'failed' && (
          <p style={{ margin: 0, color: '#b00' }}>
            실패 — {state.code}: {state.message}
          </p>
        )}
      </section>
    </main>
  )
}
