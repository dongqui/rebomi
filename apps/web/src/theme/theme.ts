'use client'

import { useCallback, useSyncExternalStore } from 'react'
import { THEME_STORAGE_KEY } from './theme-script'

/*
 * 화면 테마. `system` 은 기기 설정을 따르고, `light`·`dark` 는 그쪽으로 고정한다.
 *
 * 고른 값은 이 브라우저에만 저장한다(서버에 없다). 적용은 `<html data-theme>` 하나다 —
 * 토큰이 `light-dark()` 로 적혀 있어 그 속성이 `color-scheme` 만 바꾸면 된다
 * (`src/app/globals.css`).
 */

export const THEMES = ['system', 'light', 'dark'] as const
export type Theme = (typeof THEMES)[number]

function isTheme(value: unknown): value is Theme {
  return THEMES.some((theme) => theme === value)
}

/** 저장된 테마. 저장소를 쓸 수 없거나(사생활 보호 모드) 모르는 값이면 `system` 이다. */
export function readTheme(): Theme {
  try {
    const stored = window.localStorage.getItem(THEME_STORAGE_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

function applyTheme(theme: Theme) {
  if (theme === 'system') delete document.documentElement.dataset.theme
  else document.documentElement.dataset.theme = theme
}

const listeners = new Set<() => void>()

function subscribe(listener: () => void) {
  listeners.add(listener)
  // 다른 탭에서 바꾼 것도 따라간다.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== THEME_STORAGE_KEY) return
    applyTheme(readTheme())
    listener()
  }
  window.addEventListener('storage', onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('storage', onStorage)
  }
}

export function setTheme(theme: Theme) {
  try {
    if (theme === 'system') window.localStorage.removeItem(THEME_STORAGE_KEY)
    else window.localStorage.setItem(THEME_STORAGE_KEY, theme)
  } catch {
    // 저장하지 못해도 이번 방문에는 적용한다.
  }
  applyTheme(theme)
  for (const listener of listeners) listener()
}

/** 지금 테마와 바꾸는 함수. 서버에서 그릴 때는 `system` 이다. */
export function useTheme(): [Theme, (theme: Theme) => void] {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => 'system' as const)
  return [theme, useCallback((next: Theme) => setTheme(next), [])]
}

/** 화면에 적용된 값이 기준이다. 저장하지 못한 경우에도 고른 대로 보인다. */
function currentTheme(): Theme {
  const applied = document.documentElement.dataset.theme
  return isTheme(applied) ? applied : 'system'
}
