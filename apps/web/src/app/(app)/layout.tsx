import type { ReactNode } from 'react'
import { RequireSession } from '@/auth/require-session'

/** 로그인해야 볼 수 있는 화면들. 로그인 화면(`/login`)만 이 밖에 있다. */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <RequireSession>{children}</RequireSession>
}
