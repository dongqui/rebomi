'use client'

import type { ReactNode } from 'react'
import { SessionProvider } from '@/auth/session'
import { api, tokenStore } from '@/lib/api'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <SessionProvider client={api} tokens={tokenStore}>
      {children}
    </SessionProvider>
  )
}
