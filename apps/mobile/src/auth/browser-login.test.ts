import { describe, expect, it, vi } from 'vitest'
import {
  APP_LOGIN_RETURN_URL,
  browserLogin,
  buildStartUrl,
  parseReturnUrl,
  type BrowserLoginDeps,
} from './browser-login'

const STATE = 'state_0123456789abcdef'
const NONCE = 'nonce_0123456789abcdef'

function returned(params: Record<string, string>): string {
  return `${APP_LOGIN_RETURN_URL}#${new URLSearchParams(params).toString()}`
}

describe('buildStartUrl', () => {
  it('웹의 로그인 시작 주소를 만든다', () => {
    const url = new URL(
      buildStartUrl('https://rebomi.app', { provider: 'google', state: STATE, nonce: NONCE }),
    )

    expect(url.origin + url.pathname).toBe('https://rebomi.app/login/app/start')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      provider: 'google',
      state: STATE,
      nonce: NONCE,
    })
  })

  it('웹 주소 끝의 빗금을 겹치지 않는다', () => {
    const url = buildStartUrl('https://rebomi.app/', { provider: 'apple', state: STATE, nonce: NONCE })
    expect(url.startsWith('https://rebomi.app/login/app/start?')).toBe(true)
  })
})

describe('parseReturnUrl', () => {
  const expected = { provider: 'google', state: STATE } as const

  it('신원 토큰을 꺼낸다', () => {
    const url = returned({ provider: 'google', id_token: 'g.jwt.token', state: STATE })
    expect(parseReturnUrl(url, expected)).toEqual({ kind: 'token', idToken: 'g.jwt.token' })
  })

  it('state가 다르면 버린다', () => {
    const url = returned({ provider: 'google', id_token: 'g.jwt.token', state: 'someone-elses' })
    expect(parseReturnUrl(url, expected)).toEqual({ kind: 'failed' })
  })

  it('state가 없으면 버린다', () => {
    const url = returned({ provider: 'google', id_token: 'g.jwt.token' })
    expect(parseReturnUrl(url, expected)).toEqual({ kind: 'failed' })
  })

  it('다른 수단의 결과면 버린다', () => {
    const url = returned({ provider: 'apple', id_token: 'a.jwt.token', state: STATE })
    expect(parseReturnUrl(url, expected)).toEqual({ kind: 'failed' })
  })

  it.each(['user_cancelled_authorize', 'access_denied'])('%s 는 취소다', (error) => {
    const url = returned({ provider: 'google', error, state: STATE })
    expect(parseReturnUrl(url, expected)).toEqual({ kind: 'cancelled' })
  })

  it('그 밖의 오류는 실패다', () => {
    const url = returned({ provider: 'google', error: 'missing_id_token', state: STATE })
    expect(parseReturnUrl(url, expected)).toEqual({ kind: 'failed' })
  })

  it('신원 토큰도 오류도 없으면 실패다', () => {
    expect(parseReturnUrl(returned({ provider: 'google', state: STATE }), expected)).toEqual({
      kind: 'failed',
    })
  })

  it('우리 딥링크가 아니면 실패다', () => {
    const url = `https://evil.example/#provider=google&id_token=x&state=${STATE}`
    expect(parseReturnUrl(url, expected)).toEqual({ kind: 'failed' })
  })
})

describe('browserLogin', () => {
  function deps(open: BrowserLoginDeps['openAuthSession']): BrowserLoginDeps {
    const tokens = [STATE, NONCE]
    return {
      webBaseUrl: 'https://rebomi.app',
      randomToken: () => tokens.shift() ?? 'unexpected',
      openAuthSession: open,
    }
  }

  it('브라우저 창을 열고 돌아온 신원 토큰을 돌려준다', async () => {
    const open = vi.fn(async () =>
      returned({ provider: 'apple', id_token: 'a.jwt.token', state: STATE }),
    )

    const result = await browserLogin('apple', deps(open))

    expect(result).toEqual({ kind: 'token', idToken: 'a.jwt.token' })
    expect(open).toHaveBeenCalledWith(
      `https://rebomi.app/login/app/start?provider=apple&state=${STATE}&nonce=${NONCE}`,
      'rebomi://login',
    )
  })

  it('사용자가 창을 닫으면 취소다', async () => {
    expect(await browserLogin('google', deps(async () => null))).toEqual({ kind: 'cancelled' })
  })

  it('브라우저를 열지 못하면 실패다 — 던지지 않는다', async () => {
    const open = async () => {
      throw new Error('no browser')
    }
    expect(await browserLogin('google', deps(open))).toEqual({ kind: 'failed' })
  })

  it('다른 로그인의 결과가 돌아오면 실패다', async () => {
    const open = async () => returned({ provider: 'google', id_token: 'x', state: 'other-state-value' })
    expect(await browserLogin('google', deps(open))).toEqual({ kind: 'failed' })
  })
})
