import { randomUUID } from 'node:crypto'
import {
  SEARCH_DEFAULT_LIMIT,
  SEARCH_MAX_LIMIT,
  SEARCH_MAX_TERMS,
  SEARCH_QUERY_MAX_LENGTH,
  searchResponseSchema,
  type SearchMatch,
  type SearchResponse,
} from '@rebomi/api-contract'
import { createDb, inArray, schema, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { signAccessToken } from './auth/tokens.js'
import type { JobQueue } from './jobs.js'
import { parseHighlighted } from './search/keyword.js'

const connectionString = process.env.DATABASE_URL

const JWT_SECRET = 'test-secret-test-secret-test-secret-0123'

/** 검색은 잡을 넣지 않는다. */
const noJobs: JobQueue = {
  enqueueContentProcess: () => Promise.reject(new Error('검색은 잡을 넣지 않는다')),
}

let db: Db
const createdUserIds: string[] = []
let apps: FastifyInstance[] = []

beforeAll(() => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)
})

afterEach(async () => {
  for (const app of apps) await app.close()
  apps = []
})

afterAll(async () => {
  if (createdUserIds.length > 0) {
    await db.drizzle.delete(schema.users).where(inArray(schema.users.id, createdUserIds))
  }
  await db.close()
})

function newApp(): FastifyInstance {
  const app = buildApp({
    db,
    corsOrigins: ['http://localhost:3000'],
    auth: { jwtSecret: JWT_SECRET, verifiers: {}, secureCookies: false },
    jobs: noJobs,
  })
  apps.push(app)
  return app
}

async function newUser(): Promise<{ id: string; token: string }> {
  const [user] = await db.drizzle
    .insert(schema.users)
    .values({ email: `search-${randomUUID()}@example.com` })
    .returning()
  createdUserIds.push(user!.id)
  return { id: user!.id, token: await signAccessToken(JWT_SECRET, user!.id, new Date()) }
}

type Fixture = Partial<typeof schema.contents.$inferInsert> & { body?: string }

/** 콘텐츠를 넣는다. `body` 를 주면 본문도 넣는다. */
async function insertContent(userId: string, fixture: Fixture = {}): Promise<string> {
  const { body, ...values } = fixture
  const url = values.url ?? `https://example.com/${randomUUID()}`
  const [row] = await db.drizzle
    .insert(schema.contents)
    .values({
      userId,
      url,
      normalizedUrl: url,
      domain: 'example.com',
      source: 'web',
      resurfacingIncluded: true,
      extractionLevel: body === undefined ? 'metadata_only' : 'full',
      ...(values.archiveState === 'trashed'
        ? { trashedAt: new Date(), trashedFrom: 'inbox' as const }
        : {}),
      ...values,
    })
    .returning()
  if (body !== undefined) {
    await db.drizzle.insert(schema.contentBodies).values({ contentId: row!.id, text: body })
  }
  return row!.id
}

const search = (app: FastifyInstance, token: string | null, payload: unknown) =>
  app.inject({
    method: 'POST',
    url: '/search',
    payload: payload as object,
    headers: token ? { authorization: `Bearer ${token}` } : {},
  })

async function searchOk(
  app: FastifyInstance,
  token: string,
  payload: { query: string; limit?: number; cursor?: string },
): Promise<SearchResponse> {
  const response = await search(app, token, payload)
  expect(response.statusCode).toBe(200)
  return searchResponseSchema.parse(response.json())
}

const idsOf = (response: SearchResponse): string[] => response.items.map((item) => item.content.id)

const errorCode = (response: { json(): unknown }): string =>
  (response.json() as { error: { code: string } }).error.code

/** 근거에서 강조되는 글자들. */
const highlighted = (match: SearchMatch): string[] =>
  match.ranges.map((range) => match.text.slice(range.start, range.end))

const matchIn = (response: SearchResponse, id: string, field: SearchMatch['field']) =>
  response.items.find((item) => item.content.id === id)?.matches.find((m) => m.field === field)

describe('POST /search — 한국어 부분 일치', () => {
  it('조사가 붙은 형태의 일부로 제목이 검색된다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, { title: '검색엔진을 만드는 방법' })
    await insertContent(user.id, { title: '요리 레시피' })

    const found = await searchOk(newApp(), user.token, { query: '검색엔진' })

    expect(idsOf(found)).toEqual([id])
    const match = matchIn(found, id, 'title')
    expect(match?.text).toBe('검색엔진을 만드는 방법')
    expect(highlighted(match!)).toEqual(['검색엔진'])
  })

  it('복합어의 일부로 제목과 본문이 검색된다', async () => {
    const user = await newUser()
    const byTitle = await insertContent(user.id, { title: '복합명사검색 안내' })
    const byBody = await insertContent(user.id, {
      title: '다른 제목',
      body: '이 글은 스마트폰사용시간을 줄이는 법과 명사 분석을 다룬다.',
    })

    const app = newApp()
    expect(idsOf(await searchOk(app, user.token, { query: '명사' })).sort()).toEqual(
      [byTitle, byBody].sort(),
    )
    expect(idsOf(await searchOk(app, user.token, { query: '사용시간' }))).toEqual([byBody])
  })

  it('조사가 붙은 형태의 일부로 본문이 검색되고, 본문 조각이 근거로 온다', async () => {
    const user = await newUser()
    const body = `${'앞 문단이다. '.repeat(80)}김치찌개를 끓이는 법을 적는다. ${'뒤 문단이다. '.repeat(80)}`
    const id = await insertContent(user.id, { title: '요리', body })

    const found = await searchOk(newApp(), user.token, { query: '김치찌개' })

    expect(idsOf(found)).toEqual([id])
    const match = matchIn(found, id, 'body')
    expect(highlighted(match!)).toEqual(['김치찌개'])
    // 본문 전체가 아니라 일치한 곳 주변의 조각이다.
    expect(match!.text.length).toBeLessThan(400)
    expect(match!.text).toContain('김치찌개를 끓이는 법')
    expect(body).toContain(match!.text)
  })

  it('한 글자로도 검색된다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, { title: '김치찌개' })

    expect(idsOf(await searchOk(newApp(), user.token, { query: '김' }))).toEqual([id])
  })
})

describe('POST /search — 영어와 섞인 검색어', () => {
  it('한국어와 영어가 섞인 검색어로 결과가 나온다', async () => {
    const user = await newUser()
    const both = await insertContent(user.id, {
      title: '검색엔진을 만드는 방법',
      body: 'PostgreSQL 전문검색과 PGroonga를 다룬다.',
    })
    await insertContent(user.id, { title: '검색엔진 비교', body: 'Elasticsearch 이야기' })
    await insertContent(user.id, { title: 'Postgres tips', body: 'vacuum and indexes' })

    const found = await searchOk(newApp(), user.token, { query: '검색 postgres' })

    expect(idsOf(found)).toEqual([both])
    expect(highlighted(matchIn(found, both, 'title')!)).toEqual(['검색'])
    expect(highlighted(matchIn(found, both, 'body')!)).toContain('PostgreS')
  })

  it('한 단어 안에 한국어와 영어가 붙어 있어도 검색된다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, { title: 'React훅 정리' })

    expect(idsOf(await searchOk(newApp(), user.token, { query: 'react훅' }))).toEqual([id])
  })

  it('영어도 단어의 일부로, 대소문자를 가리지 않고 검색된다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, { title: 'Building a search engine' })

    const app = newApp()
    expect(idsOf(await searchOk(app, user.token, { query: 'engin' }))).toEqual([id])
    expect(idsOf(await searchOk(app, user.token, { query: 'SEARCH' }))).toEqual([id])
  })

  it('모든 단어가 들어 있어야 한다', async () => {
    const user = await newUser()
    await insertContent(user.id, { title: '검색엔진', body: '본문' })

    expect(idsOf(await searchOk(newApp(), user.token, { query: '검색 없는단어' }))).toEqual([])
  })

  it('같은 단어를 여러 번 써도 결과가 같다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, { title: 'Postgres' })

    expect(
      idsOf(await searchOk(newApp(), user.token, { query: 'postgres POSTGRES Postgres' })),
    ).toEqual([id])
  })

  it('검색 문법처럼 보이는 글자와 기호는 글자 그대로 찾고 오류를 내지 않는다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, { title: 'C++ (입문) "따옴표" 100%' })
    await insertContent(user.id, { title: 'A or B' })

    const app = newApp()
    for (const query of ['C++', '(입문)', '"따옴표"', '100%', '(', '"', '*', '\\', "'", '-입문']) {
      const response = await search(app, user.token, { query })
      expect(response.statusCode, query).toBe(200)
    }
    expect(idsOf(await searchOk(app, user.token, { query: 'C++' }))).toEqual([id])
    // OR는 연산자가 아니라 단어다. 두 제목 모두 "OR"와 "없는말"을 함께 갖고 있지 않다.
    expect(idsOf(await searchOk(app, user.token, { query: 'C++ OR 없는말' }))).toEqual([])
  })
})

describe('POST /search — 본문이 없는 콘텐츠', () => {
  it('제목으로 검색되고 추출 수준이 함께 온다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, { title: '메타데이터만 있는 글' })

    const found = await searchOk(newApp(), user.token, { query: '메타데이터' })

    expect(idsOf(found)).toEqual([id])
    expect(found.items[0]!.content.extractionLevel).toBe('metadata_only')
    expect(found.items[0]!.matches.map((m) => m.field)).toEqual(['title'])
  })

  it('주소의 경로로 검색된다', async () => {
    const user = await newUser()
    const url = `https://blog.example.com/posts/pgroonga-intro-${randomUUID()}`
    const id = await insertContent(user.id, { url, title: null })

    const found = await searchOk(newApp(), user.token, { query: 'pgroonga-intro' })

    expect(idsOf(found)).toEqual([id])
    const match = matchIn(found, id, 'url')
    expect(match?.text).toBe(url)
    expect(highlighted(match!)).toEqual(['pgroonga-intro'])
  })

  it('도메인으로 검색된다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, {
      url: `https://www.velog.io/@someone/${randomUUID()}`,
      domain: 'velog.io',
      title: null,
    })
    await insertContent(user.id, { title: null })

    const found = await searchOk(newApp(), user.token, { query: 'velog.io' })

    expect(idsOf(found)).toEqual([id])
    expect(highlighted(matchIn(found, id, 'url')!)).toEqual(['velog.io'])
  })

  it('주소에 그대로 없는 도메인(국제화 도메인)으로도 검색되고 도메인이 근거로 온다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, {
      url: `https://xn--9t4b11yi5a.example/${randomUUID()}`,
      domain: '테스트.example',
      title: null,
    })

    const found = await searchOk(newApp(), user.token, { query: '테스트' })

    expect(idsOf(found)).toEqual([id])
    expect(matchIn(found, id, 'url')).toEqual({
      field: 'url',
      text: '테스트.example',
      ranges: [{ start: 0, end: 3 }],
    })
  })

  it('설명으로 검색된다', async () => {
    const user = await newUser()
    const id = await insertContent(user.id, {
      title: '제목',
      description: '디지털 디톡스를 시작하는 사람을 위한 안내',
    })

    const found = await searchOk(newApp(), user.token, { query: '디톡스' })

    expect(idsOf(found)).toEqual([id])
    expect(highlighted(matchIn(found, id, 'description')!)).toEqual(['디톡스'])
  })
})

describe('POST /search — 근거', () => {
  it('모든 결과에 근거가 하나 이상 있고, 구간이 글 안의 일치한 글자를 가리킨다', async () => {
    const user = await newUser()
    await insertContent(user.id, { title: '검색엔진', body: '검색에 대한 본문' })
    await insertContent(user.id, { title: null, description: '검색 설명' })
    await insertContent(user.id, { title: '다른 글', body: '여기에도 검색이 나온다' })

    const found = await searchOk(newApp(), user.token, { query: '검색' })

    expect(found.items).toHaveLength(3)
    for (const item of found.items) {
      expect(item.matches.length).toBeGreaterThan(0)
      for (const match of item.matches) {
        expect(match.ranges.length).toBeGreaterThan(0)
        expect(highlighted(match).every((text) => text === '검색')).toBe(true)
      }
    }
  })

  it('글에 든 HTML 기호는 그대로 오고 구간이 어긋나지 않는다', async () => {
    const user = await newUser()
    const title = '<b>굵게</b> & "따옴표" 그리고 <span class="keyword">가짜</span> 찾는말'
    const id = await insertContent(user.id, { title, body: `본문 <i>기울임</i> & 찾는말 끝` })

    const found = await searchOk(newApp(), user.token, { query: '찾는말' })

    const titleMatch = matchIn(found, id, 'title')!
    expect(titleMatch.text).toBe(title)
    expect(highlighted(titleMatch)).toEqual(['찾는말'])
    const bodyMatch = matchIn(found, id, 'body')!
    expect(bodyMatch.text).toBe('본문 <i>기울임</i> & 찾는말 끝')
    expect(highlighted(bodyMatch)).toEqual(['찾는말'])
  })

  it('본문 조각은 두 개까지만 온다', async () => {
    const user = await newUser()
    const far = '가나다라마바사 '.repeat(100)
    const id = await insertContent(user.id, {
      title: '제목',
      body: `찾는말 하나 ${far}찾는말 둘 ${far}찾는말 셋 ${far}찾는말 넷`,
    })

    const found = await searchOk(newApp(), user.token, { query: '찾는말' })

    const bodyMatches = found.items
      .find((item) => item.content.id === id)!
      .matches.filter((m) => m.field === 'body')
    expect(bodyMatches).toHaveLength(2)
  })
})

describe('parseHighlighted', () => {
  it('강조가 없으면 글 그대로다', () => {
    expect(parseHighlighted('그냥 글')).toEqual({ text: '그냥 글', ranges: [] })
  })

  it('강조 표시를 떼고 구간으로 바꾼다', () => {
    expect(
      parseHighlighted(
        '<span class="keyword">검색</span>엔진과 <span class="keyword">Postgre</span>SQL',
      ),
    ).toEqual({
      text: '검색엔진과 PostgreSQL',
      ranges: [
        { start: 0, end: 2 },
        { start: 6, end: 13 },
      ],
    })
  })

  it('이스케이프된 기호를 되돌리고, 구간은 되돌린 글의 위치다', () => {
    expect(
      parseHighlighted('&lt;b&gt; &amp;amp; &quot;<span class="keyword">a&amp;b</span>&quot;'),
    ).toEqual({ text: '<b> &amp; "a&b"', ranges: [{ start: 11, end: 14 }] })
  })
})

describe('POST /search — 범위', () => {
  it('일치가 없으면 오류가 아니라 빈 결과다', async () => {
    const user = await newUser()
    await insertContent(user.id, { title: '검색엔진' })

    const found = await searchOk(newApp(), user.token, { query: '어디에도없는말' })

    expect(found).toEqual({ items: [], nextCursor: null })
  })

  it('콘텐츠가 하나도 없는 사용자도 빈 결과를 받는다', async () => {
    const user = await newUser()

    expect(await searchOk(newApp(), user.token, { query: '검색' })).toEqual({
      items: [],
      nextCursor: null,
    })
  })

  it('다른 사용자의 콘텐츠는 제목으로도 본문으로도 나오지 않는다', async () => {
    const me = await newUser()
    const other = await newUser()
    const word = `비밀단어${randomUUID().replaceAll('-', '')}`
    await insertContent(other.id, { title: `${word} 제목` })
    await insertContent(other.id, { title: '남의 글', body: `본문에 ${word} 있음` })
    const mine = await insertContent(me.id, { title: `${word} 내 글` })

    const app = newApp()
    expect(idsOf(await searchOk(app, me.token, { query: word }))).toEqual([mine])
    expect(await searchOk(app, (await newUser()).token, { query: word })).toEqual({
      items: [],
      nextCursor: null,
    })
  })

  it('한 단어는 내 글에, 다른 단어는 남의 본문에 있으면 결과가 아니다', async () => {
    const me = await newUser()
    const other = await newUser()
    const word = `남의단어${randomUUID().replaceAll('-', '')}`
    await insertContent(me.id, { title: '내단어 글' })
    await insertContent(other.id, { title: '남의 글', body: `${word}` })

    expect(idsOf(await searchOk(newApp(), me.token, { query: `내단어 ${word}` }))).toEqual([])
  })

  it('휴지통의 콘텐츠는 나오지 않고, Inbox와 보관됨은 나온다', async () => {
    const user = await newUser()
    const inbox = await insertContent(user.id, { title: '찾는말 인박스' })
    const archived = await insertContent(user.id, {
      title: '찾는말 보관',
      archiveState: 'archived',
    })
    await insertContent(user.id, { title: '찾는말 휴지통', archiveState: 'trashed' })
    await insertContent(user.id, {
      title: '휴지통 본문',
      body: '찾는말',
      archiveState: 'trashed',
    })

    const found = await searchOk(newApp(), user.token, { query: '찾는말' })

    expect(idsOf(found).sort()).toEqual([inbox, archived].sort())
  })

  it('인증 없는 요청은 401이다', async () => {
    const response = await search(newApp(), null, { query: '검색' })

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('UNAUTHORIZED')
  })
})

describe('POST /search — 정렬과 페이지', () => {
  it('제목에서 일치한 것이 본문에서만 일치한 것보다 먼저 온다', async () => {
    const user = await newUser()
    // 본문에서만 일치하는 쪽을 더 최근에 저장해, 저장일이 아니라 관련도로 갈리는지 본다.
    const inTitle = await insertContent(user.id, {
      title: '찾는말이 제목에',
      savedAt: new Date('2026-01-01T00:00:00Z'),
    })
    const inBody = await insertContent(user.id, {
      title: '다른 제목',
      body: '찾는말이 본문에',
      savedAt: new Date('2026-06-01T00:00:00Z'),
    })
    const inDescription = await insertContent(user.id, {
      title: '또 다른 제목',
      description: '찾는말이 설명에',
      savedAt: new Date('2026-03-01T00:00:00Z'),
    })

    const found = await searchOk(newApp(), user.token, { query: '찾는말' })

    expect(idsOf(found)).toEqual([inTitle, inDescription, inBody])
  })

  it('관련도가 같으면 최근에 저장한 것이 먼저 온다', async () => {
    const user = await newUser()
    const old = await insertContent(user.id, {
      title: '찾는말 하나',
      savedAt: new Date('2026-01-01T00:00:00Z'),
    })
    const recent = await insertContent(user.id, {
      title: '찾는말 둘',
      savedAt: new Date('2026-06-01T00:00:00Z'),
    })

    expect(idsOf(await searchOk(newApp(), user.token, { query: '찾는말' }))).toEqual([recent, old])
  })

  it('페이지를 넘기면 빠지거나 겹치지 않고 끝에서 nextCursor가 null이다', async () => {
    const user = await newUser()
    const expected: string[] = []
    for (let i = 0; i < 5; i += 1) {
      expected.unshift(
        await insertContent(user.id, {
          title: `찾는말 ${i}`,
          savedAt: new Date(`2026-01-0${i + 1}T00:00:00Z`),
        }),
      )
    }

    const app = newApp()
    const first = await searchOk(app, user.token, { query: '찾는말', limit: 2 })
    expect(first.nextCursor).not.toBeNull()
    const second = await searchOk(app, user.token, {
      query: '찾는말',
      limit: 2,
      cursor: first.nextCursor!,
    })
    const third = await searchOk(app, user.token, {
      query: '찾는말',
      limit: 2,
      cursor: second.nextCursor!,
    })

    expect([...idsOf(first), ...idsOf(second), ...idsOf(third)]).toEqual(expected)
    expect(third.nextCursor).toBeNull()
  })

  it('결과가 한 페이지에 딱 맞으면 nextCursor가 null이다', async () => {
    const user = await newUser()
    await insertContent(user.id, { title: '찾는말 a' })
    await insertContent(user.id, { title: '찾는말 b' })

    const found = await searchOk(newApp(), user.token, { query: '찾는말', limit: 2 })

    expect(found.items).toHaveLength(2)
    expect(found.nextCursor).toBeNull()
  })

  it('크기를 생략하면 기본 크기만큼 준다', async () => {
    const user = await newUser()
    await db.drizzle.insert(schema.contents).values(
      Array.from({ length: SEARCH_DEFAULT_LIMIT + 1 }, (_, i) => ({
        userId: user.id,
        url: `https://example.com/default-${i}`,
        normalizedUrl: `https://example.com/default-${i}`,
        domain: 'example.com',
        source: 'web' as const,
        resurfacingIncluded: true,
        title: `찾는말 ${i}`,
      })),
    )

    const found = await searchOk(newApp(), user.token, { query: '찾는말' })

    expect(found.items).toHaveLength(SEARCH_DEFAULT_LIMIT)
    expect(found.nextCursor).not.toBeNull()
  })
})

describe('POST /search — 잘못된 요청', () => {
  it.each([
    ['빈 검색어', { query: '' }],
    ['공백뿐인 검색어', { query: '   ' }],
    ['검색어 없음', {}],
    ['문자열이 아닌 검색어', { query: 1 }],
    ['너무 긴 검색어', { query: '가'.repeat(SEARCH_QUERY_MAX_LENGTH + 1) }],
    [
      '너무 많은 단어',
      { query: Array.from({ length: SEARCH_MAX_TERMS + 1 }, (_, i) => `w${i}`).join(' ') },
    ],
    ['0인 크기', { query: '검색', limit: 0 }],
    ['상한을 넘는 크기', { query: '검색', limit: SEARCH_MAX_LIMIT + 1 }],
    ['우리가 만들지 않은 커서', { query: '검색', cursor: 'not-a-cursor' }],
    [
      '음수 위치의 커서',
      { query: '검색', cursor: Buffer.from(JSON.stringify(['offset', -1])).toString('base64url') },
    ],
    [
      '너무 먼 위치의 커서',
      {
        query: '검색',
        cursor: Buffer.from(JSON.stringify(['offset', 1_000_000])).toString('base64url'),
      },
    ],
  ])('%s는 400 VALIDATION_FAILED다', async (_name, payload) => {
    const user = await newUser()

    const response = await search(newApp(), user.token, payload)

    expect(response.statusCode).toBe(400)
    expect(errorCode(response)).toBe('VALIDATION_FAILED')
  })

  it('상한 길이의 검색어는 받는다', async () => {
    const user = await newUser()

    const response = await search(newApp(), user.token, {
      query: '가'.repeat(SEARCH_QUERY_MAX_LENGTH),
    })

    expect(response.statusCode).toBe(200)
  })
})
