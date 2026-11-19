import type { WaitlistHeadline, WaitlistHero, WaitlistLocale } from '@rebomi/api-contract'
import type { ReactNode } from 'react'
import { COPY } from './copy'
import { HeroCard, HeroNotice } from './hero-art'
import { LandingShell } from './landing-shell'
import { PhonePreview } from './phone-preview'
import { JoinButton } from './waitlist'

/*
 * 대기 명단 랜딩 (waitlist.md WAIT-2). 구성과 치수는 디자인(RebomiLanding) 그대로다:
 * 히어로 → 문제 제기(저장함 더미) → 하는 일 네 가지 → 마지막 등록 버튼 → 푸터.
 *
 * 좁은 화면(860px 이하)이 기본이고 `wide:` 가 그보다 넓은 화면이다.
 */

const wrap = 'mx-auto max-w-[1120px] px-5 wide:px-10'
const section = 'border-t border-line py-14 wide:py-[88px]'
const h2 =
  'text-[28px] leading-[1.15] font-bold tracking-[-0.015em] text-balance wrap-break-word text-strong wide:text-[40px]'
const h3 = 'mb-1.5 text-[22px] leading-[1.3] font-bold text-strong'
const paragraph = 'text-[17px] leading-[1.55] text-sub'
/** "하는 일"에 붙는 작은 예시 카드. 꾸밈이라 보조 기술에는 숨긴다. */
const fragment =
  'flex flex-col justify-center gap-2 rounded-[20px] border border-line bg-surface p-5 text-[15px] leading-normal wide:min-h-[216px]'
const chip = 'flex items-center gap-2.5 rounded-xl bg-bg px-3.5 py-3 text-body'

/** 저장함 더미의 다섯 줄을 비뚤게 포갠다. */
const PILE_TILTS = [
  'rotate(-3deg) translateX(14px)',
  'rotate(2deg) translateX(-6px)',
  'rotate(-1.5deg) translateX(22px)',
  'rotate(3deg)',
  'rotate(-2deg) translateX(10px)',
]

export function LandingPage({
  locale,
  headline,
  hero,
}: {
  locale: WaitlistLocale
  headline: WaitlistHeadline
  hero: WaitlistHero
}) {
  const c = COPY[locale]
  const [line1, line2] = c.headlines[headline]
  /** 그림이 없으면 글이 한 단을 다 쓰고 더 크다. */
  const solo = hero === 'none'

  return (
    <LandingShell locale={locale} headline={headline} hero={hero}>
      <header className={`${wrap} flex h-14 items-center justify-between wide:h-16`}>
        <div className="text-xl font-bold tracking-[-0.01em] text-strong">Rebomi</div>
      </header>

      <main>
        <section
          aria-labelledby="landing-h1"
          className={`${wrap} grid grid-cols-1 items-center ${
            solo
              ? 'pt-7 pb-16 wide:pt-[72px] wide:pb-[104px]'
              : 'gap-9 pt-3 pb-14 wide:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] wide:gap-12 wide:pt-2 wide:pb-[72px]'
          }`}
        >
          <div>
            <h1
              id="landing-h1"
              className={`text-[38px] leading-[1.08] font-bold tracking-[-0.02em] text-balance wrap-break-word text-strong ${
                solo ? 'wide:text-[68px]' : 'wide:text-[54px]'
              }`}
            >
              <span className="block">{line1}</span>
              {line2 !== '' && <span className="block">{line2}</span>}
            </h1>
            <p
              className={`mt-3.5 mb-[22px] text-lg leading-normal text-sub wide:mt-5 wide:mb-7 ${
                solo ? 'max-w-[34em] wide:text-[22px]' : 'max-w-[32em] wide:text-xl'
              }`}
            >
              {headline === 'progress' ? c.ledeProgress : c.lede}
            </p>
            <div className="flex">
              <JoinButton />
            </div>
          </div>
          {hero === 'card' && <HeroCard copy={c.card} />}
          {hero === 'notice' && <HeroNotice copy={c.notice} />}
          {hero === 'phone' && <PhonePreview copy={c.phone} />}
        </section>

        <section aria-labelledby="landing-problem" className={section}>
          <div
            className={`${wrap} grid grid-cols-1 items-center gap-7 wide:grid-cols-2 wide:gap-14`}
          >
            <div>
              <h2 id="landing-problem" className={`${h2} mb-[26px]`}>
                <span className="block">{c.problemTitle[0]}</span>
                <span className="mt-[0.32em] block">{c.problemTitle[1]}</span>
              </h2>
              <p className="max-w-[30em] text-[17px] leading-[1.55] text-sub wide:text-[19px]">
                {c.problemBody}
              </p>
            </div>
            <div className="mx-auto w-full max-w-[330px] wide:mr-0 wide:max-w-[410px]">
              <p className="-mb-1 ml-2.5 flex origin-bottom-left -rotate-[4deg] items-start gap-0.5 font-hand text-[23px] leading-[1.12] text-link wide:ml-[22px] wide:text-[26px]">
                <span className="max-w-[8.8em] text-balance">{c.pileNote}</span>
                <svg
                  width="74"
                  height="69"
                  viewBox="0 0 62 58"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                  className="mt-4 flex-none"
                >
                  <path d="M5 9c16-6 34-3 40 9c5 10-3 19-11 16c-7-3-4-13 5-13c10 0 14 12 13 28" />
                  <path d="M43 41l9 9l7-11" />
                </svg>
              </p>
              <div
                role="img"
                aria-label={c.pilesAlt}
                className="pt-1 pr-4 pb-7 pl-1 wide:py-4 wide:pr-[26px]"
              >
                <div aria-hidden="true" className="flex flex-col gap-2">
                  {c.piles.map((pile, index) => (
                    <div
                      key={pile.app}
                      style={{ transform: PILE_TILTS[index] }}
                      className="flex items-center gap-3.5 rounded-[18px] border border-line bg-surface px-[18px] py-3.5 shadow-[0_12px_24px_-16px_rgba(28,25,20,0.32)] wide:gap-[18px] wide:rounded-[20px] wide:px-[22px] wide:py-[18px]"
                    >
                      <span className="min-w-[70px] flex-none text-[26px] leading-[1.2] font-bold tracking-[-0.01em] text-strong tabular-nums wide:min-w-[88px] wide:text-[32px]">
                        {pile.count}
                      </span>
                      <span>
                        <span className="block text-base leading-[1.3] font-semibold whitespace-nowrap text-strong wide:text-lg">
                          {pile.app}
                        </span>
                        <span className="block text-sm leading-[1.3] whitespace-nowrap text-muted">
                          {pile.name}
                        </span>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section aria-labelledby="landing-does" className={section}>
          <div className={wrap}>
            <h2 id="landing-does" className={`${h2} mb-4`}>
              {c.doesTitle}
            </h2>
            <div className="mt-7 grid grid-cols-1 gap-12 wide:mt-10 wide:grid-cols-2 wide:gap-x-8">
              <Feature title={c.rediscover.title} text={c.rediscover.text}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[17px] font-bold text-strong">{c.rediscover.head}</span>
                  <span className="text-[13px] text-muted tabular-nums">1 / 4</span>
                </div>
                {c.rediscover.items.map((item) => (
                  <div key={item} className="truncate border-t border-line pt-2 text-body">
                    {item}
                  </div>
                ))}
              </Feature>

              <Feature title={c.summary.title} text={c.summary.text}>
                <div className="font-semibold text-strong">{c.summary.cardTitle}</div>
                <div className="text-xs font-semibold text-muted">{c.summary.label}</div>
                <div className="text-body">{c.summary.cardText}</div>
              </Feature>

              <Feature title={c.search.title} text={c.search.text}>
                <div className={chip}>
                  <Icon d="M10.5 3a7.5 7.5 0 1 0 0 15a7.5 7.5 0 0 0 0-15zM16 16l5 5" muted />
                  <span>{c.search.query}</span>
                </div>
                <div className="mt-1.5 font-semibold text-strong">{c.search.result}</div>
                <div className="text-[13px] text-muted">{c.search.note}</div>
              </Feature>

              <Feature title={c.save.title} text={c.save.text}>
                <div className={chip}>
                  <Icon
                    d="M10 14a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1 1M14 10a4 4 0 0 0-5.66 0l-3 3a4 4 0 0 0 5.66 5.66l1-1"
                    muted
                  />
                  <span className="truncate">{c.save.url}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-2 font-semibold text-strong">
                  <Icon d="M5 12.5l4.5 4.5L19 7.5" strokeWidth={2.4} />
                  <span>{c.save.saved}</span>
                </div>
                <div className="text-[13px] text-muted">{c.save.note}</div>
              </Feature>
            </div>
          </div>
        </section>

        <section
          aria-labelledby="landing-end"
          className="border-t border-line py-16 text-center wide:py-24"
        >
          <div className={wrap}>
            <h2 id="landing-end" className={`${h2} mb-7`}>
              {c.endTitle}
            </h2>
            <div className="flex justify-center">
              <JoinButton />
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${wrap} pt-7 pb-10 text-sm text-muted`}>{c.footer}</div>
      </footer>
    </LandingShell>
  )
}

/**
 * "하는 일" 하나. 넓은 화면에서는 예시 카드가 위에 있고, 한 단으로 쌓일 때는 제목 → 설명 →
 * 예시 순서다 — 카드가 위에 있으면 제목이 위아래 어느 카드의 것인지 헷갈린다.
 */
function Feature({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <div aria-hidden="true" className={`${fragment} order-3 mt-4 wide:order-none wide:mt-0`}>
        {children}
      </div>
      <h3 className={`${h3} order-1 wide:order-none wide:mt-5`}>{title}</h3>
      <p className={`${paragraph} order-2 wide:order-none`}>{text}</p>
    </div>
  )
}

function Icon({ d, strokeWidth = 2, muted }: { d: string; strokeWidth?: number; muted?: boolean }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`flex-none ${muted ? 'text-muted' : ''}`}
    >
      <path d={d} />
    </svg>
  )
}
