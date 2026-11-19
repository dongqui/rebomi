import type { WaitlistHeadline, WaitlistHero, WaitlistLocale } from '@rebomi/api-contract'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { fakeApi, type FakeRequest, type FakeResponse } from '@/test/fake-api'
import { JoinButton, WaitlistProvider } from './waitlist'

const saved: FakeResponse = { status: 204 }
const UUID =
  /^\/waitlist\/responses\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const Q1 = 'Which best describes what you’re doing these days?'
const Q2 = 'When you save something, what are you hoping to do with it?'
const Q3 = 'What frustrates you most about the things you save?'
const Q4 = 'If Rebomi could help you with one thing, what would you want it to be?'
const EMAIL = 'Where should we send your invite?'
const OTHER_BOX = 'Tell us in your own words'

function setup(
  options: {
    respond?: (request: FakeRequest, nth: number) => FakeResponse
    locale?: WaitlistLocale
    headline?: WaitlistHeadline
    hero?: WaitlistHero
  } = {},
) {
  let nth = 0
  const fake = fakeApi((request) => {
    nth += 1
    return options.respond ? options.respond(request, nth) : saved
  })
  const user = userEvent.setup()
  render(
    <WaitlistProvider
      client={fake.api}
      locale={options.locale ?? 'en'}
      headline={options.headline ?? 'progress'}
      hero={options.hero ?? 'none'}
    >
      <p>page content</p>
      <JoinButton />
    </WaitlistProvider>,
  )
  const open = () => user.click(screen.getByRole('button', { name: 'Join the waitlist' }))
  const dialog = () => screen.getByRole('dialog')
  const option = (name: string) => within(dialog()).getByRole('button', { name })
  const bodies = () => fake.requests.map((request) => request.body)
  return { ...fake, user, open, dialog, option, bodies }
}

type Setup = ReturnType<typeof setup>

/** 첫 질문에 답해 두 번째 질문으로 간다. */
async function answerFirst({ user, option }: Setup) {
  await user.click(option('Working at a company'))
  await screen.findByRole('heading', { name: Q2 })
}

/** 질문 네 개에 모두 답해 이메일 단계까지 간다. */
async function answerAll(app: Setup) {
  await app.open()
  await answerFirst(app)
  await app.user.click(app.option('Learn something'))
  await screen.findByRole('heading', { name: Q3 })
  await app.user.click(app.option('I forget I saved them at all'))
  await screen.findByRole('heading', { name: Q4 })
  await app.user.click(app.option('Picking what’s worth my time right now'))
  await screen.findByRole('heading', { name: EMAIL })
}

const base = { locale: 'en', headline: 'progress', hero: 'none' }

const allAnswers = {
  ...base,
  occupation: 'employed',
  saveIntent: 'learn',
  frustration: 'forget',
  wantedHelp: 'pick',
}

describe('등록 대화상자 열기와 닫기', () => {
  it('처음에는 대화상자가 없고, 등록 버튼을 누르면 첫 질문이 열린다', async () => {
    const app = setup()
    expect(screen.queryByRole('dialog')).toBeNull()

    await app.open()

    expect(app.dialog().getAttribute('aria-modal')).toBe('true')
    expect(within(app.dialog()).getByRole('heading', { name: Q1 })).toBeDefined()
    expect(within(app.dialog()).getByText('1 of 4')).toBeDefined()
    // 첫 질문에서는 돌아갈 곳이 없고, 고르면 넘어가므로 "다음"도 없다.
    expect(app.option('Back')).toHaveProperty('disabled', true)
    expect(within(app.dialog()).queryByRole('button', { name: 'Next' })).toBeNull()
  })

  it('열기만 하고 닫으면 서버로 아무것도 보내지 않는다', async () => {
    const app = setup()

    await app.open()
    await app.user.click(app.option('Close'))

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(app.requests).toHaveLength(0)
  })

  it('Esc로 닫고, 닫으면 포커스가 누른 등록 버튼으로 돌아간다', async () => {
    const app = setup()
    await app.open()

    await app.user.keyboard('{Escape}')

    expect(screen.queryByRole('dialog')).toBeNull()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Join the waitlist' }))
  })

  it('열려 있는 동안 뒤의 페이지는 조작할 수 없다', async () => {
    const app = setup()
    const page = screen.getByText('page content').parentElement!
    expect(page.hasAttribute('inert')).toBe(false)

    await app.open()

    expect(page.hasAttribute('inert')).toBe(true)
  })

  it('닫았다 다시 열면 하던 단계와 고른 답이 그대로다', async () => {
    const app = setup()
    await app.open()
    await answerFirst(app)
    await app.user.click(app.option('Close'))

    await app.open()

    expect(within(app.dialog()).getByRole('heading', { name: Q2 })).toBeDefined()
    await app.user.click(app.option('Back'))
    expect(app.option('Working at a company').getAttribute('aria-pressed')).toBe('true')
    expect(app.option('Freelancing').getAttribute('aria-pressed')).toBe('false')
  })

  it('한국어면 한국어 문구로 보인다', async () => {
    const app = setup({ locale: 'ko' })

    await app.user.click(screen.getByRole('button', { name: '대기 명단 등록하기' }))

    expect(
      within(app.dialog()).getByRole('heading', { name: '지금 주로 어떤 일을 하고 있나요?' }),
    ).toBeDefined()
    expect(within(app.dialog()).getByText('4개 중 1번째')).toBeDefined()
  })
})

describe('답을 고를 때마다 저장한다', () => {
  it('첫 답을 고르면 브라우저가 만든 ID로 응답 저장 요청이 간다', async () => {
    const app = setup({ locale: 'ko', headline: 'scattered', hero: 'card' })
    await app.user.click(screen.getByRole('button', { name: '대기 명단 등록하기' }))

    await app.user.click(app.option('프리랜서로 일하고 있어요'))

    await waitFor(() => expect(app.requests).toHaveLength(1))
    const [request] = app.requests
    expect(request!.method).toBe('PUT')
    expect(request!.path).toMatch(UUID)
    expect(request!.authorization).toBeNull()
    expect(request!.body).toEqual({
      locale: 'ko',
      headline: 'scattered',
      hero: 'card',
      occupation: 'freelance',
    })
  })

  it('고르면 저장하고 다음 질문으로 넘어간다', async () => {
    const app = setup()
    await app.open()
    await answerFirst(app)

    await app.user.click(app.option('Try something'))

    await screen.findByRole('heading', { name: Q3 })
    expect(within(app.dialog()).getByText('3 of 4')).toBeDefined()
    expect(app.bodies().at(-1)).toEqual({ ...base, occupation: 'employed', saveIntent: 'try' })
  })

  it('이전으로 돌아가 답을 바꾸면 바뀐 답이 저장된다', async () => {
    const app = setup()
    await app.open()
    await answerFirst(app)
    await app.user.click(app.option('Learn something'))
    await screen.findByRole('heading', { name: Q3 })

    await app.user.click(app.option('Back'))
    expect(app.option('Learn something').getAttribute('aria-pressed')).toBe('true')
    await app.user.click(app.option('Enjoy it later'))

    await waitFor(() => expect(app.bodies().at(-1)).toMatchObject({ saveIntent: 'enjoy' }))
  })

  it('네 질문에 답하면 마지막 요청에 네 답이 모두 실리고 이메일 단계가 된다', async () => {
    const app = setup()

    await answerAll(app)

    expect(within(app.dialog()).getByText('Last step')).toBeDefined()
    expect(app.bodies().at(-1)).toEqual(allAnswers)
    expect(new Set(app.requests.map((request) => request.path)).size).toBe(1)
  })

  it('답 저장이 실패해도 설문은 계속되고, 다음 저장에 그때까지의 답이 모두 실린다', async () => {
    const app = setup({ respond: (_request, nth) => (nth <= 2 ? 'offline' : saved) })
    await app.open()
    await answerFirst(app)

    await app.user.click(app.option('Learn something'))
    await screen.findByRole('heading', { name: Q3 })
    await app.user.click(app.option('Nothing really bothers me'))

    await screen.findByRole('heading', { name: Q4 })
    expect(within(app.dialog()).queryByRole('alert')).toBeNull()
    await waitFor(() => expect(app.requests).toHaveLength(3))
    expect(app.bodies().at(-1)).toEqual({
      ...base,
      occupation: 'employed',
      saveIntent: 'learn',
      frustration: 'none',
    })
  })

  it('서버가 요청을 거부해도(429) 설문은 계속된다', async () => {
    const app = setup({
      respond: () => ({
        status: 429,
        body: { error: { code: 'RATE_LIMITED', message: 'rate limited' } },
      }),
    })
    await app.open()
    await answerFirst(app)

    await app.user.click(app.option('Keep it for reference'))

    await screen.findByRole('heading', { name: Q3 })
  })
})

describe('기타', () => {
  it('기타를 고르면 넘어가지 않고, 직접 적는 칸과 "다음"이 나오며 커서가 칸으로 간다', async () => {
    const app = setup()
    await app.open()
    expect(within(app.dialog()).queryByLabelText(OTHER_BOX)).toBeNull()

    await app.user.click(app.option('Other'))

    const box = within(app.dialog()).getByLabelText(OTHER_BOX)
    await waitFor(() => expect(document.activeElement).toBe(box))
    expect(app.option('Next')).toHaveProperty('disabled', false)
    expect(within(app.dialog()).getByRole('heading', { name: Q1 })).toBeDefined()
    // 고른 것은 바로 저장된다. 적은 글은 아직 없다.
    expect(app.bodies().at(-1)).toEqual({ ...base, occupation: 'other' })
  })

  it('적고 "다음"을 누르면 적은 글이 함께 저장되고 다음 질문으로 간다', async () => {
    const app = setup()
    await app.open()
    await app.user.click(app.option('Other'))

    await app.user.type(within(app.dialog()).getByLabelText(OTHER_BOX), '  Raising two kids ')
    await app.user.click(app.option('Next'))

    await screen.findByRole('heading', { name: Q2 })
    await waitFor(() =>
      expect(app.bodies().at(-1)).toEqual({
        ...base,
        occupation: 'other',
        occupationOther: 'Raising two kids',
      }),
    )
  })

  it('칸에서 Enter로도 넘어간다', async () => {
    const app = setup()
    await app.open()
    await app.user.click(app.option('Other'))

    await app.user.type(within(app.dialog()).getByLabelText(OTHER_BOX), 'Between jobs{Enter}')

    await screen.findByRole('heading', { name: Q2 })
    await waitFor(() =>
      expect(app.bodies().at(-1)).toMatchObject({ occupationOther: 'Between jobs' }),
    )
  })

  it('아무것도 적지 않고도 넘어갈 수 있다 — 적은 글은 보내지 않는다', async () => {
    const app = setup()
    await app.open()
    await app.user.click(app.option('Other'))

    await app.user.click(app.option('Next'))

    await screen.findByRole('heading', { name: Q2 })
    expect(app.bodies().at(-1)).toEqual({ ...base, occupation: 'other' })
  })

  it('글자를 적는 동안에는 보내지 않는다', async () => {
    const app = setup()
    await app.open()
    await app.user.click(app.option('Other'))
    await waitFor(() => expect(app.requests).toHaveLength(1))

    await app.user.type(within(app.dialog()).getByLabelText(OTHER_BOX), 'typing')

    expect(app.requests).toHaveLength(1)
  })

  it('기타에서 다른 답으로 바꾸면 적은 글을 보내지 않고, 돌아와 기타를 고르면 글이 남아 있다', async () => {
    const app = setup()
    await app.open()
    await app.user.click(app.option('Other'))
    await app.user.type(within(app.dialog()).getByLabelText(OTHER_BOX), 'Between jobs')

    await app.user.click(app.option('Freelancing'))
    await screen.findByRole('heading', { name: Q2 })
    expect(app.bodies().at(-1)).toEqual({ ...base, occupation: 'freelance' })

    await app.user.click(app.option('Back'))
    expect(within(app.dialog()).queryByLabelText(OTHER_BOX)).toBeNull()
    await app.user.click(app.option('Other'))

    expect(within(app.dialog()).getByLabelText(OTHER_BOX)).toHaveProperty('value', 'Between jobs')
  })
})

describe('이메일', () => {
  it('형식이 틀리면 서버로 보내지 않고 그 자리에서 알린다', async () => {
    const app = setup()
    await answerAll(app)
    const before = app.requests.length
    const input = within(app.dialog()).getByLabelText('Email')
    expect(
      within(app.dialog()).getByText('We’ll only email you about Rebomi’s launch.'),
    ).toBeDefined()

    await app.user.type(input, 'not-an-email')
    await app.user.click(app.option('Join the waitlist'))

    expect(within(app.dialog()).getByText('Enter a valid email address.')).toBeDefined()
    expect(input.getAttribute('aria-invalid')).toBe('true')
    expect(app.requests).toHaveLength(before)
    expect(within(app.dialog()).getByRole('heading', { name: EMAIL })).toBeDefined()
  })

  it('무엇을 왜 받고, 얼마나 보관하고, 어디로 삭제를 요청하는지 알린다', async () => {
    const app = setup()
    await answerAll(app)

    const notice = within(app.dialog()).getByText(/We collect your email and survey answers/)

    expect(notice.textContent).toContain('one year')
    expect(notice.textContent).toContain('projectn.contact@gmail.com')
  })

  it('고쳐 쓰면 오류 표시가 사라진다', async () => {
    const app = setup()
    await answerAll(app)
    const input = within(app.dialog()).getByLabelText('Email')
    await app.user.click(app.option('Join the waitlist'))
    expect(input.getAttribute('aria-invalid')).toBe('true')

    await app.user.type(input, 'someone@example.com')

    expect(input.getAttribute('aria-invalid')).toBe('false')
    expect(within(app.dialog()).queryByText('Enter a valid email address.')).toBeNull()
  })

  it('이메일을 내면 같은 응답에 답과 이메일을 함께 보내고, 성공한 뒤 완료 화면이 나온다', async () => {
    const app = setup()
    await answerAll(app)

    await app.user.type(within(app.dialog()).getByLabelText('Email'), '  someone@example.com ')
    await app.user.click(app.option('Join the waitlist'))

    await screen.findByRole('heading', { name: 'You’re on the list.' })
    expect(app.bodies().at(-1)).toEqual({ ...allAnswers, email: 'someone@example.com' })
    expect(new Set(app.requests.map((request) => request.path)).size).toBe(1)
  })

  it('Enter로도 낼 수 있다', async () => {
    const app = setup()
    await answerAll(app)

    await app.user.type(within(app.dialog()).getByLabelText('Email'), 'someone@example.com{Enter}')

    await screen.findByRole('heading', { name: 'You’re on the list.' })
  })

  it('이메일 저장이 실패하면 완료 화면이 나오지 않고 다시 시도할 수 있다', async () => {
    let failing = false
    const app = setup({ respond: () => (failing ? 'offline' : saved) })
    await answerAll(app)
    failing = true

    await app.user.type(within(app.dialog()).getByLabelText('Email'), 'someone@example.com')
    await app.user.click(app.option('Join the waitlist'))

    const alert = await within(app.dialog()).findByRole('alert')
    expect(alert.textContent).toBe('We couldn’t save that. Please try again.')
    expect(screen.queryByRole('heading', { name: 'You’re on the list.' })).toBeNull()
    expect(within(app.dialog()).getByLabelText('Email')).toHaveProperty(
      'value',
      'someone@example.com',
    )

    failing = false
    await app.user.click(app.option('Join the waitlist'))

    await screen.findByRole('heading', { name: 'You’re on the list.' })
    expect(app.bodies().at(-1)).toEqual({ ...allAnswers, email: 'someone@example.com' })
  })

  it('완료 화면을 닫고 등록 버튼을 다시 눌러도 완료 화면이고, 새 요청을 보내지 않는다', async () => {
    const app = setup()
    await answerAll(app)
    await app.user.type(within(app.dialog()).getByLabelText('Email'), 'someone@example.com{Enter}')
    await screen.findByRole('heading', { name: 'You’re on the list.' })
    const before = app.requests.length

    await app.user.click(app.option('Back to the page'))
    expect(screen.queryByRole('dialog')).toBeNull()
    await app.open()

    expect(within(app.dialog()).getByRole('heading', { name: 'You’re on the list.' })).toBeDefined()
    expect(app.requests).toHaveLength(before)
  })
})

describe('키보드', () => {
  it('등록 버튼부터 완료까지 키보드만으로 진행할 수 있다', async () => {
    const app = setup()
    const { user } = app

    // 등록 버튼으로 가서 연다.
    await user.tab()
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Join the waitlist' }))
    await user.keyboard('{Enter}')

    // 질문마다: 넘어오면 첫 Tab이 첫 선택지로 간다.
    for (const [title, first] of [
      [Q1, 'Studying or learning new skills'],
      [Q2, 'Learn something'],
      [Q3, 'I forget I saved them at all'],
      [Q4, 'Rediscovering good things I’d forgotten about'],
    ] as const) {
      await screen.findByRole('heading', { name: title })
      await user.tab()
      expect(document.activeElement).toBe(app.option(first))
      await user.keyboard('{Enter}')
    }

    // 이메일: 넘어오면 입력란에 포커스가 있다.
    await screen.findByRole('heading', { name: EMAIL })
    expect(document.activeElement).toBe(within(app.dialog()).getByLabelText('Email'))
    await user.keyboard('someone@example.com{Enter}')

    await screen.findByRole('heading', { name: 'You’re on the list.' })
    expect(app.bodies().at(-1)).toEqual({
      ...base,
      occupation: 'studying',
      saveIntent: 'learn',
      frustration: 'forget',
      wantedHelp: 'rediscover',
      email: 'someone@example.com',
    })
  })

  it('Tab이 대화상자 밖으로 나가지 않는다', async () => {
    const app = setup()
    await app.open()

    for (let n = 0; n < 12; n += 1) {
      await app.user.tab()
      expect(app.dialog().contains(document.activeElement)).toBe(true)
    }
    await app.user.tab({ shift: true })
    expect(app.dialog().contains(document.activeElement)).toBe(true)
  })
})

describe('모바일 키보드', () => {
  /** 브라우저의 visual viewport 흉내. `shrinkTo` 가 키보드가 올라온 것이다. */
  function fakeViewport() {
    const viewport = Object.assign(new EventTarget(), { height: 800, offsetTop: 0 })
    vi.stubGlobal('visualViewport', viewport)
    return {
      shrinkTo(height: number, offsetTop = 0) {
        act(() => {
          Object.assign(viewport, { height, offsetTop })
          viewport.dispatchEvent(new Event('resize'))
        })
      },
    }
  }

  const overlay = (app: Setup) => app.dialog().parentElement!

  it('키보드가 올라와 보이는 영역이 줄면 대화상자도 그 영역에 맞춰 줄어든다', async () => {
    const viewport = fakeViewport()
    const app = setup()
    await app.open()
    expect(overlay(app).style.height).toBe('800px')

    viewport.shrinkTo(420, 96)

    expect(overlay(app).style.height).toBe('420px')
    expect(overlay(app).style.top).toBe('96px')
  })

  it('보이는 영역이 줄 때 쓰고 있던 입력란을 보이는 곳으로 올린다', async () => {
    const viewport = fakeViewport()
    const app = setup()
    await answerAll(app)
    const input = within(app.dialog()).getByLabelText('Email')
    const reveal = vi.fn()
    input.scrollIntoView = reveal
    expect(document.activeElement).toBe(input)

    viewport.shrinkTo(420)

    expect(reveal).toHaveBeenCalledWith({ block: 'nearest' })
  })

  it('입력란을 쓰고 있지 않으면 아무것도 스크롤하지 않는다', async () => {
    const viewport = fakeViewport()
    const app = setup()
    await app.open()
    const reveal = vi.fn()
    app.option('Other').scrollIntoView = reveal

    viewport.shrinkTo(420)

    expect(reveal).not.toHaveBeenCalled()
  })

  it('기타를 고르면 적는 칸을 보이는 곳으로 올린다', async () => {
    fakeViewport()
    const app = setup()
    await app.open()
    const reveal = vi.fn()
    HTMLInputElement.prototype.scrollIntoView = reveal

    await app.user.click(app.option('Other'))

    await waitFor(() => expect(reveal).toHaveBeenCalledWith({ block: 'nearest' }))
    // @ts-expect-error jsdom에는 원래 없다. 다른 테스트에 남기지 않는다.
    delete HTMLInputElement.prototype.scrollIntoView
  })

  it('visual viewport를 주지 않는 브라우저에서는 화면 전체를 쓴다', async () => {
    const app = setup()

    await app.open()

    expect(overlay(app).style.height).toBe('')
  })
})
