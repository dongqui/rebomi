'use client'

import { SEARCH_QUERY_MAX_LENGTH } from '@rebomi/api-contract'
import { useRef, useState, type FormEvent } from 'react'
import { useCopy } from '@/shell/locale-context'
import { useSearch } from './search-provider'

/**
 * 상단 검색창 (디자인의 SearchField). 어느 화면에서나 보인다 (search.md §3).
 *
 * Enter를 눌렀을 때 찾는다. 입력하는 동안에는 서버에 묻지 않는다.
 */
export function SearchField({ className = '' }: { className?: string }) {
  const copy = useCopy()
  const { query, submit } = useSearch()
  const input = useRef<HTMLInputElement>(null)
  const [draft, setDraft] = useState(query)

  // 뒤로 가기나 다른 화면으로 가서 검색어가 바뀌면 입력도 따라간다.
  const [seen, setSeen] = useState(query)
  if (seen !== query) {
    setSeen(query)
    setDraft(query)
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault()
    submit(draft)
  }

  return (
    <form role="search" onSubmit={onSubmit} className={className}>
      <div className="flex h-11 items-center gap-2 rounded-xl bg-fill pr-1.5 pl-3 has-[input:focus-visible]:outline-2 has-[input:focus-visible]:outline-offset-2 has-[input:focus-visible]:outline-focus">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="flex-none text-icon"
        >
          <path d="M10.5 3a7.5 7.5 0 1 0 0 15a7.5 7.5 0 0 0 0-15zM16 16l5 5" />
        </svg>
        <input
          ref={input}
          type="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          maxLength={SEARCH_QUERY_MAX_LENGTH}
          aria-label={copy.search.placeholder}
          placeholder={copy.search.placeholder}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          // 16px 아래면 iOS가 입력할 때 화면을 확대한다.
          className="h-full min-w-0 flex-1 bg-transparent text-base text-strong placeholder:text-muted focus-visible:outline-none [&::-webkit-search-cancel-button]:appearance-none"
        />
        {draft !== '' && (
          <button
            type="button"
            aria-label={copy.search.clear}
            onClick={() => {
              setDraft('')
              input.current?.focus()
            }}
            className="flex size-8 flex-none cursor-pointer items-center justify-center rounded-[10px] text-icon hover:bg-fill-pressed"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              aria-hidden="true"
            >
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        )}
      </div>
    </form>
  )
}
