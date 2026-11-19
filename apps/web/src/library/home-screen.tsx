'use client'

import { useState } from 'react'
import { useCopy } from '@/shell/locale-context'
import { Button } from '@/ui/buttons'
import { ContentMeta } from './content-meta'
import { useLibraryContext } from './library-provider'

/**
 * 홈: 최근 저장 (library.md LIB-1, capture.md CAP-7).
 *
 * 디자인의 홈은 "오늘의 재발견"이 먼저고 그 아래가 최근 저장이다. 재노출이 아직 없어서
 * 지금은 최근 저장이 화면의 전부다. 요약 열과 "전체 보기"도 그 기능이 생길 때 붙인다.
 */
export function HomeScreen({ now: clock = () => new Date() }: { now?: () => Date }) {
  const copy = useCopy()
  const { library, openSaveLink } = useLibraryContext()
  // 저장일 표기의 기준 시각. 화면이 뜰 때 한 번 정한다.
  const [now] = useState(clock)

  if (library.load.kind === 'ready' && library.items.length === 0) {
    return (
      <section className="mt-3 rounded-3xl bg-surface p-8">
        <h1 className="mb-1 text-lg font-semibold text-strong">{copy.home.firstTitle}</h1>
        <p className="mb-4 text-sub">{copy.home.firstDesc}</p>
        <Button size="M" onClick={openSaveLink}>
          {copy.home.saveLinkLong}
        </Button>
      </section>
    )
  }

  return (
    <section aria-labelledby="recent-heading" className="mt-3">
      <h1 id="recent-heading" className="mb-2 text-[17px] font-semibold text-strong">
        {copy.home.recent}
      </h1>

      {library.load.kind === 'loading' && (
        <p role="status" className="border-t border-line py-3.5 text-sub">
          {copy.home.loading}
        </p>
      )}

      {/* 받지 못한 것을 빈 목록처럼 보이게 하지 않는다. */}
      {library.load.kind === 'failed' && (
        <div className="border-t border-line py-5">
          <p role="alert" className="mb-4 text-sub">
            {library.load.message}
          </p>
          <Button variant="weak" size="M" onClick={library.reload}>
            {copy.home.retry}
          </Button>
        </div>
      )}

      {library.items.length > 0 && (
        <ul>
          {library.items.map((content) => (
            <li
              key={content.id}
              className="grid items-center gap-x-6 gap-y-1 border-t border-line py-3.5 roomy:grid-cols-[minmax(0,1fr)_auto]"
            >
              <ContentMeta content={content} now={now} />
              <a
                href={content.url}
                target="_blank"
                rel="noreferrer"
                aria-label={copy.home.openLabel(content.title ?? content.url)}
                className="-ml-2.5 inline-flex h-8 items-center justify-self-start rounded-lg px-2.5 text-sm font-medium text-link hover:bg-link-weak roomy:ml-0 roomy:justify-self-end"
              >
                {copy.home.open}
              </a>
            </li>
          ))}
        </ul>
      )}

      {library.moreError !== null && (
        <p role="alert" className="mt-3 text-sm text-danger">
          {library.moreError}
        </p>
      )}
      {library.hasMore && (
        <div className="mt-4">
          <Button variant="weak" size="M" onClick={library.loadMore} disabled={library.loadingMore}>
            {copy.home.more}
          </Button>
        </div>
      )}
    </section>
  )
}
