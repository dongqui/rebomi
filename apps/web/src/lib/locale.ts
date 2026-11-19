/** 화면 언어. 랜딩과 앱이 함께 쓴다. */
export type Locale = 'ko' | 'en'

/**
 * 요청의 `Accept-Language` 로 화면 언어를 정한다 (waitlist.md WAIT-5).
 *
 * 가장 선호하는 언어 하나만 본다. 그것이 한국어면 한국어, 아니면 영어다 — 영어를 먼저 둔
 * 방문자에게 뒤에 한국어가 있다는 이유로 한국어를 보이지 않는다.
 */
export function pickLocale(acceptLanguage: string | null | undefined): Locale {
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
