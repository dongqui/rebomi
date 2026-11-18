import {
  ERROR_CODES,
  searchRequestSchema,
  searchResponseJsonSchema,
  searchTermsOf,
  type SearchResponse,
} from '@rebomi/api-contract'
import type { Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { errorBody } from '../errors.js'
import { keywordSearch } from '../search/keyword.js'
import { toContent } from './contents.js'

/** 커서로 넘어갈 수 있는 가장 먼 위치. 그보다 뒤는 검색어를 좁혀야 한다. */
const MAX_OFFSET = 10_000

/**
 * 커서는 "몇 번째부터"다. 관련도순에는 저장일 같은 고정된 기준이 없어 위치로 넘긴다.
 * 페이지 사이에 새 콘텐츠가 저장되면 한 항목이 겹칠 수 있다.
 */
function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify(['offset', offset])).toString('base64url')
}

/** 우리가 만든 커서가 아니면 null. */
function decodeCursor(cursor: string): number | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.length !== 2) return null
  const [kind, offset] = parsed as unknown[]
  if (kind !== 'offset') return null
  if (typeof offset !== 'number' || !Number.isInteger(offset)) return null
  if (offset < 1 || offset > MAX_OFFSET) return null
  return offset
}

/** 대소문자만 다른 단어는 같은 단어다. 같은 조건을 두 번 걸지 않는다. */
function uniqueTerms(query: string): string[] {
  const seen = new Set<string>()
  return searchTermsOf(query).filter((term) => {
    const key = term.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export type SearchRouteDeps = {
  db: Db
}

export function registerSearchRoutes(app: FastifyInstance, deps: SearchRouteDeps): void {
  const { db } = deps

  /**
   * `POST /search` — 요청한 사용자의 콘텐츠를 키워드로 찾는다 (search.md SRCH-1, SRCH-4).
   *
   * 조회지만 POST다. 검색어를 주소에 실으면 서버 로그와 프록시에 남는다.
   *
   * 검색어를 공백으로 나눈 단어가 모두 들어 있는 콘텐츠를 관련도순으로 준다. 대상은 제목,
   * 주소·도메인, 설명, 추출된 본문이고 휴지통은 빠진다. 결과마다 일치한 곳(`matches`)이
   * 온다. 일치가 없으면 빈 목록이다.
   */
  app.post(
    '/search',
    {
      preHandler: app.requireAuth,
      schema: { response: { 200: searchResponseJsonSchema } as Record<number, unknown> },
    },
    async (request, reply) => {
      const body = searchRequestSchema.parse(request.body)

      const offset = body.cursor === undefined ? 0 : decodeCursor(body.cursor)
      if (offset === null) {
        return reply
          .status(400)
          .send(errorBody(ERROR_CODES.VALIDATION_FAILED, '요청이 올바르지 않습니다'))
      }

      const found = await keywordSearch(db, {
        userId: request.userId,
        terms: uniqueTerms(body.query),
        limit: body.limit,
        offset,
      })

      const next = offset + body.limit
      const response: SearchResponse = {
        items: found.items.map(({ row, matches }) => ({ content: toContent(row), matches })),
        nextCursor: found.hasMore && next <= MAX_OFFSET ? encodeCursor(next) : null,
      }
      return reply.status(200).send(response)
    },
  )
}
