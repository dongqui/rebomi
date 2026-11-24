import { returnAppLogin } from '@/server/app-login'

/*
 * `POST /login/app/return` — Google·Apple이 로그인 결과를 보내는 주소. 두 제공자에
 * 돌아올 주소로 등록한다. 결과를 모바일 앱의 딥링크로 넘긴다 (architecture §3).
 */
export function POST(request: Request): Promise<Response> {
  return returnAppLogin(request)
}
