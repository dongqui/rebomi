import type { ReactNode } from 'react'
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native'
import { useTheme } from '../theme'

type Props = {
  label: string
  /** `brand`: 채운 강조 버튼. `weak`: 옅게 채운 보조 버튼. */
  variant: 'brand' | 'weak'
  onPress(): void
  /** 진행 중. 글자 대신 진행 표시를 보이고 누를 수 없다. */
  loading?: boolean
  disabled?: boolean
  /** 글자 앞의 아이콘. 버튼의 글자색을 받아 그린다. */
  icon?(color: string): ReactNode
}

/** 화면 폭을 채우는 큰 버튼 (디자인의 TDS Button XL, 높이 56). */
export function Button({ label, variant, onPress, loading = false, disabled = false, icon }: Props) {
  const theme = useTheme()
  const foreground = variant === 'brand' ? theme.onBrand : theme.textStrong
  const background = variant === 'brand' ? theme.brand : theme.fillWeak

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background },
        pressed && { opacity: 0.86 },
        disabled && !loading && { opacity: 0.4 },
      ]}
    >
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <View style={styles.content}>
          {icon?.(foreground)}
          <Text style={[styles.label, { color: foreground }]}>{label}</Text>
        </View>
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  button: {
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  content: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  label: { fontSize: 17, fontWeight: '600' },
})
