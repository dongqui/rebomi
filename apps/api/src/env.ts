import { fileURLToPath } from 'node:url'
import { config } from 'dotenv'
import { z } from 'zod'

config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), quiet: true })

/** 쉼표로 구분한 목록. 비어 있으면 빈 배열. */
const commaList = z
  .string()
  .default('')
  .transform((value) =>
    value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean),
  )

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  PORT: z.coerce.number().int().positive().default(3001),
  CORS_ORIGINS: commaList,
  NODE_ENV: z.string().default('development'),
  /** 액세스 토큰 서명 키. 짧은 키는 추측될 수 있어 받지 않는다. */
  AUTH_JWT_SECRET: z.string().min(32, 'AUTH_JWT_SECRET은 32자 이상이어야 합니다'),
  /** 비어 있으면 서버는 뜨지만 그 제공자의 로그인은 503이다. */
  GOOGLE_CLIENT_IDS: commaList,
  APPLE_CLIENT_IDS: commaList,
})

export type Env = z.infer<typeof schema>

/** 환경변수가 올바르지 않으면 기동하지 않는다 — 잘못된 설정으로 뜬 서버가 더 나쁘다. */
export function loadEnv(): Env {
  const parsed = schema.safeParse(process.env)

  if (!parsed.success) {
    // 값은 찍지 않는다. 어느 키가 왜 틀렸는지만 알린다.
    const problems = parsed.error.issues.map((issue) => ({
      key: issue.path.join('.'),
      message: issue.message,
    }))
    console.error('환경변수가 올바르지 않습니다:', JSON.stringify(problems, null, 2))
    process.exit(1)
  }

  return parsed.data
}
