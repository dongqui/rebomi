import { ERROR_CODES, type ApiErrorBody } from '@rebomi/api-contract'
import { serverDb } from '@/server/db'
import { saveWaitlistResponse } from '@/server/waitlist'

/*
 * `PUT /api/waitlist/responses/:id` — 대기 명단 설문 응답 저장 (waitlist.md WAIT-11).
 * 로그인을 요구하지 않는다. 같은 오리진의 랜딩만 부르므로 CORS 응답은 없다.
 */

// pg 드라이버를 쓴다.
export const runtime = 'nodejs'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const db = serverDb()
  if (db === null) {
    const body: ApiErrorBody = {
      error: { code: ERROR_CODES.INTERNAL, message: '지금은 저장할 수 없습니다' },
    }
    return Response.json(body, { status: 503 })
  }

  try {
    return await saveWaitlistResponse(db, (await params).id, request)
  } catch (error) {
    console.error('waitlist response save failed', error)
    const body: ApiErrorBody = {
      error: { code: ERROR_CODES.INTERNAL, message: '서버에서 문제가 생겼습니다' },
    }
    return Response.json(body, { status: 500 })
  }
}
