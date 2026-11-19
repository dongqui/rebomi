import type { LandingCopy } from './copy'
import { DetailsLink, FakeButton } from './phone-preview'

/*
 * 첫 화면 그림의 두 변형: 다시 꺼낸 카드 한 장, 알림 한 줄 (waitlist.md WAIT-10).
 * 둘 다 **그림**이다 — 누를 수 없고, 보조 기술에는 그림 하나로 읽힌다.
 */

const cardShadow =
  'shadow-[0_24px_44px_-18px_rgba(28,25,20,0.36),0_56px_90px_-34px_rgba(28,25,20,0.3)]'

/** 재노출 카드(디자인의 RbCard: 영상 썸네일과 요약이 있는 상태)를 비뚤게 포갠 더미. */
export function HeroCard({ copy }: { copy: LandingCopy['card'] }) {
  const back = 'absolute inset-0 rounded-3xl border border-line bg-surface'

  return (
    <div
      role="img"
      aria-label={copy.alt}
      className="relative mx-auto mt-2 mb-11 h-[480px] w-[300px] select-none wide:mt-7 wide:mr-10"
    >
      <div aria-hidden="true" inert>
        <div className={`${back} opacity-60`} style={{ transform: 'rotate(-7deg) translate(-20px, 8px)' }} />
        <div className={`${back} opacity-80`} style={{ transform: 'rotate(5deg) translate(18px, 8px)' }} />
        <div
          className={`absolute inset-0 rounded-3xl ${cardShadow}`}
          style={{ transform: 'rotate(-1deg)' }}
        >
          <div className="absolute inset-0 flex flex-col overflow-hidden rounded-3xl border border-line bg-surface text-[15px] leading-normal text-body">
            <div className="flex min-h-[84px] flex-[0_1_176px] items-end justify-between bg-thumb bg-[repeating-linear-gradient(135deg,transparent_0_10px,rgba(127,127,127,0.08)_10px_20px)] px-3 py-2 font-mono text-[11px] text-muted">
              <span>{copy.thumb}</span>
              <span className="rounded-md bg-black/60 px-1.5 py-px text-white">{copy.duration}</span>
            </div>
            <div className="flex flex-[1_0_auto] flex-col gap-2 px-5 pt-4 pb-5">
              <div className="line-clamp-2 text-xl leading-[1.4] font-bold text-strong">
                {copy.title}
              </div>
              <div className="flex flex-wrap gap-x-1.5 gap-y-0.5 text-[13px] text-muted">
                <span>{copy.source}</span>
                <span>·</span>
                <span>{copy.saved}</span>
              </div>
              <div className="mt-1 flex flex-col gap-0.5">
                <span className="text-xs font-semibold text-muted">{copy.summaryLabel}</span>
                <p className="line-clamp-5 text-base leading-[1.55] text-body">{copy.summary}</p>
              </div>
              <div className="mt-auto flex flex-col gap-3 pt-2">
                <DetailsLink>{copy.details}</DetailsLink>
                <div className="flex">
                  <FakeButton variant="fill">{copy.open}</FakeButton>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

/** 알림 한 줄. 뒤에 쌓인 알림 두 장의 가장자리가 비친다. */
export function HeroNotice({ copy }: { copy: LandingCopy['notice'] }) {
  const ghost = 'absolute rounded-[22px] border border-line bg-surface'

  return (
    <div
      role="img"
      aria-label={copy.alt}
      className="relative mx-auto w-full max-w-[430px] pt-2 pb-11 select-none wide:mr-0"
    >
      <div aria-hidden="true">
        <div className={`${ghost} inset-x-7 top-10 bottom-[18px] opacity-55`} />
        <div className={`${ghost} inset-x-3.5 top-6 bottom-[30px] opacity-85`} />
        <div className="relative z-10 flex items-start gap-3.5 rounded-[22px] border border-line bg-floating px-[18px] py-4 shadow-[0_18px_40px_-20px_rgba(28,25,20,0.4)]">
          <div className="flex size-11 flex-none items-center justify-center rounded-[11px] bg-brand text-[22px] font-bold text-on-brand">
            R
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex justify-between gap-3 text-[13px] text-muted">
              <span className="font-semibold">{copy.app}</span>
              <span>{copy.when}</span>
            </div>
            <div className="mt-0.5 text-[17px] leading-[1.35] font-semibold text-strong">
              {copy.title}
            </div>
            <div className="text-[15px] leading-[1.45] text-sub">{copy.body}</div>
          </div>
        </div>
      </div>
    </div>
  )
}
