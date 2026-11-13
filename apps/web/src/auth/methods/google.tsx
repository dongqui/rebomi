'use client'

import { useEffect, useRef } from 'react'
import { useSession } from '../session'
import type { GoogleIdApi } from './sdk'
import type { LoginMethod, LoginMethodProps } from './types'

type Options = {
  clientId: string
  loadSdk: () => Promise<GoogleIdApi>
}

/**
 * Google 로그인. Google Identity Services가 그리는 버튼을 쓰고, 받은 신원 토큰을 서버로 보낸다.
 *
 * 사용자가 Google 창을 닫아 취소한 경우 이 방식은 아무 신호도 주지 않는다 — 화면은 그대로
 * 로그인 화면에 남는다.
 */
export function createGoogleMethod({ clientId, loadSdk }: Options): LoginMethod {
  function GoogleLogin({ attempt, fail }: LoginMethodProps) {
    const { signIn } = useSession()
    const container = useRef<HTMLDivElement>(null)

    // 버튼은 한 번만 그린다. 콜백은 렌더마다 바뀌므로 최신 것을 ref로 읽는다.
    const handlers = useRef({ attempt, fail, signIn })
    useEffect(() => {
      handlers.current = { attempt, fail, signIn }
    })

    useEffect(() => {
      let cancelled = false

      loadSdk().then(
        (sdk) => {
          if (cancelled || !container.current) return
          sdk.initialize({
            client_id: clientId,
            callback: ({ credential }) => {
              const { attempt, fail, signIn } = handlers.current
              if (!credential) {
                fail('Google에서 로그인 정보를 받지 못했습니다. 다시 시도해 주세요.')
                return
              }
              attempt(() => signIn('google', credential))
            },
          })
          sdk.renderButton(container.current, {
            type: 'standard',
            theme: 'outline',
            size: 'large',
            text: 'signin_with',
            locale: 'ko',
            width: 280,
          })
        },
        () => {
          if (!cancelled) {
            handlers.current.fail(
              'Google 로그인을 불러오지 못했습니다. 네트워크나 광고 차단 설정을 확인해 주세요.',
            )
          }
        },
      )

      return () => {
        cancelled = true
      }
    }, [])

    return <div ref={container} data-login-method="google" />
  }

  return { id: 'google', Component: GoogleLogin }
}
