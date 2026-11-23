import type { Content, SearchMatch, SearchResult } from '@rebomi/api-contract'
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/auth/session'
import type { Locale } from '@/lib/locale'
import { HomeScreen } from '@/library/home-screen'
import { LibraryProvider } from '@/library/library-provider'
import { AppShell } from '@/shell/app-shell'
import { LocaleProvider } from '@/shell/locale-context'
import { errorBody, fakeApi, refreshed, type FakeRequest, type FakeResponse } from '@/test/fake-api'
import { ToastProvider } from '@/ui/toast'
import { SearchProvider } from './search-provider'
import { SearchScreen } from './search-screen'

// 주소는 jsdom의 것을 그대로 쓴다. 화면이 주소를 어떻게 바꾸는지까지 테스트가 본다.
vi.mock('next/navigation', () => ({
  usePathname: () => window.location.pathname,
  useRouter: () => ({
    replace: vi.fn(),
    push: (href: string) => window.history.pushState(null, '', href),
  }),
}))

const NOW = new Date('2026-11-13T06:00:30.000Z')
const PLACEHOLDER = '어떤 내용을 찾고 있나요?'

let nextId = 0

function content(overrides: Partial<Content> = {}): Content {
  nextId += 1
  return {
    id: `00000000-0000-4000-8000-${String(nextId).padStart(12, '0')}`,
    url: `https://example.com/post-${nextId}`,
    title: `글 ${nextId}`,
    description: null,
    domain: 'example.com',
    imageUrl: null,
    savedAt: '2026-11-13T06:00:00.000Z',
    source: 'web',
    archiveState: 'inbox',
    linkState: 'ok',
    extractionLevel: 'full',
    summaryStatus: 'pending',
    metadataStatus: 'done',
    resurfacingIncluded: true,
    ...overrides,
  }
}

/** `text` 안의 `word` 한 곳이 일치한 근거. */
function match(field: SearchMatch['field'], text: string, word: string): SearchMatch {
  const start = text.indexOf(word)
  return { field, text, ranges: [{ start, end: start + word.length }] }
}

function result(overrides: Partial<Content> = {}, matches?: SearchMatch[]): SearchResult {
  const item = content(overrides)
  return {
    content: item,
    matches: matches ?? [
      match('title', item.title ?? item.url, (item.title ?? item.url).slice(0, 1)),
    ],
  }
}

const found = (items: SearchResult[], nextCursor: string | null = null): FakeResponse => ({
  status: 200,
  body: { items, nextCursor },
})

type Routes = {
  search?: (request: FakeRequest) => FakeResponse
  action?: (id: string, action: string) => FakeResponse
  list?: () => FakeResponse
}

type Options = { at?: string; locale?: Locale; narrow?: boolean; withHome?: boolean }

async function setup(routes: Routes, options: Options = {}) {
  window.history.replaceState(null, '', options.at ?? '/app/search')

  const fake = fakeApi((request) => {
    if (request.path === '/auth/refresh') return refreshed
    if (request.path === '/search') {
      return routes.search ? routes.search(request) : found([])
    }
    if (request.path === '/contents' && request.method === 'GET') {
      return routes.list ? routes.list() : { status: 200, body: { items: [], nextCursor: null } }
    }
    const action = /^\/contents\/([^/]+)\/(archive|trash|restore)$/.exec(request.path)
    if (action && request.method === 'POST') {
      return routes.action
        ? routes.action(action[1]!, action[2]!)
        : { status: 500, body: errorBody('INTERNAL') }
    }
    return { status: 404, body: errorBody('NOT_FOUND') }
  })
  await fake.tokens.set({ accessToken: 'access-1', refreshToken: null })

  if (options.narrow) {
    vi.stubGlobal('matchMedia', () => ({
      matches: false,
      addEventListener: () => {},
      removeEventListener: () => {},
    }))
  }

  render(
    <LocaleProvider locale={options.locale ?? 'ko'}>
      <SessionProvider client={fake.api} tokens={fake.tokens}>
        <ToastProvider>
          <LibraryProvider client={fake.api} pollMs={20}>
            <SearchProvider client={fake.api}>
              <AppShell>
                {options.withHome && <HomeScreen now={() => NOW} />}
                <SearchScreen now={() => NOW} />
              </AppShell>
            </SearchProvider>
          </LibraryProvider>
        </ToastProvider>
      </SessionProvider>
    </LocaleProvider>,
  )
  return fake
}

const searches = (requests: FakeRequest[]) => requests.filter((r) => r.path === '/search')
const actions = (requests: FakeRequest[]) =>
  requests.filter((r) => /\/(archive|trash|restore)$/.test(r.path)).map((r) => r.path)

const box = () => screen.getByRole<HTMLInputElement>('searchbox', { name: PLACEHOLDER })
const articles = () => screen.queryAllByRole('article')

async function search(query: string) {
  await userEvent.clear(box())
  await userEvent.type(box(), `${query}{Enter}`)
}

/** 결과 하나의 더 보기 메뉴에서 삭제를 고른다. 확인 대화상자가 뜬다. */
async function chooseDelete(article: HTMLElement) {
  await userEvent.click(within(article).getByRole('button', { name: '더 보기' }))
  await userEvent.click(screen.getByRole('menuitem', { name: '삭제하기' }))
  return within(screen.getByRole('alertdialog', { name: '이 콘텐츠를 삭제할까요?' }))
}

afterEach(() => {
  window.history.replaceState(null, '', '/')
})

describe('검색창', () => {
  it('다른 화면에서도 단어를 넣고 Enter를 누르면 검색 화면에서 결과가 나온다', async () => {
    const { requests } = await setup(
      { search: () => found([result({ title: '커피 내리는 법' })]) },
      { at: '/app' },
    )

    await search('커피')

    expect(await screen.findByRole('heading', { name: '커피 내리는 법' })).toBeDefined()
    expect(searches(requests)).toHaveLength(1)
    expect(searches(requests)[0]!.body).toEqual({ query: '커피' })
    expect(window.location.pathname).toBe('/app/search')
  })

  it('검색어는 서버로 가지 않는 주소의 # 뒤에 남긴다', async () => {
    await setup({}, { at: '/app' })

    await search('커피 원두')

    expect(window.location.search).toBe('')
    expect(new URLSearchParams(window.location.hash.slice(1)).get('q')).toBe('커피 원두')
  })

  it('입력하는 동안에는 찾지 않는다', async () => {
    const { requests } = await setup({})

    await userEvent.type(box(), '커피')

    expect(searches(requests)).toHaveLength(0)
  })

  it('앞뒤 공백은 떼고, 빈 검색어는 서버에 보내지 않는다', async () => {
    const { requests } = await setup({})

    await search('   ')
    expect(searches(requests)).toHaveLength(0)

    await search('  커피  ')
    await waitFor(() => expect(searches(requests)).toHaveLength(1))
    expect(searches(requests)[0]!.body).toEqual({ query: '커피' })
  })

  it('지우기를 누르면 입력이 비고 초점이 입력에 남는다', async () => {
    await setup({})
    await userEvent.type(box(), '커피')

    await userEvent.click(screen.getByRole('button', { name: '검색어 지우기' }))

    expect(box().value).toBe('')
    expect(document.activeElement).toBe(box())
  })

  it('주소에 검색어가 있으면 열자마자 찾고 검색창에도 채운다', async () => {
    const { requests } = await setup(
      { search: () => found([result({ title: '돌아온 결과' })]) },
      { at: '/app/search#q=%EC%BB%A4%ED%94%BC' },
    )

    expect(await screen.findByRole('heading', { name: '돌아온 결과' })).toBeDefined()
    expect(searches(requests)[0]!.body).toEqual({ query: '커피' })
    expect(box().value).toBe('커피')
  })

  it('뒤로 가면 이전 검색어의 결과로 돌아간다', async () => {
    await setup({
      search: (request) => {
        const { query } = request.body as { query: string }
        return found([result({ title: `${query}의 결과` })])
      },
    })
    await search('커피')
    await screen.findByRole('heading', { name: '커피의 결과' })
    await search('원두')
    await screen.findByRole('heading', { name: '원두의 결과' })

    act(() => {
      window.history.replaceState(null, '', '/app/search#q=%EC%BB%A4%ED%94%BC')
      window.dispatchEvent(new PopStateEvent('popstate'))
    })

    expect(await screen.findByRole('heading', { name: '커피의 결과' })).toBeDefined()
    expect(box().value).toBe('커피')
  })

  it('좁은 화면에도 검색창이 있다', async () => {
    await setup({}, { narrow: true })

    expect(box()).toBeDefined()
  })

  it('넓은 화면의 내비게이션에 검색이 있고, 검색 화면에서는 그 항목이 현재 위치다', async () => {
    await setup({})

    const nav = within(screen.getByRole('navigation', { name: '주요 메뉴' }))
    expect(nav.getByRole('link', { name: '검색' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('link', { name: '홈' }).getAttribute('aria-current')).toBeNull()
  })
})

describe('화면의 상태', () => {
  it('입력 전에는 무엇으로 찾는지 안내하고 서버에 묻지 않는다', async () => {
    const { requests } = await setup({})

    expect(screen.getByRole('heading', { name: PLACEHOLDER })).toBeDefined()
    expect(screen.getByText('제목이나 주소, 본문에 있던 단어로 찾아요.')).toBeDefined()
    expect(searches(requests)).toHaveLength(0)
  })

  it('찾는 동안에는 찾는 중이라고 알린다', async () => {
    await setup({ search: () => found([]) })

    // 응답이 오기 전의 화면을 보려고 한 번에 제출한다.
    fireEvent.change(box(), { target: { value: '커피' } })
    fireEvent.submit(box().form!)

    expect(screen.getByRole('status').textContent).toContain('찾고 있어요')
    await screen.findByRole('heading', { name: '맞는 콘텐츠를 찾지 못했어요' })
  })

  it('결과가 없으면 빈 화면이 아니라 안내가 나온다', async () => {
    await setup({ search: () => found([]) })

    await search('없는말')

    expect(
      await screen.findByRole('heading', { name: '맞는 콘텐츠를 찾지 못했어요' }),
    ).toBeDefined()
    expect(screen.getByText(/제목이나 주소의 일부만 입력해도 돼요/)).toBeDefined()
    expect(articles()).toHaveLength(0)
  })

  it('서버에 닿지 못하면 실패를 보여주고, 다시 시도하면 결과가 나온다', async () => {
    let online = false
    await setup({ search: () => (online ? found([result({ title: '돌아온 글' })]) : 'offline') })

    await search('커피')

    expect(await screen.findByRole('heading', { name: '검색하지 못했어요' })).toBeDefined()
    expect(screen.queryByText('맞는 콘텐츠를 찾지 못했어요')).toBeNull()

    online = true
    await userEvent.click(screen.getByRole('button', { name: '다시 시도하기' }))

    expect(await screen.findByRole('heading', { name: '돌아온 글' })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '검색하지 못했어요' })).toBeNull()
  })

  it('서버가 검색어를 받지 않으면 이유를 알린다', async () => {
    await setup({ search: () => ({ status: 400, body: errorBody('VALIDATION_FAILED') }) })

    await search('하나 둘 셋 넷 다섯 여섯 일곱 여덟 아홉 열 열하나')

    expect(await screen.findByText(/단어를 10개까지 줄여서 다시 찾아보세요/)).toBeDefined()
    expect(screen.queryByRole('button', { name: '다시 시도하기' })).toBeNull()
  })

  it('브라우저 언어가 영어면 영어로 보인다', async () => {
    await setup(
      { search: () => found([result({ title: 'Coffee guide' })]) },
      { locale: 'en', at: '/app/search#q=coffee' },
    )

    expect(await screen.findByRole('heading', { name: '1 found' })).toBeDefined()
    expect(screen.getByRole('searchbox', { name: 'What are you looking for?' })).toBeDefined()
    expect(screen.getByRole('link', { name: 'Open original: Coffee guide' })).toBeDefined()
  })
})

describe('결과', () => {
  it('결과마다 출처, 저장일, 추출 수준, 제목이 보이고 원문이 새 탭으로 열린다', async () => {
    await setup({
      search: () => found([result({ title: '커피 내리는 법', url: 'https://example.com/coffee' })]),
    })

    await search('커피')

    const article = within(await screen.findByRole('article'))
    expect(article.getByRole('heading', { name: '커피 내리는 법' })).toBeDefined()
    expect(article.getByText('example.com')).toBeDefined()
    expect(article.getByText('방금')).toBeDefined()
    expect(article.getByText('본문 확보')).toBeDefined()

    const link = article.getByRole<HTMLAnchorElement>('link', { name: '원문 보기: 커피 내리는 법' })
    expect(link.href).toBe('https://example.com/coffee')
    expect(link.target).toBe('_blank')
    expect(screen.getByRole('heading', { name: '1개를 찾았어요' })).toBeDefined()
  })

  it('본문에서 일치하면 그 문장을 보여주고 일치한 글자를 강조한다', async () => {
    const sentence = '물 온도가 높으면 커피가 쓰다.'
    await setup({
      search: () =>
        found([
          result({ title: '커피 내리는 법' }, [
            match('title', '커피 내리는 법', '커피'),
            match('body', sentence, '커피'),
          ]),
        ]),
    })

    await search('커피')

    const article = await screen.findByRole('article')
    expect(within(article).getByText('관련 문장')).toBeDefined()
    expect(article.textContent).toContain(sentence)
    const marks = [...article.querySelectorAll('mark')].map((mark) => mark.textContent)
    expect(marks).toEqual(['커피'])
  })

  it('본문에 없고 설명에서 일치하면 설명을 보여준다', async () => {
    await setup({
      search: () =>
        found([
          result({ title: '원두 고르기' }, [match('description', '집에서 커피를 맛있게', '커피')]),
        ]),
    })

    await search('커피')

    const article = await screen.findByRole('article')
    expect(within(article).getByText('관련 문장')).toBeDefined()
    expect(article.textContent).toContain('집에서 커피를 맛있게')
  })

  it('제목에서만 일치하면 어떤 단어가 제목에 있는지 알린다', async () => {
    await setup({
      search: () =>
        found([result({ title: '커피 내리는 법' }, [match('title', '커피 내리는 법', '커피')])]),
    })

    await search('커피')

    const article = within(await screen.findByRole('article'))
    expect(article.getByText('제목이 일치해요')).toBeDefined()
    expect(article.getByText('‘커피’ 단어가 제목에 있어요')).toBeDefined()
  })

  it('주소에서만 일치하면 주소를 보여주고 일치한 글자를 강조한다', async () => {
    await setup({
      search: () =>
        found([
          result({ title: '블로그 글', url: 'https://example.com/coffee' }, [
            match('url', 'https://example.com/coffee', 'coffee'),
          ]),
        ]),
    })

    await search('coffee')

    const article = await screen.findByRole('article')
    expect(within(article).getByText('주소가 일치해요')).toBeDefined()
    expect(article.querySelector('mark')?.textContent).toBe('coffee')
  })

  it('방금 저장해 처리가 끝나지 않은 콘텐츠는 주소를 제목 자리에 보이고 처리 중이라고 알린다', async () => {
    await setup({
      search: () =>
        found([
          result({ title: null, url: 'https://example.com/new', metadataStatus: 'pending' }, [
            match('url', 'https://example.com/new', 'new'),
          ]),
        ]),
    })

    await search('new')

    const article = within(await screen.findByRole('article'))
    expect(article.getByRole('heading', { name: 'https://example.com/new' })).toBeDefined()
    expect(article.getByText('처리 중')).toBeDefined()
  })

  it('더 남았으면 더 보기로 같은 검색어의 다음 쪽을 이어 받는다', async () => {
    const { requests } = await setup({
      search: (request) =>
        (request.body as { cursor?: string }).cursor === 'next-1'
          ? found([result({ title: '둘째 쪽' })])
          : found([result({ title: '첫째 쪽' })], 'next-1'),
    })

    await search('쪽')
    await screen.findByRole('heading', { name: '첫째 쪽' })
    // 전체 개수를 모른다.
    expect(screen.getByRole('heading', { name: '검색 결과' })).toBeDefined()

    await userEvent.click(screen.getByRole('button', { name: '결과 더 보기' }))

    await waitFor(() => expect(articles()).toHaveLength(2))
    expect(searches(requests)[1]!.body).toEqual({ query: '쪽', cursor: 'next-1' })
    expect(screen.queryByRole('button', { name: '결과 더 보기' })).toBeNull()
    expect(screen.getByRole('heading', { name: '2개를 찾았어요' })).toBeDefined()
  })

  it('다음 쪽을 받지 못하면 알리고 받은 결과는 남긴다', async () => {
    await setup({
      search: (request) =>
        (request.body as { cursor?: string }).cursor
          ? 'offline'
          : found([result({ title: '첫째 쪽' })], 'n'),
    })

    await search('쪽')
    await userEvent.click(await screen.findByRole('button', { name: '결과 더 보기' }))

    expect((await screen.findByRole('alert')).textContent).toContain('서버에 연결할 수 없어요')
    expect(articles()).toHaveLength(1)
  })
})

describe('보관', () => {
  it('보관하면 보관됨이 되고 결과에 그대로 남는다. 되돌리기는 없다', async () => {
    const item = result({ title: '보관할 글' })
    const { requests } = await setup({
      search: () => found([item]),
      action: () => ({ status: 200, body: { ...item.content, archiveState: 'archived' } }),
    })
    await search('글')
    const article = await screen.findByRole('article')

    await userEvent.click(within(article).getByRole('button', { name: '보관하기' }))

    expect(await screen.findByText('보관했어요')).toBeDefined()
    expect(actions(requests)).toEqual([`/contents/${item.content.id}/archive`])
    expect(articles()).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull()
    // 이미 보관됨이면 보관할 것이 없다.
    expect(within(article).queryByRole('button', { name: '보관하기' })).toBeNull()
  })

  it('이미 보관됨인 결과에는 보관 버튼이 없다', async () => {
    await setup({ search: () => found([result({ archiveState: 'archived' })]) })

    await search('글')

    const article = within(await screen.findByRole('article'))
    expect(article.queryByRole('button', { name: '보관하기' })).toBeNull()
    expect(article.getByRole('button', { name: '더 보기' })).toBeDefined()
  })

  it('보관하지 못하면 알리고 보관 버튼은 남는다', async () => {
    await setup({ search: () => found([result()]), action: () => 'offline' })
    await search('글')
    const article = within(await screen.findByRole('article'))

    await userEvent.click(article.getByRole('button', { name: '보관하기' }))

    expect(await screen.findByText(/보관하지 못했어요/)).toBeDefined()
    expect(article.getByRole('button', { name: '보관하기' })).toBeDefined()
  })
})

describe('삭제', () => {
  it('확인을 거친다. 취소하면 아무것도 바뀌지 않는다', async () => {
    const { requests } = await setup({ search: () => found([result({ title: '지울 글' })]) })
    await search('글')

    const dialog = await chooseDelete(await screen.findByRole('article'))
    expect(dialog.getByText('휴지통으로 옮겨요. 30일 안에 복구할 수 있어요.')).toBeDefined()
    await userEvent.click(dialog.getByRole('button', { name: '취소' }))

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(actions(requests)).toEqual([])
    expect(articles()).toHaveLength(1)
  })

  it('확인하면 휴지통으로 가고 결과에서 사라진다', async () => {
    const [first, second] = [result({ title: '지울 글' }), result({ title: '남는 글' })]
    const { requests } = await setup({
      search: () => found([first!, second!]),
      action: () => ({ status: 200, body: { ...first!.content, archiveState: 'trashed' } }),
    })
    await search('글')
    await screen.findByRole('heading', { name: '지울 글' })

    const dialog = await chooseDelete(articles()[0]!)
    await userEvent.click(dialog.getByRole('button', { name: '삭제하기' }))

    await waitFor(() => expect(articles()).toHaveLength(1))
    expect(screen.queryByText('지울 글')).toBeNull()
    expect(screen.getByText('휴지통으로 옮겼어요')).toBeDefined()
    expect(actions(requests)).toEqual([`/contents/${first!.content.id}/trash`])
    expect(screen.getByRole('heading', { name: '1개를 찾았어요' })).toBeDefined()
  })

  it('되돌리면 복구하고 결과의 제자리로 돌아온다', async () => {
    const [first, second] = [result({ title: '지울 글' }), result({ title: '남는 글' })]
    const { requests } = await setup({
      search: () => found([first!, second!]),
      action: (_id, action) => ({
        status: 200,
        body: { ...first!.content, archiveState: action === 'trash' ? 'trashed' : 'inbox' },
      }),
    })
    await search('글')
    await screen.findByRole('heading', { name: '지울 글' })
    const dialog = await chooseDelete(articles()[0]!)
    await userEvent.click(dialog.getByRole('button', { name: '삭제하기' }))

    await userEvent.click(await screen.findByRole('button', { name: '되돌리기' }))

    await waitFor(() => expect(articles()).toHaveLength(2))
    expect(articles()[0]!.textContent).toContain('지울 글')
    expect(actions(requests)).toEqual([
      `/contents/${first!.content.id}/trash`,
      `/contents/${first!.content.id}/restore`,
    ])
    expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull()
  })

  it('삭제하지 못하면 알리고 결과는 남는다', async () => {
    await setup({ search: () => found([result({ title: '지울 글' })]), action: () => 'offline' })
    await search('글')

    const dialog = await chooseDelete(await screen.findByRole('article'))
    await userEvent.click(dialog.getByRole('button', { name: '삭제하기' }))

    expect(await screen.findByText(/삭제하지 못했어요/)).toBeDefined()
    expect(articles()).toHaveLength(1)
    expect(screen.queryByRole('button', { name: '되돌리기' })).toBeNull()
  })

  it('마지막 결과를 지우면 결과 없음 안내가 아니라 빈 결과로 남는다', async () => {
    const item = result({ title: '지울 글' })
    await setup({
      search: () => found([item]),
      action: () => ({ status: 200, body: { ...item.content, archiveState: 'trashed' } }),
    })
    await search('글')

    const dialog = await chooseDelete(await screen.findByRole('article'))
    await userEvent.click(dialog.getByRole('button', { name: '삭제하기' }))

    await waitFor(() => expect(articles()).toHaveLength(0))
    // 되돌릴 수 있는 동안에 "찾지 못했어요"라고 하지 않는다.
    expect(screen.queryByText('맞는 콘텐츠를 찾지 못했어요')).toBeNull()
    expect(screen.getByRole('button', { name: '되돌리기' })).toBeDefined()
  })

  it('삭제한 콘텐츠는 홈의 최근 저장에서도 빠지고, 되돌리면 다시 나온다', async () => {
    const item = result({ title: '지울 글' })
    let trashed = false
    await setup(
      {
        search: () => found([item]),
        list: () => ({
          status: 200,
          body: {
            items: trashed ? [] : [item.content, content({ title: '다른 글' })],
            nextCursor: null,
          },
        }),
        action: (_id, action) => {
          trashed = action === 'trash'
          return {
            status: 200,
            body: { ...item.content, archiveState: trashed ? 'trashed' : 'inbox' },
          }
        },
      },
      { withHome: true },
    )
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
    await search('글')

    const dialog = await chooseDelete(await screen.findByRole('article'))
    await userEvent.click(dialog.getByRole('button', { name: '삭제하기' }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(1))

    await userEvent.click(screen.getByRole('button', { name: '되돌리기' }))
    await waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
  })

  it('Esc로 확인 대화상자를 닫으면 삭제하지 않는다', async () => {
    const { requests } = await setup({ search: () => found([result()]) })
    await search('글')
    await chooseDelete(await screen.findByRole('article'))

    await userEvent.keyboard('{Escape}')

    expect(screen.queryByRole('alertdialog')).toBeNull()
    expect(actions(requests)).toEqual([])
  })
})
