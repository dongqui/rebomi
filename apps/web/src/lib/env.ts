/** 웹이 기동하려면 있어야 하는 공개 환경변수. 루트 `.env.example` 과 같아야 한다. */
export const PUBLIC_ENV_NAMES = [
  'NEXT_PUBLIC_API_BASE_URL',
  'NEXT_PUBLIC_GOOGLE_CLIENT_ID',
  'NEXT_PUBLIC_APPLE_CLIENT_ID',
] as const

export type PublicEnvName = (typeof PUBLIC_ENV_NAMES)[number]
export type PublicEnv = Record<PublicEnvName, string>

/**
 * 하나라도 없으면 던진다. 조용히 기본값으로 폴백하지 않는다 — 잘못된 주소나 빈 클라이언트
 * ID로 뜬 앱이 더 나쁘다.
 */
export function requirePublicEnv(values: Record<PublicEnvName, string | undefined>): PublicEnv {
  const missing = PUBLIC_ENV_NAMES.filter((name) => !values[name]?.trim())
  if (missing.length > 0) {
    throw new Error(
      `환경변수가 없습니다: ${missing.join(', ')}. 루트의 .env.example 을 참고해 .env 에 넣으세요.`,
    )
  }
  return values as PublicEnv
}
