import { Readability } from '@mozilla/readability'
import { CONTENT_SAVE_LIMITS } from '@rebomi/api-contract'

/**
 * 사용자가 보고 있는 페이지에서 뽑은 것 (capture.md CAP-2). 서버로 보낼 값이라
 * 저장 요청의 상한(`CONTENT_SAVE_LIMITS`)에 맞춰 잘라 둔다 — 서버는 넘으면 자르지 않고 거부한다.
 */
export type CapturedPage = {
  title: string | null
  /** 페이지가 스스로 밝힌 설명. 요약이 아니다. */
  description: string | null
  /** 절대 http(s) 주소. */
  imageUrl: string | null
  /** 본문 텍스트. 화면에 텍스트가 없으면 null. */
  body: string | null
}

/** 공백을 정리하고 비면 null. Postgres의 text는 NUL을 담지 못한다. */
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
  return text === '' ? null : text.slice(0, CONTENT_SAVE_LIMITS.body)
}

function absoluteHttpUrl(value: string | null, base: string): string | null {
  if (!value) return null
  try {
    const url = new URL(value, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const text = url.toString()
    return text.length > CONTENT_SAVE_LIMITS.imageUrl ? null : text
  } catch {
    return null
  }
}

/** Readability로 뽑은 본문. 기사 구조를 찾지 못하면 null. */
function readableText(document: Document): string | null {
  try {
    // Readability는 문서를 고쳐 쓴다. 사용자가 보는 페이지를 건드리지 않게 복사본에 돌린다.
    const copy = document.cloneNode(true) as Document
    return cleanBody(new Readability(copy).parse()?.textContent)
  } catch {
    return null
  }
}

/**
 * 화면에 보이는 텍스트. Readability가 실패하는 페이지(SNS 피드·게시물 등)의 대체 수단이다.
 * 메뉴·댓글 같은 잡음이 섞일 수 있지만 사용자가 본 내용은 들어 있다.
 */
function visibleText(document: Document): string | null {
  const body = document.body as HTMLElement | null
  if (!body) return null

  // 브라우저의 innerText는 숨겨진 요소와 스크립트·스타일을 빼고 화면의 줄바꿈을 따른다.
  // innerText가 없는 환경(테스트의 jsdom)에서는 텍스트가 아닌 요소를 직접 뺀다.
  if (typeof body.innerText === 'string') return cleanBody(body.innerText)

  const copy = body.cloneNode(true) as HTMLElement
  for (const element of copy.querySelectorAll('script, style, noscript, template')) element.remove()
  return cleanBody(copy.textContent)
}

/**
 * 렌더링된 문서에서 메타데이터와 본문을 뽑는다. 규칙 기반이고, 문서를 고치지 않는다.
 *
 * 제목·설명·이미지를 고르는 순서는 서버의 추출(`apps/worker/src/extract.ts`)과 같다.
 * 본문은 Readability → 화면의 텍스트 순이다.
 *
 * @param pageUrl 지금 페이지의 주소. 상대 경로 이미지의 기준이다.
 */
export function extractPage(document: Document, pageUrl: string): CapturedPage {
  const meta = (...selectors: string[]): string | null => {
    for (const selector of selectors) {
      const value = document.querySelector(selector)?.getAttribute('content')
      if (value && value.trim() !== '') return value
    }
    return null
  }

  return {
    title: clean(
      meta('meta[property="og:title"]', 'meta[name="og:title"]') ??
        document.querySelector('title')?.textContent,
      CONTENT_SAVE_LIMITS.title,
    ),
    description: clean(
      meta(
        'meta[property="og:description"]',
        'meta[name="og:description"]',
        'meta[name="description"]',
      ),
      CONTENT_SAVE_LIMITS.description,
    ),
    imageUrl: absoluteHttpUrl(
      meta(
        'meta[property="og:image"]',
        'meta[name="og:image"]',
        'meta[name="twitter:image"]',
        'meta[property="twitter:image"]',
      )?.trim() ?? null,
      pageUrl,
    ),
    body: readableText(document) ?? visibleText(document),
  }
}
