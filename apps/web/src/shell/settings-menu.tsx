'use client'

import { useEffect, useRef, useState } from 'react'
import { useSession } from '@/auth/session'
import { THEMES, useTheme } from '@/theme/theme'
import { IconButton } from '@/ui/buttons'
import { useCopy } from './locale-context'

const SettingsIcon = () => (
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
    <path d="M4 7h10M18 7h2M4 17h2M10 17h10M14 7a2 2 0 1 0 4 0a2 2 0 0 0-4 0M6 17a2 2 0 1 0 4 0a2 2 0 0 0-4 0" />
  </svg>
)

const CheckIcon = () => (
  <svg
    width="18"
    height="18"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.4"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

const itemClass =
  'flex h-10 w-full cursor-pointer items-center justify-between gap-3 rounded-[10px] px-3 text-left text-body hover:bg-fill-pressed disabled:cursor-default disabled:opacity-30'

/**
 * 디자인의 "설정" 자리. 설정 화면이 아직 없어서, 지금 정할 수 있는 것(테마)과 로그아웃을
 * 작은 메뉴로 연다. 설정 화면이 생기면 이 버튼은 그 화면으로 가고 둘은 그리 옮긴다.
 *
 * `variant` — 사이드바에서는 이름이 붙은 줄(`row`, 메뉴가 위로 열린다), 상단 바에서는
 * 아이콘(`icon`, 메뉴가 아래로 열린다).
 */
export function SettingsMenu({ variant }: { variant: 'row' | 'icon' }) {
  const copy = useCopy()
  const { signOut } = useSession()
  const [theme, setTheme] = useTheme()
  const [open, setOpen] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const root = useRef<HTMLDivElement>(null)

  // 바깥을 누르거나 Esc를 누르면 닫는다.
  useEffect(() => {
    if (!open) return

    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !root.current?.contains(event.target)) setOpen(false)
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      root.current?.querySelector('button')?.focus()
    }

    document.addEventListener('pointerdown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [open])

  const toggle = () => setOpen((current) => !current)

  return (
    <div ref={root} className="relative">
      {variant === 'row' ? (
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
          className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-xl px-3 text-left font-medium text-sub hover:bg-fill-pressed"
        >
          <SettingsIcon />
          <span>{copy.nav.settings}</span>
        </button>
      ) : (
        <IconButton
          aria-label={copy.nav.settings}
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={toggle}
        >
          <SettingsIcon />
        </IconButton>
      )}

      {open && (
        <div
          role="menu"
          aria-label={copy.nav.settings}
          className={`absolute z-20 w-52 rounded-2xl border border-line bg-floating p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)] ${
            variant === 'row' ? 'bottom-[calc(100%+6px)] left-0' : 'top-[calc(100%+6px)] right-0'
          }`}
        >
          <div role="group" aria-label={copy.settings.theme}>
            <div className="px-3 pt-1.5 pb-1 text-xs font-semibold text-muted">
              {copy.settings.theme}
            </div>
            {THEMES.map((option) => (
              <button
                key={option}
                type="button"
                role="menuitemradio"
                aria-checked={theme === option}
                onClick={() => setTheme(option)}
                className={itemClass}
              >
                <span>{copy.settings.themes[option]}</span>
                {theme === option && <CheckIcon />}
              </button>
            ))}
          </div>

          <div className="mx-3 my-1.5 border-t border-line" />

          <button
            type="button"
            role="menuitem"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true)
              void signOut()
            }}
            className={itemClass}
          >
            {copy.settings.signOut}
          </button>
        </div>
      )}
    </div>
  )
}
