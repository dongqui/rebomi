/** Google Identity Services에서 우리가 쓰는 부분 (`google.accounts.id`). */
export type GoogleIdApi = {
  initialize(options: {
    client_id: string
    callback: (response: { credential?: string }) => void
  }): void
  renderButton(parent: HTMLElement, options: Record<string, string | number>): void
}

/** Sign in with Apple JS에서 우리가 쓰는 부분 (`AppleID.auth`). */
export type AppleAuthApi = {
  init(options: { clientId: string; scope: string; redirectURI: string; usePopup: boolean }): void
  signIn(): Promise<{ authorization: { id_token: string } }>
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdApi } }
    AppleID?: { auth: AppleAuthApi }
  }
}

const GOOGLE_SDK_URL = 'https://accounts.google.com/gsi/client'
const APPLE_SDK_URL =
  'https://appleid.cdn-apple.com/appleauth/static/jsapi/appleid/1/ko_KR/appleid.auth.js'

const loading = new Map<string, Promise<void>>()

/** 스크립트를 한 번만 붙인다. 실패하면 다음 호출이 다시 시도할 수 있게 기록을 지운다. */
function loadScript(src: string): Promise<void> {
  let pending = loading.get(src)
  if (!pending) {
    pending = new Promise<void>((resolve, reject) => {
      const script = document.createElement('script')
      script.src = src
      script.async = true
      script.onload = () => resolve()
      script.onerror = () => {
        script.remove()
        loading.delete(src)
        reject(new Error(`스크립트를 불러오지 못했습니다: ${src}`))
      }
      document.head.append(script)
    })
    loading.set(src, pending)
  }
  return pending
}

export async function loadGoogleSdk(): Promise<GoogleIdApi> {
  await loadScript(GOOGLE_SDK_URL)
  const api = window.google?.accounts.id
  if (!api) throw new Error('Google 로그인 스크립트가 초기화되지 않았습니다')
  return api
}

export async function loadAppleSdk(): Promise<AppleAuthApi> {
  await loadScript(APPLE_SDK_URL)
  const api = window.AppleID?.auth
  if (!api) throw new Error('Apple 로그인 스크립트가 초기화되지 않았습니다')
  return api
}
