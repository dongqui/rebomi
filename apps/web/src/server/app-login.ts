/*
 * 모바일 앱의 로그인 중계 (account.md §4 2026-11-24, architecture §3).
 *
 * 앱은 시스템 브라우저 창으로 `start` 를 연다. `start` 는 제공자의 로그인 주소로 보내고,
 * 제공자는 로그인이 끝나면 신원 토큰을 `return` 으로 POST한다(form_post). `return` 은 그것을
 * 앱의 딥링크로 넘긴다. 앱이 그 신원 토큰으로 API에 로그인한다.
 *
 * 여기서는 아무것도 저장하지 않고, 신원 토큰을 검증하지도 않는다 — 검증은 API가 한다.
 * 클라이언트 ID가 웹에만 있으면 되므로 앱에는 제공자 설정이 없다.
 */

export const APP_LOGIN_RETURN_PATH = '/login/app/return'

/**
 * 앱으로 돌아가는 주소. 요청에서 받지 않고 고정한다 — 받으면 신원 토큰을 아무 곳으로나
 * 보내는 경로가 된다.
 */
const APP_LINK = 'rebomi://login'

const PROVIDERS = ['google', 'apple'] as const
type Provider = (typeof PROVIDERS)[number]

/** 앱이 만든 난수(base64url). 우리 구분자(`.`)와 주소에서 뜻이 있는 문자를 받지 않는다. */
const OPAQUE = /^[A-Za-z0-9_-]{16,128}$/

/** API의 `loginRequestSchema` 가 받는 상한과 같다. */
const ID_TOKEN_MAX_LENGTH = 8192

/** 제공자가 돌려주는 오류 값. 그대로 앱에 넘기므로 모양을 제한한다. */
const PROVIDER_ERROR = /^[a-z_]{1,64}$/

const NO_STORE = { 'cache-control': 'no-store' }

function isProvider(value: string | null): value is Provider {
  return PROVIDERS.includes(value as Provider)
}

function badRequest(message: string): Response {
  return new Response(message, {
    status: 400,
    headers: { ...NO_STORE, 'content-type': 'text/plain; charset=utf-8' },
  })
}

/**
 * `GET /login/app/start?provider=&state=&nonce=` — 제공자의 로그인 주소로 보낸다.
 *
 * `state` 는 앱이 만들어 돌아온 결과와 맞춰 본다. 제공자에게는 어느 수단인지 앞에 붙여
 * 보낸다 — 돌아오는 주소가 하나라 `return` 이 수단을 알 길이 이것뿐이다.
 */
export function startAppLogin(url: URL, clientIds: Record<Provider, string>): Response {
  const provider = url.searchParams.get('provider')
  const state = url.searchParams.get('state')
  const nonce = url.searchParams.get('nonce')

  if (!isProvider(provider)) return badRequest('unknown provider')
  if (state === null || !OPAQUE.test(state)) return badRequest('invalid state')
  if (nonce === null || !OPAQUE.test(nonce)) return badRequest('invalid nonce')

  const common = {
    client_id: clientIds[provider],
    redirect_uri: `${url.origin}${APP_LOGIN_RETURN_PATH}`,
    response_mode: 'form_post',
    nonce,
    state: `${provider}.${state}`,
  }

  const target =
    provider === 'google'
      ? authorizeUrl('https://accounts.google.com/o/oauth2/v2/auth', {
          ...common,
          response_type: 'id_token',
          scope: 'openid email',
          // 브라우저에 로그인된 계정으로 말없이 넘어가지 않고 계정을 고르게 한다.
          prompt: 'select_account',
        })
      : authorizeUrl('https://appleid.apple.com/auth/authorize', {
          ...common,
          // Apple은 `id_token` 만 요청하는 것을 받지 않는다. `code` 는 쓰지 않는다.
          response_type: 'code id_token',
          // 이메일을 요청하면 Apple은 form_post만 허용한다.
          scope: 'email',
        })

  return new Response(null, { status: 302, headers: { ...NO_STORE, location: target } })
}

function authorizeUrl(base: string, params: Record<string, string>): string {
  const url = new URL(base)
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value)
  return url.toString()
}

/**
 * `POST /login/app/return` — 제공자가 보낸 결과를 앱의 딥링크로 넘긴다.
 *
 * 누구나 이 주소로 POST할 수 있다. 그래도 되는 이유: 넘기는 곳이 앱뿐이고, 앱은 자기가 만든
 * `state` 와 다르면 버린다.
 */
export async function returnAppLogin(request: Request): Promise<Response> {
  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return badRequest('form body required')
  }

  const field = (name: string): string | null => {
    const value = form.get(name)
    return typeof value === 'string' && value !== '' ? value : null
  }

  const [provider = null, state = null, ...rest] = (field('state') ?? '').split('.')
  if (!isProvider(provider) || state === null || rest.length > 0 || !OPAQUE.test(state)) {
    return badRequest('invalid state')
  }

  const result = new URLSearchParams({ provider })
  const idToken = field('id_token')
  const error = field('error')

  if (error !== null) {
    result.set('error', PROVIDER_ERROR.test(error) ? error : 'provider_error')
  } else if (idToken !== null && idToken.length <= ID_TOKEN_MAX_LENGTH) {
    result.set('id_token', idToken)
  } else {
    result.set('error', 'missing_id_token')
  }
  result.set('state', state)

  // 조각(#)에 싣는다 — 조각은 서버로 가지 않아 어느 접속 기록에도 남지 않는다.
  // POST에 대한 응답이라 303이다. 브라우저가 GET으로 딥링크를 연다.
  return new Response(null, {
    status: 303,
    headers: { ...NO_STORE, location: `${APP_LINK}#${result.toString()}` },
  })
}
