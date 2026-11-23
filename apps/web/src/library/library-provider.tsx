'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import { useCopy } from '@/shell/locale-context'
import { useToast } from '@/ui/toast'
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
  children: ReactNode
}

/**
 * 저장한 콘텐츠 목록과 링크 저장을 `/app` 의 화면들이 함께 쓰게 한다.
 *
 * 목록이 화면(홈)이 아니라 여기에 있는 이유: 저장 버튼은 앱 틀에 있고 저장한 결과는 홈의
 * 목록에 나타나야 한다.
 */
export function LibraryProvider({ client, pollMs = 3000, children }: Props) {
  const copy = useCopy()
  const toast = useToast()
  const library = useLibrary(client, pollMs)
  const [dialogOpen, setDialogOpen] = useState(false)

  const openSaveLink = useCallback(() => {
    toast.dismiss()
    setDialogOpen(true)
  }, [toast])

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
            toast.show(copy.saveDialog.created)
          }}
        />
      )}
    </LibraryContext.Provider>
  )
}
