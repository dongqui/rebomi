import { headers } from 'next/headers'
import localFont from 'next/font/local'
import type { ReactNode } from 'react'
import { pickLocale } from '@/landing/locale'
import './globals.css'

// Pretendard 가변 글꼴 한 파일 (SIL OFL 1.1). 영문과 한글을 같은 글꼴로 쓴다.
const pretendard = localFont({
  src: '../../fonts/PretendardVariable.woff2',
  weight: '45 920',
  display: 'swap',
  variable: '--font-pretendard',
})

/**
 * 누구나 보는 화면(랜딩)의 최상위 레이아웃. 로그인한 화면은 `(product)` 에 따로 있다 —
 * 그쪽은 아직 디자인을 입히지 않아서 Tailwind의 기본 초기화를 받으면 모습이 바뀐다.
 *
 * 언어를 요청마다 정하므로 이 아래 화면은 요청할 때 서버에서 그린다.
 */
export default async function SiteLayout({ children }: { children: ReactNode }) {
  const locale = pickLocale((await headers()).get('accept-language'))

  return (
    <html lang={locale} className={pretendard.variable}>
      <body>{children}</body>
    </html>
  )
}
