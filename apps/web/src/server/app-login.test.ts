// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { APP_LOGIN_RETURN_PATH, returnAppLogin, startAppLogin } from './app-login'

const clientIds = { google: 'google-web-client', apple: 'app.rebomi.web' }
const STATE = 'state_0123456789abcdef'
const NONCE = 'nonce_0123456789abcdef'

function start(query: Record<string, string>): Response {
  const url = new URL('https://rebomi.app/login/app/start')
  for (const [key, value] of Object.entries(query)) url.searchParams.set(key, value)
  return startAppLogin(url, clientIds)
}

function post(fields: Record<string, string>): Promise<Response> {
  return returnAppLogin(
    new Request(`https://rebomi.app${APP_LOGIN_RETURN_PATH}`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(fields).toString(),
    }),
  )
}

/** `rebomi://login#…` 의 조각을 읽는다. */
function appLink(response: Response): { base: string; params: URLSearchParams } {
  const location = response.headers.get('location') ?? ''
  const [base = '', fragment = ''] = location.split('#')
  return { base, params: new URLSearchParams(fragment) }
}

describe('startAppLogin', () => {
  it('Google 로그인 주소로 보낸다 — 신원 토큰을 돌아올 주소로 POST하게 한다', () => {
    const response = start({ provider: 'google', state: STATE, nonce: NONCE })

    expect(response.status).toBe(302)
    const target = new URL(response.headers.get('location') ?? '')
    expect(target.origin + target.pathname).toBe('https://accounts.google.com/o/oauth2/v2/auth')
    expect(Object.fromEntries(target.searchParams)).toEqual({
      client_id: 'google-web-client',
      redirect_uri: 'https://rebomi.app/login/app/return',
      response_type: 'id_token',
      response_mode: 'form_post',
      scope: 'openid email',
      nonce: NONCE,
      state: `google.${STATE}`,
      prompt: 'select_account',
    })
  })

  it('Apple 로그인 주소로 보낸다 — 이메일을 요청하므로 form_post다', () => {
    const response = start({ provider: 'apple', state: STATE, nonce: NONCE })

    expect(response.status).toBe(302)
    const target = new URL(response.headers.get('location') ?? '')
    expect(target.origin + target.pathname).toBe('https://appleid.apple.com/auth/authorize')
    expect(Object.fromEntries(target.searchParams)).toEqual({
      client_id: 'app.rebomi.web',
      redirect_uri: 'https://rebomi.app/login/app/return',
      response_type: 'code id_token',
      response_mode: 'form_post',
      scope: 'email',
      nonce: NONCE,
      state: `apple.${STATE}`,
    })
  })

  it('응답을 캐시하지 않게 한다', () => {
    const response = start({ provider: 'google', state: STATE, nonce: NONCE })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it.each([
    ['모르는 수단', { provider: 'kakao', state: STATE, nonce: NONCE }],
    ['수단 없음', { state: STATE, nonce: NONCE }],
    ['state 없음', { provider: 'google', nonce: NONCE }],
    ['짧은 state', { provider: 'google', state: 'short', nonce: NONCE }],
    ['허용하지 않는 문자의 state', { provider: 'google', state: `${STATE}.x&y`, nonce: NONCE }],
    ['nonce 없음', { provider: 'google', state: STATE }],
  ])('%s이면 400이고 어디로도 보내지 않는다', (_name, query) => {
    const response = start(query as Record<string, string>)
    expect(response.status).toBe(400)
    expect(response.headers.get('location')).toBeNull()
  })
})

describe('returnAppLogin', () => {
  it('Google이 보낸 신원 토큰을 앱의 딥링크로 넘긴다', async () => {
    const response = await post({ id_token: 'g.jwt.token', state: `google.${STATE}` })

    expect(response.status).toBe(303)
    const { base, params } = appLink(response)
    expect(base).toBe('rebomi://login')
    expect(Object.fromEntries(params)).toEqual({
      provider: 'google',
      id_token: 'g.jwt.token',
      state: STATE,
    })
  })

  it('Apple이 보낸 신원 토큰을 넘긴다 — code와 user는 넘기지 않는다', async () => {
    const response = await post({
      id_token: 'a.jwt.token',
      code: 'apple-code',
      user: '{"name":{"firstName":"A"}}',
      state: `apple.${STATE}`,
    })

    expect(response.status).toBe(303)
    expect(Object.fromEntries(appLink(response).params)).toEqual({
      provider: 'apple',
      id_token: 'a.jwt.token',
      state: STATE,
    })
  })

  it('사용자가 취소하면 제공자의 오류 값을 넘긴다', async () => {
    const response = await post({ error: 'user_cancelled_authorize', state: `apple.${STATE}` })

    expect(response.status).toBe(303)
    expect(Object.fromEntries(appLink(response).params)).toEqual({
      provider: 'apple',
      error: 'user_cancelled_authorize',
      state: STATE,
    })
  })

  it('신원 토큰도 오류도 없으면 오류로 넘긴다', async () => {
    const response = await post({ state: `google.${STATE}` })

    expect(Object.fromEntries(appLink(response).params)).toEqual({
      provider: 'google',
      error: 'missing_id_token',
      state: STATE,
    })
  })

  it('토큰을 넘기는 응답을 캐시하지 않게 한다', async () => {
    const response = await post({ id_token: 'g.jwt.token', state: `google.${STATE}` })
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it.each([
    ['state 없음', { id_token: 'x' }],
    ['수단이 붙지 않은 state', { id_token: 'x', state: STATE }],
    ['모르는 수단의 state', { id_token: 'x', state: `kakao.${STATE}` }],
    ['허용하지 않는 문자의 state', { id_token: 'x', state: `google.${STATE}#evil=1` }],
  ])('%s이면 400이고 앱으로 넘기지 않는다', async (_name, fields) => {
    const response = await post(fields as Record<string, string>)
    expect(response.status).toBe(400)
    expect(response.headers.get('location')).toBeNull()
  })

  it('폼이 아닌 본문은 400이다', async () => {
    const response = await returnAppLogin(
      new Request(`https://rebomi.app${APP_LOGIN_RETURN_PATH}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: '{"id_token":"x"}',
      }),
    )
    expect(response.status).toBe(400)
  })

  it('너무 긴 신원 토큰은 넘기지 않는다', async () => {
    const response = await post({ id_token: 'x'.repeat(8193), state: `google.${STATE}` })
    expect(Object.fromEntries(appLink(response).params)).toMatchObject({
      error: 'missing_id_token',
    })
  })
})
