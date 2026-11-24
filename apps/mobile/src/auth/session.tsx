import { createContext, useContext, useEffect, useSyncExternalStore, type ReactNode } from 'react'
import type { SessionStatus, SessionStore } from './session-store'

export type Session = Pick<SessionStore, 'signIn' | 'signOut' | 'retry'> & {
  status: SessionStatus
}

const SessionContext = createContext<SessionStore | null>(null)

/** 앱이 뜰 때 세션 복구를 시작하고, 아래 화면들이 로그인 상태를 읽게 한다. */
export function SessionProvider({ store, children }: { store: SessionStore; children: ReactNode }) {
  useEffect(() => {
    store.start()
  }, [store])

  return <SessionContext.Provider value={store}>{children}</SessionContext.Provider>
}

export function useSession(): Session {
  const store = useContext(SessionContext)
  if (!store) throw new Error('SessionProvider 안에서만 쓸 수 있습니다')

  const status = useSyncExternalStore(store.subscribe, store.getStatus)
  return { status, signIn: store.signIn, signOut: store.signOut, retry: store.retry }
}
