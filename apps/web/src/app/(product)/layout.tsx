import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Rebomi',
  description: '저장한 콘텐츠를 잊지 않게 다시 보여준다',
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          padding: '3rem 1.5rem',
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Apple SD Gothic Neo", "Noto Sans KR", sans-serif',
          lineHeight: 1.6,
        }}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
