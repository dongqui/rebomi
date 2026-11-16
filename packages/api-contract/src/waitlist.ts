import { z } from 'zod'

/*
 * 대기 명단 랜딩의 설문 응답 (waitlist.md).
 *
 * 답은 화면 문구가 아니라 언어와 무관한 고정 키로 주고받는다 — 한국어와 영어 응답을
 * 함께 집계할 수 있어야 한다. 값 이름은 `@rebomi/db` 의 waitlist_responses 테이블과 같다.
 */

/** 저장한 것들이 쌓이는 곳 (복수 선택). */
export const WAITLIST_SAVE_PLACES = [
  'instagram',
  'youtube',
  'reddit',
  'x',
  'browser',
  'notes',
  'other',
] as const
/** 저장한 걸 다시 보는 빈도. */
export const WAITLIST_REVISIT_FREQUENCIES = ['almost_never', 'sometimes', 'most_weeks'] as const
/** 가장 도움이 될 것. */
export const WAITLIST_MOST_HELPFUL = ['summary', 'search', 'resurfacing', 'one_place'] as const
/** 지불 의향. */
export const WAITLIST_WILLINGNESS_TO_PAY = ['yes', 'maybe', 'no'] as const
/** 방문자가 본 언어. */
export const WAITLIST_LOCALES = ['ko', 'en'] as const
/** 방문자가 본 헤드라인 (광고 소재). */
export const WAITLIST_HEADLINES = ['forgot', 'scattered', 'find'] as const

export const waitlistSavePlaceSchema = z.enum(WAITLIST_SAVE_PLACES)
export const waitlistRevisitFrequencySchema = z.enum(WAITLIST_REVISIT_FREQUENCIES)
export const waitlistMostHelpfulSchema = z.enum(WAITLIST_MOST_HELPFUL)
export const waitlistWillingnessToPaySchema = z.enum(WAITLIST_WILLINGNESS_TO_PAY)
export const waitlistLocaleSchema = z.enum(WAITLIST_LOCALES)
export const waitlistHeadlineSchema = z.enum(WAITLIST_HEADLINES)

export type WaitlistSavePlace = z.infer<typeof waitlistSavePlaceSchema>
export type WaitlistRevisitFrequency = z.infer<typeof waitlistRevisitFrequencySchema>
export type WaitlistMostHelpful = z.infer<typeof waitlistMostHelpfulSchema>
export type WaitlistWillingnessToPay = z.infer<typeof waitlistWillingnessToPaySchema>
export type WaitlistLocale = z.infer<typeof waitlistLocaleSchema>
export type WaitlistHeadline = z.infer<typeof waitlistHeadlineSchema>

/** 이메일 주소의 최대 길이 (RFC 5321의 경로 길이). */
export const WAITLIST_EMAIL_MAX_LENGTH = 254

/**
 * 설문 응답 저장 요청 (`PUT /waitlist/responses/:id`).
 *
 * 매번 **지금까지의 답 전체**를 보낸다. 서버는 그 ID의 응답이 없으면 만들고 있으면
 * 덮어쓴다 — 저장이 한 번 실패해도 다음 요청이 전부 채운다. 아직 답하지 않은 질문은
 * 보내지 않는다. 이메일만 예외로, 보내지 않아도 이미 저장된 이메일은 지워지지 않는다.
 */
export const saveWaitlistResponseRequestSchema = z.object({
  locale: waitlistLocaleSchema,
  headline: waitlistHeadlineSchema,
  savePlaces: z
    .array(waitlistSavePlaceSchema)
    .refine((places) => new Set(places).size === places.length, '같은 값을 두 번 보낼 수 없습니다'),
  revisitFrequency: waitlistRevisitFrequencySchema.optional(),
  mostHelpful: waitlistMostHelpfulSchema.optional(),
  willingnessToPay: waitlistWillingnessToPaySchema.optional(),
  /** 앞뒤 공백을 떼고 소문자로 바꾼 뒤 형식을 본다. */
  email: z.string().trim().toLowerCase().pipe(z.email().max(WAITLIST_EMAIL_MAX_LENGTH)).optional(),
})

/** 클라이언트가 보내는 모양. */
export type SaveWaitlistResponseRequest = z.input<typeof saveWaitlistResponseRequestSchema>
