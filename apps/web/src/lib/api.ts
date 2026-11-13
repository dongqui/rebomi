import { createApiClient } from '@rebomi/api-client'
import { createTokenStore } from '@/auth/token-store'
import { requirePublicEnv } from './env'

// Next는 `process.env.NEXT_PUBLIC_*` 를 이름을 그대로 쓴 곳에서만 빌드 시 값으로 바꾼다.
// 그래서 이름을 하나씩 적는다 — `process.env[name]` 으로는 브라우저에서 읽히지 않는다.
export const publicEnv = requirePublicEnv({
  NEXT_PUBLIC_API_BASE_URL: process.env.NEXT_PUBLIC_API_BASE_URL,
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
  NEXT_PUBLIC_APPLE_CLIENT_ID: process.env.NEXT_PUBLIC_APPLE_CLIENT_ID,
})

export const apiBaseUrl = publicEnv.NEXT_PUBLIC_API_BASE_URL

/** 액세스 토큰은 메모리에만 둔다. 갱신 토큰은 httpOnly 쿠키에 있다 (architecture §3). */
export const tokenStore = createTokenStore()

/** 웹이 서버와 통신하는 유일한 경로. */
export const api = createApiClient({
  baseUrl: apiBaseUrl,
  session: 'cookie',
  tokenStore,
})
