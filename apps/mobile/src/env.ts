/**
 * 앱이 뜨려면 있어야 하는 환경변수. 루트 `.env.example` 과 같아야 한다.
 *
 * Metro는 `process.env.EXPO_PUBLIC_*` 를 이름을 그대로 쓴 곳에서만 값으로 바꾼다 —
 * 그래서 이름을 하나씩 적는다.
 */
const values = {
  EXPO_PUBLIC_API_BASE_URL: process.env.EXPO_PUBLIC_API_BASE_URL,
  EXPO_PUBLIC_WEB_BASE_URL: process.env.EXPO_PUBLIC_WEB_BASE_URL,
}

// 조용히 localhost로 폴백하지 않는다 — 잘못된 주소를 가리키는 앱이 더 나쁘다.
const missing = Object.entries(values)
  .filter(([, value]) => !value?.trim())
  .map(([name]) => name)
if (missing.length > 0) {
  throw new Error(
    `환경변수가 없습니다: ${missing.join(', ')}. 루트의 .env.example 을 참고해 .env 에 넣으세요.`,
  )
}

/** API 서버의 주소. Android 에뮬레이터에서 호스트의 서버는 `http://10.0.2.2:<포트>` 다. */
export const apiBaseUrl = values.EXPO_PUBLIC_API_BASE_URL as string

/** 웹의 주소. 로그인할 때 브라우저 창으로 여는 `<이 값>/login/app/start` 에 쓴다. */
export const webBaseUrl = values.EXPO_PUBLIC_WEB_BASE_URL as string
