'use client'

import type { WaitlistHeadline, WaitlistLocale } from '@rebomi/api-contract'
import type { ReactNode } from 'react'
import { api } from '@/lib/api'
import { WaitlistProvider } from './waitlist'

/**
 * 서버에서 그린 랜딩을 감싸 등록 대화상자를 붙인다.
 *
 * 저장 요청은 브라우저가 API로 직접 보낸다 — 확장·모바일과 같은 경로와 CORS를 탄다.
 */
export function LandingShell({
  locale,
  headline,
  children,
}: {
  locale: WaitlistLocale
  headline: WaitlistHeadline
  children: ReactNode
}) {
  return (
    <WaitlistProvider client={api} locale={locale} headline={headline}>
      {children}
    </WaitlistProvider>
  )
}
