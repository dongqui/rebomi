import type { AuthProvider } from '@rebomi/api-contract'
import type { Strings } from '../strings'
import type { BrowserLoginResult } from './browser-login'

/**
 * 로그인 화면에 나열되는 수단. 화면은 수단이 몇 개인지, 각 수단이 자격을 어떻게 얻는지
 * 모른다 — 새 수단(예: 이메일, 기기의 네이티브 로그인)은 이 모양으로 만들어 목록에 넣는다.
 */
export type LoginMethod = {
  id: string
  /** 버튼의 로고. */
  logo: 'google' | 'apple'
  label(strings: Strings): string
  /**
   * 로그인을 끝까지 실행한다. 사용자가 그만뒀으면 `cancelled`.
   * 실패하면 던진다 — 서버가 거부했으면 `ApiError`, 그 전에 실패했으면 `BrowserLoginFailed`.
   */
  run(): Promise<'signed-in' | 'cancelled'>
}

export type LoginMethodDeps = {
  /** 브라우저 창에서 제공자의 신원 토큰을 받는다. */
  browserLogin(provider: AuthProvider): Promise<BrowserLoginResult>
  signIn(provider: AuthProvider, idToken: string): Promise<void>
}

/** 브라우저 창에서 신원 토큰을 받지 못했다(제공자나 중계의 실패). */
export class BrowserLoginFailed extends Error {
  constructor() {
    super('browser login failed')
    this.name = 'BrowserLoginFailed'
  }
}

function browserMethod(provider: AuthProvider, deps: LoginMethodDeps): LoginMethod {
  return {
    id: provider,
    logo: provider,
    label: (strings) => strings.login[provider],
    async run() {
      const result = await deps.browserLogin(provider)
      if (result.kind === 'cancelled') return 'cancelled'
      if (result.kind === 'failed') throw new BrowserLoginFailed()
      await deps.signIn(provider, result.idToken)
      return 'signed-in'
    },
  }
}

/**
 * 지금의 수단: Google과 Apple, 둘 다 시스템 브라우저 창에서 한다 (account.md §4).
 * 순서는 디자인(RebomiLogin)을 따른다 — iOS는 Apple 먼저, Android는 Google 먼저.
 */
export function createLoginMethods(platform: string, deps: LoginMethodDeps): LoginMethod[] {
  const google = browserMethod('google', deps)
  const apple = browserMethod('apple', deps)
  return platform === 'ios' ? [apple, google] : [google, apple]
}
