import type { ReactNode } from 'react'
import type { LandingCopy } from './copy'

/*
 * 히어로의 휴대폰. 디자인의 모바일 홈(RebomiMobile, iOS) 첫 화면을 그대로 옮긴 **정적인**
 * 그림이다 — 눌러도 아무 일도 일어나지 않고, 보조 기술에는 그림 하나로 읽힌다.
 *
 * 화면은 402×874로 그리고 통째로 줄여서 기기 안에 넣는다. 그래서 안쪽 치수는 디자인의
 * 모바일 화면 값 그대로다.
 */

const TABS = [
  { id: 'home', d: 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z' },
  { id: 'search', d: 'M10.5 3a7.5 7.5 0 1 0 0 15a7.5 7.5 0 0 0 0-15zM16 16l5 5' },
  { id: 'library', d: 'M4 8h16v11a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1zM3 4h18v4H3zM10 12h4' },
] as const

export function PhonePreview({ copy }: { copy: LandingCopy['phone'] }) {
  return (
    <div className="flex justify-center pb-10 wide:pt-2 wide:pb-12">
      <div
        role="img"
        aria-label={copy.label}
        className="relative flex-none rounded-[48px] bg-[#0b0b0c] p-2 shadow-[0_0_0_1px_rgba(255,255,255,0.22),inset_0_0_0_2px_rgba(255,255,255,0.1),inset_0_0_0_5px_#19191b,0_28px_44px_-20px_rgba(28,25,20,0.42),0_64px_96px_-36px_rgba(28,25,20,0.34)] before:absolute before:top-[150px] before:-left-[3px] before:h-[92px] before:w-[3px] before:rounded-xs before:bg-[#19191b] before:shadow-[0_0_0_1px_rgba(255,255,255,0.16)] after:absolute after:top-[190px] after:-right-[3px] after:h-[70px] after:w-[3px] after:rounded-xs after:bg-[#19191b] after:shadow-[0_0_0_1px_rgba(255,255,255,0.16)] wide:rounded-[52px] wide:p-2.5"
      >
        <div className="h-[682px] w-[314px] overflow-hidden rounded-[40px] wide:h-[734px] wide:w-[338px] wide:rounded-[42px]">
          <div
            aria-hidden="true"
            className="h-[874px] w-[402px] origin-top-left scale-[0.78] select-none wide:scale-[0.84]"
          >
            <Screen copy={copy} />
          </div>
        </div>
      </div>
    </div>
  )
}

function Screen({ copy }: { copy: LandingCopy['phone'] }) {
  return (
    <div className="relative flex h-full flex-col bg-bg pt-[54px] text-[15px] leading-normal text-body">
      <StatusBar />

      <div className="min-h-0 flex-1 overflow-hidden pb-6">
        <div className="flex h-12 items-center justify-between pr-2.5 pl-6">
          <div className="text-xl font-bold tracking-[-0.01em] text-strong">Rebomi</div>
          <div className="flex size-11 items-center justify-center text-icon">
            <Icon
              size={22}
              d="M4 7h10M18 7h2M4 17h2M10 17h10M14 7a2 2 0 1 0 4 0a2 2 0 0 0-4 0M6 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0"
            />
          </div>
        </div>

        <div className="flex items-baseline gap-2.5 px-6 pt-1.5 pb-3.5">
          <div className="mb-0.5 text-[22px] leading-[1.35] font-bold text-strong">
            {copy.today}
          </div>
          <span className="flex-none text-sm text-muted tabular-nums">{copy.position}</span>
          <span className="ml-auto text-[15px] leading-[1.252] font-medium text-link">
            {copy.listView}
          </span>
        </div>

        {/* 카드 더미: 뒤의 두 장은 아래쪽 가장자리만 보인다. */}
        <div className="overflow-hidden px-4">
          <div className="relative h-[552px]">
            <div className="absolute inset-x-0 top-0 bottom-5 origin-bottom translate-y-5 scale-90 rounded-3xl border border-line bg-surface" />
            <div className="absolute inset-x-0 top-0 bottom-5 origin-bottom translate-y-2.5 scale-95 rounded-3xl border border-line bg-surface" />
            <Card copy={copy} />
          </div>
        </div>

        <div className="flex items-center gap-2 px-4 pt-3 pb-1">
          <div className="flex size-12 flex-none items-center justify-center text-icon opacity-30">
            <Icon size={22} d="M9 14L4 9l5-5M4 9h10a6 6 0 0 1 0 12h-3" />
          </div>
          {[copy.skip, copy.later, copy.archive].map((label) => (
            <FakeButton key={label} variant="weak">
              {label}
            </FakeButton>
          ))}
          <div className="flex size-12 flex-none items-center justify-center text-icon">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="5" cy="12" r="1.8" />
              <circle cx="12" cy="12" r="1.8" />
              <circle cx="19" cy="12" r="1.8" />
            </svg>
          </div>
        </div>
      </div>

      <div className="flex flex-none border-t border-line bg-bg px-2 pb-[22px]">
        {TABS.map((tab) => {
          const on = tab.id === 'home'
          return (
            <div
              key={tab.id}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-[3px] py-1.5 text-[11px] leading-[13.2px] ${
                on ? 'font-bold text-strong' : 'font-medium text-muted'
              }`}
            >
              <Icon size={24} d={tab.d} strokeWidth={on ? 2.6 : 2} />
              <span>{copy.tabs[tab.id]}</span>
            </div>
          )
        })}
      </div>

      {/* 홈 인디케이터 */}
      <div className="absolute inset-x-0 bottom-0 flex h-[34px] items-end justify-center pb-2">
        <div className="h-[5px] w-[139px] rounded-full bg-strong opacity-30" />
      </div>
    </div>
  )
}

/** 재노출 카드 한 장 (디자인의 RbCard: 썸네일·요약·메모가 모두 있는 상태). */
function Card({ copy }: { copy: LandingCopy['phone'] }) {
  return (
    <div className="absolute inset-x-0 top-0 bottom-5 flex flex-col overflow-hidden rounded-3xl border border-line bg-surface">
      <div className="flex min-h-[84px] flex-[0_1_176px] items-end bg-thumb bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(127,127,127,0.08)_10px_20px)] px-3 py-2 font-mono text-[11px] text-muted">
        blog cover
      </div>
      <div className="flex flex-[1_0_auto] flex-col gap-2 px-5 pt-4 pb-5">
        <div className="line-clamp-2 text-xl leading-[1.4] font-bold text-strong">{copy.title}</div>
        <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[13px] text-muted">
          <span>{copy.source}</span>
          <span>·</span>
          <span>{copy.saved}</span>
        </div>
        <div className="mt-1 flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-muted">{copy.summaryLabel}</span>
          <p className="line-clamp-4 text-base leading-[1.55] text-body">{copy.summary}</p>
        </div>
        <div className="mt-1 rounded-xl bg-bg px-3 py-2">
          <div className="text-xs font-semibold text-muted">{copy.noteLabel}</div>
          <div className="text-strong">{copy.note}</div>
        </div>
        <div className="mt-auto flex flex-col gap-3 pt-2">
          <div className="flex items-center text-[15px] leading-[1.252] font-medium text-link">
            <span>{copy.details}</span>
            <span className="flex size-5 items-center justify-center">
              <svg width="6.4" height="10.9" viewBox="0 0 6.4 10.9" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M 1 0 C 0.8 0 0.5 0.1 0.4 0.3 C 0 0.7 0 1.2 0.4 1.6 L 4.2 5.4 L 0.3 9.3 C -0.1 9.7 -0.1 10.2 0.3 10.6 C 0.7 11 1.2 11 1.6 10.6 L 6.1 6.1 C 6.5 5.7 6.5 5.2 6.1 4.8 L 1.6 0.3 C 1.4 0.2 1.2 0 1 0 Z"
                />
              </svg>
            </span>
          </div>
          <div className="flex">
            <FakeButton variant="fill">{copy.open}</FakeButton>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 버튼처럼 보이기만 하는 것. 그림의 일부라 누를 수 없다. */
function FakeButton({ variant, children }: { variant: 'fill' | 'weak'; children: ReactNode }) {
  return (
    <div
      className={`flex h-12 min-w-0 flex-1 items-center justify-center rounded-[14px] px-4 text-[17px] leading-[1.252] font-semibold ${
        variant === 'fill' ? 'bg-brand text-on-brand' : 'bg-fill text-sub'
      }`}
    >
      {children}
    </div>
  )
}

function Icon({ d, size, strokeWidth = 2 }: { d: string; size: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={d} />
    </svg>
  )
}

/** iOS 상태 표시줄과 다이내믹 아일랜드. */
function StatusBar() {
  return (
    <>
      <div className="absolute top-[11px] left-1/2 z-20 h-[37px] w-[126px] -translate-x-1/2 rounded-3xl bg-black" />
      <div className="absolute inset-x-0 top-0 z-10 flex items-center justify-center gap-[154px] px-6 pt-[21px] pb-[19px] text-strong">
        <div className="flex h-[22px] flex-1 items-center justify-center pt-[1.5px] text-[17px] leading-[22px] font-semibold">
          9:41
        </div>
        <div className="flex h-[22px] flex-1 items-center justify-center gap-[7px] pt-px pr-px">
          <svg width="19" height="12" viewBox="0 0 19 12" fill="currentColor">
            <rect x="0" y="7.5" width="3.2" height="4.5" rx="0.7" />
            <rect x="4.8" y="5" width="3.2" height="7" rx="0.7" />
            <rect x="9.6" y="2.5" width="3.2" height="9.5" rx="0.7" />
            <rect x="14.4" y="0" width="3.2" height="12" rx="0.7" />
          </svg>
          <svg width="17" height="12" viewBox="0 0 17 12" fill="currentColor">
            <path d="M8.5 3.2C10.8 3.2 12.9 4.1 14.4 5.6L15.5 4.5C13.7 2.7 11.2 1.5 8.5 1.5C5.8 1.5 3.3 2.7 1.5 4.5L2.6 5.6C4.1 4.1 6.2 3.2 8.5 3.2Z" />
            <path d="M8.5 6.8C9.9 6.8 11.1 7.3 12 8.2L13.1 7.1C11.8 5.9 10.2 5.1 8.5 5.1C6.8 5.1 5.2 5.9 3.9 7.1L5 8.2C5.9 7.3 7.1 6.8 8.5 6.8Z" />
            <circle cx="8.5" cy="10.5" r="1.5" />
          </svg>
          <svg width="27" height="13" viewBox="0 0 27 13">
            <rect
              x="0.5"
              y="0.5"
              width="23"
              height="12"
              rx="3.5"
              stroke="currentColor"
              strokeOpacity="0.35"
              fill="none"
            />
            <rect x="2" y="2" width="20" height="9" rx="2" fill="currentColor" />
            <path
              d="M25 4.5V8.5C25.8 8.2 26.5 7.2 26.5 6.5C26.5 5.8 25.8 4.8 25 4.5Z"
              fill="currentColor"
              fillOpacity="0.4"
            />
          </svg>
        </div>
      </div>
    </>
  )
}
