import { useCallback, useRef, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../theme'
import { Button } from '../ui/button'
import { ProviderLogo } from '../ui/provider-logo'
import { useStrings } from '../use-strings'
import { loginErrorMessage } from './messages'
import type { LoginMethod } from './methods'
import { useSession } from './session'

/**
 * 로그인 화면 (디자인 RebomiLogin의 앱 화면). 수단은 `methods` 로 받는다.
 *
 * 로그인하지 않은 동안의 세 상태를 모두 여기서 그린다:
 * - `checking`: 워드마크만 (디자인에 없는 상태)
 * - `unreachable`: 오류 상자와 다시 시도 — 로그인 버튼을 보이지 않는다. 로그아웃된 것이 아니다
 * - `signed-out`: 제목과 로그인 버튼
 *
 * 디자인의 약관 문구 줄은 이용약관·개인정보 처리방침 페이지가 생길 때 넣는다.
 */
export function LoginScreen({ methods }: { methods: LoginMethod[] }) {
  const { status, retry } = useSession()
  const theme = useTheme()
  const strings = useStrings()
  /** 진행 중인 수단의 id. */
  const [busy, setBusy] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const running = useRef(false)

  const start = useCallback(
    (method: LoginMethod) => {
      if (running.current) return
      running.current = true
      setBusy(method.id)
      setMessage(null)

      method
        .run()
        // 성공하면 세션이 `signed-in` 이 되어 이 화면이 사라진다. 취소는 조용히 돌아온다.
        .catch((error: unknown) => setMessage(loginErrorMessage(error, strings)))
        .finally(() => {
          running.current = false
          setBusy(null)
        })
    },
    [strings],
  )

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.top}>
        <Text style={[styles.wordmark, { color: theme.textStrong }]}>Rebomi</Text>
      </View>

      {status === 'unreachable' && (
        <View style={styles.bottom}>
          <ErrorBox message={strings.unreachable} />
          <Button label={strings.retry} variant="brand" onPress={retry} />
        </View>
      )}

      {status === 'signed-out' && (
        <>
          <View style={styles.middle}>
            <Text accessibilityRole="header" style={[styles.title, { color: theme.textStrong }]}>
              {strings.login.title}
            </Text>
            <Text style={[styles.sub, { color: theme.textSub }]}>{strings.login.sub}</Text>
          </View>

          <View style={styles.bottom}>
            {message !== null && busy === null && <ErrorBox message={message} />}
            <View style={styles.buttons}>
              {methods.map((method, index) => (
                <Button
                  key={method.id}
                  label={method.label(strings)}
                  variant={index === 0 ? 'brand' : 'weak'}
                  loading={busy === method.id}
                  disabled={busy !== null && busy !== method.id}
                  onPress={() => start(method)}
                  icon={(color) => <ProviderLogo provider={method.logo} color={color} />}
                />
              ))}
            </View>
          </View>
        </>
      )}
    </SafeAreaView>
  )
}

function ErrorBox({ message }: { message: string }) {
  const theme = useTheme()
  return (
    <View accessibilityRole="alert" style={[styles.error, { backgroundColor: theme.fillWeak }]}>
      <Text style={[styles.errorText, { color: theme.dangerText }]}>{message}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  top: { height: 48, justifyContent: 'center' },
  wordmark: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  middle: { flex: 1, justifyContent: 'center', paddingBottom: 72 },
  title: { fontSize: 38, lineHeight: 43, fontWeight: '700', letterSpacing: -0.76 },
  sub: { marginTop: 12, fontSize: 18, lineHeight: 27 },
  bottom: { marginTop: 'auto', gap: 16, paddingBottom: 20 },
  buttons: { gap: 10 },
  error: { paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14 },
  errorText: { fontSize: 15, lineHeight: 22 },
})
