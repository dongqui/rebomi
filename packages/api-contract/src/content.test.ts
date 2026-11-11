import { describe, expect, it } from 'vitest'
import {
  contentJsonSchema,
  contentSchema,
  createContentRequestSchema,
  listContentsResponseJsonSchema,
  listContentsResponseSchema,
  type Content,
} from './index.js'

const content: Content = {
  id: '0b0e7c7e-7b1f-4d0a-9d55-0d6f2f1f6a11',
  url: 'https://example.com/a?utm_source=x',
  title: null,
  domain: 'example.com',
  imageUrl: null,
  savedAt: '2026-11-11T03:00:00.000Z',
  source: 'web',
  archiveState: 'inbox',
  linkState: 'ok',
  extractionLevel: 'metadata_only',
  summaryStatus: 'pending',
  metadataStatus: 'pending',
  resurfacingIncluded: true,
}

describe('contentSchema', () => {
  it('저장 직후의 콘텐츠(제목·이미지 없음)를 받아들인다', () => {
    expect(contentSchema.parse(content)).toEqual(content)
  })

  it.each([
    ['source', 'fax'],
    ['archiveState', 'dead'],
    ['linkState', 'archived'],
    ['extractionLevel', 'done'],
    ['summaryStatus', 'inbox'],
    ['metadataStatus', 'no_content'],
  ])('%s 에 정의되지 않은 값 %s 는 거부한다', (field, value) => {
    expect(contentSchema.safeParse({ ...content, [field]: value }).success).toBe(false)
  })

  it('상태 축 하나가 빠지면 거부한다', () => {
    const withoutLinkState: Partial<Content> = { ...content }
    delete withoutLinkState.linkState
    expect(contentSchema.safeParse(withoutLinkState).success).toBe(false)
  })

  it('savedAt이 ISO 8601 시각이 아니면 거부한다', () => {
    expect(contentSchema.safeParse({ ...content, savedAt: '어제' }).success).toBe(false)
  })
})

describe('createContentRequestSchema', () => {
  it('URL과 출처 경로를 받는다', () => {
    const request = { url: 'https://example.com/a', source: 'web' }
    expect(createContentRequestSchema.parse(request)).toEqual(request)
  })

  it('빈 URL은 거부한다', () => {
    expect(createContentRequestSchema.safeParse({ url: '', source: 'web' }).success).toBe(false)
  })

  it('출처 경로가 없으면 거부한다', () => {
    expect(createContentRequestSchema.safeParse({ url: 'https://example.com/a' }).success).toBe(
      false,
    )
  })

  it('가져오기는 저장 요청의 출처가 될 수 없다', () => {
    // 가져오기는 별도 경로(import)로 들어온다. 저장 API로 출처를 위조할 수 없어야 한다.
    expect(
      createContentRequestSchema.safeParse({ url: 'https://example.com/a', source: 'import' })
        .success,
    ).toBe(false)
  })
})

describe('listContentsResponseSchema', () => {
  it('콘텐츠 배열을 items로, 다음 페이지 커서를 nextCursor로 받는다', () => {
    const response = { items: [content], nextCursor: 'opaque-cursor' }
    expect(listContentsResponseSchema.parse(response)).toEqual(response)
  })

  it('마지막 페이지는 nextCursor가 null이다', () => {
    const response = { items: [], nextCursor: null }
    expect(listContentsResponseSchema.parse(response)).toEqual(response)
  })

  it('nextCursor가 빠지면 거부한다', () => {
    // 빠진 것과 "더 없음"을 구분한다 — 서버가 필드를 잊으면 클라이언트가 조용히 멈춘다.
    expect(listContentsResponseSchema.safeParse({ items: [] }).success).toBe(false)
  })
})

describe('직렬화용 JSON 스키마', () => {
  it.each([
    ['contentJsonSchema', contentJsonSchema],
    ['listContentsResponseJsonSchema', listContentsResponseJsonSchema],
  ])('%s 는 계약에 없는 필드를 허용하지 않고 $schema 키가 없다', (_name, jsonSchema) => {
    expect(jsonSchema.additionalProperties).toBe(false)
    expect(jsonSchema).not.toHaveProperty('$schema')
  })

  it('목록의 항목 스키마도 계약에 없는 필드를 허용하지 않는다', () => {
    const properties = listContentsResponseJsonSchema.properties as {
      items: { items: Record<string, unknown> }
    }
    expect(properties.items.items.additionalProperties).toBe(false)
  })
})
