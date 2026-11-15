'use client'

import { SignOutButton } from '@/auth/sign-out-button'
import { api } from '@/lib/api'
import { LibraryScreen } from '@/library/library-screen'

/**
 * 로그인한 사용자의 첫 화면: URL 저장과 저장한 콘텐츠 목록.
 *
 * 클라이언트 컴포넌트인 것이 요점이다. 서버 컴포넌트에서 호출하면 확장·모바일이
 * 실제로 쓰는 브라우저→API 경로와 CORS가 검증되지 않고, 갱신 쿠키도 닿지 않는다.
 */
export default function Home() {
  return (
    <main style={{ maxWidth: '40rem', margin: '0 auto' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1 style={{ fontSize: '1.5rem' }}>Rebomi</h1>
        <SignOutButton />
      </header>

      <LibraryScreen client={api} />
    </main>
  )
}
