import { describe, expect, it } from 'vitest'
import { LANDING_LOCALE, pickHeadline, pickHero } from './locale'

describe('LANDING_LOCALE', () => {
  it('랜딩은 지금 영어로만 보인다', () => {
    expect(LANDING_LOCALE).toBe('en')
  })
})

describe('pickHeadline', () => {
  it.each(['progress', 'forgot', 'scattered', 'find'] as const)(
    '"%s" 를 그대로 고른다',
    (value) => {
      expect(pickHeadline(value)).toBe(value)
    },
  )

  it.each([undefined, '', 'other', 'FIND', 'constructor'])(
    '없거나 모르는 값 %s 이면 기본 헤드라인이다',
    (value) => {
      expect(pickHeadline(value)).toBe('progress')
    },
  )

  it('같은 파라미터가 여러 번 오면 첫 값을 본다', () => {
    expect(pickHeadline(['find', 'scattered'])).toBe('find')
    expect(pickHeadline(['nope', 'find'])).toBe('progress')
  })
})

describe('pickHero', () => {
  it.each(['none', 'card', 'notice', 'phone'] as const)('"%s" 를 그대로 고른다', (value) => {
    expect(pickHero(value)).toBe(value)
  })

  it.each([undefined, '', 'video', 'CARD', 'constructor'])(
    '없거나 모르는 값 %s 이면 글만이다',
    (value) => {
      expect(pickHero(value)).toBe('none')
    },
  )

  it('같은 파라미터가 여러 번 오면 첫 값을 본다', () => {
    expect(pickHero(['card', 'phone'])).toBe('card')
  })
})
