'use client'

import { useRouter } from 'next/navigation'
import { useEffect, type ReactNode } from 'react'
import { ConnectionError } from './connection-error'
import { useSession } from './session'

/**
 * 로그인한 사용자에게만 `children` 을 보인다. 로그인하지 않았으면 로그인 화면으로 보낸다.
 *
 * 브라우저에서 판단한다. 갱신 쿠키는 API의 `/auth` 경로에만 붙어 Next 서버에는 보이지 않는다.
 */
export function RequireSession({ children }: { children: ReactNode }) {
  const { status, retry } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'signed-out') router.replace('/login')
  }, [status, router])

  if (status === 'signed-in') return <>{children}</>
  if (status === 'unreachable') return <ConnectionError onRetry={retry} />
  return <p>확인 중…</p>
}
