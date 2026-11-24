import { Stack } from 'expo-router'

/** 로그인해야 보이는 화면들. 하단 탭은 다음 작업(#44)에서 이 자리에 놓는다. */
export default function AppLayout() {
  return <Stack screenOptions={{ headerShown: false }} />
}
