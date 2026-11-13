'use client'

import type { ApiClient } from '@rebomi/api-client'
import { ContentRow } from './content-row'
import { SaveForm } from './save-form'
import { useLibrary } from './use-library'

type Props = {
  client: Pick<ApiClient, 'listContents' | 'saveContent' | 'getContent'>
  /** 처리 중인 항목을 다시 확인하는 간격. */
  pollMs?: number
}

/** URL 저장과 저장한 콘텐츠 목록 (capture.md CAP-1·6·7, library.md LIB-1). */
export function LibraryScreen({ client, pollMs = 3000 }: Props) {
  const library = useLibrary(client, pollMs)

  return (
    <>
      <SaveForm onSave={library.save} />

      <section style={{ marginTop: '1.5rem' }}>
        {library.load.kind === 'loading' && <p>불러오는 중…</p>}

        {/* 받지 못한 것을 빈 목록처럼 보이게 하지 않는다. */}
        {library.load.kind === 'failed' && (
          <div>
            <p role="alert" style={{ color: '#b00' }}>
              {library.load.message}
            </p>
            <button type="button" onClick={library.reload}>
              다시 시도
            </button>
          </div>
        )}

        {library.load.kind === 'ready' && library.items.length === 0 && (
          <p style={{ color: '#666' }}>아직 저장한 콘텐츠가 없습니다.</p>
        )}

        {library.items.length > 0 && (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {library.items.map((content) => (
              <ContentRow key={content.id} content={content} />
            ))}
          </ul>
        )}

        {library.moreError !== null && (
          <p role="alert" style={{ color: '#b00', fontSize: '0.875rem' }}>
            {library.moreError}
          </p>
        )}
        {library.hasMore && (
          <button
            type="button"
            onClick={library.loadMore}
            disabled={library.loadingMore}
            style={{ marginTop: '1rem' }}
          >
            더 보기
          </button>
        )}
      </section>
    </>
  )
}
