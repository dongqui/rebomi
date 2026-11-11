import { createHash, randomBytes } from 'node:crypto'
import { SignJWT, errors, jwtVerify } from 'jose'

/** 액세스 토큰 수명: 15분. 로그아웃해도 이미 발급된 것은 이만큼 더 유효하다. */
export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60
/** 갱신 토큰 수명: 60일. 갱신에 쓸 때마다 그 시점부터 다시 센다. */
export const REFRESH_TOKEN_TTL_SECONDS = 60 * 24 * 60 * 60

const ISSUER = 'rebomi'
const AUDIENCE = 'rebomi-api'
const ALGORITHM = 'HS256'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const keyOf = (secret: string): Uint8Array => new TextEncoder().encode(secret)

/** 액세스 토큰(JWT, HS256)을 만든다. `sub` 가 사용자 ID다. */
export function signAccessToken(secret: string, userId: string, now: Date): Promise<string> {
  const issuedAt = Math.floor(now.getTime() / 1000)

  return new SignJWT({})
    .setProtectedHeader({ alg: ALGORITHM })
    .setSubject(userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + ACCESS_TOKEN_TTL_SECONDS)
    .sign(keyOf(secret))
}

export type AccessTokenResult =
  { ok: true; userId: string } | { ok: false; reason: 'expired' | 'invalid' }

/**
 * 액세스 토큰을 검증한다. 만료와 그 밖의 실패를 구분해 돌려준다 — 클라이언트는
 * 만료일 때만 갱신을 시도한다.
 *
 * 알고리즘을 HS256 하나로 고정한다. 토큰 헤더가 고르게 두면 `alg: none` 이나
 * 다른 알고리즘으로 서명 검증을 피해 갈 수 있다.
 */
export async function verifyAccessToken(
  secret: string,
  token: string,
  now: Date,
): Promise<AccessTokenResult> {
  try {
    const { payload } = await jwtVerify(token, keyOf(secret), {
      algorithms: [ALGORITHM],
      issuer: ISSUER,
      audience: AUDIENCE,
      currentDate: now,
      requiredClaims: ['sub', 'exp'],
    })

    if (typeof payload.sub !== 'string' || !UUID.test(payload.sub)) {
      return { ok: false, reason: 'invalid' }
    }
    return { ok: true, userId: payload.sub }
  } catch (error) {
    return { ok: false, reason: error instanceof errors.JWTExpired ? 'expired' : 'invalid' }
  }
}

/** 갱신 토큰의 저장 형태. DB에는 이 해시만 들어간다. */
export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

/** 새 갱신 토큰(256비트 난수)과 그 해시. 토큰은 클라이언트에게만 준다. */
export function newRefreshToken(): { token: string; hash: string } {
  const token = randomBytes(32).toString('base64url')
  return { token, hash: hashRefreshToken(token) }
}
