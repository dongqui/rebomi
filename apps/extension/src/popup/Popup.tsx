import { ApiError, type ApiClient } from '@rebomi/api-client'
import { useEffect, useState, type CSSProperties } from 'react'
import { useSession } from '../auth/session.js'
import type { ObservableTokenStore } from '../auth/token-store.js'

type Props = {
  client: Pick<ApiClient, 'refresh' | 'listContents'>
  tokens: Pick<ObservableTokenStore, 'subscribe'>
  /** 웹 로그인 페이지를 새 탭으로 연다. */
  openLogin: () => void
}

const text: CSSProperties = { margin: 0, fontSize: '0.875rem' }
const button: CSSProperties = { marginTop: '0.75rem', font: 'inherit', fontSize: '0.875rem' }

/**
 * 확장의 로그인 상태를 보여주는 확인용 최소 화면. 저장 UI는 아직 없다.
 *
 * 확장에는 로그인 화면이 없다(account ACC-9). 로그인돼 있지 않으면 알리고, 버튼으로
 * 웹 로그인 페이지를 연다 — 열자마자 탭을 띄우면 팝업이 닫혀 이유를 알 수 없다.
 */
export function Popup({ client, tokens, openLogin }: Props) {
  const session = useSession(client, tokens)

  return (
    <main
      style={{
        minWidth: 280,
        padding: '1rem 1.25rem',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif',
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Rebomi</h1>

      {session.status === 'checking' && <p style={text}>확인 중…</p>}

      {session.status === 'signed-in' && (
        <>
          <p style={text}>로그인되어 있습니다</p>
          <AccountCheck client={client} />
        </>
      )}

      {session.status === 'signed-out' && (
        <>
          <p style={text}>로그인이 필요합니다. 웹에서 로그인하면 확장도 로그인됩니다.</p>
          <button type="button" style={button} onClick={openLogin}>
            로그인하기
          </button>
        </>
      )}

      {session.status === 'unreachable' && (
        <>
          <p role="alert" style={{ ...text, color: '#b00' }}>
            서버에 연결할 수 없습니다
          </p>
          <button type="button" style={button} onClick={session.retry}>
            다시 시도
          </button>
        </>
      )}
    </main>
  )
}

type Check = { kind: 'checking' } | { kind: 'ok' } | { kind: 'failed'; code: string }

/**
 * 로그인된 계정으로 인증된 요청이 실제로 통하는지 한 번 확인한다.
 *
 * 갱신이 거부돼 실패한 경우는 여기서 다루지 않는다 — 그때는 토큰이 지워져 팝업이
 * 로그인이 필요한 상태로 바뀌고 이 컴포넌트는 사라진다.
 */
function AccountCheck({ client }: { client: Pick<ApiClient, 'listContents'> }) {
  const [check, setCheck] = useState<Check>({ kind: 'checking' })

  useEffect(() => {
    let cancelled = false

    client.listContents({ limit: 1 }).then(
      () => {
        if (!cancelled) setCheck({ kind: 'ok' })
      },
      (error: unknown) => {
        if (cancelled) return
        setCheck({ kind: 'failed', code: error instanceof ApiError ? error.code : 'UNKNOWN' })
      },
    )

    return () => {
      cancelled = true
    }
  }, [client])

  const style: CSSProperties = { ...text, fontSize: '0.75rem', color: '#666' }

  if (check.kind === 'checking') return <p style={style}>계정 확인 중…</p>
  if (check.kind === 'ok') return <p style={style}>계정 요청 성공</p>
  return (
    <p role="alert" style={{ ...style, color: '#b00' }}>
      계정 요청 실패 — {check.code}
    </p>
  )
}
