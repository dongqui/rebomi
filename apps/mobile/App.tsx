import { ApiError, createApiClient } from '@rebomi/api-client'
import type { HealthResponse } from '@rebomi/api-contract'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'

const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL

// 조용히 localhost로 폴백하지 않는다 — 잘못된 주소를 가리키는 앱이 더 나쁘다.
if (!baseUrl) {
  throw new Error('EXPO_PUBLIC_API_BASE_URL이 없습니다. `cp .env.example .env` 를 실행하세요.')
}

const api = createApiClient({ baseUrl })

type State =
  | { kind: 'loading' }
  | { kind: 'loaded'; health: HealthResponse }
  | { kind: 'failed'; code: string; message: string }

/**
 * 스캐폴드가 증명하는 경로: RN 번들 → @rebomi/api-client → GET /health → DB.
 *
 * iOS 시뮬레이터는 호스트의 localhost에 그대로 닿는다. Android 에뮬레이터는
 * 10.0.2.2 를 써야 하므로 EXPO_PUBLIC_API_BASE_URL 로 갈아끼운다.
 */
export default function App() {
  const [state, setState] = useState<State>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false

    api
      .health()
      .then((health) => {
        if (!cancelled) setState({ kind: 'loaded', health })
      })
      .catch((error: unknown) => {
        if (cancelled) return
        const apiError = error instanceof ApiError ? error : null
        setState({
          kind: 'failed',
          code: apiError?.code ?? 'UNKNOWN',
          message: apiError?.message ?? String(error),
        })
      })

    return () => {
      cancelled = true
    }
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Rebomi</Text>
      <Text style={styles.subtle}>{baseUrl}</Text>

      {state.kind === 'loading' && <Text style={styles.body}>확인 중…</Text>}

      {state.kind === 'loaded' && (
        <Text style={styles.body}>
          status: {state.health.status} · db: {state.health.db} · version: {state.health.version}
        </Text>
      )}

      {state.kind === 'failed' && (
        <Text style={styles.error}>
          실패 — {state.code}: {state.message}
        </Text>
      )}

      <StatusBar style="auto" />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: { fontSize: 24, fontWeight: '600' },
  subtle: { fontSize: 12, color: '#666', marginTop: 4, marginBottom: 24 },
  body: { fontSize: 15, textAlign: 'center' },
  error: { fontSize: 15, color: '#b00', textAlign: 'center' },
})
