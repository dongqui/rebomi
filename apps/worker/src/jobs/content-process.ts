import type { ContentProcessPayload } from '@rebomi/core'
import { and, eq, schema, sql, type Db } from '@rebomi/db'
import { extractPage, type ExtractedPage } from '../extract.js'
import { FetchPageError, type FetchedPage } from '../fetch-page.js'

const { contents, contentBodies } = schema

/** 이번 시도가 몇 번째이고 마지막인지. pg-boss가 알려 준다. */
export type Attempt = {
  /** 지금까지 다시 시도한 횟수. 첫 시도는 0. */
  retryCount: number
  /** 이번에 실패하면 더 시도하지 않는다. */
  isLast: boolean
}

export type ContentProcessDeps = {
  db: Db
  fetchPage: (url: string) => Promise<FetchedPage>
  log: (message: string, context?: unknown) => void
}

export type ContentProcessHandler = (
  payload: ContentProcessPayload,
  attempt: Attempt,
) => Promise<void>

/**
 * 저장된 콘텐츠의 서버 측 처리: 페이지를 가져와 제목·설명·이미지와 본문을 채운다
 * (capture.md CAP-7, CAP-8).
 *
 * 처리 상태(`metadata_status`)의 전이는 여기서만 일어난다.
 *
 * | 결과 | extraction_level | metadata_status | summary_status |
 * | --- | --- | --- | --- |
 * | 본문 추출됨 | full | done | 그대로(pending) |
 * | 본문 없음 | 그대로 | done | no_content |
 * | 영구 오류·재시도 소진 | 그대로 | failed | no_content |
 *
 * 일시 오류는 던져서 pg-boss가 다시 시도하게 한다. 마지막 시도에서는 던지지 않고
 * 실패를 기록한다 — 콘텐츠는 지우지 않는다.
 */
export function createContentProcessHandler(deps: ContentProcessDeps): ContentProcessHandler {
  const { db, fetchPage, log } = deps

  /** 처리 중인 행만 고친다. 이미 끝난 행을 늦게 온 잡이 덮어쓰지 않게 한다. */
  const pending = (contentId: string) =>
    and(eq(contents.id, contentId), eq(contents.metadataStatus, 'pending'))

  async function markFailed(contentId: string): Promise<void> {
    await db.drizzle
      .update(contents)
      .set({
        metadataStatus: 'failed',
        // 본문을 얻지 못했으니 요약할 것이 없다. 이미 본문이 있어 요약이 진행된 행은 두지 않는다.
        summaryStatus: sql`case when ${contents.summaryStatus} = 'pending' then 'no_content' else ${contents.summaryStatus} end`,
      })
      .where(pending(contentId))
  }

  async function markDone(contentId: string, page: ExtractedPage): Promise<void> {
    await db.transaction(async (tx) => {
      const base = {
        metadataStatus: 'done' as const,
        // 저장한 쪽(확장·모바일)이 먼저 채운 값이 있으면 그것을 둔다.
        title: sql`coalesce(${contents.title}, ${page.title})`,
        description: sql`coalesce(${contents.description}, ${page.description})`,
        imageUrl: sql`coalesce(${contents.imageUrl}, ${page.imageUrl})`,
      }

      const updated = await tx.drizzle
        .update(contents)
        .set(
          page.bodyText === null
            ? {
                ...base,
                summaryStatus: sql`case when ${contents.summaryStatus} = 'pending' then 'no_content' else ${contents.summaryStatus} end`,
              }
            : { ...base, extractionLevel: 'full' as const },
        )
        .where(pending(contentId))
        .returning({ id: contents.id })

      // 그 사이 지워졌거나 다른 잡이 끝냈으면 본문을 넣지 않는다.
      if (updated.length === 0 || page.bodyText === null) return

      await tx.drizzle
        .insert(contentBodies)
        .values({ contentId, text: page.bodyText })
        .onConflictDoNothing({ target: contentBodies.contentId })
    })
  }

  return async (payload, attempt) => {
    try {
      await run(payload, attempt)
    } catch (error) {
      // 예상하지 못한 오류(DB 등)로 마지막 시도까지 실패하면 "처리 중"으로 영원히 남는다.
      // 실패를 기록해 보고, 오류는 그대로 올려 잡 실패 로그에 남긴다.
      if (attempt.isLast) {
        await markFailed(payload.contentId).catch(() => {})
      }
      throw error
    }
  }

  async function run(payload: ContentProcessPayload, attempt: Attempt): Promise<void> {
    const { contentId } = payload

    const [content] = await db.drizzle
      .select({ url: contents.url, metadataStatus: contents.metadataStatus })
      .from(contents)
      .where(eq(contents.id, contentId))

    // 처리 전에 지워졌거나(휴지통 영구 삭제, 탈퇴) 이미 끝난 잡이다. 할 일이 없다.
    if (!content || content.metadataStatus !== 'pending') {
      log('worker: content-process skipped', { contentId, found: Boolean(content) })
      return
    }

    let page: FetchedPage
    try {
      page = await fetchPage(content.url)
    } catch (error) {
      if (!(error instanceof FetchPageError)) throw error

      // 주소(쿼리에 토큰이 있을 수 있다)는 로그에 남기지 않는다.
      const context = { contentId, reason: error.reason, retryCount: attempt.retryCount }

      if (error.kind === 'transient' && !attempt.isLast) {
        log('worker: content-process will retry', context)
        throw error
      }

      await markFailed(contentId)
      log('worker: content-process failed', context)
      return
    }

    const extracted = extractPage(page.html, page.url)
    await markDone(contentId, extracted)
    log('worker: content-process done', { contentId, hasBody: extracted.bodyText !== null })
  }
}
