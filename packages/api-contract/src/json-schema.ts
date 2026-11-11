import { z, type ZodType } from 'zod'

/**
 * Fastify 직렬화에 꽂는 JSON 스키마를 만든다. `additionalProperties: false` 이므로
 * 계약에 없는 필드는 응답으로 나가지 못한다 — Zod의 parse는 모르는 키를 조용히
 * 버리기만 해서 서버가 드리프트해도 잡지 못한다.
 */
export function toResponseJsonSchema(schema: ZodType): Record<string, unknown> {
  const jsonSchema = z.toJSONSchema(schema) as Record<string, unknown>
  // Fastify의 직렬화기는 $schema 키를 이해하지 못한다.
  delete jsonSchema.$schema
  return jsonSchema
}
