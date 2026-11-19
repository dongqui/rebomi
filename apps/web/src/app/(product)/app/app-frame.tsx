'use client'

import type { ReactNode } from 'react'
import { RequireSession } from '@/auth/require-session'
import { api } from '@/lib/api'
import { LibraryProvider } from '@/library/library-provider'
import { AppShell } from '@/shell/app-shell'

/**
 * `/app` 의 공통 틀을 조립한다: 로그인 확인 → 저장한 콘텐츠 → 내비게이션과 상단 영역.
 *
 * 클라이언트 컴포넌트인 것이 요점이다. 서버 컴포넌트에서 API를 부르면 확장·모바일이
 * 실제로 쓰는 브라우저→API 경로와 CORS가 검증되지 않고, 갱신 쿠키도 닿지 않는다.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  return (
    <RequireSession>
      <LibraryProvider client={api}>
        <AppShell>{children}</AppShell>
      </LibraryProvider>
    </RequireSession>
  )
}
