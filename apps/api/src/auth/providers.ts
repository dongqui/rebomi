import { createRemoteJWKSet, errors, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose'

/** 제공자가 확인해 준 신원. */
export type ProviderIdentity = {
  /** 제공자 안에서 사용자를 가리키는 변하지 않는 식별자(`sub`). */
  subject: string
  email: string | null
  /** 제공자가 이 이메일의 소유를 확인했는가. */
  emailVerified: boolean
}

/** 신원 토큰을 검증한다. 받아들일 수 없는 토큰이면 `InvalidProviderTokenError` 를 던진다. */
export type IdentityVerifier = (idToken: string) => Promise<ProviderIdentity>

/** 신원 토큰의 서명·만료·발급자·대상 중 하나가 맞지 않는다. */
export class InvalidProviderTokenError extends Error {
  /** 로그용 사유 코드(jose의 에러 코드). 토큰 내용은 담지 않는다. */
  readonly reason: string

  constructor(reason: string) {
    super(`제공자 신원 토큰을 받아들일 수 없습니다: ${reason}`)
    this.name = 'InvalidProviderTokenError'
    this.reason = reason
  }
}

export type IdentityVerifierOptions = {
  /** 제공자의 공개키. 운영은 원격 JWKS, 테스트는 로컬 JWKS. */
  jwks: JWTVerifyGetKey
  issuers: string[]
  /** 우리 앱에 발급된 토큰만 받는다. 웹·iOS·Android의 클라이언트 ID가 서로 다르다. */
  audiences: string[]
  now?: () => Date
}

export function createIdentityVerifier(options: IdentityVerifierOptions): IdentityVerifier {
  return async (idToken) => {
    let payload: JWTPayload
    try {
      const verified = await jwtVerify(idToken, options.jwks, {
        algorithms: ['RS256'],
        issuer: options.issuers,
        audience: options.audiences,
        currentDate: options.now?.(),
        requiredClaims: ['sub', 'exp', 'iss', 'aud'],
      })
      payload = verified.payload
    } catch (error) {
      // 제공자 공개키를 받아오지 못한 것은 토큰의 잘못이 아니다. 401로 바꾸지 않는다.
      if (error instanceof errors.JOSEError && !(error instanceof errors.JWKSTimeout)) {
        throw new InvalidProviderTokenError(error.code)
      }
      throw error
    }

    if (typeof payload.sub !== 'string' || payload.sub === '') {
      throw new InvalidProviderTokenError('ERR_MISSING_SUBJECT')
    }

    const email = typeof payload.email === 'string' && payload.email !== '' ? payload.email : null
    // Apple은 email_verified 를 문자열 "true" 로 보내기도 한다.
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true'

    return { subject: payload.sub, email, emailVerified }
  }
}

/** Google 신원 토큰 검증기. `clientIds` 는 우리 앱의 OAuth 클라이언트 ID들이다. */
export function googleVerifier(clientIds: string[]): IdentityVerifier {
  return createIdentityVerifier({
    jwks: createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs')),
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    audiences: clientIds,
  })
}

/** Apple 신원 토큰 검증기. `clientIds` 는 Service ID(웹)와 앱 번들 ID(iOS)다. */
export function appleVerifier(clientIds: string[]): IdentityVerifier {
  return createIdentityVerifier({
    jwks: createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys')),
    issuers: ['https://appleid.apple.com'],
    audiences: clientIds,
  })
}
