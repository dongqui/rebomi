import { config } from 'dotenv'
import { z } from 'zod'

config({ path: new URL('../../../.env', import.meta.url).pathname, quiet: true })

const schema = z.object({
  DATABASE_URL: z.string().min(1),
})

export type Env = z.infer<typeof schema>

/** 환경변수가 올바르지 않으면 기동하지 않는다. */
export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env)

  if (!parsed.success) {
    console.error('환경변수가 올바르지 않습니다:', JSON.stringify(parsed.error.issues, null, 2))
    process.exit(1)
  }

  return parsed.data
}
