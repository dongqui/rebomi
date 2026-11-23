'use client'

import { useEffect, useId, useRef } from 'react'
import { Button } from './buttons'

type Props = {
  title: string
  description: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

/**
 * 되돌리기 어려운 동작 앞의 확인 (디자인의 Dialog `confirm`).
 *
 * 열리면 초점이 취소에 간다 — Enter를 잘못 눌러도 실행되지 않는다. Esc와 바깥을 누르는
 * 것은 취소다.
 */
export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: Props) {
  const titleId = useId()
  const descriptionId = useId()
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const previous = document.activeElement
    panel.current?.querySelector('button')?.focus()
    return () => {
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus()
    }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-dim px-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel()
      }}
      onKeyDown={(event) => {
        if (event.key !== 'Escape') return
        event.stopPropagation()
        onCancel()
      }}
    >
      <div
        ref={panel}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="w-full max-w-[340px] rounded-3xl bg-floating p-6 shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      >
        <h2 id={titleId} className="text-xl leading-[1.4] font-bold text-strong">
          {title}
        </h2>
        <p id={descriptionId} className="mt-2 text-[15px] text-sub">
          {description}
        </p>
        <div className="mt-6 grid grid-cols-2 gap-2">
          <Button variant="weak" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </div>
    </div>
  )
}
