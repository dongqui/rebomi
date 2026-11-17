import type { WaitlistHeadline, WaitlistLocale } from '@rebomi/api-contract'
import type { ReactNode } from 'react'
import { COPY } from './copy'
import { LandingShell } from './landing-shell'
import { PhonePreview } from './phone-preview'
import { JoinButton } from './waitlist'

/*
 * 대기 명단 랜딩 (waitlist.md WAIT-2). 구성과 치수는 디자인(RebomiLanding) 그대로다:
 * 히어로 → 문제 제기 → 하는 일 세 가지 → "차분하게" → 사용 방법 → 마지막 등록 버튼 → 푸터.
 *
 * 좁은 화면(860px 이하)이 기본이고 `wide:` 가 그보다 넓은 화면이다.
 */

const wrap = 'mx-auto max-w-[1120px] px-5 wide:px-10'
const section = 'border-t border-line py-14 wide:py-[88px]'
const h2 =
  'text-[28px] leading-[1.15] font-bold tracking-[-0.015em] text-balance wrap-break-word text-strong wide:text-[40px]'
const h3 = 'mb-1.5 text-[22px] leading-[1.3] font-bold text-strong'
const paragraph = 'text-[17px] leading-[1.55] text-sub'
const rows = '[&>li]:border-t [&>li]:border-line [&>li]:py-3.5 [&>li:first-child]:border-t-0'
/** "하는 일" 세 가지에 붙는 작은 예시 카드. 꾸밈이라 보조 기술에는 숨긴다. */
const fragment =
  'flex flex-col justify-center gap-2 rounded-[20px] border border-line bg-surface p-5 text-[15px] leading-normal wide:min-h-[196px]'

export function LandingPage({
  locale,
  headline,
}: {
  locale: WaitlistLocale
  headline: WaitlistHeadline
}) {
  const c = COPY[locale]

  return (
    <LandingShell locale={locale} headline={headline}>
      <header className={`${wrap} flex h-14 items-center justify-between wide:h-16`}>
        <div className="text-xl font-bold tracking-[-0.01em] text-strong">Rebomi</div>
      </header>

      <main>
        <section
          aria-labelledby="landing-h1"
          className={`${wrap} grid grid-cols-1 items-center gap-9 pt-3 pb-14 wide:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] wide:gap-12 wide:pt-2 wide:pb-[72px]`}
        >
          <div>
            <h1
              id="landing-h1"
              className="text-[38px] leading-[1.08] font-bold tracking-[-0.02em] text-balance wrap-break-word text-strong wide:text-[60px]"
            >
              {c.headlines[headline]}
            </h1>
            <p className="mt-3.5 mb-[22px] max-w-[32em] text-lg leading-normal text-sub wide:mt-5 wide:mb-7 wide:text-xl">
              {c.lede}
            </p>
            <div className="flex">
              <JoinButton />
            </div>
            <p className="mt-3 text-sm text-muted">{c.ctaNote}</p>
          </div>
          <PhonePreview copy={c.phone} />
        </section>

        <section aria-labelledby="landing-problem" className={section}>
          <div
            className={`${wrap} grid grid-cols-1 items-center gap-7 wide:grid-cols-2 wide:gap-14`}
          >
            <div>
              <h2 id="landing-problem" className={`${h2} mb-4`}>
                {c.problemTitle}
              </h2>
              <p className="max-w-[30em] text-[17px] leading-[1.55] text-sub wide:text-[19px]">
                {c.problemBody}
              </p>
            </div>
            <ul className={rows}>
              {c.piles.map((pile) => (
                <li key={pile.app} className="flex items-baseline justify-between gap-4">
                  <span className="text-[22px] font-semibold text-strong">{pile.app}</span>
                  <span className="text-base text-muted">{pile.name}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="landing-does" className={section}>
          <div className={wrap}>
            <h2 id="landing-does" className={`${h2} mb-4`}>
              {c.doesTitle}
            </h2>
            <div className="mt-7 grid grid-cols-1 gap-8 wide:mt-10 wide:grid-cols-3 wide:gap-7">
              <Feature title={c.features[0]!.title} text={c.features[0]!.text}>
                <div className="font-semibold text-strong">{c.summaryCard.title}</div>
                <div className="text-xs font-semibold text-muted">{c.summaryCard.label}</div>
                <div className="text-body">{c.summaryCard.text}</div>
              </Feature>

              <Feature title={c.features[1]!.title} text={c.features[1]!.text}>
                <div className="flex items-center gap-2.5 rounded-xl bg-bg px-3.5 py-3 text-body">
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    className="flex-none text-muted"
                  >
                    <path d="M10.5 3a7.5 7.5 0 1 0 0 15a7.5 7.5 0 0 0 0-15zM16 16l5 5" />
                  </svg>
                  <span>{c.searchCard.query}</span>
                </div>
                <div className="mt-1.5 font-semibold text-strong">{c.searchCard.title}</div>
                <div className="text-[13px] text-muted">{c.searchCard.note}</div>
              </Feature>

              <Feature title={c.features[2]!.title} text={c.features[2]!.text}>
                <div className="flex items-baseline gap-2">
                  <span className="text-[17px] font-bold text-strong">{c.feedCard.head}</span>
                  <span className="text-[13px] text-muted tabular-nums">1 / 4</span>
                </div>
                {c.feedCard.items.map((item) => (
                  <div key={item} className="truncate border-t border-line pt-2 text-body">
                    {item}
                  </div>
                ))}
              </Feature>
            </div>
          </div>
        </section>

        <section aria-labelledby="landing-calm" className={section}>
          <div
            className={`${wrap} grid grid-cols-1 items-start gap-7 wide:grid-cols-2 wide:gap-14`}
          >
            <h2 id="landing-calm" className={`${h2} mb-4`}>
              {c.calmTitle}
            </h2>
            <ul className={rows}>
              {c.calm.map((item) => (
                <li key={item.title}>
                  <div className="text-xl font-semibold text-strong">{item.title}</div>
                  <div className="text-sub">{item.text}</div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section aria-labelledby="landing-how" className={section}>
          <div className={wrap}>
            <h2 id="landing-how" className={`${h2} mb-4`}>
              {c.howTitle}
            </h2>
            <ol className="mt-7 grid grid-cols-1 gap-8 wide:mt-8 wide:grid-cols-3 wide:gap-7">
              {c.steps.map((step, index) => (
                <li key={step.title}>
                  <div className="text-[15px] font-semibold text-muted tabular-nums">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <h3 className={`${h3} mt-1.5`}>{step.title}</h3>
                  <p className={paragraph}>{step.text}</p>
                </li>
              ))}
            </ol>
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
            <p className="mt-3 text-sm text-muted">{c.ctaNote}</p>
          </div>
        </section>
      </main>

      <footer className="border-t border-line">
        <div className={`${wrap} pt-7 pb-10 text-sm text-muted`}>{c.footer}</div>
      </footer>
    </LandingShell>
  )
}

function Feature({ title, text, children }: { title: string; text: string; children: ReactNode }) {
  return (
    <div>
      <div aria-hidden="true" className={fragment}>
        {children}
      </div>
      <h3 className={`${h3} mt-5`}>{title}</h3>
      <p className={paragraph}>{text}</p>
    </div>
  )
}
