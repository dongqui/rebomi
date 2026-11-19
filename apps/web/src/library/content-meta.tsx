'use client'

import type { Content } from '@rebomi/api-contract'
import { useCopy, useLocale } from '@/shell/locale-context'
import { formatSaved } from './labels'

const Dot = () => <span aria-hidden="true">·</span>

/**
 * 콘텐츠의 제목(없으면 주소)과 한 줄 정보: 출처 · 저장일 · 추출 수준 · 처리 상태.
 *
 * 추출 수준과 처리 상태는 서로 다른 축이다. 한 표시에 섞지 않는다 — 처리 상태는 끝나지
 * 않았을 때만 따로 보인다.
 */
export function ContentMeta({ content, now }: { content: Content; now: Date }) {
  const copy = useCopy()
  const locale = useLocale()

  return (
    <div className="min-w-0">
      <div className="truncate font-semibold text-strong">{content.title ?? content.url}</div>
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-muted">
        <span>{content.domain}</span>
        <Dot />
        <time dateTime={content.savedAt}>{formatSaved(content.savedAt, now, locale, copy)}</time>
        <Dot />
        <span>{copy.extraction[content.extractionLevel]}</span>
        {content.metadataStatus === 'pending' && (
          <>
            <Dot />
            <span className="inline-flex items-center gap-1.5">
              <span aria-hidden="true" className="size-2 rounded-full bg-brand" />
              {copy.home.pending}
            </span>
          </>
        )}
        {content.metadataStatus === 'failed' && (
          <>
            <Dot />
            <span>{copy.home.failed}</span>
          </>
        )}
      </div>
    </div>
  )
}
