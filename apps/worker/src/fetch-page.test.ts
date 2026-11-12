import { gzipSync } from 'node:zlib'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { FetchPageError, USER_AGENT, fetchPage, isPublicAddress } from './fetch-page.js'
import {
  FIXTURE_ADDRESS,
  html,
  startFixtureServer,
  type FixtureServer,
} from './testing/fixture-server.js'

let server: FixtureServer
const local = { allowedAddresses: [FIXTURE_ADDRESS] }

beforeAll(async () => {
  server = await startFixtureServer()
})

afterAll(async () => {
  await server.close()
})

async function failure(promise: Promise<unknown>): Promise<FetchPageError> {
  try {
    await promise
  } catch (error) {
    if (error instanceof FetchPageError) return error
    throw error
  }
  throw new Error('실패해야 하는데 성공했습니다')
}

describe('isPublicAddress()', () => {
  it.each([
    '127.0.0.1',
    '10.1.2.3',
    '172.16.0.1',
    '172.31.255.255',
    '192.168.0.10',
    '169.254.169.254',
    '100.64.0.1',
    '0.0.0.0',
    '224.0.0.1',
    '::1',
    '::',
    'fe80::1',
    'fd00::1',
    '::ffff:127.0.0.1',
    '::ffff:10.0.0.1',
  ])('%s 는 막는다', (address) => {
    expect(isPublicAddress(address)).toBe(false)
  })

  it.each(['8.8.8.8', '172.32.0.1', '1.1.1.1', '2606:4700:4700::1111'])(
    '%s 는 허용한다',
    (address) => {
      expect(isPublicAddress(address)).toBe(true)
    },
  )

  it('IP가 아닌 문자열은 막는다', () => {
    expect(isPublicAddress('example.com')).toBe(false)
  })
})

describe('fetchPage()', () => {
  it('HTML을 가져오고 봇임을 밝히는 User-Agent를 보낸다', async () => {
    server.on('/ok', (_request, response) => html(response, '<html><title>안녕</title></html>'))

    const page = await fetchPage(server.url('/ok'), local)

    expect(page).toEqual({ url: server.url('/ok'), html: '<html><title>안녕</title></html>' })
    expect(server.userAgents('/ok')).toEqual([USER_AGENT])
    expect(USER_AGENT).toContain('RebomiBot')
  })

  it('gzip으로 온 응답을 푼다', async () => {
    server.on('/gzip', (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
      response.end(gzipSync('<p>압축</p>'))
    })

    expect((await fetchPage(server.url('/gzip'), local)).html).toBe('<p>압축</p>')
  })

  it('헤더가 밝힌 EUC-KR을 읽는다', async () => {
    // "한글" 의 EUC-KR 바이트
    const body = Buffer.concat([
      Buffer.from('<title>'),
      Buffer.from([0xc7, 0xd1, 0xb1, 0xdb]),
      Buffer.from('</title>'),
    ])
    server.on('/euc-header', (_request, response) =>
      html(response, body, 'text/html; charset=EUC-KR'),
    )

    expect((await fetchPage(server.url('/euc-header'), local)).html).toBe('<title>한글</title>')
  })

  it('헤더에 없으면 meta 태그의 문자셋을 따른다', async () => {
    const body = Buffer.concat([
      Buffer.from('<html><head><meta charset="euc-kr"><title>'),
      Buffer.from([0xc7, 0xd1, 0xb1, 0xdb]),
      Buffer.from('</title></head></html>'),
    ])
    server.on('/euc-meta', (_request, response) => html(response, body, 'text/html'))

    expect((await fetchPage(server.url('/euc-meta'), local)).html).toContain('<title>한글</title>')
  })

  it('리다이렉트를 따라가고 마지막 주소를 돌려준다', async () => {
    server.on('/from', (_request, response) => {
      response.writeHead(302, { location: '/to' })
      response.end()
    })
    server.on('/to', (_request, response) => html(response, '<p>도착</p>'))

    const page = await fetchPage(server.url('/from'), local)

    expect(page).toEqual({ url: server.url('/to'), html: '<p>도착</p>' })
  })

  it('리다이렉트가 한도를 넘으면 영구 실패다', async () => {
    server.on('/loop', (_request, response) => {
      response.writeHead(302, { location: '/loop' })
      response.end()
    })

    const error = await failure(fetchPage(server.url('/loop'), { ...local, maxRedirects: 3 }))

    expect(error).toMatchObject({ kind: 'permanent', reason: 'too_many_redirects' })
    expect(server.hits('/loop')).toBe(4)
  })

  it('내부망 주소로 가는 리다이렉트는 따라가지 않는다', async () => {
    server.on('/to-metadata', (_request, response) => {
      response.writeHead(302, { location: 'http://169.254.169.254/latest/meta-data/' })
      response.end()
    })

    const error = await failure(fetchPage(server.url('/to-metadata'), local))

    expect(error).toMatchObject({ kind: 'permanent', reason: 'blocked_address' })
  })

  it('허용 목록이 없으면 루프백 주소는 요청조차 보내지 않는다', async () => {
    server.on('/private', (_request, response) => html(response, '<p>내부</p>'))

    const byAddress = await failure(fetchPage(server.url('/private')))
    const byName = await failure(
      fetchPage(server.url('/private').replace(FIXTURE_ADDRESS, 'localhost')),
    )

    expect(byAddress).toMatchObject({ kind: 'permanent', reason: 'blocked_address' })
    expect(byName).toMatchObject({ kind: 'permanent', reason: 'blocked_address' })
    expect(server.hits('/private')).toBe(0)
  })

  it.each(['http://[::1]/', 'http://10.0.0.5/admin', 'http://2130706433/', 'http://0x7f.1/'])(
    '%s 는 막는다',
    async (url) => {
      expect(await failure(fetchPage(url))).toMatchObject({
        kind: 'permanent',
        reason: 'blocked_address',
      })
    },
  )

  it('http(s)가 아닌 주소는 영구 실패다', async () => {
    expect(await failure(fetchPage('file:///etc/passwd'))).toMatchObject({
      kind: 'permanent',
      reason: 'unsupported_protocol',
    })
  })

  it.each([500, 502, 503, 429])('%i 응답은 일시 실패다', async (status) => {
    server.on(`/status-${status}`, (_request, response) => {
      response.writeHead(status)
      response.end()
    })

    expect(await failure(fetchPage(server.url(`/status-${status}`), local))).toMatchObject({
      kind: 'transient',
      reason: 'http_status',
    })
  })

  it.each([404, 403, 410])('%i 응답은 영구 실패다', async (status) => {
    server.on(`/status-${status}`, (_request, response) => {
      response.writeHead(status)
      response.end()
    })

    expect(await failure(fetchPage(server.url(`/status-${status}`), local))).toMatchObject({
      kind: 'permanent',
      reason: 'http_status',
    })
  })

  it('연결이 끊기면 일시 실패다', async () => {
    server.on('/reset', (request) => request.socket.destroy())

    expect(await failure(fetchPage(server.url('/reset'), local))).toMatchObject({
      kind: 'transient',
      reason: 'network',
    })
  })

  it('제한 시간 안에 응답이 없으면 일시 실패다', async () => {
    server.on('/slow', () => {
      // 응답하지 않는다.
    })

    const error = await failure(fetchPage(server.url('/slow'), { ...local, timeoutMs: 200 }))

    expect(error).toMatchObject({ kind: 'transient', reason: 'timeout' })
  })

  it('HTML이 아니면 영구 실패다', async () => {
    server.on('/pdf', (_request, response) => html(response, '%PDF-1.7', 'application/pdf'))

    expect(await failure(fetchPage(server.url('/pdf'), local))).toMatchObject({
      kind: 'permanent',
      reason: 'not_html',
    })
  })

  it('크기 상한을 넘으면 영구 실패다. 압축을 푼 크기로 센다', async () => {
    server.on('/big', (_request, response) => {
      response.writeHead(200, { 'content-type': 'text/html', 'content-encoding': 'gzip' })
      response.end(gzipSync('a'.repeat(50_000)))
    })

    const error = await failure(fetchPage(server.url('/big'), { ...local, maxBytes: 10_000 }))

    expect(error).toMatchObject({ kind: 'permanent', reason: 'too_large' })
  })
})
