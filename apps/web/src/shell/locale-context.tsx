'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Locale } from '@/lib/locale'
import { APP_COPY, type AppCopy } from './copy'

const LocaleContext = createContext<Locale>('ko')

/** 서버가 요청의 `Accept-Language` 로 고른 언어를 아래 화면에 전한다. */
export function LocaleProvider({ locale, children }: { locale: Locale; children: ReactNode }) {
  return <LocaleContext.Provider value={locale}>{children}</LocaleContext.Provider>
}

export function useLocale(): Locale {
  return useContext(LocaleContext)
}

export function useCopy(): AppCopy {
  return APP_COPY[useLocale()]
}
