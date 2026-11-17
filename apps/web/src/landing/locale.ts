import {
  WAITLIST_HEADLINES,
  type WaitlistHeadline,
  type WaitlistLocale,
} from '@rebomi/api-contract'

/**
 * 요청의 `Accept-Language` 로 랜딩의 언어를 정한다 (waitlist.md WAIT-5).
 *
 * 가장 선호하는 언어 하나만 본다. 그것이 한국어면 한국어, 아니면 영어다 — 영어를 먼저 둔
 * 방문자에게 뒤에 한국어가 있다는 이유로 한국어를 보이지 않는다.
 */
export function pickLocale(acceptLanguage: string | null | undefined): WaitlistLocale {
  let best: { tag: string; q: number } | null = null

  for (const part of (acceptLanguage ?? '').split(',')) {
    const [rawTag = '', ...params] = part.split(';')
    const tag = rawTag.trim().toLowerCase()
    if (tag === '' || tag === '*') continue

    const qParam = params.map((param) => param.trim()).find((param) => param.startsWith('q='))
    const q = qParam === undefined ? 1 : Number(qParam.slice(2))
    if (!(q > 0)) continue

    // 같은 q면 먼저 적힌 쪽이 이긴다.
    if (best === null || q > best.q) best = { tag, q }
  }

  return best !== null && (best.tag === 'ko' || best.tag.startsWith('ko-')) ? 'ko' : 'en'
}

export const DEFAULT_HEADLINE: WaitlistHeadline = 'forgot'

/**
 * 주소의 `?h=` 로 헤드라인(광고 소재)을 고른다 (WAIT-6). 없거나 모르는 값이면 기본이다.
 */
export function pickHeadline(value: string | string[] | undefined): WaitlistHeadline {
  const first = Array.isArray(value) ? value[0] : value
  return WAITLIST_HEADLINES.find((headline) => headline === first) ?? DEFAULT_HEADLINE
}
