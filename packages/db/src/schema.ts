import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core'

/**
 * 계정. 스캐폴드 단계에서는 인증이 붙을 자리만 잡는다 (스펙 1장 "범위 밖").
 */
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
})
