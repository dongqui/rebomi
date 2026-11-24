import { useMemo } from 'react'
import { Platform } from 'react-native'
import { browserLogin } from '../src/auth/browser-login'
import { LoginScreen } from '../src/auth/login-screen'
import { createLoginMethods } from '../src/auth/methods'
import { openAuthSession, randomToken } from '../src/auth/open-auth-session'
import { useSession } from '../src/auth/session'
import { webBaseUrl } from '../src/env'

/**
 * `/login`. 웹이 로그인 결과를 돌려보내는 딥링크(`rebomi://login`)도 이 화면으로 온다 —
 * 결과 자체는 브라우저 창을 연 쪽(`openAuthSession`)이 받는다.
 */
export default function Login() {
  const { signIn } = useSession()

  /** 로그인 수단. 새 수단은 `createLoginMethods` 에 더한다. */
  const methods = useMemo(
    () =>
      createLoginMethods(Platform.OS, {
        browserLogin: (provider) =>
          browserLogin(provider, { webBaseUrl, randomToken, openAuthSession }),
        signIn,
      }),
    [signIn],
  )

  return <LoginScreen methods={methods} />
}
