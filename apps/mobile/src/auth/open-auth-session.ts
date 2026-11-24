import * as Crypto from 'expo-crypto'
import * as WebBrowser from 'expo-web-browser'
import type { BrowserLoginDeps } from './browser-login'

/**
 * 시스템 브라우저 창(Android: Custom Tab, iOS: ASWebAuthenticationSession)을 연다.
 * 앱 안에 심는 웹뷰가 아니다 — Google은 웹뷰에서의 로그인을 막는다.
 */
export const openAuthSession: BrowserLoginDeps['openAuthSession'] = async (url, returnUrl) => {
  const result = await WebBrowser.openAuthSessionAsync(url, returnUrl)
  return result.type === 'success' ? result.url : null
}

/** 추측할 수 없는 난수 24바이트를 base64url(32자)로. */
export const randomToken: BrowserLoginDeps['randomToken'] = () => {
  const bytes = Crypto.getRandomBytes(24)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
