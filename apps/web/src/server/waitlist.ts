import {
  ERROR_CODES,
  saveWaitlistResponseRequestSchema,
  waitlistAnswersOf,
  type ApiErrorBody,
} from '@rebomi/api-contract'
import { schema, sql, type Db } from '@rebomi/db'

/*
 * 대기 명단 설문 응답 저장 (waitlist.md WAIT-4, WAIT-8, WAIT-11).
 *
 * 배포된 랜딩은 API 서버 없이 이 웹의 `/api` 로 응답을 저장한다. 계약과 동작은
 * `apps/api` 의 `PUT /waitlist/responses/:id` 와 같다 — 둘을 함께 고친다.
 *
 * 요청 제한은 여기 없다. 서버리스 인스턴스는 메모리를 나눠 쓰지 않아 여기서 세면 맞지
 * 않는다. 배포 쪽 방화벽에서 건다 (architecture.md §8).
 */

const { waitlistResponses } = schema

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** 정상 요청은 수백 바이트다. */
const BODY_LIMIT_BYTES = 4 * 1024

function failure(status: number, code: string, message: string): Response {
  const body: ApiErrorBody = { error: { code, message } }
  return Response.json(body, { status })
}

const invalid = () => failure(400, ERROR_CODES.VALIDATION_FAILED, '요청이 올바르지 않습니다')

/**
 * `:id` 는 브라우저가 만든 UUID다. 그 ID의 응답이 없으면 만들고 있으면 덮어쓴다. 요청은
 * 지금까지의 답 전체이므로 보내지 않은 답은 비운다. 이메일만 예외로, 보내지 않아도 저장된
 * 이메일은 남는다.
 *
 * 저장된 내용은 어떤 응답으로도 돌려주지 않는다 — ID를 아는 것만으로 남의 이메일을 읽을
 * 수 있으면 안 된다.
 */
export async function saveWaitlistResponse(db: Db, id: string, request: Request): Promise<Response> {
  // uuid 컬럼에 다른 모양을 넣으면 DB가 오류를 낸다.
  if (!UUID.test(id)) return invalid()

  const text = await request.text()
  if (new TextEncoder().encode(text).byteLength > BODY_LIMIT_BYTES) {
    return failure(413, ERROR_CODES.BAD_REQUEST, '요청을 처리할 수 없습니다')
  }

  let json: unknown
  try {
    json = JSON.parse(text)
  } catch {
    return invalid()
  }
  const parsed = saveWaitlistResponseRequestSchema.safeParse(json)
  if (!parsed.success) return invalid()

  const answers = waitlistAnswersOf(parsed.data)
  await db.drizzle
    .insert(waitlistResponses)
    .values({ id, ...answers, email: parsed.data.email ?? null })
    .onConflictDoUpdate({
      target: waitlistResponses.id,
      set: {
        ...answers,
        email: sql`coalesce(excluded.email, ${waitlistResponses.email})`,
        updatedAt: sql`now()`,
      },
    })

  return new Response(null, { status: 204 })
}
