import { z } from 'zod'
import { contentSchema } from './content.js'
import { toResponseJsonSchema } from './json-schema.js'

/*
 * 키워드 검색 (search.md SRCH-1, SRCH-4).
 *
 * 검색어는 주소가 아니라 요청 본문으로 보낸다 — 주소는 서버 로그에 남는다.
 */

/** 검색어의 상한(글자 수). 앞뒤 공백을 뗀 뒤에 센다. */
export const SEARCH_QUERY_MAX_LENGTH = 200
/** 검색어를 공백으로 나눈 단어 수의 상한. */
export const SEARCH_MAX_TERMS = 10
/** 검색 결과 한 페이지의 기본 크기와 상한. */
export const SEARCH_DEFAULT_LIMIT = 20
export const SEARCH_MAX_LIMIT = 50

/**
 * 검색어를 단어로 나눈다. 공백이 경계다. 결과에는 모든 단어가 들어 있는 콘텐츠만 온다.
 * `OR`, `-`, 따옴표 같은 검색 문법은 없다 — 글자 그대로 찾는다.
 */
export function searchTermsOf(query: string): string[] {
  return query.split(/\s+/u).filter((term) => term !== '')
}

/** 검색 요청. */
export const searchRequestSchema = z.object({
  query: z
    .string()
    .trim()
    .min(1)
    .max(SEARCH_QUERY_MAX_LENGTH)
    .refine((query) => searchTermsOf(query).length <= SEARCH_MAX_TERMS, {
      message: `단어는 ${SEARCH_MAX_TERMS}개까지 쓸 수 있습니다`,
    }),
  limit: z.number().int().min(1).max(SEARCH_MAX_LIMIT).default(SEARCH_DEFAULT_LIMIT),
  /** 같은 검색어로 받은 이전 응답의 `nextCursor`. 없으면 첫 페이지. */
  cursor: z.string().min(1).max(512).optional(),
})

/** 클라이언트가 넘기는 검색 조건. */
export type SearchRequest = z.input<typeof searchRequestSchema>

/** 검색어가 일치한 곳. 도메인에서 일치한 것은 `url` 로 온다. */
export const searchMatchFieldSchema = z.enum(['title', 'url', 'description', 'body'])
export type SearchMatchField = z.infer<typeof searchMatchFieldSchema>

/**
 * 매칭 근거 하나: 어디에서, 어떤 글의 어느 부분이 일치했는가.
 *
 * `text` 는 HTML이 아닌 글 그대로다. 화면은 `ranges` 의 위치를 강조해서 그린다.
 */
export const searchMatchSchema = z.object({
  field: searchMatchFieldSchema,
  /** 일치한 부분을 담은 글. 본문은 일치한 곳 주변의 조각이고, 나머지는 그 값 전체다. */
  text: z.string(),
  /**
   * `text` 안에서 일치한 구간. `start` 부터 `end` 앞까지이고, JS 문자열의 위치(UTF-16
   * 코드 단위)다 — `text.slice(start, end)` 가 일치한 글자다. 앞에서부터 순서대로 오고
   * 겹치지 않는다.
   */
  ranges: z.array(z.object({ start: z.number().int().min(0), end: z.number().int().min(0) })),
})
export type SearchMatch = z.infer<typeof searchMatchSchema>

/** 검색 결과 하나. 추출 수준은 `content.extractionLevel` 에 있다. */
export const searchResultSchema = z.object({
  content: contentSchema,
  /** 왜 이 콘텐츠가 나왔는지. 하나 이상 온다. */
  matches: z.array(searchMatchSchema),
})
export type SearchResult = z.infer<typeof searchResultSchema>

/** 검색 응답. 관련도가 높은 것부터 온다. 일치가 없으면 `items` 가 빈 배열이다. */
export const searchResponseSchema = z.object({
  items: z.array(searchResultSchema),
  /** 다음 페이지를 요청할 때 같은 검색어와 함께 돌려보내는 불투명한 값. 더 없으면 null. */
  nextCursor: z.string().nullable(),
})
export type SearchResponse = z.infer<typeof searchResponseSchema>

export const searchResponseJsonSchema = toResponseJsonSchema(searchResponseSchema)
