import { describe, expect, it } from 'vitest'
import { pickHeadline, pickLocale } from './locale'

describe('pickLocale', () => {
  it.each([
    ['ko', 'ko'],
    ['ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7', 'ko'],
    ['KO-kr', 'ko'],
    ['en-US,en;q=0.9', 'en'],
    ['ja,en;q=0.8', 'en'],
    ['fr-FR', 'en'],
  ])('Accept-Language "%s" → %s', (header, locale) => {
    expect(pickLocale(header)).toBe(locale)
  })

  it('가장 선호하는 언어만 본다 — 한국어가 뒤에 있으면 영어다', () => {
    expect(pickLocale('en-US,en;q=0.9,ko;q=0.8')).toBe('en')
  })

  it('순서가 아니라 q 값으로 선호를 정한다', () => {
    expect(pickLocale('en;q=0.5, ko;q=0.9')).toBe('ko')
  })

  it('"kok"(콘칸어)처럼 ko로 시작만 하는 언어는 한국어가 아니다', () => {
    expect(pickLocale('kok')).toBe('en')
  })

  it.each([null, undefined, '', '*', ';;;', 'ko;q=0'])('헤더가 %s 이면 영어다', (header) => {
    expect(pickLocale(header)).toBe('en')
  })
})

describe('pickHeadline', () => {
  it.each(['forgot', 'scattered', 'find'] as const)('"%s" 를 그대로 고른다', (value) => {
    expect(pickHeadline(value)).toBe(value)
  })

  it.each([undefined, '', 'other', 'FIND', 'constructor'])(
    '없거나 모르는 값 %s 이면 기본 헤드라인이다',
    (value) => {
      expect(pickHeadline(value)).toBe('forgot')
    },
  )

  it('같은 파라미터가 여러 번 오면 첫 값을 본다', () => {
    expect(pickHeadline(['find', 'scattered'])).toBe('find')
    expect(pickHeadline(['nope', 'find'])).toBe('forgot')
  })
})
