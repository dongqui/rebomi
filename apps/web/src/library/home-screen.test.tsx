import type { Content } from '@rebomi/api-contract'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { SessionProvider } from '@/auth/session'
import type { Locale } from '@/lib/locale'
import { AppShell } from '@/shell/app-shell'
import { LocaleProvider } from '@/shell/locale-context'
import { SearchProvider } from '@/search/search-provider'
import { errorBody, fakeApi, refreshed, type FakeRequest, type FakeResponse } from '@/test/fake-api'
import { ToastProvider } from '@/ui/toast'
import { HomeScreen } from './home-screen'
import { LibraryProvider } from './library-provider'

vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ replace: vi.fn(), push: vi.fn() }),
}))

/** 화면이 "지금"으로 삼는 시각. 아래 `content()` 의 저장 시각에서 30초 뒤다. */
const NOW = new Date('2026-11-13T06:00:30.000Z')

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
    extractionLevel: 'metadata_only',
    summaryStatus: 'pending',
    metadataStatus: 'done',
    resurfacingIncluded: true,
    ...overrides,
  }
}

type Routes = {
  list?: (request: FakeRequest) => FakeResponse
  save?: (request: FakeRequest) => FakeResponse
  one?: (id: string, request: FakeRequest) => FakeResponse
}

const page = (items: Content[], nextCursor: string | null = null): FakeResponse => ({
  status: 200,
  body: { items, nextCursor },
})

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/**
 * 로그인된 상태의 앱 틀 + 홈. 폴링 간격은 테스트가 기다릴 수 있게 짧다.
 * `narrow` 면 좁은 화면(860px 이하)이다.
 */
async function setup(routes: Routes, options: { locale?: Locale; narrow?: boolean } = {}) {
  const fake = fakeApi((request) => {
    if (request.path === '/auth/refresh') return refreshed
    if (request.path === '/contents' && request.method === 'GET') {
      return routes.list ? routes.list(request) : page([])
    }
    if (request.path === '/contents' && request.method === 'POST') {
      return routes.save ? routes.save(request) : { status: 500, body: errorBody('INTERNAL') }
    }
    if (request.path.startsWith('/contents/')) {
      const id = request.path.slice('/contents/'.length)
      return routes.one ? routes.one(id, request) : { status: 404, body: errorBody('NOT_FOUND') }
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
                <HomeScreen now={() => NOW} />
              </AppShell>
            </SearchProvider>
          </LibraryProvider>
        </ToastProvider>
      </SessionProvider>
    </LocaleProvider>,
  )
  return fake
}

const FIRST_USE = '저장한 콘텐츠가 아직 없어요'

const rows = () => screen.queryAllByRole('listitem')
const saves = (requests: FakeRequest[]) =>
  requests.filter((request) => request.path === '/contents' && request.method === 'POST')
const lists = (requests: FakeRequest[]) =>
  requests.filter((request) => request.path === '/contents' && request.method === 'GET')
const polls = (requests: FakeRequest[]) =>
  requests.filter((request) => request.path.startsWith('/contents/'))

const addressInput = () => screen.getByLabelText<HTMLInputElement>('링크 주소')

/** 링크 저장 대화상자를 열고(이미 열려 있으면 그대로) 주소를 넣어 저장한다. */
async function save(url: string) {
  if (screen.queryByRole('dialog') === null) {
    await userEvent.click(screen.getByRole('button', { name: '링크 저장' }))
  }
  await userEvent.clear(addressInput())
  if (url) await userEvent.type(addressInput(), url)
  await userEvent.click(screen.getByRole('button', { name: '저장' }))
}

function setHidden(hidden: boolean) {
  Object.defineProperty(document, 'hidden', { configurable: true, value: hidden })
}

afterEach(() => {
  setHidden(false)
  delete document.documentElement.dataset.theme
  window.localStorage.clear()
})

describe('목록', () => {
  it('항목마다 제목, 출처, 저장일, 추출 수준을 보여준다', async () => {
    await setup({
      list: () => page([content({ title: '읽을 글', extractionLevel: 'full' })]),
    })

    const row = within(await screen.findByRole('listitem'))
    expect(row.getByText('읽을 글')).toBeDefined()
    expect(row.getByText('example.com')).toBeDefined()
    expect(row.getByText('방금')).toBeDefined()
    expect(row.getByText('본문 확보')).toBeDefined()
    // 처리가 끝난 항목에는 처리 상태를 따로 보이지 않는다.
    expect(row.queryByText('처리 중')).toBeNull()
  })

  it('추출 수준과 처리 상태를 값마다 다른 말로 보여준다', async () => {
    await setup({
      list: () =>
        page([
          content({ extractionLevel: 'partial', metadataStatus: 'pending' }),
          content({ extractionLevel: 'metadata_only', metadataStatus: 'failed' }),
        ]),
    })

    const [first, second] = await screen.findAllByRole('listitem')
    expect(within(first!).getByText('본문 일부')).toBeDefined()
    expect(within(first!).getByText('처리 중')).toBeDefined()
    expect(within(second!).getByText('메타데이터만')).toBeDefined()
    expect(within(second!).getByText('페이지 정보를 가져오지 못했어요')).toBeDefined()
  })

  it('제목이 아직 없으면 주소를 대신 보여준다', async () => {
    await setup({
      list: () => page([content({ title: null, url: 'https://example.com/untitled' })]),
    })

    const row = within(await screen.findByRole('listitem'))
    expect(row.getByText('https://example.com/untitled')).toBeDefined()
  })

  it('원문이 새 탭으로 열린다', async () => {
    await setup({
      list: () => page([content({ title: '읽을 글', url: 'https://example.com/read' })]),
    })

    const link = await screen.findByRole<HTMLAnchorElement>('link', { name: '원문 보기: 읽을 글' })
    expect(link.href).toBe('https://example.com/read')
    expect(link.target).toBe('_blank')
  })

  it('저장한 것이 없으면 빈 목록이 아니라 첫 사용 안내를 보이고, 거기서 링크 저장을 연다', async () => {
    await setup({ list: () => page([]) })

    expect(await screen.findByRole('heading', { name: FIRST_USE })).toBeDefined()
    expect(screen.queryByRole('heading', { name: '최근 저장' })).toBeNull()

    await userEvent.click(screen.getByRole('button', { name: '링크 저장하기' }))

    expect(screen.getByRole('dialog', { name: '링크 저장하기' })).toBeDefined()
    expect(document.activeElement).toBe(addressInput())
  })

  it('API에 닿지 못하면 빈 목록이 아니라 오류를 보여주고, 다시 시도하면 불러온다', async () => {
    let online = false
    await setup({ list: () => (online ? page([content({ title: '돌아온 글' })]) : 'offline') })

    expect((await screen.findByRole('alert')).textContent).toContain('서버에 연결할 수 없어요')
    expect(screen.queryByText(FIRST_USE)).toBeNull()

    online = true
    await userEvent.click(screen.getByRole('button', { name: '다시 시도하기' }))

    expect(await screen.findByText('돌아온 글')).toBeDefined()
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('다음 페이지가 있으면 더 보기로 이어서 받고, 끝나면 더 보기가 사라진다', async () => {
    const { requests } = await setup({
      list: (request) =>
        request.search.includes('cursor=next-1')
          ? page([content({ title: '둘째 쪽' })])
          : page([content({ title: '첫째 쪽' })], 'next-1'),
    })

    await userEvent.click(await screen.findByRole('button', { name: '더 보기' }))

    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(rows()[0]!.textContent).toContain('첫째 쪽')
    expect(rows()[1]!.textContent).toContain('둘째 쪽')
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull()
    expect(lists(requests)).toHaveLength(2)
  })

  it('다음 페이지가 없으면 더 보기가 없다', async () => {
    await setup({ list: () => page([content()]) })

    await screen.findByRole('listitem')
    expect(screen.queryByRole('button', { name: '더 보기' })).toBeNull()
  })

  it('다음 페이지를 받지 못하면 오류를 알리고 이미 받은 항목은 남긴다', async () => {
    await setup({
      list: (request) =>
        request.search.includes('cursor=') ? 'offline' : page([content({ title: '첫째 쪽' })], 'n'),
    })

    await userEvent.click(await screen.findByRole('button', { name: '더 보기' }))

    expect((await screen.findByRole('alert')).textContent).toContain('서버에 연결할 수 없어요')
    expect(screen.getByText('첫째 쪽')).toBeDefined()
    expect(screen.getByRole('button', { name: '더 보기' })).toBeDefined()
  })
})

describe('저장', () => {
  it('저장하면 새로고침 없이 목록 맨 위에 나타나고 대화상자가 닫힌다', async () => {
    const saved = content({
      title: null,
      url: 'https://example.com/new',
      metadataStatus: 'pending',
    })
    const { requests } = await setup({
      list: () => page([content({ title: '예전 글' })]),
      save: () => ({ status: 201, body: { status: 'created', content: saved } }),
      one: () => ({ status: 200, body: saved }),
    })
    await screen.findByText('예전 글')

    await save('https://example.com/new')

    await waitFor(() => expect(rows()).toHaveLength(2))
    expect(rows()[0]!.textContent).toContain('https://example.com/new')
    expect(rows()[1]!.textContent).toContain('예전 글')
    expect(screen.getByRole('status').textContent).toContain('저장했어요')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(saves(requests)[0]!.body).toEqual({ url: 'https://example.com/new', source: 'web' })
    // 목록을 다시 받아서 보여준 것이 아니다.
    expect(lists(requests)).toHaveLength(1)
  })

  it('중복이면 중복이라고 알리고 기존 항목을 보여주며 목록은 늘지 않는다', async () => {
    const existing = content({ title: '이미 있는 글', extractionLevel: 'full' })
    await setup({
      list: () => page([content({ title: '다른 글' }), existing]),
      save: () => ({ status: 200, body: { status: 'duplicate', content: existing } }),
    })
    await screen.findByText('다른 글')

    await save('https://example.com/dup?utm_source=x')

    const notice = within(await within(screen.getByRole('dialog')).findByRole('status'))
    expect(notice.getByText(/이미 저장한 링크예요/)).toBeDefined()
    expect(notice.getByText('이미 있는 글')).toBeDefined()
    expect(rows()).toHaveLength(2)
    // 순서도 그대로다 (product.md D-15).
    expect(rows()[0]!.textContent).toContain('다른 글')
  })

  it('빈 입력은 이유를 알리고 서버에 보내지 않는다', async () => {
    const { requests } = await setup({ list: () => page([]) })
    await screen.findByText(FIRST_USE)

    await save('')

    expect((await screen.findByRole('alert')).textContent).toContain('주소를 입력해 주세요')
    expect(saves(requests)).toHaveLength(0)
  })

  it('앞뒤 공백은 떼고 보낸다', async () => {
    const saved = content()
    const { requests } = await setup({
      save: () => ({ status: 201, body: { status: 'created', content: saved } }),
    })
    await screen.findByText(FIRST_USE)

    await save('  https://example.com/a  ')

    await waitFor(() => expect(saves(requests)).toHaveLength(1))
    expect(saves(requests)[0]!.body).toEqual({ url: 'https://example.com/a', source: 'web' })
  })

  it('서버가 유효하지 않다고 한 주소는 이유를 알리고 저장되지 않는다', async () => {
    await setup({
      list: () => page([content({ title: '있던 글' })]),
      save: () => ({ status: 400, body: errorBody('VALIDATION_FAILED') }),
    })
    await screen.findByText('있던 글')

    await save('ftp://example.com/file')

    expect((await screen.findByRole('alert')).textContent).toContain(
      'http 또는 https 주소만 저장할 수 있어요',
    )
    expect(rows()).toHaveLength(1)
    // 고쳐 쓸 수 있게 입력은 남긴다.
    expect(addressInput().value).toBe('ftp://example.com/file')
  })

  it('저장 요청이 서버에 닿지 못하면 오류를 알리고 목록은 그대로다', async () => {
    await setup({ list: () => page([content({ title: '있던 글' })]), save: () => 'offline' })
    await screen.findByText('있던 글')

    await save('https://example.com/a')

    expect((await screen.findByRole('alert')).textContent).toContain('서버에 연결할 수 없어요')
    expect(rows()).toHaveLength(1)
  })

  it('그 밖의 서버 오류도 성공처럼 보이지 않는다', async () => {
    await setup({ save: () => ({ status: 500, body: errorBody('INTERNAL') }) })
    await screen.findByText(FIRST_USE)

    await save('https://example.com/a')

    expect((await screen.findByRole('alert')).textContent).toContain('저장하지 못했어요')
    expect(screen.queryByRole('status')).toBeNull()
  })
})

describe('처리 상태 갱신', () => {
  it('처리가 끝나면 사용자 조작 없이 제목과 추출 수준이 바뀌고, 그 뒤로는 묻지 않는다', async () => {
    const pending = content({ title: null, metadataStatus: 'pending' })
    let processed = false
    const { requests } = await setup({
      list: () => page([pending]),
      one: () => ({
        status: 200,
        body: processed
          ? { ...pending, title: '가져온 제목', extractionLevel: 'full', metadataStatus: 'done' }
          : pending,
      }),
    })
    await screen.findByText('처리 중')
    await waitFor(() => expect(polls(requests).length).toBeGreaterThan(0))

    processed = true

    expect(await screen.findByText('가져온 제목')).toBeDefined()
    const row = within(screen.getByRole('listitem'))
    expect(row.getByText('본문 확보')).toBeDefined()
    expect(row.queryByText('처리 중')).toBeNull()
    expect(polls(requests)[0]!.path).toBe(`/contents/${pending.id}`)

    const settled = polls(requests).length
    await wait(100)
    expect(polls(requests)).toHaveLength(settled)
  })

  it('처리 중인 항목이 없으면 묻지 않는다', async () => {
    const { requests } = await setup({ list: () => page([content(), content()]) })
    await screen.findAllByRole('listitem')

    await wait(100)

    expect(polls(requests)).toHaveLength(0)
  })

  it('처리 중인 항목만 묻는다', async () => {
    const pending = content({ metadataStatus: 'pending' })
    const { requests } = await setup({
      list: () => page([content(), pending]),
      one: () => ({ status: 200, body: pending }),
    })

    await waitFor(() => expect(polls(requests).length).toBeGreaterThan(1))

    expect(new Set(polls(requests).map((request) => request.path))).toEqual(
      new Set([`/contents/${pending.id}`]),
    )
  })

  it('방금 저장한 항목도 처리가 끝나면 갱신된다', async () => {
    const saved = content({ title: null, metadataStatus: 'pending' })
    await setup({
      save: () => ({ status: 201, body: { status: 'created', content: saved } }),
      one: () => ({ status: 200, body: { ...saved, title: '새 글 제목', metadataStatus: 'done' } }),
    })
    await screen.findByText(FIRST_USE)

    await save(saved.url)

    expect(await screen.findByText('새 글 제목')).toBeDefined()
  })

  it('확인에 실패해도 항목을 그대로 두고 다음에 다시 묻는다', async () => {
    const pending = content({ title: '기다리는 글', metadataStatus: 'pending' })
    let online = false
    await setup({
      list: () => page([pending]),
      one: () =>
        online ? { status: 200, body: { ...pending, metadataStatus: 'done' } } : 'offline',
    })
    await screen.findByText('처리 중')
    await wait(60)
    expect(screen.getByText('기다리는 글')).toBeDefined()

    online = true

    await waitFor(() => expect(screen.queryByText('처리 중')).toBeNull())
    expect(screen.getByText('기다리는 글')).toBeDefined()
  })

  it('그 사이 사라진 항목은 목록에서 뺀다', async () => {
    const pending = content({ title: '지워진 글', metadataStatus: 'pending' })
    await setup({
      list: () => page([pending, content({ title: '남는 글' })]),
      one: () => ({ status: 404, body: errorBody('NOT_FOUND') }),
    })
    await screen.findByText('남는 글')

    await waitFor(() => expect(screen.queryByText('지워진 글')).toBeNull())
    expect(screen.getByText('남는 글')).toBeDefined()
  })

  it('탭이 숨겨져 있는 동안에는 묻지 않는다', async () => {
    setHidden(true)
    const pending = content({ metadataStatus: 'pending' })
    const { requests } = await setup({
      list: () => page([pending]),
      one: () => ({ status: 200, body: pending }),
    })
    await screen.findByText('처리 중')

    await wait(100)
    expect(polls(requests)).toHaveLength(0)

    setHidden(false)
    await waitFor(() => expect(polls(requests).length).toBeGreaterThan(0))
  })
})

describe('링크 저장 대화상자', () => {
  it('Esc나 닫기로 닫히고, 열기 전에 있던 버튼으로 초점이 돌아간다', async () => {
    await setup({ list: () => page([content()]) })
    await screen.findByRole('listitem')
    const opener = screen.getByRole('button', { name: '링크 저장' })

    await userEvent.click(opener)
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(opener)

    await userEvent.click(opener)
    await userEvent.click(screen.getByRole('button', { name: '닫기' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})

describe('앱 틀', () => {
  it('넓은 화면에서는 사이드바에 내비게이션과 설정이 있다', async () => {
    await setup({ list: () => page([content()]) })

    const nav = within(screen.getByRole('navigation', { name: '주요 메뉴' }))
    expect(nav.getByRole('link', { name: '홈' }).getAttribute('aria-current')).toBe('page')
    expect(nav.getByRole('button', { name: '설정' })).toBeDefined()
  })

  it('좁은 화면에서는 상단 바에 내비게이션이 있고 설정은 그 밖의 아이콘이다', async () => {
    await setup({ list: () => page([content()]) }, { narrow: true })

    const nav = within(screen.getByRole('navigation', { name: '주요 메뉴' }))
    expect(nav.getByRole('link', { name: '홈' })).toBeDefined()
    expect(nav.queryByRole('button', { name: '설정' })).toBeNull()
    expect(screen.getByRole('button', { name: '설정' })).toBeDefined()
    expect(screen.getByRole('button', { name: '링크 저장' })).toBeDefined()
  })

  it('설정에서 테마를 고르면 화면에 적용되고 이 브라우저에 남는다', async () => {
    await setup({ list: () => page([content()]) })

    await userEvent.click(screen.getByRole('button', { name: '설정' }))
    expect(
      screen.getByRole('menuitemradio', { name: '시스템 설정' }).getAttribute('aria-checked'),
    ).toBe('true')

    await userEvent.click(screen.getByRole('menuitemradio', { name: '다크' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
    expect(window.localStorage.getItem('rebomi-theme')).toBe('dark')
    expect(screen.getByRole('menuitemradio', { name: '다크' }).getAttribute('aria-checked')).toBe(
      'true',
    )

    // 시스템 설정으로 돌리면 고정을 푼다.
    await userEvent.click(screen.getByRole('menuitemradio', { name: '시스템 설정' }))
    expect(document.documentElement.dataset.theme).toBeUndefined()
    expect(window.localStorage.getItem('rebomi-theme')).toBeNull()
  })

  it('브라우저 언어가 영어면 영어로 보인다', async () => {
    await setup(
      { list: () => page([content({ title: 'A post', extractionLevel: 'full' })]) },
      { locale: 'en' },
    )

    const row = within(await screen.findByRole('listitem'))
    expect(screen.getByRole('heading', { name: 'Recently saved' })).toBeDefined()
    expect(row.getByText('Just now')).toBeDefined()
    expect(row.getByText('Full text')).toBeDefined()
    expect(screen.getByRole('button', { name: 'Save link' })).toBeDefined()
  })
})
