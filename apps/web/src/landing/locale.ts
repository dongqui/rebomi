import {
  WAITLIST_HEADLINES,
  WAITLIST_HEROES,
  type WaitlistHeadline,
  type WaitlistHero,
  type WaitlistLocale,
} from '@rebomi/api-contract'

/**
 * 랜딩의 언어 (WAIT-5). 지금은 방문자의 브라우저 언어와 무관하게 영어다 (2026-11-20).
 * 한국어 문구는 `copy.ts` 에 그대로 있다 — 다시 고르게 할 때 여기서 정한다.
 */
export const LANDING_LOCALE: WaitlistLocale = 'en'

export const DEFAULT_HEADLINE: WaitlistHeadline = 'progress'
/** 글만. */
export const DEFAULT_HERO: WaitlistHero = 'none'

const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)

/**
 * 주소의 `?h=` 로 헤드라인(광고 소재)을 고른다 (WAIT-6). 없거나 모르는 값이면 기본이다.
 */
export function pickHeadline(value: string | string[] | undefined): WaitlistHeadline {
  return WAITLIST_HEADLINES.find((headline) => headline === first(value)) ?? DEFAULT_HEADLINE
}

/**
 * 주소의 `?hero=` 로 첫 화면 그림(광고 소재)을 고른다 (WAIT-10). 없거나 모르는 값이면 글만이다.
 */
export function pickHero(value: string | string[] | undefined): WaitlistHero {
  return WAITLIST_HEROES.find((hero) => hero === first(value)) ?? DEFAULT_HERO
}
