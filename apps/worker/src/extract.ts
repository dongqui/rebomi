import { Readability } from '@mozilla/readability'
import { parseHTML } from 'linkedom'

/**
 * 가져온 HTML에서 메타데이터와 본문을 뽑는다 (capture.md §5).
 *
 * 규칙 기반이다 — AI를 쓰지 않는다. 원본 HTML은 여기서 버리고 텍스트만 남긴다.
 */

export const EXTRACT_LIMITS = {
  title: 500,
  description: 2_000,
  imageUrl: 2_048,
  /** 본문 텍스트의 상한(글자 수). 넘는 부분은 자른다. */
  bodyText: 200_000,
} as const

export type ExtractedPage = {
  title: string | null
  /** 페이지가 스스로 밝힌 설명. 요약이 아니다. */
  description: string | null
  /** 절대 http(s) 주소. */
  imageUrl: string | null
  /** 본문 텍스트. 본문을 찾지 못하면 null. */
  bodyText: string | null
}

/** Postgres의 text는 NUL을 담지 못한다. 공백을 정리하고 비면 null. */
function clean(value: string | null | undefined, limit: number): string | null {
  if (!value) return null
  const text = value.replaceAll('\u0000', '').replace(/\s+/g, ' ').trim()
  return text === '' ? null : text.slice(0, limit)
}

/** 줄바꿈은 살리고 줄 안의 공백만 정리한다. 빈 줄은 하나로 줄인다. */
function cleanBody(value: string | null | undefined): string | null {
  if (!value) return null
  const text = value
    .replaceAll('\u0000', '')
    .split(/\r?\n/)
    .map((line) => line.replace(/[^\S\n]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
  return text === '' ? null : text.slice(0, EXTRACT_LIMITS.bodyText)
}

function absoluteHttpUrl(value: string | null, base: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const text = url.toString()
    return text.length > EXTRACT_LIMITS.imageUrl ? null : text
  } catch {
    return null
  }
}

/**
 * @param pageUrl 리다이렉트를 따라간 뒤의 주소. 상대 경로 이미지의 기준이다.
 */
export function extractPage(html: string, pageUrl: string): ExtractedPage {
  const { document } = parseHTML(html)

  const meta = (...selectors: string[]): string | null => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute('content')
      if (value && value.trim() !== '') return value
    }
    return null
  }

  // Readability가 문서를 고쳐 쓰므로 메타데이터를 먼저 읽는다.
  const title = clean(
    meta('meta[property="og:title"]', 'meta[name="og:title"]') ??
      document.querySelector('title')?.textContent,
    EXTRACT_LIMITS.title,
  )
  const description = clean(
    meta(
      'meta[property="og:description"]',
      'meta[name="og:description"]',
      'meta[name="description"]',
    ),
    EXTRACT_LIMITS.description,
  )
  const imageUrl = absoluteHttpUrl(
    meta(
      'meta[property="og:image"]',
      'meta[name="og:image"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
    )?.trim() ?? null,
    pageUrl,
  )

  let bodyText: string | null = null
  try {
    // linkedom의 문서는 DOM 표준의 Document와 타입이 다르지만 Readability가 쓰는 범위는 같다.
    const article = new Readability(
      document as unknown as ConstructorParameters<typeof Readability>[0],
    ).parse()
    bodyText = cleanBody(article?.textContent)
  } catch {
    // 본문을 못 찾은 것으로 본다. 메타데이터는 그대로 쓴다.
  }

  return { title, description, imageUrl, bodyText }
}
