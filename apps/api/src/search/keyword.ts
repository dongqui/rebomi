import type { SearchMatch } from '@rebomi/api-contract'
import { and, eq, inArray, schema, sql, type Db, type SQL } from '@rebomi/db'

/*
 * 키워드 검색 엔진 (search.md SRCH-1). PGroonga에 묶인 SQL은 이 파일에만 둔다 — Phase 2
 * 평가에서 엔진을 바꾸게 되면 여기만 바꾼다. 밖에서는 `keywordSearch` 의 입력과 결과만 본다.
 */

const { contents, contentBodies } = schema

type ContentRow = typeof contents.$inferSelect

/** 일치한 곳의 가중치. 제목에서 일치한 콘텐츠가 본문에서만 일치한 것보다 위에 온다. */
const WEIGHT = { title: 4, meta: 2, body: 1 } as const

/** 본문 조각의 크기(바이트). 한글로 100자쯤이다. */
const BODY_SNIPPET_BYTES = 300
/** 한 결과에 싣는 본문 조각의 수. */
const BODY_SNIPPET_MAX = 2

export type KeywordSearchInput = {
  userId: string
  /** 모두 들어 있어야 하는 단어들. 하나 이상. */
  terms: string[]
  limit: number
  offset: number
}

export type KeywordSearchResult = {
  items: { row: ContentRow; matches: SearchMatch[] }[]
  hasMore: boolean
}

/** 제목·설명·주소·도메인. 인덱스 `contents_search_idx` 의 식과 같아야 인덱스를 쓴다. */
const metaText = sql`array[${contents.title}, ${contents.description}, ${contents.url}, ${contents.domain}]`

const textArray = (values: string[]): SQL =>
  sql`array[${sql.join(
    values.map((value) => sql`${value}`),
    sql`, `,
  )}]::text[]`

/**
 * 그 사용자의 콘텐츠 가운데 모든 단어가 들어 있는 것을 관련도순으로 준다. 단어마다 제목·
 * 설명·주소·도메인·본문 어디에 있어도 된다. 휴지통은 빠진다.
 *
 * 단어는 글자 그대로 찾는다(`&@`). 검색 문법으로 해석하는 `&@~` 를 쓰지 않으므로 사용자가
 * 넣은 기호가 문법 오류가 되지 않는다.
 */
export async function keywordSearch(
  db: Db,
  input: KeywordSearchInput,
): Promise<KeywordSearchResult> {
  const { userId, terms, limit, offset } = input
  if (terms.length === 0) return { items: [], hasMore: false }

  // 단어마다 일치한 콘텐츠를 두 인덱스에서 따로 모은다. 한 조건에 OR로 묶으면 서로 다른
  // 테이블의 인덱스를 함께 쓸 수 없다.
  const hits = sql.join(
    terms.flatMap((term, index) => [
      sql`select ${contents.id} as content_id, ${index}::int as term, ${WEIGHT.meta}::int as weight
          from ${contents}
          where ${contents.userId} = ${userId} and ${metaText} &@ ${term}`,
      sql`select ${contentBodies.contentId}, ${index}::int, ${WEIGHT.body}::int
          from ${contentBodies}
          where ${contentBodies.text} &@ ${term}`,
    ]),
    sql` union all `,
  )

  const termArray = textArray(terms)
  const ranked = await db.drizzle.execute(sql`
    with hits as (${hits}),
    matched as (
      select content_id, sum(weight) as score
      from hits
      group by content_id
      having count(distinct term) = ${terms.length}::int
    )
    select ${contents.id} as id
    from matched
    join ${contents} on ${contents.id} = matched.content_id
    -- 본문 인덱스에는 남의 본문도 있다. 사용자와 휴지통은 여기서 거른다 (architecture.md §3).
    where ${contents.userId} = ${userId} and ${contents.archiveState} <> 'trashed'
    order by
      matched.score + ${WEIGHT.title}::int * (
        select count(*) from unnest(${termArray}) as keyword where ${contents.title} &@ keyword
      ) desc,
      ${contents.savedAt} desc,
      ${contents.id} desc
    -- 하나 더 읽어 다음 페이지가 있는지 본다.
    limit ${limit + 1}::int offset ${offset}::int
  `)

  const ids = (ranked.rows as { id: string }[]).map((row) => row.id)
  const pageIds = ids.slice(0, limit)
  if (pageIds.length === 0) return { items: [], hasMore: false }

  // 근거는 이 페이지에 실릴 행에 대해서만 만든다. 본문은 DB 밖으로 꺼내지 않는다.
  const rows = await db.drizzle
    .select({
      row: contents,
      title: sql<string | null>`pgroonga_highlight_html(${contents.title}, ${termArray})`,
      description: sql<
        string | null
      >`pgroonga_highlight_html(${contents.description}, ${termArray})`,
      url: sql<string>`pgroonga_highlight_html(${contents.url}, ${termArray})`,
      domain: sql<string>`pgroonga_highlight_html(${contents.domain}, ${termArray})`,
      body: sql<
        string[] | null
      >`pgroonga_snippet_html(${contentBodies.text}, ${termArray}, ${BODY_SNIPPET_BYTES}::int)`,
    })
    .from(contents)
    .leftJoin(contentBodies, eq(contentBodies.contentId, contents.id))
    .where(and(inArray(contents.id, pageIds), eq(contents.userId, userId)))

  const byId = new Map(rows.map((found) => [found.row.id, found]))
  const items = pageIds.flatMap((id) => {
    const found = byId.get(id)
    // 두 질의 사이에 지워진 행은 건너뛴다.
    if (!found) return []
    return [{ row: found.row, matches: matchesOf(found) }]
  })

  return { items, hasMore: ids.length > limit }
}

type Highlighted = {
  row: ContentRow
  title: string | null
  description: string | null
  url: string
  domain: string
  body: string[] | null
}

/** 강조 표시가 든 값들에서 근거를 만든다. 일치한 곳만 싣는다. */
function matchesOf(found: Highlighted): SearchMatch[] {
  const matches: SearchMatch[] = []
  const add = (field: SearchMatch['field'], html: string | null): boolean => {
    if (html === null) return false
    const parsed = parseHighlighted(html)
    if (parsed.ranges.length === 0) return false
    matches.push({ field, ...parsed })
    return true
  }

  add('title', found.title)
  // 도메인은 주소의 일부다. 주소에서 못 찾았을 때만(국제화 도메인 등) 도메인을 보인다.
  if (!add('url', found.url)) add('url', found.domain)
  add('description', found.description)
  for (const snippet of (found.body ?? []).slice(0, BODY_SNIPPET_MAX)) add('body', snippet)

  // 인덱스의 정규화와 강조의 정규화가 어긋나면 일치 위치를 못 찾을 수 있다. 그래도 결과에는
  // 근거가 있어야 하므로, 위치 없이 제목이나 주소를 싣는다.
  if (matches.length === 0) {
    matches.push(
      found.row.title === null
        ? { field: 'url', text: found.row.url, ranges: [] }
        : { field: 'title', text: found.row.title, ranges: [] },
    )
  }
  return matches
}

const KEYWORD_OPEN = '<span class="keyword">'
const KEYWORD_CLOSE = '</span>'

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

const unescapeHtml = (html: string): string =>
  html.replace(/&(?:amp|lt|gt|quot|#39);/g, (entity) => ENTITIES[entity] ?? entity)

/**
 * PGroonga가 돌려준 강조 HTML을 글과 일치 구간으로 바꾼다. 원문의 `<` 는 `&lt;` 로 바뀌어
 * 오므로, 글에 보이는 `<span class="keyword">` 는 언제나 PGroonga가 넣은 것이다.
 */
export function parseHighlighted(html: string): Pick<SearchMatch, 'text' | 'ranges'> {
  let text = ''
  const ranges: SearchMatch['ranges'] = []

  let position = 0
  while (position < html.length) {
    const open = html.indexOf(KEYWORD_OPEN, position)
    if (open === -1) break
    const close = html.indexOf(KEYWORD_CLOSE, open + KEYWORD_OPEN.length)
    if (close === -1) break

    text += unescapeHtml(html.slice(position, open))
    const keyword = unescapeHtml(html.slice(open + KEYWORD_OPEN.length, close))
    ranges.push({ start: text.length, end: text.length + keyword.length })
    text += keyword
    position = close + KEYWORD_CLOSE.length
  }
  text += unescapeHtml(html.slice(position))

  return { text, ranges }
}
