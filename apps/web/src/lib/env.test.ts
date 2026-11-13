import { describe, expect, it } from 'vitest'
import { requirePublicEnv } from './env'

const complete = {
  NEXT_PUBLIC_API_BASE_URL: 'http://localhost:3001',
  NEXT_PUBLIC_GOOGLE_CLIENT_ID: 'google-client',
  NEXT_PUBLIC_APPLE_CLIENT_ID: 'apple-service-id',
}

describe('requirePublicEnv', () => {
  it('값이 모두 있으면 그대로 돌려준다', () => {
    expect(requirePublicEnv(complete)).toEqual(complete)
  })

  it('없는 변수의 이름을 모두 담아 던진다', () => {
    expect(() =>
      requirePublicEnv({
        ...complete,
        NEXT_PUBLIC_GOOGLE_CLIENT_ID: undefined,
        NEXT_PUBLIC_APPLE_CLIENT_ID: undefined,
      }),
    ).toThrow(/NEXT_PUBLIC_GOOGLE_CLIENT_ID.*NEXT_PUBLIC_APPLE_CLIENT_ID/)
  })

  it('빈 문자열은 없는 것으로 본다', () => {
    expect(() => requirePublicEnv({ ...complete, NEXT_PUBLIC_API_BASE_URL: '  ' })).toThrow(
      /NEXT_PUBLIC_API_BASE_URL/,
    )
  })
})
