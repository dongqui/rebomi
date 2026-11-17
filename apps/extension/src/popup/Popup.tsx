import { ApiError, type ApiClient } from '@rebomi/api-client'
import { ERROR_CODES, type Content, type ExtractionLevel } from '@rebomi/api-contract'
import { useEffect, useRef, useState, type CSSProperties } from 'react'
import { useSession } from '../auth/session.js'
import type { ObservableTokenStore } from '../auth/token-store.js'
import { toSaveRequest, type Capture } from '../capture/capture-tab.js'

type Props = {
  client: Pick<ApiClient, 'refresh' | 'saveContent'>
  tokens: Pick<ObservableTokenStore, 'subscribe'>
  /** 웹 로그인 페이지를 새 탭으로 연다. */
  openLogin: () => void
  /** 지금 보고 있는 탭을 캡처한다. */
  capture: () => Promise<Capture>
}

const text: CSSProperties = { margin: 0, fontSize: '0.875rem' }
const sub: CSSProperties = { margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#666' }
const button: CSSProperties = { marginTop: '0.75rem', font: 'inherit', fontSize: '0.875rem' }

/** 추출 수준의 표기. 웹(`apps/web/src/library/labels.ts`)과 같다. */
const EXTRACTION_LABEL: Record<ExtractionLevel, string> = {
  full: '본문',
  partial: '일부',
  metadata_only: '메타데이터만',
}

/**
 * 확장의 팝업. 열면 바로 지금 페이지를 저장한다 (capture.md CAP-2) — 캡처 전에 안내로
 * 막지 않고, 결과에 추출 수준을 함께 보여 본문이 저장됐음을 알린다.
 *
 * 확장에는 로그인 화면이 없다(account ACC-9). 로그인돼 있지 않으면 저장하지 않고 알리며,
 * 버튼으로 웹 로그인 페이지를 연다 — 열자마자 탭을 띄우면 팝업이 닫혀 이유를 알 수 없다.
 */
export function Popup({ client, tokens, openLogin, capture }: Props) {
  const session = useSession(client, tokens)

  return (
    <main
      style={{
        width: 300,
        padding: '1rem 1.25rem',
        fontFamily: 'ui-sans-serif, system-ui, -apple-system, "Apple SD Gothic Neo", sans-serif',
        lineHeight: 1.5,
      }}
    >
      <h1 style={{ fontSize: '1rem', margin: '0 0 0.75rem' }}>Rebomi</h1>

      {session.status === 'checking' && <p style={text}>확인 중…</p>}

      {session.status === 'signed-in' && <SavePage client={client} capture={capture} />}

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

type Outcome =
  | { kind: 'saved'; duplicate: boolean; content: Content }
  | { kind: 'unsupported' }
  | { kind: 'failed'; code: string }

async function save(
  client: Pick<ApiClient, 'saveContent'>,
  capture: () => Promise<Capture>,
): Promise<Outcome> {
  try {
    const captured = await capture()
    if (captured.kind === 'unsupported') return { kind: 'unsupported' }

    const response = await client.saveContent(toSaveRequest(captured))
    return { kind: 'saved', duplicate: response.status === 'duplicate', content: response.content }
  } catch (error) {
    return { kind: 'failed', code: error instanceof ApiError ? error.code : 'UNKNOWN' }
  }
}

/**
 * 지금 페이지를 한 번 저장하고 결과를 보인다.
 *
 * 갱신이 거부돼 실패한 경우는 여기서 다루지 않는다 — 그때는 토큰이 지워져 팝업이
 * 로그인이 필요한 상태로 바뀌고 이 컴포넌트는 사라진다.
 */
function SavePage({ client, capture }: Pick<Props, 'client' | 'capture'>) {
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [attempt, setAttempt] = useState(0)
  // 저장은 되돌릴 수 없는 요청이다. 개발 모드가 효과를 두 번 돌려도 시도마다 한 번만 보낸다.
  const running = useRef<{ attempt: number; outcome: Promise<Outcome> } | null>(null)

  useEffect(() => {
    let active = true

    if (running.current?.attempt !== attempt) {
      running.current = { attempt, outcome: save(client, capture) }
    }
    void running.current.outcome.then((next) => {
      if (active) setOutcome(next)
    })

    return () => {
      active = false
    }
  }, [client, capture, attempt])

  if (outcome === null) return <p style={text}>저장하는 중…</p>

  if (outcome.kind === 'unsupported') {
    return (
      <p style={text}>이 탭은 저장할 수 없습니다. 웹 페이지(http, https)만 저장할 수 있습니다.</p>
    )
  }

  if (outcome.kind === 'failed') {
    return (
      <>
        <p role="alert" style={{ ...text, color: '#b00' }}>
          {outcome.code === ERROR_CODES.NETWORK
            ? '서버에 연결할 수 없습니다. 저장되지 않았습니다.'
            : `저장하지 못했습니다 — ${outcome.code}`}
        </p>
        <button
          type="button"
          style={button}
          onClick={() => {
            setOutcome(null)
            setAttempt((current) => current + 1)
          }}
        >
          다시 시도
        </button>
      </>
    )
  }

  const { content } = outcome
  return (
    <>
      <p style={{ ...text, fontWeight: 600 }}>
        {outcome.duplicate ? '이미 저장한 페이지입니다' : '저장했습니다'}
      </p>
      <p style={{ ...text, marginTop: '0.25rem', overflowWrap: 'anywhere' }}>
        {content.title ?? content.url}
      </p>
      <p style={sub}>추출 수준: {EXTRACTION_LABEL[content.extractionLevel]}</p>
    </>
  )
}
