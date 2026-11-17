import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  WAITLIST_SAVE_PLACES,
  saveWaitlistResponseRequestSchema,
  type SaveWaitlistResponseRequest,
} from './index.js'

const first: SaveWaitlistResponseRequest = {
  locale: 'ko',
  headline: 'forgot',
  savePlaces: ['instagram', 'browser'],
}

const complete: SaveWaitlistResponseRequest = {
  ...first,
  revisitFrequency: 'almost_never',
  mostHelpful: 'resurfacing',
  willingnessToPay: 'maybe',
  email: 'someone@example.com',
}

describe('saveWaitlistResponseRequestSchema', () => {
  it('첫 질문의 답만 있는 요청을 받는다', () => {
    expect(saveWaitlistResponseRequestSchema.parse(first)).toEqual(first)
  })

  it('네 질문의 답과 이메일이 모두 있는 요청을 받는다', () => {
    expect(saveWaitlistResponseRequestSchema.parse(complete)).toEqual(complete)
  })

  it('복수 선택에서 다 빼면 빈 배열이다', () => {
    expect(saveWaitlistResponseRequestSchema.safeParse({ ...first, savePlaces: [] }).success).toBe(
      true,
    )
  })

  it('쌓이는 곳의 선택지는 일곱 개다', () => {
    expect(WAITLIST_SAVE_PLACES).toEqual([
      'instagram',
      'youtube',
      'reddit',
      'x',
      'browser',
      'notes',
      'other',
    ])
    expect(
      saveWaitlistResponseRequestSchema.safeParse({
        ...first,
        savePlaces: [...WAITLIST_SAVE_PLACES],
      }).success,
    ).toBe(true)
  })

  it.each([
    ['savePlaces', ['tiktok']],
    ['savePlaces', ['instagram', 'instagram']],
    ['savePlaces', 'instagram'],
    ['revisitFrequency', 'daily'],
    ['mostHelpful', 'tags'],
    ['willingnessToPay', 'yes, a few dollars a month'],
    ['locale', 'ja'],
    ['headline', 'other'],
    ['revisitFrequency', null],
  ])('%s 가 정의되지 않은 값 %j 이면 거부한다', (field, value) => {
    expect(saveWaitlistResponseRequestSchema.safeParse({ ...first, [field]: value }).success).toBe(
      false,
    )
  })

  it.each(['savePlaces', 'locale', 'headline'] as const)('%s 가 빠지면 거부한다', (field) => {
    const request: Partial<SaveWaitlistResponseRequest> = { ...first }
    delete request[field]
    expect(saveWaitlistResponseRequestSchema.safeParse(request).success).toBe(false)
  })

  it('이메일은 앞뒤 공백을 떼고 소문자로 바꾼다', () => {
    const parsed = saveWaitlistResponseRequestSchema.parse({
      ...first,
      email: '  Some.One@Example.COM \n',
    })
    expect(parsed.email).toBe('some.one@example.com')
  })

  it.each(['', '   ', 'someone', 'someone@', '@example.com', 'a b@example.com', 'a@b'])(
    '이메일 "%s" 은 형식이 틀려 거부한다',
    (email) => {
      expect(saveWaitlistResponseRequestSchema.safeParse({ ...first, email }).success).toBe(false)
    },
  )

  it('254자를 넘는 이메일은 거부한다', () => {
    const email = `${'a'.repeat(243)}@example.com`
    expect(email.length).toBe(255)
    expect(saveWaitlistResponseRequestSchema.safeParse({ ...first, email }).success).toBe(false)
  })
})

describe('ERROR_CODES', () => {
  it('요청 한도 초과의 코드가 있다', () => {
    expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED')
  })
})
