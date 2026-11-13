'use client'

import { useEffect, useState } from 'react'
import { useSession } from '../session'
import type { AppleAuthApi } from './sdk'
import type { LoginMethod, LoginMethodProps } from './types'

type Options = {
  /** Apple Developer의 Service ID. */
  clientId: string
  /**
   * Service ID에 등록한 Return URL. 팝업 모드에서도 Apple이 요구한다.
   * 브라우저에서만 알 수 있는 값(현재 오리진)이라 함수로 받아 화면이 뜬 뒤에 읽는다.
   */
  redirectUri: () => string
  loadSdk: () => Promise<AppleAuthApi>
}

/** Apple이 사용자의 취소를 알릴 때 쓰는 값. */
const CANCELLED = new Set(['popup_closed_by_user', 'user_cancelled_authorize'])

function appleErrorCode(error: unknown): string | null {
  if (typeof error !== 'object' || error === null || !('error' in error)) return null
  return typeof error.error === 'string' ? error.error : null
}

/** Apple 로그인. Sign in with Apple JS의 팝업으로 신원 토큰을 받아 서버로 보낸다. */
export function createAppleMethod({ clientId, redirectUri, loadSdk }: Options): LoginMethod {
  function AppleLogin({ disabled, attempt, fail }: LoginMethodProps) {
    const { signIn } = useSession()
    // 미리 불러 둔다. 누른 뒤에 불러오면 브라우저가 팝업을 사용자 동작으로 보지 않아 막는다.
    const [sdk, setSdk] = useState<AppleAuthApi | null>(null)
    const [waiting, setWaiting] = useState(false)

    useEffect(() => {
      let cancelled = false

      loadSdk().then(
        (loaded) => {
          if (cancelled) return
          loaded.init({ clientId, scope: 'email', redirectURI: redirectUri(), usePopup: true })
          setSdk(loaded)
        },
        () => {
          if (!cancelled) {
            fail('Apple 로그인을 불러오지 못했습니다. 네트워크나 광고 차단 설정을 확인해 주세요.')
          }
        },
      )

      return () => {
        cancelled = true
      }
      // 한 번만 불러온다. `fail` 은 렌더마다 바뀌지만 불러오기를 다시 할 이유가 아니다.
    }, [])

    async function start(loaded: AppleAuthApi) {
      setWaiting(true)
      let idToken: string
      try {
        idToken = (await loaded.signIn()).authorization.id_token
      } catch (error) {
        const code = appleErrorCode(error)
        fail(
          code !== null && CANCELLED.has(code)
            ? 'Apple 로그인을 취소했습니다.'
            : 'Apple 로그인에 실패했습니다. 다시 시도해 주세요.',
        )
        return
      } finally {
        setWaiting(false)
      }
      attempt(() => signIn('apple', idToken))
    }

    return (
      <button
        type="button"
        data-login-method="apple"
        disabled={disabled || waiting || sdk === null}
        onClick={() => {
          if (sdk) void start(sdk)
        }}
        style={{
          width: 280,
          height: 40,
          border: '1px solid #000',
          borderRadius: 4,
          background: '#000',
          color: '#fff',
          fontSize: '0.875rem',
          cursor: 'pointer',
        }}
      >
        Apple로 로그인
      </button>
    )
  }

  return { id: 'apple', Component: AppleLogin }
}
