import { ApiError } from '@rebomi/api-client'
import { ERROR_CODES } from '@rebomi/api-contract'
import type { Locale } from '@/lib/locale'
import type { AppCopy } from '@/shell/copy'

const DAY_MS = 24 * 60 * 60 * 1000

const INTL_LOCALES: Record<Locale, string> = { ko: 'ko-KR', en: 'en-US' }

const startOfDay = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate())

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/**
 * 저장일을 지금으로부터의 거리로 적는다: "방금 · 5분 전 · 3시간 전 · 어제 · 2일 전".
 * 달력으로 7일이 넘으면 날짜로 적는다. 날짜 경계는 보는 사람의 시간대 기준이다.
 */
export function formatSaved(savedAt: string, now: Date, locale: Locale, copy: AppCopy): string {
  const saved = new Date(savedAt)
  const intlLocale = INTL_LOCALES[locale]
  const relative = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'always' })

  const days = Math.round((startOfDay(now).getTime() - startOfDay(saved).getTime()) / DAY_MS)
  if (days >= 7) {
    return new Intl.DateTimeFormat(intlLocale, { dateStyle: 'medium' }).format(saved)
  }
  // 하루 전만 낱말로 적는다("어제"). 이틀 전부터는 숫자다 — "그저께"가 아니라 "2일 전".
  if (days === 1) {
    const worded = new Intl.RelativeTimeFormat(intlLocale, { numeric: 'auto' })
    return capitalize(worded.format(-1, 'day'))
  }
  if (days > 1) return relative.format(-days, 'day')

  // 같은 날이다. 시계가 어긋나 미래로 보이는 것도 "방금"이다.
  const minutes = Math.floor((now.getTime() - saved.getTime()) / 60_000)
  if (minutes < 1) return copy.saved.justNow
  if (minutes < 60) return relative.format(-minutes, 'minute')
  return relative.format(-Math.floor(minutes / 60), 'hour')
}

/** 서버에 닿지 못한 오류인가. */
function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && error.code === ERROR_CODES.NETWORK
}

/** 저장 실패를 사용자에게 보일 문구로 바꾼다. 분기는 에러 코드로만 한다. */
export function saveErrorMessage(error: unknown, copy: AppCopy): string {
  if (isUnreachable(error)) return copy.errors.unreachable
  if (error instanceof ApiError && error.code === ERROR_CODES.VALIDATION_FAILED) {
    return copy.saveDialog.invalid
  }
  return copy.saveDialog.failed
}

/** 목록을 받지 못한 이유를 사용자에게 보일 문구로 바꾼다. */
export function listErrorMessage(error: unknown, copy: AppCopy): string {
  return isUnreachable(error) ? copy.errors.unreachable : copy.errors.list
}
