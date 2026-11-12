import { loginResponseSchema, refreshResponseSchema, type AuthProvider } from '@rebomi/api-contract'
import { createDb, eq, inArray, schema, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type JWK } from 'jose'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { buildApp, type BuildAppDeps } from './app.js'
import { createIdentityVerifier } from './auth/providers.js'
import { hashRefreshToken } from './auth/tokens.js'

const connectionString = process.env.DATABASE_URL

const JWT_SECRET = 'test-secret-test-secret-test-secret-0123'
const ALLOWED_ORIGIN = 'http://localhost:3000'
const GOOGLE_AUDIENCE = 'google-client-id.apps.googleusercontent.com'
const APPLE_AUDIENCE = 'com.rebomi.web'
const GOOGLE_ISSUER = 'https://accounts.google.com'
const APPLE_ISSUER = 'https://appleid.apple.com'

const MINUTE = 60_000
const DAY = 24 * 60 * MINUTE

type PrivateKey = Awaited<ReturnType<typeof generateKeyPair>>['privateKey']

/** 테스트가 움직이는 시계. 서버와 제공자 검증기가 같은 시계를 본다. */
let clock: Date
const advance = (ms: number): void => {
  clock = new Date(clock.getTime() + ms)
}

let db: Db
let googleKey: PrivateKey
let appleKey: PrivateKey
/** 제공자가 모르는 키. 이 키로 서명한 토큰은 위조다. */
let strangerKey: PrivateKey
let verifiers: BuildAppDeps['auth']['verifiers']

const createdEmails: string[] = []
let apps: FastifyInstance[] = []

async function keyAndJwks(kid: string): Promise<{ privateKey: PrivateKey; jwk: JWK }> {
  const { publicKey, privateKey } = await generateKeyPair('RS256')
  return { privateKey, jwk: { ...(await exportJWK(publicKey)), kid, alg: 'RS256', use: 'sig' } }
}

beforeAll(async () => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
  db = createDb(connectionString)

  const google = await keyAndJwks('google-1')
  const apple = await keyAndJwks('apple-1')
  googleKey = google.privateKey
  appleKey = apple.privateKey
  strangerKey = (await keyAndJwks('google-1')).privateKey

  verifiers = {
    google: createIdentityVerifier({
      jwks: createLocalJWKSet({ keys: [google.jwk] }),
      issuers: [GOOGLE_ISSUER, 'accounts.google.com'],
      audiences: [GOOGLE_AUDIENCE],
      now: () => clock,
    }),
    apple: createIdentityVerifier({
      jwks: createLocalJWKSet({ keys: [apple.jwk] }),
      issuers: [APPLE_ISSUER],
      audiences: [APPLE_AUDIENCE],
      now: () => clock,
    }),
  }
})

beforeEach(() => {
  clock = new Date('2026-11-11T00:00:00.000Z')
})

afterEach(async () => {
  for (const app of apps) await app.close()
  apps = []
})

afterAll(async () => {
  // 신원과 갱신 토큰은 사용자 삭제에 딸려 지워진다.
  if (createdEmails.length > 0) {
    await db.drizzle.delete(schema.users).where(inArray(schema.users.email, createdEmails))
  }
  await db.close()
})

function newApp(overrides: Partial<BuildAppDeps['auth']> = {}, logger?: BuildAppDeps['logger']) {
  const app = buildApp({
    db,
    corsOrigins: [ALLOWED_ORIGIN],
    logger,
    // 인증 경로는 큐를 쓰지 않는다.
    jobs: { enqueueContentProcess: () => Promise.resolve() },
    auth: {
      jwtSecret: JWT_SECRET,
      verifiers,
      secureCookies: false,
      now: () => clock,
      ...overrides,
    },
  })
  // 인증된 요청에서 핸들러가 사용자 ID를 얻는지 보는 경로.
  app.get('/__whoami', { preHandler: app.requireAuth }, (request) => ({ userId: request.userId }))
  apps.push(app)
  return app
}

/** 다른 테스트와 겹치지 않는 이메일. 끝나면 지운다. */
function newEmail(): string {
  const email = `auth-${crypto.randomUUID()}@example.com`
  createdEmails.push(email)
  return email
}

type IdTokenOptions = {
  email?: string | null
  emailVerified?: boolean | string
  subject?: string
  audience?: string
  issuer?: string
  key?: PrivateKey
  /** 발급 시각으로부터의 수명(ms). 기본 1시간. */
  lifetimeMs?: number
}

async function idToken(provider: AuthProvider, options: IdTokenOptions = {}): Promise<string> {
  const issuedAt = Math.floor(clock.getTime() / 1000)
  const claims: Record<string, unknown> = {}
  if (options.email !== null) claims.email = options.email ?? newEmail()
  if (options.emailVerified !== undefined || options.email !== null) {
    claims.email_verified = options.emailVerified ?? true
  }

  return new SignJWT(claims)
    .setProtectedHeader({ alg: 'RS256', kid: provider === 'google' ? 'google-1' : 'apple-1' })
    .setSubject(options.subject ?? crypto.randomUUID())
    .setIssuer(options.issuer ?? (provider === 'google' ? GOOGLE_ISSUER : APPLE_ISSUER))
    .setAudience(options.audience ?? (provider === 'google' ? GOOGLE_AUDIENCE : APPLE_AUDIENCE))
    .setIssuedAt(issuedAt)
    .setExpirationTime(issuedAt + Math.floor((options.lifetimeMs ?? 60 * MINUTE) / 1000))
    .sign(options.key ?? (provider === 'google' ? googleKey : appleKey))
}

const post = (app: FastifyInstance, url: string, payload: unknown, headers = {}) =>
  app.inject({ method: 'POST', url, payload: payload as object, headers })

async function login(
  app: FastifyInstance,
  provider: AuthProvider,
  options: IdTokenOptions = {},
  session?: 'body' | 'cookie',
) {
  const response = await post(app, '/auth/login', {
    provider,
    idToken: await idToken(provider, options),
    ...(session ? { session } : {}),
  })
  return response
}

/** 성공해야 하는 로그인. 본문을 계약으로 파싱해 돌려준다. */
async function loginOk(app: FastifyInstance, provider: AuthProvider, options: IdTokenOptions = {}) {
  const response = await login(app, provider, options)
  expect(response.statusCode).toBe(200)
  return loginResponseSchema.parse(response.json())
}

const errorCode = (response: { json(): unknown }): string =>
  (response.json() as { error: { code: string } }).error.code

const whoami = (app: FastifyInstance, accessToken?: string) =>
  app.inject({
    method: 'GET',
    url: '/__whoami',
    headers: accessToken ? { authorization: `Bearer ${accessToken}` } : {},
  })

/** Set-Cookie 에서 갱신 토큰 쿠키를 꺼낸다. */
function refreshCookie(response: { cookies: Array<Record<string, unknown>> }) {
  return response.cookies.find((cookie) => cookie.name === 'rebomi_refresh')
}

describe.each(['google', 'apple'] as const)('%s 로그인', (provider) => {
  it('처음 로그인하면 계정이 만들어지고 액세스·갱신 토큰을 받는다', async () => {
    const app = newApp()
    const email = newEmail()

    const body = await loginOk(app, provider, { email })

    expect(body.user.email).toBe(email)
    expect(body.accessToken).not.toBe('')
    expect(body.refreshToken).toEqual(expect.any(String))
    expect(body.expiresIn).toBe(900)
    const [user] = await db.drizzle
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, body.user.id))
    expect(user?.email).toBe(email)
  })

  it('같은 신원으로 다시 로그인하면 같은 계정이다', async () => {
    const app = newApp()
    const identity = { email: newEmail(), subject: crypto.randomUUID() }

    const first = await loginOk(app, provider, identity)
    const second = await loginOk(app, provider, identity)

    expect(second.user.id).toBe(first.user.id)
  })

  it.each([
    ['서명이 틀린 토큰', (): IdTokenOptions => ({ key: strangerKey })],
    ['만료된 토큰', (): IdTokenOptions => ({ lifetimeMs: -MINUTE })],
    ['다른 앱에 발급된 토큰', (): IdTokenOptions => ({ audience: 'someone-else' })],
    ['다른 발급자의 토큰', (): IdTokenOptions => ({ issuer: 'https://evil.test' })],
  ])('%s 으로는 로그인할 수 없다', async (_name, options) => {
    const app = newApp()
    const email = newEmail()

    const response = await login(app, provider, { ...options(), email })

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('INVALID_PROVIDER_TOKEN')
    const users = await db.drizzle.select().from(schema.users).where(eq(schema.users.email, email))
    expect(users).toEqual([])
  })
})

describe('제공자 토큰 형식', () => {
  it.each(['not-a-jwt', 'a.b.c'])(
    'JWT가 아닌 값 "%s" 은 INVALID_PROVIDER_TOKEN이다',
    async (value) => {
      const app = newApp()

      const response = await post(app, '/auth/login', { provider: 'google', idToken: value })

      expect(response.statusCode).toBe(401)
      expect(errorCode(response)).toBe('INVALID_PROVIDER_TOKEN')
    },
  )

  it('빈 idToken은 400이다', async () => {
    const app = newApp()

    const response = await post(app, '/auth/login', { provider: 'google', idToken: '' })

    expect(response.statusCode).toBe(400)
    expect(errorCode(response)).toBe('VALIDATION_FAILED')
  })

  it('Apple 키로 서명한 토큰을 Google 로그인에 쓸 수 없다', async () => {
    const app = newApp()
    const appleToken = await idToken('apple', { audience: GOOGLE_AUDIENCE, issuer: GOOGLE_ISSUER })

    const response = await post(app, '/auth/login', { provider: 'google', idToken: appleToken })

    expect(response.statusCode).toBe(401)
  })

  it('Apple이 email_verified를 문자열 "true"로 보내도 검증된 것으로 본다', async () => {
    const app = newApp()

    const response = await login(app, 'apple', { emailVerified: 'true' })

    expect(response.statusCode).toBe(200)
  })

  it('모르는 provider는 400이다', async () => {
    const app = newApp()

    const response = await post(app, '/auth/login', { provider: 'kakao', idToken: 'x' })

    expect(response.statusCode).toBe(400)
    expect(errorCode(response)).toBe('VALIDATION_FAILED')
  })

  it('클라이언트 ID가 설정되지 않은 제공자는 503 PROVIDER_NOT_CONFIGURED다', async () => {
    const app = newApp({ verifiers: { google: verifiers.google } })

    const response = await login(app, 'apple')

    expect(response.statusCode).toBe(503)
    expect(errorCode(response)).toBe('PROVIDER_NOT_CONFIGURED')
  })
})

describe('계정 묶기', () => {
  it('Google로 만든 계정과 검증된 이메일이 같은 Apple 신원은 같은 계정이다', async () => {
    const app = newApp()
    const email = newEmail()

    const google = await loginOk(app, 'google', { email })
    const apple = await loginOk(app, 'apple', { email })

    expect(apple.user.id).toBe(google.user.id)
  })

  it('이메일의 대소문자만 다르면 같은 계정이다', async () => {
    const app = newApp()
    const email = newEmail()

    const google = await loginOk(app, 'google', { email })
    const apple = await loginOk(app, 'apple', { email: email.toUpperCase() })

    expect(apple.user.id).toBe(google.user.id)
  })

  it('이메일이 다른 두 로그인은 서로 다른 계정이다', async () => {
    const app = newApp()

    const google = await loginOk(app, 'google')
    const apple = await loginOk(app, 'apple')

    expect(apple.user.id).not.toBe(google.user.id)
  })

  it('이메일을 검증하지 않았다고 알려 온 신원은 기존 계정에 묶이지 않고 거부된다', async () => {
    const app = newApp()
    const email = newEmail()
    const google = await loginOk(app, 'google', { email })

    const response = await login(app, 'apple', { email, emailVerified: false })

    expect(response.statusCode).toBe(403)
    expect(errorCode(response)).toBe('EMAIL_NOT_VERIFIED')
    const identities = await db.drizzle
      .select()
      .from(schema.authIdentities)
      .where(eq(schema.authIdentities.userId, google.user.id))
    expect(identities.map((identity) => identity.provider)).toEqual(['google'])
  })

  it('이메일이 없는 처음 보는 신원은 거부된다', async () => {
    const app = newApp()

    const response = await login(app, 'apple', { email: null })

    expect(response.statusCode).toBe(403)
    expect(errorCode(response)).toBe('EMAIL_NOT_VERIFIED')
  })

  it('이미 가입한 신원은 나중에 이메일 없이 와도 같은 계정으로 로그인된다', async () => {
    const app = newApp()
    const subject = crypto.randomUUID()
    const first = await loginOk(app, 'apple', { subject })

    const second = await loginOk(app, 'apple', { subject, email: null })

    expect(second.user.id).toBe(first.user.id)
  })

  // Review Focus 1
  it('같은 신원의 첫 로그인이 동시에 와도 계정은 하나다', async () => {
    const app = newApp()
    const identity = { email: newEmail(), subject: crypto.randomUUID() }

    const responses = await Promise.all(
      Array.from({ length: 5 }, () => login(app, 'google', identity)),
    )

    expect(responses.map((response) => response.statusCode)).toEqual([200, 200, 200, 200, 200])
    const ids = new Set(
      responses.map((response) => loginResponseSchema.parse(response.json()).user.id),
    )
    expect(ids.size).toBe(1)
    const users = await db.drizzle
      .select()
      .from(schema.users)
      .where(eq(schema.users.email, identity.email))
    expect(users).toHaveLength(1)
  })
})

describe('requireAuth', () => {
  it('유효한 액세스 토큰의 요청에서 핸들러가 사용자 ID를 얻는다', async () => {
    const app = newApp()
    const { accessToken, user } = await loginOk(app, 'google')

    const response = await whoami(app, accessToken)

    expect(response.statusCode).toBe(200)
    expect(response.json()).toEqual({ userId: user.id })
  })

  it('소문자 스킴 "bearer" 도 받는다 (RFC 7235)', async () => {
    const app = newApp()
    const { accessToken } = await loginOk(app, 'google')

    const response = await app.inject({
      method: 'GET',
      url: '/__whoami',
      headers: { authorization: `bearer ${accessToken}` },
    })

    expect(response.statusCode).toBe(200)
  })

  it.each(['__none__', 'Basic abc', 'Bearer', 'Bearer   ', 'Bearer not-a-jwt', 'Bearer a.b.c'])(
    'Authorization "%s" 는 401 UNAUTHORIZED다',
    async (header) => {
      const app = newApp()

      const response = await app.inject({
        method: 'GET',
        url: '/__whoami',
        headers: header === '__none__' ? {} : { authorization: header },
      })

      expect(response.statusCode).toBe(401)
      expect(errorCode(response)).toBe('UNAUTHORIZED')
    },
  )

  it('만료된 액세스 토큰은 401 ACCESS_TOKEN_EXPIRED다', async () => {
    const app = newApp()
    const { accessToken } = await loginOk(app, 'google')

    advance(14 * MINUTE)
    expect((await whoami(app, accessToken)).statusCode).toBe(200)
    advance(2 * MINUTE)
    const response = await whoami(app, accessToken)

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('ACCESS_TOKEN_EXPIRED')
  })

  // Review Focus 3
  it('다른 비밀키로 서명한 토큰은 UNAUTHORIZED다', async () => {
    const app = newApp()
    const { user } = await loginOk(app, 'google')
    const now = Math.floor(clock.getTime() / 1000)
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuer('rebomi')
      .setAudience('rebomi-api')
      .setIssuedAt(now)
      .setExpirationTime(now + 900)
      .sign(new TextEncoder().encode('another-secret-another-secret-another'))

    const response = await whoami(app, forged)

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('UNAUTHORIZED')
  })

  it('서명이 없는 alg:none 토큰은 UNAUTHORIZED다', async () => {
    const app = newApp()
    const { user } = await loginOk(app, 'google')
    const encode = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url')
    const now = Math.floor(clock.getTime() / 1000)
    const unsigned = `${encode({ alg: 'none', typ: 'JWT' })}.${encode({
      sub: user.id,
      iss: 'rebomi',
      aud: 'rebomi-api',
      iat: now,
      exp: now + 900,
    })}.`

    const response = await whoami(app, unsigned)

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('UNAUTHORIZED')
  })

  it('제공자의 신원 토큰은 액세스 토큰으로 쓸 수 없다', async () => {
    const app = newApp()

    const response = await whoami(app, await idToken('google'))

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('UNAUTHORIZED')
  })
})

describe('POST /auth/refresh', () => {
  it('갱신 토큰으로 새 액세스 토큰을 받는다', async () => {
    const app = newApp()
    const { refreshToken, user } = await loginOk(app, 'google')
    advance(20 * MINUTE)

    const response = await post(app, '/auth/refresh', { refreshToken })

    expect(response.statusCode).toBe(200)
    const body = refreshResponseSchema.parse(response.json())
    expect(body.expiresIn).toBe(900)
    expect((await whoami(app, body.accessToken)).json()).toEqual({ userId: user.id })
  })

  it('응답 본문에 갱신 토큰이 없다 (회전하지 않는다)', async () => {
    const app = newApp()
    const { refreshToken } = await loginOk(app, 'google')

    const first = await post(app, '/auth/refresh', { refreshToken })
    const second = await post(app, '/auth/refresh', { refreshToken })

    expect(Object.keys(first.json() as object).sort()).toEqual(['accessToken', 'expiresIn'])
    expect(second.statusCode).toBe(200)
  })

  it('60일 동안 쓰지 않은 갱신 토큰은 REFRESH_TOKEN_EXPIRED다', async () => {
    const app = newApp()
    const { refreshToken } = await loginOk(app, 'google')
    advance(60 * DAY + MINUTE)

    const response = await post(app, '/auth/refresh', { refreshToken })

    expect(response.statusCode).toBe(401)
    expect(errorCode(response)).toBe('REFRESH_TOKEN_EXPIRED')
  })

  it('쓸 때마다 그 시점부터 60일로 연장된다', async () => {
    const app = newApp()
    const { refreshToken } = await loginOk(app, 'google')

    advance(59 * DAY)
    expect((await post(app, '/auth/refresh', { refreshToken })).statusCode).toBe(200)
    advance(59 * DAY)
    const response = await post(app, '/auth/refresh', { refreshToken })

    expect(response.statusCode).toBe(200)
  })

  it.each([{ refreshToken: 'unknown-token' }, {}])(
    '모르는 갱신 토큰이거나 토큰이 없으면 REFRESH_TOKEN_INVALID다 (%j)',
    async (payload) => {
      const app = newApp()

      const response = await post(app, '/auth/refresh', payload)

      expect(response.statusCode).toBe(401)
      expect(errorCode(response)).toBe('REFRESH_TOKEN_INVALID')
    },
  )

  it('액세스 토큰은 갱신 토큰으로 쓸 수 없다', async () => {
    const app = newApp()
    const { accessToken } = await loginOk(app, 'google')

    const response = await post(app, '/auth/refresh', { refreshToken: accessToken })

    expect(errorCode(response)).toBe('REFRESH_TOKEN_INVALID')
  })

  it('DB에는 갱신 토큰의 해시만 저장된다', async () => {
    const app = newApp()
    const { refreshToken, user } = await loginOk(app, 'google')

    const rows = await db.drizzle
      .select()
      .from(schema.refreshTokens)
      .where(eq(schema.refreshTokens.userId, user.id))

    expect(rows).toHaveLength(1)
    expect(rows[0]!.tokenHash).toBe(hashRefreshToken(refreshToken!))
    expect(JSON.stringify(rows)).not.toContain(refreshToken!)
  })
})

describe('POST /auth/logout', () => {
  it('로그아웃하면 그 갱신 토큰은 더 이상 쓰이지 않는다', async () => {
    const app = newApp()
    const { refreshToken } = await loginOk(app, 'google')

    const logout = await post(app, '/auth/logout', { refreshToken })
    const refresh = await post(app, '/auth/refresh', { refreshToken })

    expect(logout.statusCode).toBe(204)
    expect(refresh.statusCode).toBe(401)
    expect(errorCode(refresh)).toBe('REFRESH_TOKEN_INVALID')
  })

  it('다른 기기의 갱신 토큰은 그대로 쓸 수 있다', async () => {
    const app = newApp()
    const identity = { email: newEmail(), subject: crypto.randomUUID() }
    const phone = await loginOk(app, 'google', identity)
    const laptop = await loginOk(app, 'google', identity)

    await post(app, '/auth/logout', { refreshToken: phone.refreshToken })

    const response = await post(app, '/auth/refresh', { refreshToken: laptop.refreshToken })
    expect(response.statusCode).toBe(200)
  })

  it.each([{ refreshToken: 'unknown-token' }, {}])('모르는 토큰이어도 204다 (%j)', async (body) => {
    const app = newApp()

    const response = await post(app, '/auth/logout', body)

    expect(response.statusCode).toBe(204)
  })
})

describe('쿠키 방식 (웹)', () => {
  it('갱신 토큰이 본문에 없고 httpOnly 쿠키로만 온다', async () => {
    const app = newApp()

    const response = await login(app, 'google', {}, 'cookie')

    expect(response.statusCode).toBe(200)
    const body = loginResponseSchema.parse(response.json())
    expect(body.refreshToken).toBeNull()
    const cookie = refreshCookie(response)
    expect(cookie).toMatchObject({
      httpOnly: true,
      sameSite: 'Lax',
      path: '/auth',
      maxAge: 60 * 24 * 60 * 60,
    })
    expect(cookie?.secure).toBeUndefined()
    expect(response.body).not.toContain(String(cookie?.value))
  })

  it('운영에서는 Secure 쿠키다', async () => {
    const app = newApp({ secureCookies: true })

    const response = await login(app, 'google', {}, 'cookie')

    expect(refreshCookie(response)?.secure).toBe(true)
  })

  it('본문 방식 로그인은 쿠키를 내리지 않는다', async () => {
    const app = newApp()

    const response = await login(app, 'google')

    expect(refreshCookie(response)).toBeUndefined()
  })

  it('쿠키로 갱신하고, 쿠키 수명도 다시 60일로 내려온다', async () => {
    const app = newApp()
    const loginResponse = await login(app, 'google', {}, 'cookie')
    const { user } = loginResponseSchema.parse(loginResponse.json())
    const token = String(refreshCookie(loginResponse)?.value)

    const response = await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
      headers: { origin: ALLOWED_ORIGIN },
      cookies: { rebomi_refresh: token },
    })

    expect(response.statusCode).toBe(200)
    const body = refreshResponseSchema.parse(response.json())
    expect((await whoami(app, body.accessToken)).json()).toEqual({ userId: user.id })
    expect(refreshCookie(response)).toMatchObject({ value: token, maxAge: 60 * 24 * 60 * 60 })
  })

  it.each([{ origin: 'https://evil.test' }, {}])(
    '허용 목록에 없는 Origin(%j)의 쿠키 갱신은 403으로 거부된다',
    async (headers) => {
      const app = newApp()
      const token = String(refreshCookie(await login(app, 'google', {}, 'cookie'))?.value)

      const response = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {},
        headers,
        cookies: { rebomi_refresh: token },
      })

      expect(response.statusCode).toBe(403)
      // 거부된 요청이 토큰 수명을 늘리거나 폐기하지 않았다.
      const allowed = await app.inject({
        method: 'POST',
        url: '/auth/refresh',
        payload: {},
        headers: { origin: ALLOWED_ORIGIN },
        cookies: { rebomi_refresh: token },
      })
      expect(allowed.statusCode).toBe(200)
    },
  )

  it('쿠키로 로그아웃하면 쿠키가 지워지고 그 토큰은 더 쓰이지 않는다', async () => {
    const app = newApp()
    const token = String(refreshCookie(await login(app, 'google', {}, 'cookie'))?.value)
    const request = {
      method: 'POST' as const,
      payload: {},
      headers: { origin: ALLOWED_ORIGIN },
      cookies: { rebomi_refresh: token },
    }

    const logout = await app.inject({ ...request, url: '/auth/logout' })
    const refresh = await app.inject({ ...request, url: '/auth/refresh' })

    expect(logout.statusCode).toBe(204)
    expect(refreshCookie(logout)).toMatchObject({ value: '', maxAge: 0 })
    expect(errorCode(refresh)).toBe('REFRESH_TOKEN_INVALID')
  })

  it('허용 목록에 없는 Origin의 쿠키 로그아웃은 거부되고 토큰은 살아 있다', async () => {
    const app = newApp()
    const token = String(refreshCookie(await login(app, 'google', {}, 'cookie'))?.value)

    const logout = await app.inject({
      method: 'POST',
      url: '/auth/logout',
      payload: {},
      headers: { origin: 'https://evil.test' },
      cookies: { rebomi_refresh: token },
    })

    expect(logout.statusCode).toBe(403)
    const refresh = await post(app, '/auth/refresh', { refreshToken: token })
    expect(refresh.statusCode).toBe(200)
  })
})

describe('로그', () => {
  it('토큰과 비밀값이 로그에 남지 않는다', async () => {
    const lines: string[] = []
    const app = newApp(
      {},
      { level: 'trace', stream: { write: (line: string) => lines.push(line) } },
    )

    const googleIdToken = await idToken('google')
    const loginResponse = await post(app, '/auth/login', {
      provider: 'google',
      idToken: googleIdToken,
    })
    const { accessToken, refreshToken } = loginResponseSchema.parse(loginResponse.json())
    const cookieLogin = await login(app, 'google', {}, 'cookie')
    const cookieToken = String(refreshCookie(cookieLogin)?.value)
    const badIdToken = await idToken('google', { key: strangerKey })
    await post(app, '/auth/login', { provider: 'google', idToken: badIdToken })
    await whoami(app, accessToken)
    await whoami(app, `${accessToken}x`)
    const refreshed = await post(app, '/auth/refresh', { refreshToken })
    await app.inject({
      method: 'POST',
      url: '/auth/refresh',
      payload: {},
      headers: { origin: ALLOWED_ORIGIN },
      cookies: { rebomi_refresh: cookieToken },
    })
    await post(app, '/auth/refresh', { refreshToken: 'unknown-refresh-token-value' })
    await post(app, '/auth/logout', { refreshToken })

    const log = lines.join('')
    expect(lines.length).toBeGreaterThan(0)
    const secrets = [
      googleIdToken,
      badIdToken,
      accessToken,
      refreshToken!,
      cookieToken,
      refreshResponseSchema.parse(refreshed.json()).accessToken,
      'unknown-refresh-token-value',
      hashRefreshToken(refreshToken!),
      JWT_SECRET,
    ]
    for (const secret of secrets) {
      expect(log).not.toContain(secret)
    }
  })
})
