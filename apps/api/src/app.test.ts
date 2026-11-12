import { readFileSync } from 'node:fs'
import { healthResponseSchema } from '@rebomi/api-contract'
import { createDb, type Db } from '@rebomi/db'
import type { FastifyInstance } from 'fastify'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { buildApp } from './app.js'

const connectionString = process.env.DATABASE_URL

/** package.json을 직접 읽는다 — 구현과 같은 출처를 쓰면 증명이 되지 않는다. */
const packageVersion = (
  JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')) as {
    version: string
  }
).version

const CORS_ORIGINS = ['http://localhost:3000', 'chrome-extension://abcdefghijklmnop']

/** 인증 경로는 auth.test.ts 가 본다. 여기서는 앱을 조립할 최소 설정만 준다. */
const AUTH = {
  jwtSecret: 'test-secret-test-secret-test-secret-0123',
  verifiers: {},
  secureCookies: false,
}

/** 큐에 넣지 않는 더블. 콘텐츠 경로는 contents.test.ts 가 실제 큐로 본다. */
const JOBS = { enqueueContentProcess: () => Promise.resolve() }

/** ping이 항상 거부되는 Db 더블. ping은 db.drizzle.execute를 호출한다. */
const deadDb = (): Db => ({
  drizzle: {
    execute: () => Promise.reject(new Error('connection refused')),
  } as unknown as Db['drizzle'],
  transaction: () => Promise.reject(new Error('connection refused')),
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
    const app = track(buildApp({ db, corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))

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
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))

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
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))
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

describe('CORS', () => {
  it.each(CORS_ORIGINS)('허용 오리진 %s 의 프리플라이트에 헤더를 붙인다', async (origin) => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin, 'access-control-request-method': 'GET' },
    })

    expect(response.headers['access-control-allow-origin']).toBe(origin)
  })

  it('허용하지 않은 오리진에는 헤더를 붙이지 않는다', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))

    const response = await app.inject({
      method: 'OPTIONS',
      url: '/health',
      headers: { origin: 'https://evil.test', 'access-control-request-method': 'GET' },
    })

    expect(response.headers['access-control-allow-origin']).toBeUndefined()
  })
})

describe('Fastify가 만드는 응답도 공통 포맷을 지킨다', () => {
  it('없는 경로에 NOT_FOUND 포맷으로 404를 돌려준다', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))

    const response = await app.inject({ method: 'GET', url: '/존재하지-않는-경로' })

    expect(response.statusCode).toBe(404)
    expect((response.json() as { error: { code: string } }).error.code).toBe('NOT_FOUND')
  })

  it('깨진 JSON 바디를 500이 아니라 400 VALIDATION_FAILED로 돌려준다', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))
    app.post('/__echo', () => ({ ok: true }))

    const response = await app.inject({
      method: 'POST',
      url: '/__echo',
      headers: { 'content-type': 'application/json' },
      payload: '{깨진',
    })

    // 클라이언트 잘못을 서버 장애로 보고하면 재시도 로직이 틀린 판단을 한다.
    expect(response.statusCode).toBe(400)
    expect((response.json() as { error: { code: string } }).error.code).toBe('VALIDATION_FAILED')
  })

  it('지원하지 않는 Content-Type을 500이 아니라 415로 돌려준다', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))
    app.post('/__echo', () => ({ ok: true }))

    const response = await app.inject({
      method: 'POST',
      url: '/__echo',
      headers: { 'content-type': 'text/foo' },
      payload: 'x',
    })

    expect(response.statusCode).toBe(415)
    expect((response.json() as { error: { code: string } }).error.code).toBeTruthy()
  })

  it('statusCode가 붙은 에러의 상태를 존중한다', async () => {
    const app = track(buildApp({ db: deadDb(), corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))
    app.get('/__forbidden', () => {
      const error = new Error('내부 사정') as Error & { statusCode: number }
      error.statusCode = 403
      throw error
    })

    const response = await app.inject({ method: 'GET', url: '/__forbidden' })

    expect(response.statusCode).toBe(403)
    expect(JSON.stringify(response.json())).not.toContain('내부 사정')
  })
})

describe('응답 계약 강제', () => {
  it('계약에 없는 필드는 직렬화 단계에서 떨어진다', async () => {
    // Zod의 parse는 모르는 키를 조용히 버리므로, parse 결과를 비교하는 테스트는
    // 서버가 내부 정보를 덧붙여도 초록색이다. 원본 바디를 본다.
    const db = createDb(connectionString!)
    closers.push(() => db.close())
    const app = track(buildApp({ db, corsOrigins: CORS_ORIGINS, auth: AUTH, jobs: JOBS }))

    const response = await app.inject({ method: 'GET', url: '/health' })
    const raw = JSON.parse(response.body) as Record<string, unknown>

    expect(Object.keys(raw).sort()).toEqual(['db', 'status', 'version'])
  })
})
