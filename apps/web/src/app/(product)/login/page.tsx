'use client'

import { LoginScreen } from '@/auth/login-screen'
import { createAppleMethod } from '@/auth/methods/apple'
import { createGoogleMethod } from '@/auth/methods/google'
import { loadAppleSdk, loadGoogleSdk } from '@/auth/methods/sdk'
import type { LoginMethod } from '@/auth/methods/types'
import { publicEnv } from '@/lib/api'

/** 로그인 수단. 새 수단(예: 이메일)은 여기에 항목으로 더한다. */
const methods: LoginMethod[] = [
  createGoogleMethod({
    clientId: publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    loadSdk: loadGoogleSdk,
  }),
  createAppleMethod({
    clientId: publicEnv.NEXT_PUBLIC_APPLE_CLIENT_ID,
    // Apple Service ID에 Return URL로 등록하는 주소. 팝업 모드라 실제로 이동하지는 않는다.
    redirectUri: () => `${window.location.origin}/login`,
    loadSdk: loadAppleSdk,
  }),
]

export default function LoginPage() {
  return <LoginScreen methods={methods} />
}
