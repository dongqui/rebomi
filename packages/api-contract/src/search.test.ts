import { describe, expect, it } from 'vitest'
import {
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
  SEARCH_MAX_TERMS,
  SEARCH_QUERY_MAX_LENGTH,
  searchRequestSchema,
  searchResponseSchema,
  searchTermsOf,
} from './search.js'

describe('searchTermsOf', () => {
  it('공백으로 나누고 빈 조각은 버린다', () => {
    expect(searchTermsOf('  검색   postgres\t엔진\n')).toEqual(['검색', 'postgres', '엔진'])
  })

  it('검색 문법처럼 보이는 글자도 그대로 단어다', () => {
    expect(searchTermsOf('a OR -b "c"')).toEqual(['a', 'OR', '-b', '"c"'])
  })
})

describe('searchRequestSchema', () => {
  it('앞뒤 공백을 떼고, 크기를 생략하면 기본값을 준다', () => {
    expect(searchRequestSchema.parse({ query: '  검색엔진 ' })).toEqual({
      query: '검색엔진',
      limit: SEARCH_DEFAULT_LIMIT,
    })
  })

  it('빈 검색어와 공백뿐인 검색어를 거부한다', () => {
    expect(searchRequestSchema.safeParse({ query: '' }).success).toBe(false)
    expect(searchRequestSchema.safeParse({ query: '   ' }).success).toBe(false)
    expect(searchRequestSchema.safeParse({}).success).toBe(false)
  })

  it('상한까지는 받고, 넘는 검색어는 거부한다', () => {
    const atLimit = '가'.repeat(SEARCH_QUERY_MAX_LENGTH)
    expect(searchRequestSchema.safeParse({ query: atLimit }).success).toBe(true)
    expect(searchRequestSchema.safeParse({ query: `${atLimit}가` }).success).toBe(false)
  })

  it('앞뒤 공백은 길이에 세지 않는다', () => {
    const padded = `  ${'가'.repeat(SEARCH_QUERY_MAX_LENGTH)}  `
    expect(searchRequestSchema.safeParse({ query: padded }).success).toBe(true)
  })

  it('단어가 상한을 넘으면 거부한다', () => {
    const words = (count: number) => Array.from({ length: count }, (_, i) => `w${i}`).join(' ')
    expect(searchRequestSchema.safeParse({ query: words(SEARCH_MAX_TERMS) }).success).toBe(true)
    expect(searchRequestSchema.safeParse({ query: words(SEARCH_MAX_TERMS + 1) }).success).toBe(
      false,
    )
  })

  it('크기는 1부터 상한까지의 정수만 받는다', () => {
    const withLimit = (limit: unknown) => searchRequestSchema.safeParse({ query: 'a', limit })
    expect(withLimit(1).success).toBe(true)
    expect(withLimit(SEARCH_MAX_LIMIT).success).toBe(true)
    expect(withLimit(0).success).toBe(false)
    expect(withLimit(SEARCH_MAX_LIMIT + 1).success).toBe(false)
    expect(withLimit(1.5).success).toBe(false)
    expect(withLimit('10').success).toBe(false)
  })
})

describe('searchResponseSchema', () => {
  const content = {
    id: '7f1c1a52-3f0e-4c58-9d6f-0c2a8f1f6f10',
    url: 'https://example.com/a',
    title: '검색엔진',
    description: null,
    domain: 'example.com',
    imageUrl: null,
    savedAt: '2026-11-18T00:00:00.000Z',
    source: 'web',
    archiveState: 'inbox',
    linkState: 'ok',
    extractionLevel: 'metadata_only',
    summaryStatus: 'pending',
    metadataStatus: 'pending',
    resurfacingIncluded: true,
  }

  it('콘텐츠와 근거를 담은 결과를 받는다', () => {
    const response = {
      items: [
        {
          content,
          matches: [{ field: 'title', text: '검색엔진', ranges: [{ start: 0, end: 2 }] }],
        },
      ],
      nextCursor: null,
    }
    expect(searchResponseSchema.parse(response)).toEqual(response)
  })

  it('빈 결과를 받는다', () => {
    expect(searchResponseSchema.parse({ items: [], nextCursor: null }).items).toEqual([])
  })

  it('모르는 곳의 근거는 거부한다', () => {
    const response = {
      items: [{ content, matches: [{ field: 'memo', text: 'x', ranges: [] }] }],
      nextCursor: null,
    }
    expect(searchResponseSchema.safeParse(response).success).toBe(false)
  })
})
