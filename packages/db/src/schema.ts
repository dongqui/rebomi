import { sql, type SQL } from 'drizzle-orm'
import {
  boolean,
  check,
  index,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
  type AnyPgColumn,
} from 'drizzle-orm/pg-core'

/**
 * 계정. 이메일은 제공자가 검증한 것만, 소문자로 넣는다.
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})

/** 로그인 수단 (account.md §4). */
export const AUTH_PROVIDERS = ['google', 'apple'] as const

/*
 * 콘텐츠의 상태 축 (architecture.md §4). 축마다 컬럼이 따로 있고 한 필드에 섞지 않는다.
 *
 * 같은 값 목록이 `@rebomi/api-contract` 의 content 스키마에도 있다. 두 패키지는
 * 서로 의존하지 않으므로(architecture.md §2), 어긋남은 행을 계약 타입으로 옮기는
 * apps/api 의 타입체크가 잡는다.
 */

/** 출처 경로. */
export const CONTENT_SOURCES = ['extension', 'mobile', 'web', 'import'] as const
/** 보관 상태: Inbox / 보관됨 / 휴지통. */
export const ARCHIVE_STATES = ['inbox', 'archived', 'trashed'] as const
/** 휴지통으로 가기 전의 보관 상태. 복구하면 여기로 돌아간다. */
export const TRASHED_FROM_STATES = ['inbox', 'archived'] as const
/** 링크 상태: 정상 / 링크 소멸. 판정 전·일시 실패 값은 D-04 결정 뒤에 추가한다. */
export const LINK_STATES = ['ok', 'dead'] as const
/** 추출 수준: 본문 / 일부 / 메타데이터만. */
export const EXTRACTION_LEVELS = ['full', 'partial', 'metadata_only'] as const
/** AI 처리 상태(요약): 생성 중 / 완료 / 실패 / 본문 없음. */
export const SUMMARY_STATUSES = ['pending', 'done', 'failed', 'no_content'] as const
/** 서버 측 메타데이터 수집의 처리 상태: 처리 중 / 완료 / 실패. */
export const METADATA_STATUSES = ['pending', 'done', 'failed'] as const

/**
 * 값 목록을 DB의 check 제약으로 옮긴다. pg enum 대신 text + check 를 쓰는 이유는
 * 값 추가(D-04 등)가 제약 교체 한 번으로 끝나기 때문이다.
 */
const oneOf = (column: AnyPgColumn, values: readonly string[]): SQL =>
  sql`${column} in (${sql.raw(values.map((value) => `'${value}'`).join(', '))})`

/**
 * 저장한 콘텐츠. 사용자당 정규화 URL 하나.
 *
 * 본문은 `content_bodies` 에 따로 둔다. 요약·임베딩·메모·가져온 폴더 컬럼은 각 기능의
 * Issue에서 추가한다.
 *
 * 키워드 검색 인덱스(`contents_search_idx`, `content_bodies_search_idx`)는 PGroonga
 * 인덱스라 여기 적을 수 없다. 마이그레이션 `0007_search_indexes` 에 직접 쓴 SQL로 있다.
 */
export const contents = pgTable(
  'contents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** 사용자가 저장한 그대로의 URL. */
    url: text('url').notNull(),
    /** `core.normalizeUrl` 의 결과. 중복 판정의 기준이다. */
    normalizedUrl: text('normalized_url').notNull(),
    title: text('title'),
    /** 페이지가 스스로 밝힌 설명(og:description 등). 요약이 아니다. */
    description: text('description'),
    domain: text('domain').notNull(),
    imageUrl: text('image_url'),
    source: text('source', { enum: CONTENT_SOURCES }).notNull(),
    archiveState: text('archive_state', { enum: ARCHIVE_STATES }).notNull().default('inbox'),
    /** 휴지통으로 보낸 시각. 휴지통에 있을 때만 값이 있다. 30일 뒤 영구 삭제의 기준이다. */
    trashedAt: timestamp('trashed_at', { withTimezone: true }),
    /** 휴지통으로 가기 전의 보관 상태. 휴지통에 있을 때만 값이 있다. */
    trashedFrom: text('trashed_from', { enum: TRASHED_FROM_STATES }),
    linkState: text('link_state', { enum: LINK_STATES }).notNull().default('ok'),
    extractionLevel: text('extraction_level', { enum: EXTRACTION_LEVELS })
      .notNull()
      .default('metadata_only'),
    summaryStatus: text('summary_status', { enum: SUMMARY_STATUSES }).notNull().default('pending'),
    metadataStatus: text('metadata_status', { enum: METADATA_STATUSES })
      .notNull()
      .default('pending'),
    /** 기본값이 출처에 따라 달라(resurfacing.md §5) DB 기본값을 두지 않는다. 넣는 쪽이 정한다. */
    resurfacingIncluded: boolean('resurfacing_included').notNull(),
    savedAt: timestamp('saved_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('contents_user_id_normalized_url_unique').on(table.userId, table.normalizedUrl),
    index('contents_user_id_saved_at_idx').on(table.userId, table.savedAt.desc()),
    check('contents_source_check', oneOf(table.source, CONTENT_SOURCES)),
    check('contents_archive_state_check', oneOf(table.archiveState, ARCHIVE_STATES)),
    check('contents_trashed_from_check', oneOf(table.trashedFrom, TRASHED_FROM_STATES)),
    // 삭제 시각과 삭제 전 상태는 휴지통에 있을 때만, 그리고 그때는 반드시 있다.
    check(
      'contents_trashed_fields_check',
      sql`(${table.archiveState} = 'trashed') = (${table.trashedAt} is not null) and (${table.archiveState} = 'trashed') = (${table.trashedFrom} is not null)`,
    ),
    check('contents_link_state_check', oneOf(table.linkState, LINK_STATES)),
    check('contents_extraction_level_check', oneOf(table.extractionLevel, EXTRACTION_LEVELS)),
    check('contents_summary_status_check', oneOf(table.summaryStatus, SUMMARY_STATUSES)),
    check('contents_metadata_status_check', oneOf(table.metadataStatus, METADATA_STATUSES)),
  ],
)

/**
 * 콘텐츠에서 추출한 본문 텍스트. 콘텐츠당 하나.
 *
 * `contents` 와 가른 이유는 크기다 — 목록 질의가 수만 자짜리 본문을 함께 읽지 않게 한다.
 * 원본 HTML은 저장하지 않는다. 추출한 텍스트만 둔다 (architecture.md §8).
 */
export const contentBodies = pgTable('content_bodies', {
  contentId: uuid('content_id')
    .primaryKey()
    .references(() => contents.id, { onDelete: 'cascade' }),
  text: text('text').notNull(),
  extractedAt: timestamp('extracted_at', { withTimezone: true }).notNull().defaultNow(),
})

/**
 * 제공자 신원. 한 계정에 Google·Apple 신원이 각각 붙을 수 있다 — 검증된 이메일이
 * 같으면 같은 계정이다 (account.md ACC-7).
 */
export const authIdentities = pgTable(
  'auth_identities',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    provider: text('provider', { enum: AUTH_PROVIDERS }).notNull(),
    /** 제공자가 준 사용자 식별자(`sub`). 이메일이 바뀌어도 변하지 않는다. */
    subject: text('subject').notNull(),
    /** 제공자가 알려 온 이메일. 계정의 이메일과 다를 수 있어 기록만 한다. */
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique('auth_identities_provider_subject_unique').on(table.provider, table.subject),
    index('auth_identities_user_id_idx').on(table.userId),
    check('auth_identities_provider_check', oneOf(table.provider, AUTH_PROVIDERS)),
  ],
)

/**
 * 갱신 토큰. 토큰 자체가 아니라 SHA-256 해시만 둔다 — DB가 새어도 토큰으로 쓸 수 없다.
 * 회전하지 않는다: 로그아웃(`revoked_at`)이나 만료 전까지 같은 토큰을 쓴다.
 */
export const refreshTokens = pgTable(
  'refresh_tokens',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    /** 갱신에 쓸 때마다 뒤로 밀린다. */
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('refresh_tokens_user_id_idx').on(table.userId)],
)

/*
 * 대기 명단 랜딩의 설문 응답 (waitlist.md). 답은 화면 문구가 아니라 고정 키다.
 * 같은 값 목록이 `@rebomi/api-contract` 의 waitlist 스키마에도 있다 — 어긋남은
 * 요청을 행으로 옮기는 apps/api 의 타입체크가 잡는다.
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

/**
 * 설문 응답 하나. 방문자가 답을 고를 때마다 같은 행을 갱신한다.
 *
 * - `id` 는 브라우저가 만든다. DB 기본값을 두지 않는다.
 * - 답하지 않은 질문과 내지 않은 이메일은 비어 있다. 어디까지 답했는지가 여기서 보인다.
 * - 이메일은 유일하지 않다. 같은 이메일로 여러 번 등록할 수 있다.
 * - 계정(`users`)과 무관하다. 이 이메일로 가입해도 연결하지 않는다.
 */
export const waitlistResponses = pgTable(
  'waitlist_responses',
  {
    id: uuid('id').primaryKey(),
    locale: text('locale', { enum: WAITLIST_LOCALES }).notNull(),
    headline: text('headline', { enum: WAITLIST_HEADLINES }).notNull(),
    hero: text('hero', { enum: WAITLIST_HEROES }).notNull(),
    occupation: text('occupation', { enum: WAITLIST_OCCUPATIONS }),
    /** `…Other` 는 그 질문의 답이 `other` 일 때 방문자가 직접 적은 글이다. */
    occupationOther: text('occupation_other'),
    saveIntent: text('save_intent', { enum: WAITLIST_SAVE_INTENTS }),
    saveIntentOther: text('save_intent_other'),
    frustration: text('frustration', { enum: WAITLIST_FRUSTRATIONS }),
    frustrationOther: text('frustration_other'),
    wantedHelp: text('wanted_help', { enum: WAITLIST_WANTED_HELPS }),
    wantedHelpOther: text('wanted_help_other'),
    /** 앞뒤 공백을 떼고 소문자로 넣는다. */
    email: text('email'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check('waitlist_responses_locale_check', oneOf(table.locale, WAITLIST_LOCALES)),
    check('waitlist_responses_headline_check', oneOf(table.headline, WAITLIST_HEADLINES)),
    check('waitlist_responses_hero_check', oneOf(table.hero, WAITLIST_HEROES)),
    check('waitlist_responses_occupation_check', oneOf(table.occupation, WAITLIST_OCCUPATIONS)),
    check('waitlist_responses_save_intent_check', oneOf(table.saveIntent, WAITLIST_SAVE_INTENTS)),
    check('waitlist_responses_frustration_check', oneOf(table.frustration, WAITLIST_FRUSTRATIONS)),
    check('waitlist_responses_wanted_help_check', oneOf(table.wantedHelp, WAITLIST_WANTED_HELPS)),
  ],
)
