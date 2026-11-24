import { useColorScheme } from 'react-native'

/**
 * 색 토큰. 디자인의 `rebomi-tokens.css` 가운데 웜 페이퍼 톤 — 웹(`globals.css`)과 같은 값이다.
 * 지금은 로그인 화면이 쓰는 것만 있다.
 */
const light = {
  bg: 'rgb(245,242,234)',
  textStrong: 'rgb(28,25,20)',
  textSub: 'rgba(28,25,20,0.74)',
  fillWeak: 'rgba(28,25,20,0.06)',
  fillPressed: 'rgba(28,25,20,0.1)',
  brand: 'rgb(28,25,20)',
  onBrand: 'rgb(245,242,234)',
  dangerText: 'rgb(228,41,57)',
}

type Colors = typeof light

const dark: Colors = {
  bg: 'rgb(26,24,21)',
  textStrong: 'rgb(245,240,230)',
  textSub: 'rgba(245,240,230,0.74)',
  fillWeak: 'rgba(245,240,230,0.09)',
  fillPressed: 'rgba(245,240,230,0.14)',
  brand: 'rgb(245,240,230)',
  onBrand: 'rgb(26,24,21)',
  dangerText: 'rgb(250,97,109)',
}

export type Theme = Colors & { dark: boolean }

/** 기기의 밝은/어두운 화면 설정을 따른다. */
export function useTheme(): Theme {
  const isDark = useColorScheme() === 'dark'
  return { ...(isDark ? dark : light), dark: isDark }
}
