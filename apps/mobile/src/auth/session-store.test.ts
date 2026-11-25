import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  errorBody,
  fakeApp,
  health,
  loggedIn,
  refreshRejected,
  refreshed,
  type FakeResponse,
} from '../test/fake-api'
import type { SessionStatus, SessionStore } from './session-store'

afterEach(() => {
  vi.unstubAllGlobals()
})

/** 상태가 `checking` 을 벗어날 때까지 기다린다. */
function settled(session: SessionStore): Promise<SessionStatus> {
  return new Promise((resolve) => {
    const check = () => {
      const status = session.getStatus()
      if (status === 'checking') return false
      resolve(status)
      return true
    }
    if (check()) return
    const unsubscribe = session.subscribe(() => {
      if (check()) unsubscribe()
    })
  })
}

const accessExpired: FakeResponse = { status: 401, body: errorBody('ACCESS_TOKEN_EXPIRED') }

describe('세션 복구 (앱을 다시 열었을 때)', () => {
  it('저장된 갱신 토큰으로 로그인 상태가 된다', async () => {
    const { session, requests } = fakeApp(() => refreshed, 'stored-refresh')

    expect(session.getStatus()).toBe('checking')
    session.start()

    expect(await settled(session)).toBe('signed-in')
    expect(requests).toEqual([
      expect.objectContaining({ path: '/auth/refresh', body: { refreshToken: 'stored-refresh' } }),
    ])
  })

  it('복구한 뒤의 요청은 새로 받은 액세스 토큰을 싣는다', async () => {
    const { session, api, requests } = fakeApp(
      (request) => (request.path === '/auth/refresh' ? refreshed : health),
      'stored-refresh',
    )
    session.start()
    await settled(session)

    await api.health()

    expect(requests.at(-1)).toMatchObject({ path: '/health', authorization: 'Bearer access-2' })
  })

  it('저장된 갱신 토큰이 없으면 서버에 묻지 않고 로그아웃 상태다', async () => {
    const { session, requests } = fakeApp(() => refreshed)
    session.start()

    expect(await settled(session)).toBe('signed-out')
    expect(requests).toEqual([])
  })

  it('갱신 토큰이 폐기됐으면 로그아웃 상태이고 저장소에서 지운다', async () => {
    const { session, storage } = fakeApp(() => refreshRejected, 'revoked-refresh')
    session.start()

    expect(await settled(session)).toBe('signed-out')
    expect(storage.value).toBeNull()
  })

  it('갱신 토큰이 만료됐어도 같다', async () => {
    const { session, storage } = fakeApp(
      () => ({ status: 401, body: errorBody('REFRESH_TOKEN_EXPIRED') }),
      'expired-refresh',
    )
    session.start()

    expect(await settled(session)).toBe('signed-out')
    expect(storage.value).toBeNull()
  })

  it('서버에 닿지 못하면 로그아웃이 아니라 연결 실패이고 갱신 토큰을 지우지 않는다', async () => {
    const { session, storage } = fakeApp(() => 'offline', 'stored-refresh')
    session.start()

    expect(await settled(session)).toBe('unreachable')
    expect(storage.value).toBe('stored-refresh')
    expect(storage.removes).toBe(0)
  })

  it('서버가 5xx로 답해도 로그아웃시키지 않는다', async () => {
    const { session, storage } = fakeApp(
      () => ({ status: 500, body: errorBody('INTERNAL') }),
      'stored-refresh',
    )
    session.start()

    expect(await settled(session)).toBe('unreachable')
    expect(storage.value).toBe('stored-refresh')
  })

  it('연결 실패에서 다시 시도하면 복구된다', async () => {
    let online = false
    const { session } = fakeApp(() => (online ? refreshed : 'offline'), 'stored-refresh')
    session.start()
    expect(await settled(session)).toBe('unreachable')

    online = true
    session.retry()

    expect(session.getStatus()).toBe('checking')
    expect(await settled(session)).toBe('signed-in')
  })

  it('보안 저장소를 읽지 못하면 로그아웃이 아니라 연결 실패다', async () => {
    const { session, storage, requests } = fakeApp(() => refreshed, 'stored-refresh')
    storage.broken = true
    session.start()

    expect(await settled(session)).toBe('unreachable')
    expect(requests).toEqual([])
  })
})

describe('로그인', () => {
  it('신원 토큰을 본문 방식으로 보내고, 받은 갱신 토큰을 보안 저장소에 둔다', async () => {
    const { session, storage, requests } = fakeApp(() => loggedIn)
    session.start()
    await settled(session)

    await session.signIn('google', 'provider-id-token')

    expect(session.getStatus()).toBe('signed-in')
    expect(requests).toEqual([
      expect.objectContaining({
        path: '/auth/login',
        body: { provider: 'google', idToken: 'provider-id-token', session: 'body' },
      }),
    ])
    expect(storage.value).toBe('refresh-1')
  })

  it('서버가 거부하면 던지고 로그아웃 상태로 남는다', async () => {
    const { session, storage } = fakeApp(() => ({
      status: 401,
      body: errorBody('INVALID_PROVIDER_TOKEN'),
    }))
    session.start()
    await settled(session)

    await expect(session.signIn('apple', 'bad')).rejects.toMatchObject({
      code: 'INVALID_PROVIDER_TOKEN',
    })
    expect(session.getStatus()).toBe('signed-out')
    expect(storage.value).toBeNull()
  })
})

describe('사용 중', () => {
  it('액세스 토큰이 만료되면 갱신하고 요청을 다시 보낸다 — 로그인 상태가 유지된다', async () => {
    let expired = true
    const { session, api, requests } = fakeApp((request) => {
      if (request.path === '/auth/login') return loggedIn
      if (request.path === '/auth/refresh') return refreshed
      if (expired) {
        expired = false
        return accessExpired
      }
      return health
    })
    session.start()
    await settled(session)
    await session.signIn('google', 'provider-id-token')

    await expect(api.health()).resolves.toMatchObject({ status: 'ok' })

    expect(session.getStatus()).toBe('signed-in')
    expect(requests.map((request) => [request.path, request.authorization])).toEqual([
      ['/auth/login', null],
      ['/health', 'Bearer access-1'],
      ['/auth/refresh', null],
      ['/health', 'Bearer access-2'],
    ])
    expect(requests[2]?.body).toEqual({ refreshToken: 'refresh-1' })
  })

  it('갱신이 거부되면(갱신 토큰 폐기) 로그아웃 상태가 되고 저장소에서 지운다', async () => {
    const { session, api, storage } = fakeApp((request) => {
      if (request.path === '/auth/login') return loggedIn
      if (request.path === '/auth/refresh') return refreshRejected
      return accessExpired
    })
    session.start()
    await settled(session)
    await session.signIn('google', 'provider-id-token')

    await expect(api.health()).rejects.toMatchObject({ code: 'REFRESH_TOKEN_INVALID' })

    expect(session.getStatus()).toBe('signed-out')
    expect(storage.value).toBeNull()
  })

  it('갱신하다 서버에 닿지 못하면 로그인 상태와 갱신 토큰을 그대로 둔다', async () => {
    const { session, api, storage } = fakeApp((request) => {
      if (request.path === '/auth/login') return loggedIn
      if (request.path === '/auth/refresh') return 'offline'
      return accessExpired
    })
    session.start()
    await settled(session)
    await session.signIn('google', 'provider-id-token')

    await expect(api.health()).rejects.toMatchObject({ code: 'NETWORK' })

    expect(session.getStatus()).toBe('signed-in')
    expect(storage.value).toBe('refresh-1')
  })
})

describe('로그아웃', () => {
  it('갱신 토큰을 서버에 보내 폐기하고 저장소에서 지운다', async () => {
    const { session, storage, requests } = fakeApp((request) =>
      request.path === '/auth/refresh' ? refreshed : { status: 204 },
    'stored-refresh')
    session.start()
    await settled(session)

    await session.signOut()

    expect(session.getStatus()).toBe('signed-out')
    expect(requests.at(-1)).toMatchObject({
      path: '/auth/logout',
      body: { refreshToken: 'stored-refresh' },
    })
    expect(storage.value).toBeNull()
  })

  it('서버에 닿지 못해도 이 기기에서는 로그아웃된다', async () => {
    const { session, storage } = fakeApp(
      (request) => (request.path === '/auth/refresh' ? refreshed : 'offline'),
      'stored-refresh',
    )
    session.start()
    await settled(session)

    await session.signOut()

    expect(session.getStatus()).toBe('signed-out')
    expect(storage.value).toBeNull()
  })

  it('로그아웃한 뒤 앱을 다시 열면 로그아웃 상태다', async () => {
    const first = fakeApp(
      (request) => (request.path === '/auth/refresh' ? refreshed : { status: 204 }),
      'stored-refresh',
    )
    first.session.start()
    await settled(first.session)
    await first.session.signOut()

    const second = fakeApp(() => refreshed, first.storage.value)
    second.session.start()

    expect(await settled(second.session)).toBe('signed-out')
  })
})

describe('갱신 토큰이 남는 곳', () => {
  it('보안 저장소에만 쓰이고, 갱신 때는 다시 쓰지 않는다', async () => {
    const log = vi.spyOn(console, 'log')
    const warn = vi.spyOn(console, 'warn')
    const error = vi.spyOn(console, 'error')
    let expired = true
    const { session, api, storage } = fakeApp((request) => {
      if (request.path === '/auth/login') return loggedIn
      if (request.path === '/auth/refresh') return refreshed
      if (expired) {
        expired = false
        return accessExpired
      }
      return health
    })
    session.start()
    await settled(session)
    await session.signIn('google', 'provider-id-token')
    await api.health()

    expect(storage.writes).toEqual(['refresh-1'])
    for (const spy of [log, warn, error]) expect(spy).not.toHaveBeenCalled()
  })
})
