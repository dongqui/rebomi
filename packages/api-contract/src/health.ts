import { z } from 'zod'

/**
 * `GET /health` 의 응답.
 *
 * HTTP 상태는 `ok` 일 때 200, `degraded` 일 때 503이다. 클라이언트는 503도
 * 예외로 만들지 않고 이 모양으로 받는다 — DB 장애를 화면에 보여주는 것이
 * 이 엔드포인트의 용도다 (스펙 6장).
 */
export const healthResponseSchema = z.object({
  status: z.enum(['ok', 'degraded']),
  db: z.enum(['ok', 'error']),
  version: z.string(),
})

export type HealthResponse = z.infer<typeof healthResponseSchema>

/** `health()` 가 예외로 바꾸지 않고 그대로 파싱하는 상태 코드. */
export const HEALTH_ACCEPTED_STATUSES = [200, 503] as const

/**
 * Fastify 직렬화에 꽂는 JSON 스키마. `additionalProperties: false` 이므로 계약에
 * 없는 필드는 응답으로 나가지 못한다 — Zod의 parse는 모르는 키를 조용히 버리기만
 * 해서 서버가 드리프트해도 잡지 못한다.
 */
export const healthResponseJsonSchema: Record<string, unknown> = (() => {
  const schema = z.toJSONSchema(healthResponseSchema) as Record<string, unknown>
  // Fastify의 직렬화기는 $schema 키를 이해하지 못한다.
  delete schema.$schema
  return schema
})()
