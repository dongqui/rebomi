import { useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useSession } from '../../src/auth/session'
import { useTheme } from '../../src/theme'
import { Button } from '../../src/ui/button'
import { useStrings } from '../../src/use-strings'

/**
 * 로그인한 뒤의 첫 화면. 지금은 자리만 있다 — 홈과 탭은 다음 작업(#44)에서 만든다.
 * 로그아웃은 설정 화면이 생기면 그리로 옮긴다.
 */
export default function Home() {
  const { signOut } = useSession()
  const theme = useTheme()
  const strings = useStrings()
  const [leaving, setLeaving] = useState(false)

  return (
    <SafeAreaView style={[styles.screen, { backgroundColor: theme.bg }]}>
      <View style={styles.top}>
        <Text style={[styles.wordmark, { color: theme.textStrong }]}>Rebomi</Text>
      </View>
      <View style={styles.middle}>
        <Text style={[styles.body, { color: theme.textSub }]}>{strings.signedIn}</Text>
      </View>
      <View style={styles.bottom}>
        <Button
          label={strings.signOut}
          variant="weak"
          loading={leaving}
          onPress={() => {
            setLeaving(true)
            // 끝나면 세션이 `signed-out` 이 되어 이 화면이 사라진다.
            void signOut()
          }}
        />
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 24 },
  top: { height: 48, justifyContent: 'center' },
  wordmark: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  middle: { flex: 1, justifyContent: 'center' },
  body: { fontSize: 18, lineHeight: 27 },
  bottom: { paddingBottom: 20 },
})
