'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useSyncExternalStore, type ReactNode } from 'react'
import { useLibraryContext } from '@/library/library-provider'
import { Button } from '@/ui/buttons'
import { useCopy } from './locale-context'
import { SettingsMenu } from './settings-menu'

/** 디자인의 경계: 860px 이하에서는 사이드바 대신 상단 바를 쓴다. */
const WIDE_QUERY = '(min-width: 861px)'

function subscribeWide(listener: () => void) {
  const query = window.matchMedia?.(WIDE_QUERY)
  query?.addEventListener('change', listener)
  return () => query?.removeEventListener('change', listener)
}

/**
 * 넓은 화면인가. 둘을 다 그려 놓고 CSS로 감추지 않는 이유: 같은 버튼이 문서에 두 번
 * 있으면 보조 기술과 테스트가 어느 쪽인지 가릴 수 없다. 이 화면은 로그인을 확인한 뒤
 * 브라우저에서만 그려지므로 서버와 어긋날 일이 없다.
 */
function useWide(): boolean {
  return useSyncExternalStore(
    subscribeWide,
    () => window.matchMedia?.(WIDE_QUERY).matches ?? true,
    () => true,
  )
}

const HOME_ICON = 'M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z'

const Brand = () => <div className="text-xl font-bold tracking-[-0.01em] text-strong">Rebomi</div>

/**
 * `/app` 아래 화면들의 공통 틀: 내비게이션과 상단 영역 (디자인 RebomiWeb).
 *
 * 디자인의 내비에는 검색·보관함이 있고 상단에는 검색창이 있다. 그 기능이 붙을 때 여기에
 * 항목으로 더한다 — 눌러도 되지 않는 자리는 두지 않는다.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const copy = useCopy()
  const wide = useWide()
  const pathname = usePathname()
  const { openSaveLink } = useLibraryContext()

  const items = [{ href: '/app', label: copy.nav.home, icon: HOME_ICON }]

  const saveButton = (
    <Button variant="weak" size="M" onClick={openSaveLink}>
      {copy.saveLink}
    </Button>
  )

  return (
    <div className="flex min-h-dvh text-[15px] leading-normal">
      {wide && (
        <nav
          aria-label={copy.nav.label}
          className="sticky top-0 flex h-dvh w-56 flex-none flex-col gap-0.5 border-r border-line px-3 pt-5 pb-3"
        >
          <div className="px-3 pt-1 pb-5">
            <Brand />
          </div>
          {items.map((item) => {
            const current = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={current ? 'page' : undefined}
                className={`flex h-11 items-center gap-3 rounded-xl px-3 hover:bg-fill-pressed ${
                  current ? 'bg-fill font-semibold text-strong' : 'font-medium text-sub'
                }`}
              >
                <svg
                  width="22"
                  height="22"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d={item.icon} />
                </svg>
                <span>{item.label}</span>
              </Link>
            )
          })}
          <div className="flex-1" />
          <SettingsMenu variant="row" />
        </nav>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-3 px-4 pt-4 pb-3 wide:gap-4 wide:px-8">
          {!wide && (
            <>
              <Brand />
              <nav aria-label={copy.nav.label} className="mx-1 flex gap-1">
                {items.map((item) => {
                  const current = pathname === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={current ? 'page' : undefined}
                      className={`flex h-10 items-center rounded-xl px-3.5 hover:bg-fill-pressed ${
                        current ? 'bg-fill font-semibold text-strong' : 'font-medium text-sub'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </>
          )}
          <div className="ml-auto flex items-center gap-2">
            {saveButton}
            {!wide && <SettingsMenu variant="icon" />}
          </div>
        </header>

        <main className="flex-1 px-4 pt-3 pb-16 wide:px-8">
          <div className="mx-auto max-w-[984px]">{children}</div>
        </main>
      </div>
    </div>
  )
}
