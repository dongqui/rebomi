import type { Metadata } from 'next'
import { headers } from 'next/headers'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import { pickLocale } from '@/lib/locale'
import { themeScript } from '@/theme/theme-script'
import '../globals.css'
import { Providers } from './providers'

export const metadata: Metadata = {
  title: 'Rebomi',
  description: '저장한 콘텐츠를 잊지 않게 다시 보여준다',
}

// Pretendard 가변 글꼴 한 파일 (SIL OFL 1.1). 영문과 한글을 같은 글꼴로 쓴다.
const pretendard = localFont({
  src: '../../fonts/PretendardVariable.woff2',
  weight: '45 920',
  display: 'swap',
  variable: '--font-pretendard',
})

/**
 * 로그인 화면(`/login`)과 로그인한 뒤의 화면(`/app`)의 최상위 레이아웃. 랜딩은 `(site)` 에
 * 따로 있다.
 *
 * 언어는 요청의 `Accept-Language` 로 정한다(랜딩과 같은 규칙). 테마는 사용자가 고른 값이
 * 브라우저에 있어서, 첫 그리기 전에 인라인 스크립트가 `<html data-theme>` 을 단다 —
 * 그래서 서버가 그린 `<html>` 과 속성이 다를 수 있고 `suppressHydrationWarning` 이 필요하다.
 */
export default async function RootLayout({ children }: { children: ReactNode }) {
  const locale = pickLocale((await headers()).get('accept-language'))

  return (
    <html lang={locale} className={pretendard.variable} suppressHydrationWarning>
      <body>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
        <Providers locale={locale}>{children}</Providers>
      </body>
    </html>
  )
}
