'use client'

import type { WaitlistHeadline, WaitlistHero, WaitlistLocale } from '@rebomi/api-contract'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'
import { WaitlistProvider } from './waitlist'

/**
 * 서버에서 그린 랜딩을 감싸 등록 대화상자를 붙인다.
 *
 * 저장 요청은 브라우저가 `NEXT_PUBLIC_API_BASE_URL` 로 직접 보낸다. 배포된 랜딩에서는 그것이
 * 이 웹의 `/api` 다 (`src/app/api/waitlist`).
 */
export function LandingShell({
  locale,
  headline,
  hero,
  children,
}: {
  locale: WaitlistLocale
  headline: WaitlistHeadline
  hero: WaitlistHero
  children: ReactNode
}) {
  return (
    <WaitlistProvider client={api} locale={locale} headline={headline} hero={hero}>
      {children}
    </WaitlistProvider>
  )
}
