'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

/** 알림에 붙는 동작 하나 (되돌리기). 누르면 알림이 닫힌다. */
export type ToastAction = { label: string; run: () => void }

type Toast = { message: string; action?: ToastAction }

type ToastApi = {
  /** 알림을 띄운다. 떠 있던 알림은 새 것으로 바뀐다. */
  show(message: string, action?: ToastAction): void
  dismiss(): void
}

const ToastContext = createContext<ToastApi | null>(null)

export function useToast(): ToastApi {
  const value = useContext(ToastContext)
  if (!value) throw new Error('ToastProvider 안에서만 쓸 수 있습니다')
  return value
}

/**
 * 화면 아래에 잠깐 뜨는 알림 (디자인의 Toast). 한 번에 하나만 뜬다.
 *
 * `toastMs` 뒤에 스스로 사라진다 — 되돌리기도 그때까지만 할 수 있다.
 */
export function ToastProvider({
  toastMs = 4500,
  children,
}: {
  toastMs?: number
  children: ReactNode
}) {
  const [toast, setToast] = useState<Toast | null>(null)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), toastMs)
    return () => clearTimeout(timer)
  }, [toast, toastMs])

  const show = useCallback(
    (message: string, action?: ToastAction) => setToast(action ? { message, action } : { message }),
    [],
  )
  const dismiss = useCallback(() => setToast(null), [])
  const api = useMemo(() => ({ show, dismiss }), [show, dismiss])

  return (
    <ToastContext.Provider value={api}>
      {children}

      {toast !== null && (
        <div className="pointer-events-none fixed inset-x-0 bottom-7 z-[60] flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-4 rounded-2xl bg-strong px-5 py-3.5 text-[15px] font-medium text-bg shadow-[0_8px_24px_rgba(0,0,0,0.18)]">
            <p role="status">{toast.message}</p>
            {toast.action && (
              <button
                type="button"
                onClick={() => {
                  const { run } = toast.action!
                  setToast(null)
                  run()
                }}
                className="-my-1 -mr-2 cursor-pointer rounded-lg px-2 py-1 font-semibold underline underline-offset-4"
              >
                {toast.action.label}
              </button>
            )}
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
