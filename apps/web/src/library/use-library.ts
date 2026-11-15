'use client'

import { ApiError, type ApiClient } from '@rebomi/api-client'
import { ERROR_CODES, type Content, type CreateContentResponse } from '@rebomi/api-contract'
import { useCallback, useEffect, useRef, useState } from 'react'
import { listErrorMessage } from './labels'

type LibraryClient = Pick<ApiClient, 'listContents' | 'saveContent' | 'getContent'>

/** 첫 페이지의 상태. 받지 못한 것과 비어 있는 것을 구분한다. */
export type LoadState = { kind: 'loading' } | { kind: 'ready' } | { kind: 'failed'; message: string }

export type Library = {
  load: LoadState
  /** 저장일 최근순. */
  items: Content[]
  /** 다음 페이지가 남았는가. */
  hasMore: boolean
  loadingMore: boolean
  /** 다음 페이지를 받지 못한 이유. 받은 항목은 그대로 둔다. */
  moreError: string | null
  /** 첫 페이지를 다시 받는다. */
  reload(): void
  loadMore(): void
  /** 저장한다. 새로 생겼으면 목록 맨 위에 넣는다. 실패하면 던진다. */
  save(url: string): Promise<CreateContentResponse>
}

const isPending = (content: Content) => content.metadataStatus === 'pending'

/**
 * 저장한 콘텐츠 목록과 그 갱신.
 *
 * 처리가 끝났는지는 서버가 알려 주지 않으므로, 처리 중인 항목만 `pollMs` 마다 하나씩
 * 다시 조회한다. 처리 중인 항목이 없으면 묻지 않는다.
 */
export function useLibrary(client: LibraryClient, pollMs: number): Library {
  const [load, setLoad] = useState<LoadState>({ kind: 'loading' })
  const [items, setItems] = useState<Content[]>([])
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [loadingMore, setLoadingMore] = useState(false)
  const [moreError, setMoreError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    let cancelled = false

    client.listContents().then(
      (page) => {
        if (cancelled) return
        setItems(page.items)
        setNextCursor(page.nextCursor)
        setLoad({ kind: 'ready' })
      },
      (error: unknown) => {
        if (!cancelled) setLoad({ kind: 'failed', message: listErrorMessage(error) })
      },
    )

    return () => {
      cancelled = true
    }
  }, [client, attempt])

  const reload = useCallback(() => {
    setLoad({ kind: 'loading' })
    setAttempt((count) => count + 1)
  }, [])

  const loadMore = useCallback(() => {
    if (nextCursor === null || loadingMore) return
    setLoadingMore(true)
    setMoreError(null)

    client
      .listContents({ cursor: nextCursor })
      .then(
        (page) => {
          // 그 사이 저장해 맨 위에 넣은 항목이 뒤 페이지에 다시 올 수는 없지만, 같은 항목이
          // 두 번 그려지면 React 키가 겹친다. 이미 있는 것은 건너뛴다.
          setItems((current) => {
            const known = new Set(current.map((item) => item.id))
            return [...current, ...page.items.filter((item) => !known.has(item.id))]
          })
          setNextCursor(page.nextCursor)
        },
        (error: unknown) => setMoreError(listErrorMessage(error)),
      )
      .finally(() => setLoadingMore(false))
  }, [client, nextCursor, loadingMore])

  const save = useCallback(
    async (url: string) => {
      const result = await client.saveContent({ url, source: 'web' })
      if (result.status === 'created') {
        setItems((current) => [
          result.content,
          ...current.filter((item) => item.id !== result.content.id),
        ])
      }
      return result
    },
    [client],
  )

  // 타이머가 매번 최신 목록을 보게 한다. 목록이 바뀔 때마다 타이머를 다시 걸지 않는다.
  const itemsRef = useRef(items)
  useEffect(() => {
    itemsRef.current = items
  }, [items])

  const hasPending = items.some(isPending)

  useEffect(() => {
    if (!hasPending) return

    let cancelled = false
    /** 응답을 기다리는 중인 항목. 느린 응답 위에 같은 요청을 쌓지 않는다. */
    const inFlight = new Set<string>()

    const timer = setInterval(() => {
      // 보이지 않는 탭에서는 쉰다. 다시 보이면 다음 차례에 이어서 묻는다.
      if (document.hidden) return

      for (const { id } of itemsRef.current.filter(isPending)) {
        if (inFlight.has(id)) continue
        inFlight.add(id)

        client
          .getContent(id)
          .then(
            (fresh) => {
              if (cancelled) return
              setItems((current) => current.map((item) => (item.id === id ? fresh : item)))
            },
            (error: unknown) => {
              if (cancelled) return
              // 그 사이 지워졌다. 그 밖의 실패는 그대로 두고 다음 차례에 다시 묻는다.
              if (error instanceof ApiError && error.code === ERROR_CODES.NOT_FOUND) {
                setItems((current) => current.filter((item) => item.id !== id))
              }
            },
          )
          .finally(() => inFlight.delete(id))
      }
    }, pollMs)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [client, hasPending, pollMs])

  return {
    load,
    items,
    hasMore: nextCursor !== null,
    loadingMore,
    moreError,
    reload,
    loadMore,
    save,
  }
}
