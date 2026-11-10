import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true })

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: z
    .string()
    .default('')
    .transform((value) =>
      value
        .split(',')
        .map((origin) => origin.trim())
        .filter(Boolean),
    ),
})

export type Env = z.infer<typeof schema>

/** 환경변수가 올바르지 않으면 기동하지 않는다 — 잘못된 설정으로 뜬 서버가 더 나쁘다. */
export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env)

  if (!parsed.success) {
    console.error('환경변수가 올바르지 않습니다:', JSON.stringify(parsed.error.issues, null, 2))
    process.exit(1)
  }

  return parsed.data
}
