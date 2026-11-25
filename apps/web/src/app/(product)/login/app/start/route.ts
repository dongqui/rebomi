import { publicEnv } from '@/lib/api'
import { startAppLogin } from '@/server/app-login'

/*
 * `GET /login/app/start` — 모바일 앱이 시스템 브라우저 창으로 여는 주소.
 * 제공자의 로그인 주소로 보낸다 (architecture §3 "모바일의 로그인").
 */
export function GET(request: Request): Response {
  return startAppLogin(new URL(request.url), {
    google: publicEnv.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
    apple: publicEnv.NEXT_PUBLIC_APPLE_CLIENT_ID,
  })
}
