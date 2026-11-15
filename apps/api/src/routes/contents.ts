import {
  ERROR_CODES,
  contentJsonSchema,
  createContentRequestSchema,
  createContentResponseJsonSchema,
  listContentsQuerySchema,
  listContentsResponseJsonSchema,
  type Content,
  type CreateContentResponse,
  type ListContentsResponse,
} from '@rebomi/api-contract'
import { InvalidUrlError, domainOf, normalizeUrl } from '@rebomi/core'
import { and, eq, ne, schema, sql, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { errorBody } from '../errors.js'
import type { JobQueue } from '../jobs.js'

const { contents } = schema

type ContentRow = typeof contents.$inferSelect

/**
 * DB 행을 계약의 콘텐츠로 옮긴다. `normalizedUrl`·`userId` 같은 내부 값은 싣지 않는다.
 * 값 목록이 db와 계약에서 어긋나면 여기서 타입 오류가 난다 (architecture.md §4).
 */
function toContent(row: ContentRow): Content {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    description: row.description,
    domain: row.domain,
    imageUrl: row.imageUrl,
    savedAt: row.savedAt.toISOString(),
    source: row.source,
    archiveState: row.archiveState,
    linkState: row.linkState,
    extractionLevel: row.extractionLevel,
    summaryStatus: row.summaryStatus,
    metadataStatus: row.metadataStatus,
    resurfacingIncluded: row.resurfacingIncluded,
  }
}

/** 목록에서 한 행의 위치. 저장일이 같은 행은 ID로 순서를 가른다. */
type Position = { savedAt: string; id: string }

/** Postgres가 마이크로초까지 찍어 준 UTC 시각. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 커서는 클라이언트에게 불투명한 값이다. 내용을 해석하지 않고 그대로 돌려보낸다. */
function encodeCursor(position: Position): string {
  return Buffer.from(JSON.stringify([position.savedAt, position.id])).toString('base64url')
}

/** 우리가 만든 커서가 아니면 null. SQL에 넣기 전에 모양을 확인한다. */
function decodeCursor(cursor: string): Position | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.length !== 2) return null
  const [savedAt, id] = parsed as unknown[]
  if (typeof savedAt !== 'string' || !TIMESTAMP.test(savedAt)) return null
  if (typeof id !== 'string' || !UUID.test(id)) return null
  return { savedAt, id }
}

/**
 * 저장일을 마이크로초까지 문자열로 읽는다. JS의 Date는 밀리초까지만 담아서, 그것으로
 * 커서를 만들면 같은 밀리초에 저장된 행을 건너뛰거나 다시 준다.
 */
const savedAtText = sql<string>`to_char(${contents.savedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

export type ContentRouteDeps = {
  db: Db
  jobs: JobQueue
}

export function registerContentRoutes(app: FastifyInstance, deps: ContentRouteDeps): void {
  const { db, jobs } = deps

  /**
   * `POST /contents` — URL을 저장한다 (capture.md CAP-1, CAP-6).
   *
   * 행을 만들고 처리 잡을 큐에 넣으면 바로 응답한다. 메타데이터 수집과 요약은 워커가
   * 나중에 한다. 이미 저장한 URL이면 새로 만들지 않고 기존 콘텐츠를 `duplicate` 로 준다.
   */
  app.post(
    '/contents',
    {
      preHandler: app.requireAuth,
      schema: {
        // 상태 코드를 넓은 타입으로 둔다 — 좁으면 Fastify가 에러 응답의 상태를 막는다.
        response: {
          200: createContentResponseJsonSchema,
          201: createContentResponseJsonSchema,
        } as Record<number, unknown>,
      },
    },
    async (request, reply) => {
      const body = createContentRequestSchema.parse(request.body)
      const url = body.url.trim()

      let normalizedUrl: string
      let domain: string
      try {
        normalizedUrl = normalizeUrl(url)
        domain = domainOf(normalizedUrl)
      } catch (error) {
        if (!(error instanceof InvalidUrlError)) throw error
        return reply
          .status(400)
          .send(
            errorBody(ERROR_CODES.VALIDATION_FAILED, 'http 또는 https 주소만 저장할 수 있습니다'),
          )
      }

      const userId = request.userId

      const created = await db.transaction(async (tx) => {
        // 중복 판정은 DB의 유일 제약에 맡긴다. 먼저 조회하고 넣으면 동시에 온 두 요청이
        // 둘 다 "없다"고 보고 하나가 제약 위반으로 실패한다.
        const [row] = await tx.drizzle
          .insert(contents)
          .values({
            userId,
            url,
            normalizedUrl,
            domain,
            source: body.source,
            // 직접 저장한 콘텐츠는 재노출 대상이다 (resurfacing.md §5).
            resurfacingIncluded: true,
          })
          .onConflictDoNothing({ target: [contents.userId, contents.normalizedUrl] })
          .returning()
        if (!row) return null

        await jobs.enqueueContentProcess(tx, { contentId: row.id })
        return row
      })

      if (created) {
        const response: CreateContentResponse = { status: 'created', content: toContent(created) }
        return reply.status(201).send(response)
      }

      const [existing] = await db.drizzle
        .select()
        .from(contents)
        .where(and(eq(contents.userId, userId), eq(contents.normalizedUrl, normalizedUrl)))
      if (!existing) throw new Error('중복으로 판정된 콘텐츠를 찾을 수 없습니다')

      const response: CreateContentResponse = { status: 'duplicate', content: toContent(existing) }
      return reply.status(200).send(response)
    },
  )

  /**
   * `GET /contents` — 요청한 사용자의 콘텐츠를 저장일 최근순으로 준다 (library.md LIB-1).
   *
   * 휴지통은 뺀다. 상태별 필터와 오래된 순 정렬은 아직 없다.
   */
  app.get(
    '/contents',
    {
      preHandler: app.requireAuth,
      schema: { response: { 200: listContentsResponseJsonSchema } as Record<number, unknown> },
    },
    async (request, reply) => {
      const query = listContentsQuerySchema.parse(request.query)

      const after = query.cursor === undefined ? undefined : decodeCursor(query.cursor)
      if (after === null) {
        return reply
          .status(400)
          .send(errorBody(ERROR_CODES.VALIDATION_FAILED, '요청이 올바르지 않습니다'))
      }

      // 모든 콘텐츠 질의는 사용자 ID로 범위를 제한한다 (architecture.md §3).
      const rows = await db.drizzle
        .select({ row: contents, savedAtText })
        .from(contents)
        .where(
          and(
            eq(contents.userId, request.userId),
            ne(contents.archiveState, 'trashed'),
            after
              ? sql`(${contents.savedAt}, ${contents.id}) < (${after.savedAt}::timestamptz, ${after.id}::uuid)`
              : undefined,
          ),
        )
        .orderBy(sql`${contents.savedAt} desc, ${contents.id} desc`)
        // 하나 더 읽어 다음 페이지가 있는지 본다.
        .limit(query.limit + 1)

      const page = rows.slice(0, query.limit)
      const last = page.at(-1)
      const hasMore = rows.length > query.limit

      const response: ListContentsResponse = {
        items: page.map(({ row }) => toContent(row)),
        nextCursor:
          hasMore && last ? encodeCursor({ savedAt: last.savedAtText, id: last.row.id }) : null,
      }
      return reply.status(200).send(response)
    },
  )

  /**
   * `GET /contents/:id` — 요청한 사용자의 콘텐츠 하나를 준다.
   *
   * 클라이언트가 처리 중인 콘텐츠의 상태를 다시 확인하는 데 쓴다. 남의 콘텐츠와 없는
   * 콘텐츠를 구분하지 않고 404로 답한다 — 구분하면 ID가 존재하는지 알려 주게 된다.
   * 휴지통은 목록과 같게 없는 것으로 본다.
   */
  app.get<{ Params: { id: string } }>(
    '/contents/:id',
    {
      preHandler: app.requireAuth,
      schema: { response: { 200: contentJsonSchema } as Record<number, unknown> },
    },
    async (request, reply) => {
      const notFound = () =>
        reply.status(404).send(errorBody(ERROR_CODES.NOT_FOUND, '콘텐츠를 찾을 수 없습니다'))

      const { id } = request.params
      // uuid 컬럼에 다른 모양을 넣으면 DB가 오류를 낸다.
      if (!UUID.test(id)) return notFound()

      const [row] = await db.drizzle
        .select()
        .from(contents)
        .where(
          and(
            eq(contents.id, id),
            eq(contents.userId, request.userId),
            ne(contents.archiveState, 'trashed'),
          ),
        )
      if (!row) return notFound()

      return reply.status(200).send(toContent(row))
    },
  )
}
