'use client'

import type { ApiClient } from '@rebomi/api-client'
import {
  WAITLIST_OTHER_MAX_LENGTH,
  saveWaitlistResponseRequestSchema,
  type SaveWaitlistResponseRequest,
  type WaitlistHeadline,
  type WaitlistHero,
  type WaitlistLocale,
} from '@rebomi/api-contract'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from 'react'
import { COPY, type LandingCopy } from './copy'
import { createResponseSaver } from './response-saver'
import { Button, IconButton, TextButton } from '@/ui/buttons'

/*
 * 대기 명단 등록 (waitlist.md WAIT-3, WAIT-4, WAIT-8).
 *
 * 등록 버튼 → 질문 네 개(하나씩 고른다) → 이메일 → 완료. 상태는 페이지에 한 벌만 있어서 어느 등록
 * 버튼으로 열어도, 닫았다 다시 열어도 하던 곳에서 이어진다.
 */

const QUESTIONS = ['occupation', 'saveIntent', 'frustration', 'wantedHelp'] as const
type QuestionId = (typeof QUESTIONS)[number]
type Step = QuestionId | 'email' | 'done'
const STEPS: readonly Step[] = [...QUESTIONS, 'email', 'done']

/** 지금까지 고른 답. 질문마다 하나다. */
type Answers = Pick<SaveWaitlistResponseRequest, QuestionId>
/** 질문마다 "기타"에 적은 글. 다른 답으로 바꿔도 지우지 않는다 — 돌아오면 그대로 있다. */
type Others = Partial<Record<QuestionId, string>>

/** 고르면 직접 적는 칸이 열리는 선택지. 질문마다 마지막에 있다. */
const OTHER = 'other'

/** 하나만 고르는 질문은 고르면 이만큼 뒤에 넘어간다 — 고른 표시가 보일 시간이다. */
const AUTO_ADVANCE_MS = 220

const emailSchema = saveWaitlistResponseRequestSchema.shape.email

/** 서버가 받는 것과 같은 규칙으로 본다. 정규화(공백·대소문자)는 서버가 한다. */
function validEmail(value: string): string | null {
  const trimmed = value.trim()
  return trimmed !== '' && emailSchema.safeParse(trimmed).success ? trimmed : null
}

const WaitlistContext = createContext<{ open: () => void; cta: string } | null>(null)

/** 등록 대화상자를 여는 버튼. 페이지 어디에 몇 개를 두어도 같은 대화상자를 연다. */
export function JoinButton() {
  const waitlist = useContext(WaitlistContext)
  if (waitlist === null) throw new Error('JoinButton은 WaitlistProvider 안에서만 쓴다')
  return <Button onClick={waitlist.open}>{waitlist.cta}</Button>
}

export function WaitlistProvider({
  client,
  locale,
  headline,
  hero,
  children,
}: {
  client: Pick<ApiClient, 'saveWaitlistResponse'>
  locale: WaitlistLocale
  headline: WaitlistHeadline
  hero: WaitlistHero
  children: ReactNode
}) {
  const copy = COPY[locale]

  const [isOpen, setIsOpen] = useState(false)
  const [step, setStep] = useState<Step>(QUESTIONS[0])
  const [answers, setAnswers] = useState<Answers>({})
  const [others, setOthers] = useState<Others>({})
  const [email, setEmail] = useState('')
  /** 이메일을 한 번 내 봤는가. 그 전에는 형식 오류를 보이지 않는다. */
  const [tried, setTried] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [saveFailed, setSaveFailed] = useState(false)

  /** 응답 ID와 그 ID로 보내는 통로. 대화상자가 처음 열릴 때 만든다. */
  const saver = useRef<ReturnType<typeof createResponseSaver<SaveWaitlistResponseRequest>>>(null)
  const advanceTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const opener = useRef<HTMLElement>(null)

  useEffect(() => () => clearTimeout(advanceTimer.current), [])

  const open = useCallback(() => {
    if (saver.current === null) {
      const id = crypto.randomUUID()
      saver.current = createResponseSaver((body) => client.saveWaitlistResponse(id, body))
    }
    opener.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setIsOpen(true)
  }, [client])

  const close = useCallback(() => {
    setIsOpen(false)
    opener.current?.focus()
  }, [])

  /** 지금까지의 답 전체를 보낸다. "기타"에 적은 글은 그 질문의 답이 기타일 때만 싣는다. */
  const save = (next: Answers, withEmail?: string): Promise<void> => {
    const body: SaveWaitlistResponseRequest = { locale, headline, hero, ...next }
    for (const question of QUESTIONS) {
      const text = others[question]?.trim()
      if (next[question] === OTHER && text) body[`${question}Other`] = text
    }
    if (withEmail !== undefined) body.email = withEmail
    return saver.current!.save(body)
  }

  /** 실패는 알리지 않는다 — 다음 저장이 전부 다시 싣는다. */
  const saveQuietly = (next: Answers) => {
    save(next).catch(() => undefined)
  }

  const goTo = (target: Step) => {
    clearTimeout(advanceTimer.current)
    setStep(target)
  }
  const stepIndex = STEPS.indexOf(step)

  const submitEmail = () => {
    if (submitting) return
    const address = validEmail(email)
    if (address === null) {
      setTried(true)
      setSaveFailed(false)
      return
    }
    setSubmitting(true)
    setSaveFailed(false)
    save(answers, address)
      .then(
        () => setStep('done'),
        () => setSaveFailed(true),
      )
      .finally(() => setSubmitting(false))
  }

  const context = useMemo(() => ({ open, cta: copy.cta }), [open, copy.cta])

  const question = QUESTIONS.find((id) => id === step)

  return (
    <WaitlistContext.Provider value={context}>
      <div inert={isOpen}>{children}</div>
      {isOpen && (
        <Dialog label={copy.cta} step={step} onClose={close}>
          <Progress copy={copy} stepIndex={stepIndex} onClose={close} />

          {question !== undefined && (
            <QuestionStep
              // 질문이 바뀌면 새로 그린다 — 앞 질문의 스크롤 위치가 남지 않는다.
              key={question}
              copy={copy}
              question={copy.dialog[question]}
              chosen={answers[question]}
              otherText={others[question] ?? ''}
              canGoBack={stepIndex > 0}
              onPick={(key) => {
                const next = { ...answers, [question]: key } as Answers
                setAnswers(next)
                saveQuietly(next)
                clearTimeout(advanceTimer.current)
                // 기타는 적고 나서 "다음"으로 넘어간다.
                if (key === OTHER) return
                advanceTimer.current = setTimeout(
                  () => setStep(STEPS[stepIndex + 1]!),
                  AUTO_ADVANCE_MS,
                )
              }}
              onOtherText={(text) => setOthers({ ...others, [question]: text })}
              onBack={() => goTo(STEPS[stepIndex - 1]!)}
              onNext={() => {
                // 적은 글은 넘어갈 때 저장한다 — 글자마다 보내지 않는다.
                saveQuietly(answers)
                goTo(STEPS[stepIndex + 1]!)
              }}
            />
          )}

          {step === 'email' && (
            <EmailStep
              copy={copy}
              email={email}
              invalid={tried && validEmail(email) === null}
              saveFailed={saveFailed}
              submitting={submitting}
              onChange={(value) => {
                setEmail(value)
                setSaveFailed(false)
              }}
              onSubmit={submitEmail}
              onBack={() => goTo(QUESTIONS.at(-1)!)}
            />
          )}

          {step === 'done' && (
            <>
              <div className="min-h-0 flex-1 overflow-auto px-6 pt-8 pb-2">
                <h2
                  data-step-focus
                  tabIndex={-1}
                  className="mb-2 text-[28px] leading-[1.25] font-bold text-strong outline-none"
                >
                  {copy.dialog.doneTitle}
                </h2>
                <p className="text-[17px] text-sub">{copy.dialog.doneBody}</p>
              </div>
              <div className="flex flex-none justify-end px-6 pt-5 pb-6">
                <Button variant="weak" onClick={close}>
                  {copy.dialog.doneClose}
                </Button>
              </div>
            </>
          )}
        </Dialog>
      )}
    </WaitlistContext.Provider>
  )
}
/**
 * 실제로 보이는 영역(visual viewport). 모바일에서 키보드가 올라오면 높이가 줄고, iOS는
 * 페이지를 밀어 올려 `top` 도 바뀐다. 이 값을 주지 않는 브라우저에서는 `null` 이다.
 */
function useVisibleArea(): { top: number; height: number } | null {
  const [area, setArea] = useState<{ top: number; height: number } | null>(null)

  useEffect(() => {
    const viewport = window.visualViewport
    if (!viewport) return
    const update = () => setArea({ top: viewport.offsetTop, height: viewport.height })
    update()
    viewport.addEventListener('resize', update)
    viewport.addEventListener('scroll', update)
    return () => {
      viewport.removeEventListener('resize', update)
      viewport.removeEventListener('scroll', update)
    }
  }, [])

  return area
}

/** 포커스가 입력란에 있으면 보이는 곳까지만 스크롤한다. */
function revealActiveInput(within: HTMLElement | null): void {
  const active = document.activeElement
  if (active instanceof HTMLInputElement && within?.contains(active)) {
    active.scrollIntoView?.({ block: 'nearest' })
  }
}

/** 입력란으로 포커스를 옮긴 뒤 키보드가 올라올 틈을 주고 보이게 한다. */
const REVEAL_DELAY_MS = 60

const FOCUSABLE = 'button:not([disabled]), input:not([disabled]), a[href]'

/**
 * 화면을 덮는 대화상자. Esc로 닫히고 Tab이 밖으로 나가지 않는다. 단계가 바뀌면 그 단계의
 * 제목(이메일 단계는 입력란)으로 포커스를 옮긴다 — 방금 누른 선택지가 사라지면서 포커스를
 * 잃지 않게, 그리고 다음 Tab이 첫 선택지로 가게.
 */
function Dialog({
  label,
  step,
  onClose,
  children,
}: {
  label: string
  step: Step
  onClose: () => void
  children: ReactNode
}) {
  const panel = useRef<HTMLDivElement>(null)
  const visible = useVisibleArea()

  useEffect(() => {
    panel.current?.querySelector<HTMLElement>('[data-step-focus]')?.focus()
  }, [step])

  // 보이는 영역이 줄면(키보드가 올라오면) 쓰고 있던 입력란을 다시 보이는 곳으로 올린다.
  useEffect(() => {
    if (visible !== null) revealActiveInput(panel.current)
  }, [visible])

  // 열려 있는 동안 뒤의 페이지가 스크롤되지 않게 한다.
  useEffect(() => {
    const root = document.documentElement
    const before = root.style.overflow
    root.style.overflow = 'hidden'
    return () => {
      root.style.overflow = before
    }
  }, [])

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.stopPropagation()
      onClose()
      return
    }
    if (event.key !== 'Tab' || panel.current === null) return

    const focusable = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (first === undefined || last === undefined) return

    const current = document.activeElement
    if (event.shiftKey && (current === first || !focusable.includes(current as HTMLElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && current === last) {
      event.preventDefault()
      first.focus()
    }
  }

  return (
    <div
      className="fixed inset-0 z-40 flex items-center justify-center bg-dim"
      // 키보드가 올라오면 화면에 고정된 것은 키보드 뒤로 깔린다. 보이는 영역에 맞춰 줄여서
      // 아래의 버튼까지 키보드 위에 붙인다.
      style={visible === null ? undefined : { top: visible.top, height: visible.height, bottom: 'auto' }}
      onKeyDown={onKeyDown}
    >
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="flex h-full w-full flex-col overflow-hidden bg-floating roomy:h-auto roomy:max-h-[calc(100%-48px)] roomy:w-[520px] roomy:max-w-[calc(100%-32px)] roomy:rounded-[28px]"
      >
        {children}
      </div>
    </div>
  )
}

function Progress({
  copy,
  stepIndex,
  onClose,
}: {
  copy: LandingCopy
  stepIndex: number
  onClose: () => void
}) {
  const total = QUESTIONS.length
  const position = stepIndex + 1
  const text =
    position <= total
      ? copy.dialog.progress(position, total)
      : position === total + 1
        ? copy.dialog.lastStep
        : ''
  const percent = Math.min(100, Math.round((position / (total + 1)) * 100))

  return (
    <>
      <div className="flex flex-none items-center justify-between gap-3 pt-4 pr-4 pl-6">
        <span className="text-sm text-muted tabular-nums">{text}</span>
        <IconButton aria-label={copy.dialog.close} onClick={onClose}>
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            aria-hidden="true"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </IconButton>
      </div>
      <div
        aria-hidden="true"
        className="mx-6 mt-2 h-1 flex-none overflow-hidden rounded-xs bg-fill"
      >
        <div
          className="h-full rounded-xs bg-brand transition-[width] duration-200"
          style={{ width: `${percent}%` }}
        />
      </div>
    </>
  )
}

/**
 * 입력란. 공통 포커스 링(바깥으로 2px 띄운 파란 선)은 입력란의 테두리와 겹쳐 두 겹으로 보여서,
 * 포커스가 오면 테두리 자리에 먹색 선 한 겹만 그린다 (디자인).
 */
const field =
  'h-[52px] w-full rounded-[14px] border border-muted bg-bg px-4 text-[17px] text-strong placeholder:text-muted focus-visible:rounded-[14px] focus-visible:border-transparent focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-strong'

/**
 * 하나만 고르는 질문. 고르면 넘어가고, "기타"를 고르면 직접 적는 칸과 "다음"이 나온다.
 */
function QuestionStep({
  copy,
  question,
  chosen,
  otherText,
  canGoBack,
  onPick,
  onOtherText,
  onBack,
  onNext,
}: {
  copy: LandingCopy
  question: { title: string; options: { key: string; label: string }[] }
  chosen: string | undefined
  otherText: string
  canGoBack: boolean
  onPick: (key: string) => void
  onOtherText: (text: string) => void
  onBack: () => void
  onNext: () => void
}) {
  const otherOn = chosen === OTHER
  const otherInput = useRef<HTMLInputElement>(null)

  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto px-6 pt-6 pb-2">
        <h2
          data-step-focus
          tabIndex={-1}
          className="mb-[47px] text-2xl leading-[1.3] font-bold text-balance text-strong outline-none"
        >
          {question.title}
        </h2>
        <div role="group" aria-label={question.title} className="flex flex-col gap-2">
          {question.options.map((option) => {
            const on = chosen === option.key
            return (
              <button
                key={option.key}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  onPick(option.key)
                  // 방금 고른 기타: 칸이 그려진 뒤 그리로 커서를 옮긴다.
                  if (option.key === OTHER) {
                    requestAnimationFrame(() => {
                      const input = otherInput.current
                      input?.focus({ preventScroll: true })
                      // 칸이 화면 밖이나 키보드 뒤에 있으면 보이는 곳까지만 올린다.
                      setTimeout(() => input?.scrollIntoView?.({ block: 'nearest' }), REVEAL_DELAY_MS)
                    })
                  }
                }}
                className={`flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 rounded-[14px] px-4 py-3 text-left text-[17px] font-medium transition-colors duration-[120ms] ${
                  on ? 'bg-brand text-on-brand' : 'bg-fill text-strong'
                }`}
              >
                <span>{option.label}</span>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className={`flex-none ${on ? 'opacity-100' : 'opacity-0'}`}
                >
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </button>
            )
          })}
        </div>
        {otherOn && (
          <input
            ref={otherInput}
            type="text"
            value={otherText}
            maxLength={WAITLIST_OTHER_MAX_LENGTH}
            onChange={(event) => onOtherText(event.target.value)}
            onKeyDown={(event) => {
              // 한글 조합 중의 Enter는 글자를 확정하는 것이지 넘어가는 것이 아니다.
              if (event.key === 'Enter' && !event.nativeEvent.isComposing) onNext()
            }}
            placeholder={copy.dialog.otherPlaceholder}
            aria-label={copy.dialog.otherPlaceholder}
            className={`${field} mt-2`}
          />
        )}
      </div>
      <div className="flex flex-none items-center justify-between gap-3 px-6 pt-3 pb-6">
        <TextButton disabled={!canGoBack} onClick={onBack}>
          {copy.dialog.back}
        </TextButton>
        {otherOn && <Button onClick={onNext}>{copy.dialog.next}</Button>}
      </div>
    </>
  )
}
function EmailStep({
  copy,
  email,
  invalid,
  saveFailed,
  submitting,
  onChange,
  onSubmit,
  onBack,
}: {
  copy: LandingCopy
  email: string
  invalid: boolean
  saveFailed: boolean
  submitting: boolean
  onChange: (value: string) => void
  onSubmit: () => void
  onBack: () => void
}) {
  const { dialog } = copy
  return (
    <>
      <div className="min-h-0 flex-1 overflow-auto px-6 pt-6 pb-2">
        <h2 className="mb-[18px] text-2xl leading-[1.3] font-bold text-balance text-strong">
          {dialog.emailTitle}
        </h2>
        <label htmlFor="waitlist-email" className="mb-1.5 block text-sm font-semibold text-sub">
          {dialog.emailLabel}
        </label>
        <input
          id="waitlist-email"
          data-step-focus
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="you@example.com"
          value={email}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            // 한글 조합 중의 Enter는 글자를 확정하는 것이지 내는 것이 아니다.
            if (event.key === 'Enter' && !event.nativeEvent.isComposing) onSubmit()
          }}
          aria-invalid={invalid}
          aria-describedby="waitlist-email-help"
          className={field}
        />
        {saveFailed ? (
          <p id="waitlist-email-help" role="alert" className="mt-2 min-h-[1lh] text-sm text-danger">
            {dialog.emailSaveFailed}
          </p>
        ) : (
          <p
            id="waitlist-email-help"
            role="status"
            className={`mt-2 min-h-[1lh] text-sm ${invalid ? 'text-danger' : 'text-muted'}`}
          >
            {invalid ? dialog.emailError : dialog.emailHelp}
          </p>
        )}
        <p className="mt-4 text-[13px] leading-normal text-muted">{dialog.privacy}</p>
      </div>
      <div className="flex flex-none items-center justify-between gap-3 px-6 pt-3 pb-6">
        <TextButton onClick={onBack}>{dialog.back}</TextButton>
        <Button disabled={submitting} onClick={onSubmit}>
          {copy.cta}
        </Button>
      </div>
    </>
  )
}
