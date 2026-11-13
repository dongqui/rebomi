'use client'

import type { Content, CreateContentResponse } from '@rebomi/api-contract'
import { useState, type FormEvent } from 'react'
import { ContentSummary } from './content-row'
import { saveErrorMessage } from './labels'

type Notice =
  | { kind: 'created' }
  | { kind: 'duplicate'; content: Content }
  | { kind: 'error'; message: string }

/**
 * URL 입력과 저장 (capture.md CAP-1, CAP-6).
 *
 * 주소가 http(s)인지는 서버가 판정한다 — 여기서는 빈 입력만 막는다. 판정 기준을 두 곳에
 * 두면 어긋난다.
 */
export function SaveForm({ onSave }: { onSave: (url: string) => Promise<CreateContentResponse> }) {
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return

    const trimmed = url.trim()
    if (trimmed === '') {
      setNotice({ kind: 'error', message: '주소를 입력해 주세요.' })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      const result = await onSave(trimmed)
      setNotice(
        result.status === 'created'
          ? { kind: 'created' }
          : { kind: 'duplicate', content: result.content },
      )
      setUrl('')
    } catch (error) {
      // 고쳐서 다시 보낼 수 있게 입력은 남긴다.
      setNotice({ kind: 'error', message: saveErrorMessage(error) })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section>
      <form onSubmit={(event) => void submit(event)} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          aria-label="저장할 주소"
          // type="url" 을 쓰지 않는다 — 브라우저가 먼저 막으면 이유를 우리 말로 보여줄 수 없다.
          type="text"
          inputMode="url"
          placeholder="https://"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          style={{ flex: 1, padding: '0.5rem' }}
        />
        <button type="submit" disabled={saving}>
          저장
        </button>
      </form>

      {notice?.kind === 'error' && (
        <p role="alert" style={{ color: '#b00', fontSize: '0.875rem' }}>
          {notice.message}
        </p>
      )}
      {notice?.kind === 'created' && (
        <p role="status" style={{ fontSize: '0.875rem' }}>
          저장했습니다.
        </p>
      )}
      {notice?.kind === 'duplicate' && (
        <div role="status" style={{ fontSize: '0.875rem' }}>
          <p>이미 저장한 링크입니다.</p>
          <ContentSummary content={notice.content} />
        </div>
      )}
    </section>
  )
}
