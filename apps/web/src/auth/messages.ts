import { ApiError } from '@rebomi/api-client'
import { ERROR_CODES } from '@rebomi/api-contract'

export const UNREACHABLE_MESSAGE = '서버에 연결할 수 없습니다. 잠시 후 다시 시도해 주세요.'

const LOGIN_MESSAGES: Record<string, string> = {
  [ERROR_CODES.INVALID_PROVIDER_TOKEN]: '로그인 정보를 확인하지 못했습니다. 다시 시도해 주세요.',
  [ERROR_CODES.EMAIL_NOT_VERIFIED]:
    '이메일이 확인되지 않은 계정입니다. 다른 계정으로 로그인해 주세요.',
  [ERROR_CODES.PROVIDER_NOT_CONFIGURED]: '지금은 이 로그인 수단을 쓸 수 없습니다.',
  [ERROR_CODES.NETWORK]: UNREACHABLE_MESSAGE,
}

/** 로그인 실패를 사용자에게 보일 문구로 바꾼다. 분기는 에러 코드로만 한다. */
export function loginErrorMessage(error: unknown): string {
  const known = error instanceof ApiError ? LOGIN_MESSAGES[error.code] : undefined
  return known ?? '로그인하지 못했습니다. 다시 시도해 주세요.'
}
