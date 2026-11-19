'use client'

import type { ReactNode } from 'react'
import { SessionProvider } from '@/auth/session'
import { api, tokenStore } from '@/lib/api'
import type { Locale } from '@/lib/locale'
import { LocaleProvider } from '@/shell/locale-context'

export function Providers({ locale, children }: { locale: Locale; children: ReactNode }) {
  return (
    <LocaleProvider locale={locale}>
      <SessionProvider client={api} tokens={tokenStore}>
        {children}
      </SessionProvider>
    </LocaleProvider>
  )
}
