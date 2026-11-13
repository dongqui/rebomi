import type { AppleAuthApi, GoogleIdApi } from '@/auth/methods/sdk'

/**
 * Google Identity Services 흉내. 실제처럼 `renderButton` 이 넘겨받은 요소 안에 버튼을
 * 그리고, 누르면 `initialize` 로 받은 콜백에 신원 토큰을 넘긴다.
 */
export function fakeGoogleSdk(credential: string | undefined = 'google-id-token'): {
  sdk: GoogleIdApi
  clientIds: string[]
} {
  const clientIds: string[] = []
  let callback: ((response: { credential?: string }) => void) | null = null

  return {
    clientIds,
    sdk: {
      initialize: (options) => {
        clientIds.push(options.client_id)
        callback = options.callback
      },
      renderButton: (parent) => {
        const button = document.createElement('button')
        button.textContent = 'Google로 로그인'
        button.addEventListener('click', () => callback?.(credential ? { credential } : {}))
        parent.replaceChildren(button)
      },
    },
  }
}

/** Sign in with Apple JS 흉내. `outcome` 이 Error류면 `signIn()` 이 그것으로 거부된다. */
export function fakeAppleSdk(outcome: { idToken: string } | { error: string }): {
  sdk: AppleAuthApi
  inits: Parameters<AppleAuthApi['init']>[0][]
} {
  const inits: Parameters<AppleAuthApi['init']>[0][] = []

  return {
    inits,
    sdk: {
      init: (options) => {
        inits.push(options)
      },
      signIn: () =>
        'idToken' in outcome
          ? Promise.resolve({ authorization: { id_token: outcome.idToken } })
          : // Apple의 스크립트는 Error가 아니라 `{ error }` 객체로 거부한다.
            Promise.reject({ error: outcome.error }),
    },
  }
}
