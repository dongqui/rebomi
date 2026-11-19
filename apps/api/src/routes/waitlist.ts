import rateLimit from '@fastify/rate-limit'
import {
  ERROR_CODES,
  saveWaitlistResponseRequestSchema,
  waitlistAnswersOf,
} from '@rebomi/api-contract'
import { schema, sql, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { errorBody } from '../errors.js'

const { waitlistResponses } = schema

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * 한 출처(IP)가 응답 저장을 부를 수 있는 횟수. 이 경로는 인증이 없고 이메일 없이도
 * 행을 만들 수 있어 제한을 둔다. 설문을 끝까지 하면 10~15번쯤 보낸다.
 */
export const WAITLIST_RATE_LIMIT = { max: 60, timeWindowMs: 60_000 } as const

/** 정상 요청은 수백 바이트다. */
const BODY_LIMIT_BYTES = 4 * 1024

export type WaitlistRouteDeps = {
  db: Db
}

/**
 * 대기 명단 설문 응답 (waitlist.md WAIT-4, WAIT-8).
 *
 * 요청 제한 플러그인을 이 경로들에만 걸려고 별도 스코프에 등록한다.
 */
export function registerWaitlistRoutes(app: FastifyInstance, deps: WaitlistRouteDeps): void {
  const { db } = deps

  app.register(async (scope) => {
    await scope.register(rateLimit, {
      max: WAITLIST_RATE_LIMIT.max,
      timeWindow: WAITLIST_RATE_LIMIT.timeWindowMs,
      // 던진 것은 공통 에러 핸들러가 429 `RATE_LIMITED` 로 바꾼다 (errors.ts).
      errorResponseBuilder: () => Object.assign(new Error('rate limited'), { statusCode: 429 }),
    })

    /**
     * `PUT /waitlist/responses/:id` — 설문 응답을 저장한다. 로그인을 요구하지 않는다.
     *
     * `:id` 는 브라우저가 만든 UUID다. 그 ID의 응답이 없으면 만들고 있으면 덮어쓴다.
     * 요청은 지금까지의 답 전체이므로 보내지 않은 답은 비운다. 이메일만 예외로,
     * 보내지 않아도 저장된 이메일은 남는다.
     *
     * 저장된 내용은 어떤 응답으로도 돌려주지 않는다 — ID를 아는 것만으로 남의 이메일을
     * 읽을 수 있으면 안 된다.
     */
    scope.put<{ Params: { id: string } }>(
      '/waitlist/responses/:id',
      { bodyLimit: BODY_LIMIT_BYTES },
      async (request, reply) => {
        const { id } = request.params
        // uuid 컬럼에 다른 모양을 넣으면 DB가 오류를 낸다.
        if (!UUID.test(id)) {
          return reply
            .status(400)
            .send(errorBody(ERROR_CODES.VALIDATION_FAILED, '요청이 올바르지 않습니다'))
        }

        const body = saveWaitlistResponseRequestSchema.parse(request.body)
        const answers = waitlistAnswersOf(body)

        await db.drizzle
          .insert(waitlistResponses)
          .values({ id, ...answers, email: body.email ?? null })
          .onConflictDoUpdate({
            target: waitlistResponses.id,
            set: {
              ...answers,
              email: sql`coalesce(excluded.email, ${waitlistResponses.email})`,
              updatedAt: sql`now()`,
            },
          })

        return reply.status(204).send()
      },
    )
  })
}
