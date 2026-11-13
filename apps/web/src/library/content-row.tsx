import type { Content } from '@rebomi/api-contract'
import { EXTRACTION_LABELS, METADATA_LABELS, formatSavedDate } from './labels'

const metaStyle = { color: '#666', fontSize: '0.8125rem' }

/** 콘텐츠 하나의 요약: 제목(없으면 주소), 도메인, 저장일, 추출 수준, 처리 상태. */
export function ContentSummary({ content }: { content: Content }) {
  return (
    <>
      <a href={content.url} target="_blank" rel="noreferrer" style={{ wordBreak: 'break-all' }}>
        {content.title ?? content.url}
      </a>
      <div style={{ ...metaStyle, display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
        <span>{content.domain}</span>
        <time dateTime={content.savedAt}>{formatSavedDate(content.savedAt)}</time>
        {/* 추출 수준과 처리 상태는 서로 다른 축이다. 한 표시에 섞지 않는다. */}
        <span title="추출 수준">{EXTRACTION_LABELS[content.extractionLevel]}</span>
        <span title="처리 상태">{METADATA_LABELS[content.metadataStatus]}</span>
      </div>
    </>
  )
}

export function ContentRow({ content }: { content: Content }) {
  return (
    <li style={{ padding: '0.75rem 0', borderBottom: '1px solid #eee' }}>
      <ContentSummary content={content} />
    </li>
  )
}
