import { createApiClient, type ApiClient } from '@rebomi/api-client'
import { createTokenStore, type ObservableTokenStore } from './token-store.js'

export type ExtensionApi = {
  client: ApiClient
  tokens: ObservableTokenStore
}

/**
 * 확장이 서버와 통신하는 유일한 경로.
 *
 * 쿠키 방식(`session: 'cookie'`)으로 만든다 — 확장은 웹 로그인을 재사용한다(account ACC-9).
 * 같은 브라우저에서 웹이 받은 갱신 쿠키가 `/auth/refresh` 요청에 실리고, 확장은 그 응답의
 * 액세스 토큰만 메모리에 둔다. 매니페스트의 `host_permissions` 에 API 오리진이 있어야
 * Chrome이 확장 페이지의 요청에 그 쿠키를 붙인다.
 */
export function createExtensionApi(baseUrl: string): ExtensionApi {
  const tokens = createTokenStore()
  const client = createApiClient({ baseUrl, session: 'cookie', tokenStore: tokens })
  return { client, tokens }
}
