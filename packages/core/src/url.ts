import { InvalidUrlError } from './errors.js'

/** 정확히 일치하면 제거하는 트래킹 파라미터. */
const TRACKING_PARAMS = new Set(['fbclid', 'gclid', 'igshid', 'ref'])

/** 접두사가 일치하면 제거하는 트래킹 파라미터. */
const TRACKING_PREFIXES = ['utm_']

const isTracking = (key: string): boolean =>
  TRACKING_PARAMS.has(key) || TRACKING_PREFIXES.some((prefix) => key.startsWith(prefix))

/**
 * URL을 중복 판정에 쓸 수 있는 정규형으로 바꾼다 (PRD 4.1).
 *
 * 호스트를 소문자로, 기본 포트와 프래그먼트를 제거하고, 트래킹 파라미터를 걷어낸 뒤
 * 남은 쿼리를 정렬해 순서만 다른 URL이 같은 문자열이 되게 한다.
 *
 * @throws {InvalidUrlError} http(s) URL로 해석할 수 없는 입력
 */
export function normalizeUrl(input: string): string {
  let url: URL
  try {
    url = new URL(input)
  } catch {
    throw new InvalidUrlError(input)
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new InvalidUrlError(input)
  }

  url.hash = ''

  const kept = [...url.searchParams.entries()]
    .filter(([key]) => !isTracking(key))
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))

  url.search = ''
  for (const [key, value] of kept) {
    url.searchParams.append(key, value)
  }

  const serialized = url.toString()
  const hasEmptyPath = url.pathname === '/' && url.search === ''
  return hasEmptyPath ? serialized.replace(/\/$/, '') : serialized
}
