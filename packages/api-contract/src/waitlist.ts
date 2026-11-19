import { z } from 'zod'

/*
 * 대기 명단 랜딩의 설문 응답 (waitlist.md).
 *
 * 답은 화면 문구가 아니라 언어와 무관한 고정 키로 주고받는다 — 한국어와 영어 응답을
 * 함께 집계할 수 있어야 한다. 값 이름은 `@rebomi/db` 의 waitlist_responses 테이블과 같다.
 *
 * 질문은 넷이고 모두 하나만 고른다. 마지막 선택지 `other` 를 고르면 직접 적은 글이
 * 따라온다.
 */

/** 지금 주로 하는 일. */
export const WAITLIST_OCCUPATIONS = [
  'studying',
  'employed',
  'freelance',
  'own_business',
  'creator',
  'other',
] as const
/** 저장할 때 그걸로 하고 싶은 것. */
export const WAITLIST_SAVE_INTENTS = [
  'learn',
  'work',
  'try',
  'enjoy',
  'reference',
  'other',
] as const
/** 저장한 것과 관련해 가장 답답한 점. */
export const WAITLIST_FRUSTRATIONS = [
  'forget',
  'cant_find',
  'too_many',
  'no_time',
  'never_use',
  'none',
  'other',
] as const
/** Rebomi가 한 가지를 도와준다면. */
export const WAITLIST_WANTED_HELPS = [
  'rediscover',
  'find',
  'pick',
  'use',
  'one_place',
  'other',
] as const
/** 방문자가 본 언어. */
export const WAITLIST_LOCALES = ['ko', 'en'] as const
/** 방문자가 본 헤드라인 (광고 소재). */
export const WAITLIST_HEADLINES = ['progress', 'forgot', 'scattered', 'find'] as const
/** 방문자가 본 첫 화면 그림 (광고 소재). `none` 은 글만이다. */
export const WAITLIST_HEROES = ['none', 'card', 'notice', 'phone'] as const

export const waitlistOccupationSchema = z.enum(WAITLIST_OCCUPATIONS)
export const waitlistSaveIntentSchema = z.enum(WAITLIST_SAVE_INTENTS)
export const waitlistFrustrationSchema = z.enum(WAITLIST_FRUSTRATIONS)
export const waitlistWantedHelpSchema = z.enum(WAITLIST_WANTED_HELPS)
export const waitlistLocaleSchema = z.enum(WAITLIST_LOCALES)
export const waitlistHeadlineSchema = z.enum(WAITLIST_HEADLINES)
export const waitlistHeroSchema = z.enum(WAITLIST_HEROES)

export type WaitlistOccupation = z.infer<typeof waitlistOccupationSchema>
export type WaitlistSaveIntent = z.infer<typeof waitlistSaveIntentSchema>
export type WaitlistFrustration = z.infer<typeof waitlistFrustrationSchema>
export type WaitlistWantedHelp = z.infer<typeof waitlistWantedHelpSchema>
export type WaitlistLocale = z.infer<typeof waitlistLocaleSchema>
export type WaitlistHeadline = z.infer<typeof waitlistHeadlineSchema>
export type WaitlistHero = z.infer<typeof waitlistHeroSchema>

/** 이메일 주소의 최대 길이 (RFC 5321의 경로 길이). */
export const WAITLIST_EMAIL_MAX_LENGTH = 254
/** "기타"에 직접 적는 글의 최대 길이. */
export const WAITLIST_OTHER_MAX_LENGTH = 500

/** "기타"에 적은 글. 앞뒤 공백을 떼고, 비어 있으면 보내지 않은 것과 같다. */
const otherText = z
  .string()
  .trim()
  .max(WAITLIST_OTHER_MAX_LENGTH)
  .transform((text) => (text === '' ? undefined : text))
  .optional()

/**
 * 설문 응답 저장 요청 (`PUT /waitlist/responses/:id`).
 *
 * 매번 **지금까지의 답 전체**를 보낸다. 서버는 그 ID의 응답이 없으면 만들고 있으면
 * 덮어쓴다 — 저장이 한 번 실패해도 다음 요청이 전부 채운다. 아직 답하지 않은 질문은
 * 보내지 않는다. 이메일만 예외로, 보내지 않아도 이미 저장된 이메일은 지워지지 않는다.
 *
 * `…Other` 는 그 질문의 답이 `other` 일 때만 뜻이 있다. 다른 답과 함께 오면 서버가 버린다.
 */
export const saveWaitlistResponseRequestSchema = z.object({
  locale: waitlistLocaleSchema,
  headline: waitlistHeadlineSchema,
  hero: waitlistHeroSchema,
  occupation: waitlistOccupationSchema.optional(),
  occupationOther: otherText,
  saveIntent: waitlistSaveIntentSchema.optional(),
  saveIntentOther: otherText,
  frustration: waitlistFrustrationSchema.optional(),
  frustrationOther: otherText,
  wantedHelp: waitlistWantedHelpSchema.optional(),
  wantedHelpOther: otherText,
  /** 앞뒤 공백을 떼고 소문자로 바꾼 뒤 형식을 본다. */
  email: z.string().trim().toLowerCase().pipe(z.email().max(WAITLIST_EMAIL_MAX_LENGTH)).optional(),
})

/** 클라이언트가 보내는 모양. */
export type SaveWaitlistResponseRequest = z.input<typeof saveWaitlistResponseRequestSchema>
/** 서버가 검증한 뒤의 모양. */
export type SavedWaitlistResponse = z.output<typeof saveWaitlistResponseRequestSchema>

type Question = 'occupation' | 'saveIntent' | 'frustration' | 'wantedHelp'

/**
 * 검증된 요청을 저장할 값으로 바꾼다. 답하지 않은 질문은 `null` 이고, "기타"가 아닌 답에
 * 딸려 온 글은 버린다. 이메일은 넣지 않는다 — 저장하는 쪽이 따로 다룬다.
 */
export function waitlistAnswersOf(body: SavedWaitlistResponse) {
  const other = (question: Question) =>
    body[question] === 'other' ? (body[`${question}Other`] ?? null) : null

  return {
    locale: body.locale,
    headline: body.headline,
    hero: body.hero,
    occupation: body.occupation ?? null,
    occupationOther: other('occupation'),
    saveIntent: body.saveIntent ?? null,
    saveIntentOther: other('saveIntent'),
    frustration: body.frustration ?? null,
    frustrationOther: other('frustration'),
    wantedHelp: body.wantedHelp ?? null,
    wantedHelpOther: other('wantedHelp'),
  }
}
