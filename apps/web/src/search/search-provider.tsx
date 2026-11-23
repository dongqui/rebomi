'use client'

import { ApiError, type ApiClient } from '@rebomi/api-client'
import { ERROR_CODES, type Content, type SearchResult } from '@rebomi/api-contract'
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { listErrorMessage } from '@/library/labels'
import { useLibraryContext } from '@/library/library-provider'
import { useCopy } from '@/shell/locale-context'
import { useToast } from '@/ui/toast'
import { useSearchQuery } from './query'

export type SearchClient = Pick<
  ApiClient,
  'searchContents' | 'archiveContent' | 'trashContent' | 'restoreContent'
>

/** 검색하지 못한 이유. `invalid` 는 서버가 검색어를 받지 않은 것이라 다시 보내도 같다. */
export type SearchFailure = 'invalid' | 'unreachable'

/** 화면이 그릴 상태. 결과가 없는 것과 받지 못한 것을 구분한다. */
export type SearchView =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'failed'; reason: SearchFailure }
  | { kind: 'results'; items: SearchResult[] }

type SearchContextValue = {
  /** 지금 찾고 있는 검색어. 검색 화면이 아니거나 입력 전이면 빈 문자열. */
  query: string
  /** 검색어를 바꾼다. 검색 화면으로 가고 주소에 남는다. */
  submit(query: string): void
  view: SearchView
  hasMore: boolean
  loadingMore: boolean
  /** 다음 쪽을 받지 못한 이유. 받은 결과는 그대로 둔다. */
  moreError: string | null
  loadMore(): void
  retry(): void
  archive(result: SearchResult): void
  /** 휴지통으로 보낸다. 확인은 부르는 쪽이 받는다. */
  trash(result: SearchResult): void
}

const SearchContext = createContext<SearchContextValue | null>(null)

export function useSearch(): SearchContextValue {
  const value = useContext(SearchContext)
  if (!value) throw new Error('SearchProvider 안에서만 쓸 수 있습니다')
  return value
}

/** 한 번의 검색(검색어 + 시도)에 대한 결과. `key` 가 지금 것과 다르면 지난 검색이다. */
type Outcome =
  | {
      key: string
      kind: 'found'
      items: SearchResult[]
      nextCursor: string | null
      /** 서버가 하나도 찾지 못했는가. 찾은 것을 사용자가 지운 것과 구분한다. */
      nothing: boolean
    }
  | { key: string; kind: 'failed'; reason: SearchFailure }

type More = { key: string; loading: boolean; error: string | null }

const failureOf = (error: unknown): SearchFailure =>
  error instanceof ApiError && error.code === ERROR_CODES.VALIDATION_FAILED
    ? 'invalid'
    : 'unreachable'

/**
 * 검색어, 그 결과, 결과에서의 보관·삭제 (search.md SRCH-4~6, library.md LIB-3~4).
 *
 * 화면(검색 화면)이 아니라 여기에 있는 이유: 검색창은 앱 틀에 있고 결과는 검색 화면에
 * 나타나야 한다.
 */
export function SearchProvider({
  client,
  children,
}: {
  client: SearchClient
  children: ReactNode
}) {
  const copy = useCopy()
  const toast = useToast()
  const { library } = useLibraryContext()
  const [query, submit] = useSearchQuery()
  const [attempt, setAttempt] = useState(0)
  const [outcome, setOutcome] = useState<Outcome | null>(null)
  const [more, setMore] = useState<More | null>(null)
  /** 휴지통으로 보낸 결과. 되돌리면 제자리에 다시 보이도록 빼지 않고 가려 둔다. */
  const [trashed, setTrashed] = useState<ReadonlySet<string>>(new Set())

  const key = `${attempt}\n${query}`

  useEffect(() => {
    if (query === '') return
    let cancelled = false

    client.searchContents({ query }).then(
      (page) => {
        if (cancelled) return
        setOutcome({
          key,
          kind: 'found',
          items: page.items,
          nextCursor: page.nextCursor,
          nothing: page.items.length === 0,
        })
        setTrashed(new Set())
      },
      (error: unknown) => {
        if (!cancelled) setOutcome({ key, kind: 'failed', reason: failureOf(error) })
      },
    )

    return () => {
      cancelled = true
    }
  }, [client, query, key])

  const current = query !== '' && outcome?.key === key ? outcome : null
  const found = current?.kind === 'found' ? current : null
  const nextCursor = found?.nextCursor ?? null
  const currentMore = more?.key === key ? more : null
  const loadingMore = currentMore?.loading ?? false

  const retry = useCallback(() => setAttempt((count) => count + 1), [])

  const loadMore = useCallback(() => {
    if (nextCursor === null || loadingMore) return
    setMore({ key, loading: true, error: null })

    client.searchContents({ query, cursor: nextCursor }).then(
      (page) => {
        setOutcome((latest) => {
          if (latest?.key !== key || latest.kind !== 'found') return latest
          const known = new Set(latest.items.map((item) => item.content.id))
          return {
            ...latest,
            items: [...latest.items, ...page.items.filter((item) => !known.has(item.content.id))],
            nextCursor: page.nextCursor,
          }
        })
        setMore({ key, loading: false, error: null })
      },
      (error: unknown) => setMore({ key, loading: false, error: listErrorMessage(error, copy) }),
    )
  }, [client, query, key, nextCursor, loadingMore, copy])

  /** 결과 안의 콘텐츠를 서버가 돌려준 새 값으로 바꾼다. 그 사이 검색이 바뀌었으면 그대로 둔다. */
  const putContent = useCallback((content: Content) => {
    setOutcome((latest) =>
      latest?.kind === 'found'
        ? {
            ...latest,
            items: latest.items.map((item) =>
              item.content.id === content.id ? { ...item, content } : item,
            ),
          }
        : latest,
    )
  }, [])

  const archive = useCallback(
    ({ content }: SearchResult) => {
      client.archiveContent(content.id).then(
        (archived) => {
          putContent(archived)
          library.replace(archived)
          // 보관됨을 Inbox로 되돌리는 동작이 없어 되돌리기를 두지 않는다 (library.md §5).
          toast.show(copy.search.archived)
        },
        () => toast.show(copy.search.archiveFailed),
      )
    },
    [client, library, toast, copy, putContent],
  )

  const trash = useCallback(
    ({ content }: SearchResult) => {
      const { id } = content
      const setHidden = (hidden: boolean) =>
        setTrashed((ids) => {
          const next = new Set(ids)
          if (hidden) next.add(id)
          else next.delete(id)
          return next
        })

      const undo = () => {
        client.restoreContent(id).then(
          (restored) => {
            putContent(restored)
            setHidden(false)
            // 최근 저장의 어디에 있었는지는 서버가 안다.
            library.reload()
          },
          () => toast.show(copy.search.undoFailed),
        )
      }

      client.trashContent(id).then(
        () => {
          setHidden(true)
          library.remove(id)
          toast.show(copy.search.trashed, { label: copy.search.undo, run: undo })
        },
        () => toast.show(copy.search.deleteFailed),
      )
    },
    [client, library, toast, copy, putContent],
  )

  const view = useMemo((): SearchView => {
    if (query === '') return { kind: 'idle' }
    if (current === null) return { kind: 'loading' }
    if (current.kind === 'failed') return { kind: 'failed', reason: current.reason }
    if (current.nothing) return { kind: 'empty' }
    return {
      kind: 'results',
      items: current.items.filter((item) => !trashed.has(item.content.id)),
    }
  }, [query, current, trashed])

  const value = useMemo(
    () => ({
      query,
      submit,
      view,
      hasMore: nextCursor !== null,
      loadingMore,
      moreError: currentMore?.error ?? null,
      loadMore,
      retry,
      archive,
      trash,
    }),
    [query, submit, view, nextCursor, loadingMore, currentMore, loadMore, retry, archive, trash],
  )

  return <SearchContext.Provider value={value}>{children}</SearchContext.Provider>
}
