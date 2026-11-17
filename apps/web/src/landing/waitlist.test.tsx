import type { WaitlistHeadline, WaitlistLocale } from '@rebomi/api-contract'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { fakeApi, type FakeRequest, type FakeResponse } from '@/test/fake-api'
import { JoinButton, WaitlistProvider } from './waitlist'

const saved: FakeResponse = { status: 204 }
const UUID =
  /^\/waitlist\/responses\/[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

function setup(
  options: {
    respond?: (request: FakeRequest, nth: number) => FakeResponse
    locale?: WaitlistLocale
    headline?: WaitlistHeadline
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
      headline={options.headline ?? 'forgot'}
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

/** 첫 질문에서 Instagram을 고르고 두 번째 질문으로 간다. */
async function answerFirst({ user, option }: Setup) {
  await user.click(option('Instagram'))
  await user.click(option('Next'))
  await screen.findByRole('heading', { name: 'How often do you go back to them?' })
}

/** 질문 네 개에 모두 답해 이메일 단계까지 간다. */
async function answerAll(app: Setup) {
  await app.open()
  await answerFirst(app)
  await app.user.click(app.option('Once in a while'))
  await screen.findByRole('heading', { name: 'What would help you most?' })
  await app.user.click(app.option('A few saves brought back each week'))
  await screen.findByRole('heading', { name: 'If Rebomi did this well, would you pay for it?' })
  await app.user.click(app.option('Maybe, if I end up using it a lot'))
  await screen.findByRole('heading', { name: 'Where should we send your invite?' })
}

const allAnswers = {
  locale: 'en',
  headline: 'forgot',
  savePlaces: ['instagram'],
  revisitFrequency: 'sometimes',
  mostHelpful: 'resurfacing',
  willingnessToPay: 'maybe',
}

describe('등록 대화상자 열기와 닫기', () => {
  it('처음에는 대화상자가 없고, 등록 버튼을 누르면 첫 질문이 열린다', async () => {
    const app = setup()
    expect(screen.queryByRole('dialog')).toBeNull()

    await app.open()

    expect(app.dialog().getAttribute('aria-modal')).toBe('true')
    expect(
      within(app.dialog()).getByRole('heading', { name: 'Where do your saves pile up?' }),
    ).toBeDefined()
    expect(within(app.dialog()).getByText('1 of 4')).toBeDefined()
    expect(within(app.dialog()).getByText('Pick all that apply.')).toBeDefined()
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

    expect(
      within(app.dialog()).getByRole('heading', { name: 'How often do you go back to them?' }),
    ).toBeDefined()
    await app.user.click(app.option('Back'))
    expect(app.option('Instagram').getAttribute('aria-pressed')).toBe('true')
    expect(app.option('YouTube').getAttribute('aria-pressed')).toBe('false')
  })

  it('한국어면 한국어 문구로 보인다', async () => {
    const app = setup({ locale: 'ko' })

    await app.user.click(screen.getByRole('button', { name: '대기 명단 등록하기' }))

    expect(
      within(app.dialog()).getByRole('heading', { name: '저장한 것들이 주로 어디에 쌓여 있나요?' }),
    ).toBeDefined()
    expect(within(app.dialog()).getByText('4개 중 1번째')).toBeDefined()
  })
})

describe('답을 고를 때마다 저장한다', () => {
  it('첫 답을 고르면 브라우저가 만든 ID로 응답 저장 요청이 간다', async () => {
    const app = setup({ locale: 'ko', headline: 'scattered' })
    await app.user.click(screen.getByRole('button', { name: '대기 명단 등록하기' }))

    await app.user.click(app.option('인스타그램'))

    await waitFor(() => expect(app.requests).toHaveLength(1))
    const [request] = app.requests
    expect(request!.method).toBe('PUT')
    expect(request!.path).toMatch(UUID)
    expect(request!.authorization).toBeNull()
    expect(request!.body).toEqual({
      locale: 'ko',
      headline: 'scattered',
      savePlaces: ['instagram'],
    })
  })

  it('복수 선택은 고르고 뺄 때마다 그때의 전체를 같은 ID로 보낸다', async () => {
    const app = setup()
    await app.open()

    await app.user.click(app.option('Instagram'))
    await app.user.click(app.option('Browser bookmarks'))
    await app.user.click(app.option('Instagram'))

    await waitFor(() => expect(app.requests).toHaveLength(3))
    expect(app.bodies()).toEqual([
      { locale: 'en', headline: 'forgot', savePlaces: ['instagram'] },
      { locale: 'en', headline: 'forgot', savePlaces: ['instagram', 'browser'] },
      { locale: 'en', headline: 'forgot', savePlaces: ['browser'] },
    ])
    expect(new Set(app.requests.map((request) => request.path)).size).toBe(1)
  })

  it('복수 선택 질문은 하나 이상 골라야 다음으로 갈 수 있다', async () => {
    const app = setup()
    await app.open()
    expect(app.option('Next')).toHaveProperty('disabled', true)

    await app.user.click(app.option('X'))

    expect(app.option('Next')).toHaveProperty('disabled', false)
  })

  it('하나만 고르는 질문은 고르면 저장하고 다음 질문으로 넘어간다', async () => {
    const app = setup()
    await app.open()
    await answerFirst(app)

    await app.user.click(app.option('Almost never'))

    await screen.findByRole('heading', { name: 'What would help you most?' })
    expect(within(app.dialog()).getByText('3 of 4')).toBeDefined()
    expect(app.bodies().at(-1)).toEqual({
      locale: 'en',
      headline: 'forgot',
      savePlaces: ['instagram'],
      revisitFrequency: 'almost_never',
    })
  })

  it('이전으로 돌아가 답을 바꾸면 바뀐 답이 저장된다', async () => {
    const app = setup()
    await app.open()
    await answerFirst(app)
    await app.user.click(app.option('Almost never'))
    await screen.findByRole('heading', { name: 'What would help you most?' })

    await app.user.click(app.option('Back'))
    expect(app.option('Almost never').getAttribute('aria-pressed')).toBe('true')
    await app.user.click(app.option('Most weeks'))

    await waitFor(() =>
      expect(app.bodies().at(-1)).toMatchObject({ revisitFrequency: 'most_weeks' }),
    )
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

    await app.user.click(app.option('Once in a while'))
    await screen.findByRole('heading', { name: 'What would help you most?' })
    await app.user.click(app.option('Everything in one place'))

    await screen.findByRole('heading', { name: 'If Rebomi did this well, would you pay for it?' })
    expect(within(app.dialog()).queryByRole('alert')).toBeNull()
    await waitFor(() => expect(app.requests).toHaveLength(3))
    expect(app.bodies().at(-1)).toEqual({
      locale: 'en',
      headline: 'forgot',
      savePlaces: ['instagram'],
      revisitFrequency: 'sometimes',
      mostHelpful: 'one_place',
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

    await app.user.click(app.option('Most weeks'))

    await screen.findByRole('heading', { name: 'What would help you most?' })
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
    expect(
      within(app.dialog()).getByRole('heading', { name: 'Where should we send your invite?' }),
    ).toBeDefined()
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

    // 질문 1 (복수 선택): 첫 선택지를 고르고 "다음"까지 가서 누른다.
    await user.tab()
    expect(document.activeElement).toBe(app.option('Instagram'))
    await user.keyboard(' ')
    while (document.activeElement !== app.option('Next')) await user.tab()
    await user.keyboard('{Enter}')

    // 질문 2~4: 넘어오면 첫 Tab이 첫 선택지로 간다.
    for (const [title, first] of [
      ['How often do you go back to them?', 'Almost never'],
      ['What would help you most?', 'A short summary of each save'],
      ['If Rebomi did this well, would you pay for it?', 'Yes, a few dollars a month'],
    ] as const) {
      await screen.findByRole('heading', { name: title })
      await user.tab()
      expect(document.activeElement).toBe(app.option(first))
      await user.keyboard('{Enter}')
    }

    // 이메일: 넘어오면 입력란에 포커스가 있다.
    await screen.findByRole('heading', { name: 'Where should we send your invite?' })
    expect(document.activeElement).toBe(within(app.dialog()).getByLabelText('Email'))
    await user.keyboard('someone@example.com{Enter}')

    await screen.findByRole('heading', { name: 'You’re on the list.' })
    expect(app.bodies().at(-1)).toEqual({
      locale: 'en',
      headline: 'forgot',
      savePlaces: ['instagram'],
      revisitFrequency: 'almost_never',
      mostHelpful: 'summary',
      willingnessToPay: 'yes',
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
