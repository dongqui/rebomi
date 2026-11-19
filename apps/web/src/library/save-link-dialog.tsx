'use client'

import type { Content, CreateContentResponse } from '@rebomi/api-contract'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useCopy } from '@/shell/locale-context'
import { Button, IconButton } from '@/ui/buttons'
import { ContentMeta } from './content-meta'
import { saveErrorMessage } from './labels'

type Notice = { kind: 'duplicate'; content: Content } | { kind: 'error'; message: string }

type Props = {
  onSave: (url: string) => Promise<CreateContentResponse>
  onClose: () => void
  /** 새로 저장됐다. 대화상자를 닫고 알리는 것은 부른 쪽이 한다. */
  onCreated: () => void
}

/**
 * 링크 저장 대화상자 (capture.md CAP-1, CAP-6).
 *
 * 주소가 http(s)인지는 서버가 판정한다 — 여기서는 빈 입력만 막는다. 판정 기준을 두 곳에
 * 두면 어긋난다.
 *
 * 디자인에는 "링크 저장" 버튼만 있고 주소를 넣는 화면이 없다. 모양은 랜딩의 등록
 * 대화상자를 따랐다: 좁은 화면에서는 화면을 채우고, 넓으면 가운데 뜬다.
 */
export function SaveLinkDialog({ onSave, onClose, onCreated }: Props) {
  const copy = useCopy()
  const titleId = useId()
  const noticeId = useId()
  const input = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState('')
  const [saving, setSaving] = useState(false)
  const [notice, setNotice] = useState<Notice | null>(null)
  // 저장일 표기의 기준 시각. 대화상자가 열려 있는 동안에는 바뀌지 않아도 된다.
  const [now] = useState(() => new Date())

  // 열리면 입력으로, 닫히면 열기 전에 있던 곳으로 초점을 돌려준다.
  useEffect(() => {
    const previous = document.activeElement
    input.current?.focus()
    return () => {
      if (previous instanceof HTMLElement) previous.focus()
    }
  }, [])

  async function submit(event: FormEvent) {
    event.preventDefault()
    if (saving) return

    const trimmed = url.trim()
    if (trimmed === '') {
      setNotice({ kind: 'error', message: copy.saveDialog.empty })
      return
    }

    setSaving(true)
    setNotice(null)
    try {
      const result = await onSave(trimmed)
      if (result.status === 'created') {
        onCreated()
        return
      }
      setNotice({ kind: 'duplicate', content: result.content })
      setUrl('')
    } catch (error) {
      // 고쳐서 다시 보낼 수 있게 입력은 남긴다.
      setNotice({ kind: 'error', message: saveErrorMessage(error, copy) })
    } finally {
      setSaving(false)
    }
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-dim"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
      onKeyDown={onKeyDown}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="flex h-full w-full flex-col overflow-hidden bg-floating roomy:h-auto roomy:max-h-[calc(100%-48px)] roomy:w-[480px] roomy:max-w-[calc(100%-32px)] roomy:rounded-[28px]"
      >
        <div className="flex flex-none items-center justify-between gap-3 pt-4 pr-4 pl-6">
          <h2 id={titleId} className="text-xl leading-[1.4] font-bold text-strong">
            {copy.saveDialog.title}
          </h2>
          <IconButton aria-label={copy.saveDialog.close} onClick={onClose}>
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </IconButton>
        </div>

        <form
          noValidate
          onSubmit={(event) => void submit(event)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="min-h-0 flex-1 overflow-auto px-6 pt-5 pb-2">
            <label
              className="mb-1.5 block text-sm font-semibold text-sub"
              htmlFor={`${titleId}-url`}
            >
              {copy.saveDialog.label}
            </label>
            <input
              ref={input}
              id={`${titleId}-url`}
              // type="url" 을 쓰지 않는다 — 브라우저가 먼저 막으면 이유를 우리 말로 보여줄 수 없다.
              type="text"
              inputMode="url"
              autoComplete="off"
              spellCheck={false}
              placeholder="https://"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              aria-invalid={notice?.kind === 'error'}
              aria-describedby={noticeId}
              className="h-[52px] w-full rounded-[14px] border border-muted bg-bg px-4 text-[17px] text-strong placeholder:text-muted"
            />

            <div id={noticeId} className="mt-2 min-h-[1lh] text-sm">
              {notice?.kind === 'error' && (
                <p role="alert" className="text-danger">
                  {notice.message}
                </p>
              )}
              {notice?.kind === 'duplicate' && (
                <div role="status">
                  <p className="text-sub">{copy.saveDialog.duplicate}</p>
                  <div className="mt-2 rounded-xl bg-fill px-3.5 py-2.5 text-[15px]">
                    <ContentMeta content={notice.content} now={now} />
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-none justify-end px-6 pt-3 pb-6">
            <Button type="submit" disabled={saving}>
              {copy.saveDialog.save}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
