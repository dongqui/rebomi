import type { AuthProvider } from '@rebomi/api-contract'

/**
 * 시스템 브라우저 창에서 하는 로그인 (account.md §4, architecture §3 "모바일의 로그인 중계").
 *
 * 앱은 웹의 `/login/app/start` 를 브라우저 창으로 열고, 웹이 제공자의 로그인을 거쳐
 * `rebomi://login#provider=…&id_token=…&state=…` 로 돌려준다. 여기에는 제공자 SDK도
 * 클라이언트 ID도 없다.
 */

/** 웹이 돌려보내는 주소. `apps/web/src/server/app-login.ts` 의 `APP_LINK` 와 같아야 한다. */
export const APP_LOGIN_RETURN_URL = 'rebomi://login'

export type BrowserLoginResult =
  | { kind: 'token'; idToken: string }
  /** 사용자가 창을 닫았거나 제공자 화면에서 취소했다. */
  | { kind: 'cancelled' }
  /** 제공자나 중계가 실패했거나, 우리가 연 로그인의 결과가 아니다. */
  | { kind: 'failed' }

export type BrowserLoginDeps = {
  /** 웹의 오리진 (`EXPO_PUBLIC_WEB_BASE_URL`). */
  webBaseUrl: string
  /** 추측할 수 없는 난수 문자열(base64url 16~128자). */
  randomToken(): string
  /**
   * 브라우저 창을 열고, `returnUrl` 로 시작하는 주소로 돌아오면 그 주소를 돌려준다.
   * 사용자가 창을 닫으면 null.
   */
  openAuthSession(url: string, returnUrl: string): Promise<string | null>
}

/** 제공자가 "사용자가 취소했다"고 알릴 때 쓰는 값. */
const CANCELLED = new Set(['user_cancelled_authorize', 'access_denied'])

export function buildStartUrl(
  webBaseUrl: string,
  params: { provider: AuthProvider; state: string; nonce: string },
): string {
  const query = new URLSearchParams(params).toString()
  return `${webBaseUrl.replace(/\/+$/, '')}/login/app/start?${query}`
}

/**
 * 돌아온 주소를 읽는다. `state` 가 우리가 만든 것과 다르면 버린다 — 다른 곳에서 시작한
 * 로그인의 결과(또는 누군가 밀어 넣은 주소)다.
 */
export function parseReturnUrl(
  url: string,
  expected: { provider: AuthProvider; state: string },
): BrowserLoginResult {
  const hash = url.indexOf('#')
  if (!url.startsWith(APP_LOGIN_RETURN_URL) || hash === -1) return { kind: 'failed' }

  const params = new URLSearchParams(url.slice(hash + 1))
  if (params.get('state') !== expected.state) return { kind: 'failed' }
  if (params.get('provider') !== expected.provider) return { kind: 'failed' }

  const error = params.get('error')
  if (error !== null) return { kind: CANCELLED.has(error) ? 'cancelled' : 'failed' }

  const idToken = params.get('id_token')
  return idToken ? { kind: 'token', idToken } : { kind: 'failed' }
}

/** 브라우저 창을 열어 제공자의 신원 토큰을 받는다. 던지지 않는다. */
export async function browserLogin(
  provider: AuthProvider,
  deps: BrowserLoginDeps,
): Promise<BrowserLoginResult> {
  const state = deps.randomToken()
  const nonce = deps.randomToken()

  let returned: string | null
  try {
    returned = await deps.openAuthSession(
      buildStartUrl(deps.webBaseUrl, { provider, state, nonce }),
      APP_LOGIN_RETURN_URL,
    )
  } catch {
    return { kind: 'failed' }
  }

  if (returned === null) return { kind: 'cancelled' }
  return parseReturnUrl(returned, { provider, state })
}
