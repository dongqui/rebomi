import { describe, expect, it } from 'vitest'
import {
  ERROR_CODES,
  WAITLIST_FRUSTRATIONS,
  WAITLIST_HEADLINES,
  WAITLIST_HEROES,
  WAITLIST_OTHER_MAX_LENGTH,
  saveWaitlistResponseRequestSchema,
  waitlistAnswersOf,
  type SaveWaitlistResponseRequest,
} from './index.js'

const first: SaveWaitlistResponseRequest = {
  locale: 'ko',
  headline: 'progress',
  hero: 'none',
  occupation: 'employed',
}

const complete: SaveWaitlistResponseRequest = {
  ...first,
  saveIntent: 'learn',
  frustration: 'forget',
  wantedHelp: 'rediscover',
  email: 'someone@example.com',
}

describe('saveWaitlistResponseRequestSchema', () => {
  it('첫 질문의 답만 있는 요청을 받는다', () => {
    expect(saveWaitlistResponseRequestSchema.parse(first)).toEqual(first)
  })

  it('네 질문의 답과 이메일이 모두 있는 요청을 받는다', () => {
    expect(saveWaitlistResponseRequestSchema.parse(complete)).toEqual(complete)
  })

  it('헤드라인은 넷, 첫 화면 그림은 넷이다', () => {
    expect(WAITLIST_HEADLINES).toEqual(['progress', 'forgot', 'scattered', 'find'])
    expect(WAITLIST_HEROES).toEqual(['none', 'card', 'notice', 'phone'])
  })

  it('가장 답답한 점에는 "불편하지 않다"와 "기타"가 있다', () => {
    expect(WAITLIST_FRUSTRATIONS).toContain('none')
    expect(WAITLIST_FRUSTRATIONS.at(-1)).toBe('other')
  })

  it.each([
    ['occupation', 'student'],
    ['saveIntent', 'hoard'],
    ['frustration', 'everything'],
    ['wantedHelp', 'tags'],
    ['locale', 'ja'],
    ['headline', 'other'],
    ['hero', 'video'],
    ['occupation', null],
    ['occupation', ['employed']],
  ])('%s 가 정의되지 않은 값 %j 이면 거부한다', (field, value) => {
    expect(saveWaitlistResponseRequestSchema.safeParse({ ...first, [field]: value }).success).toBe(
      false,
    )
  })

  it.each(['locale', 'headline', 'hero'] as const)('%s 가 빠지면 거부한다', (field) => {
    const request: Partial<SaveWaitlistResponseRequest> = { ...first }
    delete request[field]
    expect(saveWaitlistResponseRequestSchema.safeParse(request).success).toBe(false)
  })

  it('"기타"에 적은 글은 앞뒤 공백을 뗀다', () => {
    const parsed = saveWaitlistResponseRequestSchema.parse({
      ...first,
      occupation: 'other',
      occupationOther: '  육아 중이에요 \n',
    })
    expect(parsed.occupationOther).toBe('육아 중이에요')
  })

  it('"기타"에 공백만 적으면 적지 않은 것과 같다', () => {
    const parsed = saveWaitlistResponseRequestSchema.parse({
      ...first,
      occupation: 'other',
      occupationOther: '   ',
    })
    expect(parsed.occupationOther).toBeUndefined()
  })

  it('"기타"에 적은 글이 너무 길면 거부한다', () => {
    const occupationOther = 'a'.repeat(WAITLIST_OTHER_MAX_LENGTH + 1)
    expect(
      saveWaitlistResponseRequestSchema.safeParse({ ...first, occupation: 'other', occupationOther })
        .success,
    ).toBe(false)
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

describe('waitlistAnswersOf', () => {
  const answersOf = (request: SaveWaitlistResponseRequest) =>
    waitlistAnswersOf(saveWaitlistResponseRequestSchema.parse(request))

  it('답하지 않은 질문은 null 이다', () => {
    expect(answersOf(first)).toEqual({
      locale: 'ko',
      headline: 'progress',
      hero: 'none',
      occupation: 'employed',
      occupationOther: null,
      saveIntent: null,
      saveIntentOther: null,
      frustration: null,
      frustrationOther: null,
      wantedHelp: null,
      wantedHelpOther: null,
    })
  })

  it('"기타"를 고른 질문의 글만 남긴다', () => {
    const answers = answersOf({
      ...first,
      occupation: 'other',
      occupationOther: '육아 중이에요',
      // 기타를 골랐다가 다른 답으로 바꾼 경우: 적어 둔 글이 따라와도 버린다.
      saveIntent: 'learn',
      saveIntentOther: '남은 글',
    })

    expect(answers.occupationOther).toBe('육아 중이에요')
    expect(answers.saveIntentOther).toBeNull()
  })

  it('이메일은 넣지 않는다', () => {
    expect(answersOf(complete)).not.toHaveProperty('email')
  })
})

describe('ERROR_CODES', () => {
  it('요청 한도 초과의 코드가 있다', () => {
    expect(ERROR_CODES.RATE_LIMITED).toBe('RATE_LIMITED')
  })
})
