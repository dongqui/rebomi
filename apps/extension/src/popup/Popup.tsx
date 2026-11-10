import { ApiError, createApiClient } from '@rebomi/api-client'
import type { HealthResponse } from '@rebomi/api-contract'
import { useEffect, useState } from 'react'

const baseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined

// 조용히 localhost로 폴백하지 않는다 — 잘못된 주소를 가리키는 확장이 더 나쁘다.
if (!baseUrl) {
  throw new Error('VITE_API_BASE_URL이 없습니다. `cp .env.example .env` 를 실행하세요.')
}

const api = createApiClient({ baseUrl })

type State =
  | { kind: 'loading' }
  | { kind: 'loaded'; health: HealthResponse }
  | { kind: 'failed'; code: string; message: string }

/**
 * 스캐폴드가 증명하는 경로: 확장 팝업 → @rebomi/api-client → GET /health → DB.
 *
 * 팝업은 chrome-extension:// 오리진에서 돈다. API의 CORS 허용 목록에 확장 ID가
 * 들어 있어야 한다 (.env 의 CORS_ORIGINS).
 */
export function Popup() {
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
    <main
      style={{
        minWidth: 280,
        padding: '1rem 1.25rem',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif',
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ fontSize: '1rem', margin: 0 }}>Rebomi</h1>
      <p style={{ fontSize: '0.75rem', color: '#666', margin: '0.25rem 0 0.75rem' }}>
        <code>{baseUrl}</code>
      </p>

      {state.kind === 'loading' && <p style={{ margin: 0, fontSize: '0.875rem' }}>확인 중…</p>}

      {state.kind === 'loaded' && (
        <p style={{ margin: 0, fontSize: '0.875rem' }}>
          status: <strong>{state.health.status}</strong> · db: <strong>{state.health.db}</strong> ·
          version: <strong>{state.health.version}</strong>
        </p>
      )}

      {state.kind === 'failed' && (
        <p style={{ margin: 0, fontSize: '0.875rem', color: '#b00' }}>
          실패 — {state.code}: {state.message}
        </p>
      )}
    </main>
  )
}
