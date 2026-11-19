import { WAITLIST_HEADLINES, type WaitlistHeadline } from '@rebomi/api-contract'

// 언어를 고르는 규칙은 앱 화면도 함께 쓴다.
export { pickLocale } from '@/lib/locale'

export const DEFAULT_HEADLINE: WaitlistHeadline = 'forgot'

/**
 * 주소의 `?h=` 로 헤드라인(광고 소재)을 고른다 (WAIT-6). 없거나 모르는 값이면 기본이다.
 */
export function pickHeadline(value: string | string[] | undefined): WaitlistHeadline {
  const first = Array.isArray(value) ? value[0] : value
  return WAITLIST_HEADLINES.find((headline) => headline === first) ?? DEFAULT_HEADLINE
}
