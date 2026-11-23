'use client'

import { SEARCH_MAX_TERMS, type SearchMatch, type SearchResult } from '@rebomi/api-contract'
import { useEffect, useRef, useState } from 'react'
import { ContentFacts } from '@/library/content-meta'
import { useCopy } from '@/shell/locale-context'
import { Button, IconButton } from '@/ui/buttons'
import { ConfirmDialog } from '@/ui/confirm-dialog'
import { matchedWords, pickMatch, segmentsOf } from './evidence'
import { useSearch } from './search-provider'

const H1_SMALL = 'mt-3 mb-1 text-lg font-semibold text-strong'

/** 일치한 부분을 강조한 글. */
function Highlighted({ match }: { match: SearchMatch }) {
  return (
    <>
      {segmentsOf(match.text, match.ranges).map((segment, index) =>
        segment.hit ? (
          <mark key={index} className="rounded bg-mark px-0.5 font-semibold text-strong">
            {segment.text}
          </mark>
        ) : (
          <span key={index}>{segment.text}</span>
        ),
      )}
    </>
  )
}

/**
 * 왜 이 콘텐츠가 나왔는지 (search.md SRCH-4, 디자인의 "인용 문장").
 *
 * 근거는 하나만 보인다. 본문·설명에서 일치했으면 그 글을, 제목에서만 일치했으면 어떤
 * 단어인지를, 주소에서만 일치했으면 주소를 보인다.
 */
function Evidence({ matches }: { matches: SearchMatch[] }) {
  const copy = useCopy()
  const match = pickMatch(matches)
  if (match === null) return null

  const label =
    match.field === 'title'
      ? copy.search.titleMatch
      : match.field === 'url'
        ? copy.search.urlMatch
        : copy.search.related
  const words = match.field === 'title' ? matchedWords(match) : []

  return (
    <div className="mt-1 rounded-xl bg-fill px-3.5 py-2.5">
      <div className="text-xs font-semibold text-muted">{label}</div>
      {match.field === 'title' ? (
        words.length > 0 && <div className="text-sm text-body">{copy.search.titleWords(words)}</div>
      ) : (
        <div className={`text-sm text-body ${match.field === 'url' ? 'break-all' : ''}`}>
          <Highlighted match={match} />
        </div>
      )}
    </div>
  )
}

/** 결과 하나의 더 보기 메뉴. 지금은 삭제 하나다 (디자인 RbActions `search`). */
function RowMenu({ onDelete }: { onDelete: () => void }) {
  const copy = useCopy()
  const [open, setOpen] = useState(false)
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

  return (
    <div ref={root} className="relative ml-auto">
      <IconButton
        size="S"
        aria-label={copy.search.menu}
        title={copy.search.menu}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="5" cy="12" r="1.8" />
          <circle cx="12" cy="12" r="1.8" />
          <circle cx="19" cy="12" r="1.8" />
        </svg>
      </IconButton>

      {open && (
        <div
          role="menu"
          aria-label={copy.search.menu}
          className="absolute top-[calc(100%+6px)] right-0 z-20 w-max min-w-40 rounded-2xl border border-line bg-floating p-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.14)]"
        >
          <button
            type="button"
            role="menuitem"
            onClick={() => {
              setOpen(false)
              onDelete()
            }}
            className="flex h-10 w-full cursor-pointer items-center rounded-[10px] px-3 text-left text-danger hover:bg-fill-pressed"
          >
            {copy.search.deleteLong}
          </button>
        </div>
      )}
    </div>
  )
}

function ResultRow({
  result,
  now,
  onArchive,
  onDelete,
}: {
  result: SearchResult
  now: Date
  onArchive: () => void
  onDelete: () => void
}) {
  const copy = useCopy()
  const { content, matches } = result
  const title = content.title ?? content.url

  return (
    <article className="flex flex-col gap-1.5 border-t border-line py-5">
      <ContentFacts content={content} now={now} />
      <h2 className="text-lg leading-[1.4] font-semibold [overflow-wrap:anywhere] text-pretty text-strong">
        {title}
      </h2>
      <Evidence matches={matches} />

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <a
          href={content.url}
          target="_blank"
          rel="noreferrer"
          aria-label={copy.home.openLabel(title)}
          className="inline-flex h-8 items-center rounded-[10px] bg-link-weak px-3 text-[13px] leading-[1.252] font-semibold text-link hover:opacity-80"
        >
          {copy.home.open}
        </a>
        {/* 보관됨을 Inbox로 되돌리는 동작이 없다. 이미 보관됨이면 할 것이 없다. */}
        {content.archiveState === 'inbox' && (
          <Button variant="weak" size="S" aria-label={copy.search.archiveLong} onClick={onArchive}>
            {copy.search.archive}
          </Button>
        )}
        <RowMenu onDelete={onDelete} />
      </div>
    </article>
  )
}

const SKELETON_ROWS = [
  ['w-[30%]', 'w-[70%]', 'w-[92%]'],
  ['w-[24%]', 'w-[56%]', 'w-[84%]'],
  ['w-[28%]', 'w-[64%]', 'w-[78%]'],
] as const

/**
 * 검색 화면 (search.md SRCH-4~6, 디자인 RebomiWeb의 검색).
 *
 * 지금은 키워드 검색뿐이라 요약과 "뜻이 비슷해요" 근거는 없다 — 그 기능이 생길 때 붙인다.
 */
export function SearchScreen({ now: clock = () => new Date() }: { now?: () => Date }) {
  const copy = useCopy()
  const search = useSearch()
  const { view } = search
  // 저장일 표기의 기준 시각. 화면이 뜰 때 한 번 정한다.
  const [now] = useState(clock)
  const [deleting, setDeleting] = useState<SearchResult | null>(null)

  return (
    <section aria-label={copy.search.results} className="max-w-[780px]">
      {view.kind === 'idle' && (
        <>
          <h1 className="mt-3 mb-1 text-2xl leading-[1.35] font-bold text-strong">
            {copy.search.placeholder}
          </h1>
          <p className="text-sub">{copy.search.idleDesc}</p>
        </>
      )}

      {view.kind === 'loading' && (
        <>
          <p role="status" className="mt-3 mb-2 text-sub">
            {copy.search.searching}
          </p>
          <div aria-hidden="true">
            {SKELETON_ROWS.map(([meta, title, text]) => (
              <div key={title} className="flex flex-col gap-2.5 border-t border-line py-5">
                <div className={`h-3 rounded-md bg-fill ${meta}`} />
                <div className={`h-[18px] rounded-md bg-fill ${title}`} />
                <div className={`h-3.5 rounded-md bg-fill ${text}`} />
              </div>
            ))}
          </div>
        </>
      )}

      {view.kind === 'empty' && (
        <>
          <h1 className={H1_SMALL}>{copy.search.noMatch}</h1>
          <p className="text-sub">
            {copy.search.emptyLine1}
            <br />
            {copy.search.emptyLine2}
          </p>
        </>
      )}

      {/* 받지 못한 것을 결과 없음처럼 보이게 하지 않는다. */}
      {view.kind === 'failed' &&
        (view.reason === 'invalid' ? (
          <>
            <h1 className={H1_SMALL}>{copy.search.tooLong}</h1>
            <p className="text-sub">{copy.search.tooLongDesc(SEARCH_MAX_TERMS)}</p>
          </>
        ) : (
          <>
            <h1 className={H1_SMALL}>{copy.search.failed}</h1>
            <p className="mb-4 text-sub">
              {copy.search.errLine1}
              <br />
              {copy.search.errLine2}
            </p>
            <Button variant="weak" size="M" onClick={search.retry}>
              {copy.home.retry}
            </Button>
          </>
        ))}

      {view.kind === 'results' && (
        <>
          <h1 className="mt-3 mb-1 text-[17px] font-semibold text-strong">
            {/* 전체 개수는 서버가 주지 않는다. 다 받았을 때만 센다. */}
            {search.hasMore || view.items.length === 0
              ? copy.search.results
              : copy.search.found(view.items.length)}
          </h1>

          {view.items.map((result) => (
            <ResultRow
              key={result.content.id}
              result={result}
              now={now}
              onArchive={() => search.archive(result)}
              onDelete={() => setDeleting(result)}
            />
          ))}

          {search.moreError !== null && (
            <p role="alert" className="mt-3 text-sm text-danger">
              {search.moreError}
            </p>
          )}
          {search.hasMore && (
            <div className="mt-4">
              <Button
                variant="weak"
                size="M"
                onClick={search.loadMore}
                disabled={search.loadingMore}
              >
                {copy.search.more}
              </Button>
            </div>
          )}
        </>
      )}

      {deleting !== null && (
        <ConfirmDialog
          title={copy.search.deleteTitle}
          description={copy.search.deleteDesc}
          confirmLabel={copy.search.deleteLong}
          cancelLabel={copy.search.cancel}
          onCancel={() => setDeleting(null)}
          onConfirm={() => {
            search.trash(deleting)
            setDeleting(null)
          }}
        />
      )}
    </section>
  )
}
