import { createApiClient } from '@rebomi/api-client'
import { secureRefreshTokenStorage } from './auth/secure-storage'
import { createSessionStore } from './auth/session-store'
import { createTokenStore } from './auth/token-store'
import { apiBaseUrl } from './env'

/** 갱신 토큰은 기기의 보안 저장소에, 액세스 토큰은 메모리에 둔다 (architecture §3). */
export const tokenStore = createTokenStore(secureRefreshTokenStorage)

/** 앱이 서버와 통신하는 유일한 경로. 갱신 토큰은 응답 본문으로 받는다(`session: 'body'`). */
export const api = createApiClient({ baseUrl: apiBaseUrl, tokenStore })

export const sessionStore = createSessionStore({ client: api, tokens: tokenStore })
