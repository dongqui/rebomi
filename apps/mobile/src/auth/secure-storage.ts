import * as SecureStore from 'expo-secure-store'
import type { RefreshTokenStorage } from './token-store'

const KEY = 'rebomi.refresh-token'

/**
 * 기기의 보안 저장소(iOS 키체인, Android Keystore로 암호화한 저장소).
 *
 * `AFTER_FIRST_UNLOCK`: 기기를 한 번 잠금 해제한 뒤에는 화면이 잠겨 있어도 읽힌다 —
 * 나중에 공유 확장이나 백그라운드 작업이 세션을 써야 하기 때문이다(iOS에만 적용된다).
 * Android의 자동 백업에서는 expo-secure-store 플러그인이 이 저장소를 뺀다.
 */
const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
}

export const secureRefreshTokenStorage: RefreshTokenStorage = {
  read: () => SecureStore.getItemAsync(KEY, OPTIONS),
  write: (refreshToken) => SecureStore.setItemAsync(KEY, refreshToken, OPTIONS),
  remove: () => SecureStore.deleteItemAsync(KEY, OPTIONS),
}
