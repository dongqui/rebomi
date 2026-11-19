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
import { useCopy } from '@/shell/locale-context'
import { SaveLinkDialog } from './save-link-dialog'
import { useLibrary, type Library, type LibraryClient } from './use-library'

type LibraryContextValue = {
  library: Library
  /** 링크 저장 대화상자를 연다. 상단 버튼과 첫 사용 안내가 함께 쓴다. */
  openSaveLink(): void
}

const LibraryContext = createContext<LibraryContextValue | null>(null)

export function useLibraryContext(): LibraryContextValue {
  const value = useContext(LibraryContext)
  if (!value) throw new Error('LibraryProvider 안에서만 쓸 수 있습니다')
  return value
}

type Props = {
  client: LibraryClient
  /** 처리 중인 항목을 다시 확인하는 간격. */
  pollMs?: number
  /** 저장 알림이 떠 있는 시간. */
  toastMs?: number
  children: ReactNode
}

/**
 * 저장한 콘텐츠 목록과 링크 저장을 `/app` 의 화면들이 함께 쓰게 한다.
 *
 * 목록이 화면(홈)이 아니라 여기에 있는 이유: 저장 버튼은 앱 틀에 있고 저장한 결과는 홈의
 * 목록에 나타나야 한다.
 */
export function LibraryProvider({ client, pollMs = 3000, toastMs = 4000, children }: Props) {
  const copy = useCopy()
  const library = useLibrary(client, pollMs)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (toast === null) return
    const timer = setTimeout(() => setToast(null), toastMs)
    return () => clearTimeout(timer)
  }, [toast, toastMs])

  const openSaveLink = useCallback(() => {
    setToast(null)
    setDialogOpen(true)
  }, [])

  const value = useMemo(() => ({ library, openSaveLink }), [library, openSaveLink])

  return (
    <LibraryContext.Provider value={value}>
      {children}

      {dialogOpen && (
        <SaveLinkDialog
          onSave={library.save}
          onClose={() => setDialogOpen(false)}
          onCreated={() => {
            setDialogOpen(false)
            setToast(copy.saveDialog.created)
          }}
        />
      )}

      {toast !== null && (
        <div className="pointer-events-none fixed inset-x-0 bottom-7 z-30 flex justify-center px-4">
          <p
            role="status"
            className="pointer-events-auto rounded-2xl bg-strong px-5 py-3.5 text-[15px] font-medium text-bg shadow-[0_8px_24px_rgba(0,0,0,0.18)]"
          >
            {toast}
          </p>
        </div>
      )}
    </LibraryContext.Provider>
  )
}
