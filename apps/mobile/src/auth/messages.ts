import { ApiError } from '@rebomi/api-client'
import { ERROR_CODES } from '@rebomi/api-contract'
import type { Strings } from '../strings'

/** 로그인 실패를 사용자에게 보일 문구로 바꾼다. 서버의 실패는 에러 코드로만 가른다. */
export function loginErrorMessage(error: unknown, strings: Strings): string {
  const code = error instanceof ApiError ? error.code : null
  switch (code) {
    case ERROR_CODES.EMAIL_NOT_VERIFIED:
      return strings.login.errors.emailNotVerified
    case ERROR_CODES.PROVIDER_NOT_CONFIGURED:
      return strings.login.errors.methodUnavailable
    case ERROR_CODES.NETWORK:
      return strings.unreachable
    default:
      return strings.login.errors.generic
  }
}
