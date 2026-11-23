import type { SearchMatch, SearchMatchField } from '@rebomi/api-contract'

/** 글의 한 조각. `hit` 이면 검색어와 일치한 부분이다. */
export type Segment = { text: string; hit: boolean }

/**
 * 글을 일치한 구간과 그 사이로 나눈다. 구간은 계약대로 앞에서부터 겹치지 않게 온다고
 * 보되, 어긋난 구간(글 밖, 뒤로 가는 것)은 건너뛴다 — 강조가 틀려도 글은 온전히 보인다.
 */
export function segmentsOf(text: string, ranges: SearchMatch['ranges']): Segment[] {
  const segments: Segment[] = []
  let cursor = 0

  for (const { start, end } of ranges) {
    if (start < cursor || end <= start || end > text.length) continue
    if (start > cursor) segments.push({ text: text.slice(cursor, start), hit: false })
    segments.push({ text: text.slice(start, end), hit: true })
    cursor = end
  }
  if (cursor < text.length) segments.push({ text: text.slice(cursor), hit: false })

  return segments
}

/** 근거로 보일 순서. 글의 내용에 가까운 것이 먼저다. */
const PRIORITY: SearchMatchField[] = ['body', 'description', 'title', 'url']

/** 결과 하나에서 화면에 보일 근거 하나를 고른다. */
export function pickMatch(matches: SearchMatch[]): SearchMatch | null {
  for (const field of PRIORITY) {
    const match = matches.find((candidate) => candidate.field === field)
    if (match) return match
  }
  return null
}

/** 일치한 글자들. 같은 것은 한 번만. */
export function matchedWords(match: SearchMatch): string[] {
  const words = segmentsOf(match.text, match.ranges)
    .filter((segment) => segment.hit)
    .map((segment) => segment.text)
  return [...new Set(words)]
}
