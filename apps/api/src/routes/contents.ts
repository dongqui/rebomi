import {
  CONTENT_LIST_DEFAULT_SORT,
  ERROR_CODES,
  contentJsonSchema,
  createContentRequestSchema,
  createContentResponseJsonSchema,
  listContentsQuerySchema,
  listContentsResponseJsonSchema,
  type Content,
  type ContentListSort,
  type CreateContentResponse,
  type ListContentsResponse,
} from '@rebomi/api-contract'
import { InvalidUrlError, domainOf, normalizeUrl } from '@rebomi/core'
import { and, eq, inArray, ne, schema, sql, type Db, type SQL } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { errorBody } from '../errors.js'
import type { JobQueue } from '../jobs.js'

const { contents, contentBodies } = schema

type ContentRow = typeof contents.$inferSelect

/**
 * 저장 요청의 크기 제한. 본문 상한(20만 자)은 UTF-8로 최대 600KB이고 JSON으로 싣는 동안
 * 더 커질 수 있어 Fastify 기본값(1MB)으로는 상한 안의 본문이 거부될 수 있다.
 */
const SAVE_BODY_LIMIT_BYTES = 2 * 1024 * 1024

/** 앞뒤 공백을 뗀다. 남는 것이 없으면 null. */
function textOrNull(value: string | undefined): string | null {
  const text = value?.trim() ?? ''
  return text === '' ? null : text
}

/**
 * DB 행을 계약의 콘텐츠로 옮긴다. `normalizedUrl`·`userId` 같은 내부 값은 싣지 않는다.
 * 값 목록이 db와 계약에서 어긋나면 여기서 타입 오류가 난다 (architecture.md §4).
 */
export function toContent(row: ContentRow): Content {
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

/**
 * 목록에서 한 행의 위치. 저장일이 같은 행은 ID로 순서를 가른다. 위치는 그 정렬에서만
 * 뜻이 있어 정렬을 함께 담는다.
 */
type Position = { sort: ContentListSort; savedAt: string; id: string }

/** Postgres가 마이크로초까지 찍어 준 UTC 시각. */
const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{6}Z$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 커서는 클라이언트에게 불투명한 값이다. 내용을 해석하지 않고 그대로 돌려보낸다. */
function encodeCursor(position: Position): string {
  return Buffer.from(JSON.stringify([position.sort, position.savedAt, position.id])).toString(
    'base64url',
  )
}

/** 우리가 만든 커서가 아니면 null. SQL에 넣기 전에 모양을 확인한다. */
function decodeCursor(cursor: string): Position | null {
  let parsed: unknown
  try {
    parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
  } catch {
    return null
  }

  if (!Array.isArray(parsed) || parsed.length !== 3) return null
  const [sort, savedAt, id] = parsed as unknown[]
  if (sort !== 'recent' && sort !== 'oldest') return null
  if (typeof savedAt !== 'string' || !TIMESTAMP.test(savedAt)) return null
  if (typeof id !== 'string' || !UUID.test(id)) return null
  return { sort, savedAt, id }
}

/**
 * 저장일을 마이크로초까지 문자열로 읽는다. JS의 Date는 밀리초까지만 담아서, 그것으로
 * 커서를 만들면 같은 밀리초에 저장된 행을 건너뛰거나 다시 준다.
 */
const savedAtText = sql<string>`to_char(${contents.savedAt} at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"')`

/** 그 위치 다음에 오는 행만 남기는 조건. 정렬 방향에 따라 부등호가 뒤집힌다. */
function afterPosition(sort: ContentListSort, after: Position): SQL {
  const here = sql`(${contents.savedAt}, ${contents.id})`
  const there = sql`(${after.savedAt}::timestamptz, ${after.id}::uuid)`
  return sort === 'recent' ? sql`${here} < ${there}` : sql`${here} > ${there}`
}

export type ContentRouteDeps = {
  db: Db
  jobs: JobQueue
}

export function registerContentRoutes(app: FastifyInstance, deps: ContentRouteDeps): void {
  const { db, jobs } = deps

  /**
   * `POST /contents` — URL을 저장한다 (capture.md CAP-1, CAP-2, CAP-6).
   *
   * 행을 만들고 처리 잡을 큐에 넣으면 바로 응답한다. 메타데이터 수집과 요약은 워커가
   * 나중에 한다. 이미 저장한 URL이면 새로 만들지 않고 기존 콘텐츠를 `duplicate` 로 준다.
   *
   * 저장하는 쪽이 제목·설명·본문·대표 이미지를 함께 보내면 그 값을 넣는다. 본문은
   * `content_bodies` 에 저장하고 응답에는 싣지 않는다.
   */
  app.post(
    '/contents',
    {
      preHandler: app.requireAuth,
      bodyLimit: SAVE_BODY_LIMIT_BYTES,
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
      // 저장하는 쪽이 함께 보낸 값. 공백뿐이면 보내지 않은 것과 같다.
      const sent = {
        title: textOrNull(body.title),
        description: textOrNull(body.description),
        imageUrl: body.imageUrl ?? null,
        body: textOrNull(body.body),
      }

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
            title: sent.title,
            description: sent.description,
            imageUrl: sent.imageUrl,
            // 추출 수준은 본문을 얼마나 확보했는지다 (architecture.md §4).
            extractionLevel: sent.body === null ? 'metadata_only' : 'full',
            // 직접 저장한 콘텐츠는 재노출 대상이다 (resurfacing.md §5).
            resurfacingIncluded: true,
          })
          .onConflictDoNothing({ target: [contents.userId, contents.normalizedUrl] })
          .returning()
        if (!row) return null

        if (sent.body !== null) {
          await tx.drizzle.insert(contentBodies).values({ contentId: row.id, text: sent.body })
        }
        // 본문이 있어도 잡은 넣는다. 가져올지 말지는 워커가 정한다.
        await jobs.enqueueContentProcess(tx, { contentId: row.id })
        return row
      })

      if (created) {
        const response: CreateContentResponse = { status: 'created', content: toContent(created) }
        return reply.status(201).send(response)
      }

      const mine = and(eq(contents.userId, userId), eq(contents.normalizedUrl, normalizedUrl))

      // 이미 저장한 URL에 본문이 왔고 기존에 본문이 없으면 그 본문을 받는다. 본문이 이미
      // 있으면 아무것도 바꾸지 않는다. 저장일은 어느 쪽이든 그대로다 (product.md D-15).
      const sentBody = sent.body
      if (sentBody !== null) {
        await db.transaction(async (tx) => {
          // 조건을 UPDATE에 둔다 — 먼저 읽고 판단하면 그 사이 워커가 본문을 넣을 수 있다.
          const [upgraded] = await tx.drizzle
            .update(contents)
            .set({
              extractionLevel: 'full',
              // 제목·설명·이미지는 비어 있는 것만 채운다.
              title: sql`coalesce(${contents.title}, ${sent.title})`,
              description: sql`coalesce(${contents.description}, ${sent.description})`,
              imageUrl: sql`coalesce(${contents.imageUrl}, ${sent.imageUrl})`,
              // "본문 없음"이던 요약 상태는 본문이 생겼으니 다시 대기로 돌린다.
              summaryStatus: sql`case when ${contents.summaryStatus} = 'no_content' then 'pending' else ${contents.summaryStatus} end`,
            })
            .where(and(mine, eq(contents.extractionLevel, 'metadata_only')))
            .returning({ id: contents.id })
          if (!upgraded) return

          await tx.drizzle
            .insert(contentBodies)
            .values({ contentId: upgraded.id, text: sentBody })
            .onConflictDoNothing({ target: contentBodies.contentId })
        })
      }

      const [existing] = await db.drizzle.select().from(contents).where(mine)
      if (!existing) throw new Error('중복으로 판정된 콘텐츠를 찾을 수 없습니다')

      const response: CreateContentResponse = { status: 'duplicate', content: toContent(existing) }
      return reply.status(200).send(response)
    },
  )

  /**
   * `GET /contents` — 요청한 사용자의 콘텐츠를 저장일순으로 준다 (library.md LIB-1).
   *
   * `archiveState` 를 주면 그 보관 상태만, 생략하면 휴지통을 뺀 전체다. `sort` 는 최근순
   * (기본)과 오래된 순이다.
   */
  app.get(
    '/contents',
    {
      preHandler: app.requireAuth,
      schema: { response: { 200: listContentsResponseJsonSchema } as Record<number, unknown> },
    },
    async (request, reply) => {
      const query = listContentsQuerySchema.parse(request.query)

      const sort = query.sort ?? CONTENT_LIST_DEFAULT_SORT
      const after = query.cursor === undefined ? undefined : decodeCursor(query.cursor)
      // 다른 정렬로 받은 커서는 이 정렬에서 뜻이 없다. 조용히 엉뚱한 페이지를 주지 않는다.
      if (after === null || (after && after.sort !== sort)) {
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
            query.archiveState === undefined
              ? ne(contents.archiveState, 'trashed')
              : eq(contents.archiveState, query.archiveState),
            after ? afterPosition(sort, after) : undefined,
          ),
        )
        .orderBy(
          sort === 'recent'
            ? sql`${contents.savedAt} desc, ${contents.id} desc`
            : sql`${contents.savedAt} asc, ${contents.id} asc`,
        )
        // 하나 더 읽어 다음 페이지가 있는지 본다.
        .limit(query.limit + 1)

      const page = rows.slice(0, query.limit)
      const last = page.at(-1)
      const hasMore = rows.length > query.limit

      const response: ListContentsResponse = {
        items: page.map(({ row }) => toContent(row)),
        nextCursor:
          hasMore && last
            ? encodeCursor({ sort, savedAt: last.savedAtText, id: last.row.id })
            : null,
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

  /**
   * 보관 상태를 바꾸는 동작 셋 (library.md LIB-3, LIB-4, architecture.md §4 전이 규칙).
   *
   * 조건을 UPDATE에 둔다 — 먼저 읽고 판단하면 그 사이 다른 요청이 상태를 바꿀 수 있다.
   * 바뀐 행이 없으면 그때 읽어서 이유를 가른다: 없는 콘텐츠(남의 것 포함)는 404, 이미 그
   * 상태면 바꾸지 않고 200, 허용하지 않는 전이면 409다. 같은 요청을 다시 보내도 안전하다.
   */
  function registerAction(
    action: 'archive' | 'trash' | 'restore',
    /** 이 동작으로 바뀔 수 있는 행을 바꾸고 돌려준다. 해당하지 않으면 undefined. */
    apply: (id: string, userId: string) => Promise<ContentRow | undefined>,
    /** 바뀌지 않은 행이 그대로 두어도 되는 상태인가. 아니면 허용하지 않는 전이다. */
    isSettled: (row: ContentRow) => boolean,
  ): void {
    app.post<{ Params: { id: string } }>(
      `/contents/:id/${action}`,
      {
        preHandler: app.requireAuth,
        schema: { response: { 200: contentJsonSchema } as Record<number, unknown> },
      },
      async (request, reply) => {
        const notFound = () =>
          reply.status(404).send(errorBody(ERROR_CODES.NOT_FOUND, '콘텐츠를 찾을 수 없습니다'))

        const { id } = request.params
        if (!UUID.test(id)) return notFound()

        const changed = await apply(id, request.userId)
        if (changed) return reply.status(200).send(toContent(changed))

        const [current] = await db.drizzle
          .select()
          .from(contents)
          .where(and(eq(contents.id, id), eq(contents.userId, request.userId)))
        if (!current) return notFound()
        if (isSettled(current)) return reply.status(200).send(toContent(current))

        return reply
          .status(409)
          .send(
            errorBody(
              ERROR_CODES.INVALID_STATE_TRANSITION,
              '지금 상태에서는 할 수 없는 동작입니다',
            ),
          )
      },
    )
  }

  /** 그 사용자의 그 콘텐츠가 `states` 중 하나일 때만 맞는 조건. */
  const mineIn = (id: string, userId: string, states: ContentRow['archiveState'][]) =>
    and(eq(contents.id, id), eq(contents.userId, userId), inArray(contents.archiveState, states))

  // 보관: Inbox → 보관됨. 휴지통의 콘텐츠는 보관할 수 없다 — 먼저 복구한다.
  registerAction(
    'archive',
    async (id, userId) => {
      const [row] = await db.drizzle
        .update(contents)
        .set({ archiveState: 'archived' })
        .where(mineIn(id, userId, ['inbox']))
        .returning()
      return row
    },
    (row) => row.archiveState === 'archived',
  )

  // 삭제: Inbox·보관됨 → 휴지통. 삭제한 시각과 돌아갈 상태를 남긴다.
  registerAction(
    'trash',
    async (id, userId) => {
      const [row] = await db.drizzle
        .update(contents)
        .set({
          archiveState: 'trashed',
          trashedAt: sql`now()`,
          // SET의 오른쪽은 바뀌기 전 값을 본다.
          trashedFrom: sql`${contents.archiveState}`,
        })
        .where(mineIn(id, userId, ['inbox', 'archived']))
        .returning()
      return row
    },
    (row) => row.archiveState === 'trashed',
  )

  // 복구: 휴지통 → 삭제하기 직전 상태. 휴지통이 아니면 할 일이 없다.
  registerAction(
    'restore',
    async (id, userId) => {
      const [row] = await db.drizzle
        .update(contents)
        .set({
          archiveState: sql`${contents.trashedFrom}`,
          trashedAt: null,
          trashedFrom: null,
        })
        .where(mineIn(id, userId, ['trashed']))
        .returning()
      return row
    },
    () => true,
  )
}
