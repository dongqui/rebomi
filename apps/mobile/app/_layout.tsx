import { Stack } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { sessionStore } from '../src/api'
import { SessionProvider, useSession } from '../src/auth/session'
import { useTheme } from '../src/theme'

export default function RootLayout() {
  return (
    <SessionProvider store={sessionStore}>
      <Screens />
    </SessionProvider>
  )
}

/**
 * 로그인했을 때만 `(app)` 의 화면이 있다. 그 밖의 상태(확인 중, 서버에 닿지 못함, 로그아웃)는
 * 모두 `login` 이 그린다 — 상태가 바뀌면 expo-router가 알아서 화면을 바꾼다.
 */
function Screens() {
  const { status } = useSession()
  const theme = useTheme()
  const signedIn = status === 'signed-in'

  return (
    <>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.bg } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(app)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="login" />
        </Stack.Protected>
      </Stack>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
    </>
  )
}
