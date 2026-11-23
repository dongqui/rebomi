'use client'

import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useSyncExternalStore } from 'react'

export const SEARCH_PATH = '/app/search'

/*
 * 검색어는 주소의 `#` 뒤에 둔다 (`/app/search#q=단어`). 새로고침과 뒤로 가기에서 결과가
 * 유지되면서도 서버로는 가지 않는다 — 검색 API가 검색어를 본문으로 받는 이유(주소는 서버
 * 로그에 남는다)를 웹의 주소가 깨지 않는다.
 */

/** 검색어를 담은 검색 화면의 주소. 빈 검색어면 입력 전 화면이다. */
export function searchHref(query: string): string {
  return query === '' ? SEARCH_PATH : `${SEARCH_PATH}#${new URLSearchParams({ q: query })}`
}

function readQuery(): string {
  if (window.location.pathname !== SEARCH_PATH) return ''
  return new URLSearchParams(window.location.hash.slice(1)).get('q')?.trim() ?? ''
}

/** 주소가 이벤트 없이 바뀌었을 때 알릴 곳. `pushState` 는 이벤트를 내지 않는다. */
const listeners = new Set<() => void>()

function notify() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  window.addEventListener('popstate', listener)
  window.addEventListener('hashchange', listener)
  return () => {
    listeners.delete(listener)
    window.removeEventListener('popstate', listener)
    window.removeEventListener('hashchange', listener)
  }
}

/**
 * 지금 주소의 검색어와, 검색어를 바꾸는 함수. 주소가 유일한 출처다.
 *
 * 검색 화면이 아닌 곳에서는 검색어가 빈 문자열이다.
 */
export function useSearchQuery(): [string, (query: string) => void] {
  const pathname = usePathname()
  const router = useRouter()
  const query = useSyncExternalStore(subscribe, readQuery, () => '')

  // Next는 화면을 바꾸는 커밋 안에서 주소를 바꾼다. 그 화면을 그리는 동안에는 아직 옛
  // 주소라서, 커밋이 끝난 뒤에 한 번 더 읽는다.
  useEffect(notify, [pathname])

  const submit = useCallback(
    (next: string) => {
      const href = searchHref(next.trim())
      // 같은 화면에서는 `#` 뒤만 바뀐다. 화면을 다시 받지 않고 기록만 쌓는다.
      if (window.location.pathname === SEARCH_PATH) window.history.pushState(null, '', href)
      else router.push(href)
      notify()
    },
    [router],
  )

  return [query, submit]
}
