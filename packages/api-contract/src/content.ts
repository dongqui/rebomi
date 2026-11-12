import { z } from 'zod'
import { toResponseJsonSchema } from './json-schema.js'

/*
 * 콘텐츠의 상태 축 (architecture.md §4). 축마다 필드가 따로 있고 한 필드에 섞지 않는다.
 * 값 이름은 `@rebomi/db` 의 contents 테이블과 같다.
 */

/** 출처 경로: 확장 / 모바일 / 웹 / 가져오기. */
export const contentSourceSchema = z.enum(['extension', 'mobile', 'web', 'import'])
/** 보관 상태: Inbox / 보관됨 / 휴지통. */
export const archiveStateSchema = z.enum(['inbox', 'archived', 'trashed'])
/** 링크 상태: 정상 / 링크 소멸. */
export const linkStateSchema = z.enum(['ok', 'dead'])
/** 추출 수준: 본문 / 일부 / 메타데이터만. */
export const extractionLevelSchema = z.enum(['full', 'partial', 'metadata_only'])
/** AI 처리 상태(요약): 생성 중 / 완료 / 실패 / 본문 없음. */
export const summaryStatusSchema = z.enum(['pending', 'done', 'failed', 'no_content'])
/** 서버 측 메타데이터 수집의 처리 상태: 처리 중 / 완료 / 실패. */
export const metadataStatusSchema = z.enum(['pending', 'done', 'failed'])

export type ContentSource = z.infer<typeof contentSourceSchema>
export type ArchiveState = z.infer<typeof archiveStateSchema>
export type LinkState = z.infer<typeof linkStateSchema>
export type ExtractionLevel = z.infer<typeof extractionLevelSchema>
export type SummaryStatus = z.infer<typeof summaryStatusSchema>
export type MetadataStatus = z.infer<typeof metadataStatusSchema>

/** 클라이언트가 보는 콘텐츠 하나. */
export const contentSchema = z.object({
  id: z.uuid(),
  /** 사용자가 저장한 그대로의 URL. */
  url: z.string(),
  /** 메타데이터 수집이 끝나기 전에는 null일 수 있다. */
  title: z.string().nullable(),
  /** 페이지가 스스로 밝힌 설명(og:description 등). 요약이 아니다. 없으면 null. */
  description: z.string().nullable(),
  domain: z.string(),
  imageUrl: z.string().nullable(),
  /** 저장일. ISO 8601 UTC. */
  savedAt: z.iso.datetime(),
  source: contentSourceSchema,
  archiveState: archiveStateSchema,
  linkState: linkStateSchema,
  extractionLevel: extractionLevelSchema,
  summaryStatus: summaryStatusSchema,
  metadataStatus: metadataStatusSchema,
  resurfacingIncluded: z.boolean(),
})

export type Content = z.infer<typeof contentSchema>

/**
 * 콘텐츠 생성(저장) 요청.
 *
 * URL이 http(s)인지는 서버가 `core.normalizeUrl` 로 판정한다 — 여기서는 모양만 본다.
 * 가져오기는 별도 경로로 들어오므로 저장 요청의 출처가 될 수 없다.
 */
export const createContentRequestSchema = z.object({
  url: z.string().min(1).max(2048),
  source: contentSourceSchema.exclude(['import']),
})

export type CreateContentRequest = z.infer<typeof createContentRequestSchema>

/**
 * 콘텐츠 저장 응답.
 *
 * 중복은 오류가 아니다 — 이미 저장한 URL이면 새로 만들지 않고 기존 콘텐츠를 돌려준다.
 * HTTP 상태는 `created` 일 때 201, `duplicate` 일 때 200이다.
 */
export const createContentResponseSchema = z.object({
  status: z.enum(['created', 'duplicate']),
  /** `duplicate` 이면 이미 있던 콘텐츠다. */
  content: contentSchema,
})

export type CreateContentResponse = z.infer<typeof createContentResponseSchema>

/** 목록 한 페이지의 기본 크기와 상한. */
export const CONTENT_LIST_DEFAULT_LIMIT = 50
export const CONTENT_LIST_MAX_LIMIT = 100

/**
 * 콘텐츠 목록 요청의 쿼리. 쿼리 문자열로 오므로 `limit` 은 문자열도 받는다.
 */
export const listContentsQuerySchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(CONTENT_LIST_MAX_LIMIT)
    .default(CONTENT_LIST_DEFAULT_LIMIT),
  /** 이전 응답의 `nextCursor`. 없으면 첫 페이지. */
  cursor: z.string().min(1).max(512).optional(),
})

/** 클라이언트가 넘기는 목록 조건. */
export type ListContentsQuery = {
  limit?: number
  cursor?: string
}

/** 콘텐츠 목록 응답. 휴지통을 뺀 콘텐츠가 저장일 최근순으로 온다. */
export const listContentsResponseSchema = z.object({
  items: z.array(contentSchema),
  /**
   * 다음 페이지를 요청할 때 그대로 돌려보내는 불투명한 값. 더 없으면 null.
   * 클라이언트는 내용을 해석하지 않는다.
   */
  nextCursor: z.string().nullable(),
})

export type ListContentsResponse = z.infer<typeof listContentsResponseSchema>

export const contentJsonSchema = toResponseJsonSchema(contentSchema)
export const createContentResponseJsonSchema = toResponseJsonSchema(createContentResponseSchema)
export const listContentsResponseJsonSchema = toResponseJsonSchema(listContentsResponseSchema)
