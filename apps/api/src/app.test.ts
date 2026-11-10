import { readFileSync } from 'node:fs'
import { healthResponseSchema } from '@rebomi/api-contract'
import { createDb, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'
import { requireAuth } from './auth.js'

const connectionString = process.env.DATABASE_URL

/** package.json을 직접 읽는다 — 구현과 같은 출처를 쓰면 증명이 되지 않는다. */
const packageVersion = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

const CORS_ORIGINS = ['http://localhost:3000', 'chrome-extension://abcdefghijklmnop']

/** ping이 항상 거부되는 Db 더블. ping은 db.drizzle.execute를 호출한다. */
const deadDb = (): Db => ({
  drizzle: {
    execute: () => Promise.reject(new Error('connection refused')),
  } as unknown as Db['drizzle'],
  close: () => Promise.resolve(),
})

let closers: Array<() => Promise<unknown>> = []

function track<T extends FastifyInstance>(app: T): T {
  closers.push(() => app.close())
  return app
}

afterEach(async () => {
  for (const close of closers) await close()
  closers = []
})

beforeAll(() => {
  if (!connectionString) {
    throw new Error(
      'DATABASE_URL이 없습니다. `cp .env.example .env` 후 docker compose로 DB를 띄우세요.',
    )
  }
})

describe('GET /health', () => {
  it('200과 ok 상태를 반환하고 계약을 만족한다', async () => {
    const db = createDb(connectionString!)
    closers.push(() => db.close())
    const app = track(buildApp({ db, corsOrigins: CORS_ORIGINS }))

    const response = await app.inject({ method: 'GET', url: '/health' })

    expect(response.statusCode).toBe(200)
    const body: unknown = response.json()
    expect(healthResponseSchema.parse(body)).toEqual({
      status: 'ok',
      db: 'ok',
      version: packageVersion,
    })
  })

  // Review Focus 2
  it('DB가 죽으면 503과 degraded를 반환한다', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS }))

    const response = await app.inject({ method: 'GET', url: '/health' })

    // 200이 아니어야 한다. 모니터링이 장애를 잡을 수 있어야 하므로.
    expect(response.statusCode).toBe(503)
    const body = healthResponseSchema.parse(response.json())
    expect(body.status).toBe('degraded')
    expect(body.db).toBe('error')
  })
})

describe('에러 핸들러', () => {
  it('처리되지 않은 예외를 INTERNAL 포맷으로 바꾸고 스택을 응답에 넣지 않는다', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS }))
    app.get('/__boom', () => {
      throw new Error('터지는 라우트')
    })

    const response = await app.inject({ method: 'GET', url: '/__boom' })

    expect(response.statusCode).toBe(500)
    const body = response.json() as { error: { code: string; message: string } }
    expect(body.error.code).toBe('INTERNAL')
    expect(JSON.stringify(body)).not.toContain('터지는 라우트')
    expect(JSON.stringify(body)).not.toContain('at ')
  })
})

// Review Focus 4
describe('requireAuth', () => {
  const rejected = ['__none__', 'Basic abc', 'Bearer', 'Bearer   ']

  it.each(rejected)('Authorization "%s" 를 401로 막는다', async (header) => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS }))
    app.get('/__authed', { preHandler: requireAuth }, () => ({ ok: true }))

    const response = await app.inject({
      method: 'GET',
      url: '/__authed',
      headers: header === '__none__' ? {} : { authorization: header },
    })

    expect(response.statusCode).toBe(401)
    expect((response.json() as { error: { code: string } }).error.code).toBe('UNAUTHORIZED')
  })

  it('소문자 스킴 "bearer t" 는 통과시킨다 (RFC 7235)', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS }))
    app.get('/__authed', { preHandler: requireAuth }, () => ({ ok: true }))

    const response = await app.inject({
      method: 'GET',
      url: '/__authed',
      headers: { authorization: 'bearer t' },
    })

    expect(response.statusCode).toBe(200)
  })
})

describe('CORS', () => {
  it.each(CORS_ORIGINS)('허용 오리진 %s 의 프리플라이트에 헤더를 붙인다', async (origin) => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS }))

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin, 'access-control-request-method': 'GET' },
    })

    expect(response.headers['access-control-allow-origin']).toBe(origin)
  })

  it('허용하지 않은 오리진에는 헤더를 붙이지 않는다', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS }))

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'https://evil.test', 'access-control-request-method': 'GET' },
    })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})
