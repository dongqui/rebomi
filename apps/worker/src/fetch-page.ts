import { lookup as dnsLookup, type LookupAddress } from 'node:dns'
import http, { type IncomingMessage } from 'node:http'
import https from 'node:https'
import { BlockList, isIP, type LookupFunction } from 'node:net'
import { createBrotliDecompress, createGunzip, createInflate } from 'node:zlib'

/**
 * 저장된 URL의 페이지를 가져온다 (capture.md §5의 서버 측 보조 추출).
 *
 * 주소는 사용자가 넣은 값이라 믿지 않는다. 내부망·루프백·링크 로컬 주소로는 나가지
 * 않고, 리다이렉트도 한 번씩 직접 따라가며 다시 검사한다.
 */

/** 봇임을 밝힌다. 브라우저 호환 형식이라 단순한 UA 필터는 통과한다. */
export const USER_AGENT = 'Mozilla/5.0 (compatible; RebomiBot/0.1)'

export const FETCH_LIMITS = {
  /** 리다이렉트를 포함한 전체 요청의 제한 시간. */
  timeoutMs: 10_000,
  /** 압축을 푼 뒤의 응답 크기 상한. */
  maxBytes: 5 * 1024 * 1024,
  maxRedirects: 5,
} as const

/** 실패의 종류. `transient` 만 다시 시도할 가치가 있다. */
export type FetchFailureKind = 'transient' | 'permanent'

export type FetchFailureReason =
  | 'network'
  | 'timeout'
  | 'http_status'
  | 'blocked_address'
  | 'unsupported_protocol'
  | 'too_many_redirects'
  | 'bad_redirect'
  | 'not_html'
  | 'too_large'

export class FetchPageError extends Error {
  constructor(
    readonly kind: FetchFailureKind,
    readonly reason: FetchFailureReason,
    message: string,
    options?: { cause?: unknown },
  ) {
    super(message, options)
    this.name = 'FetchPageError'
  }
}

export type FetchedPage = {
  /** 리다이렉트를 다 따라간 뒤의 주소. 상대 경로 이미지를 풀 때 기준이 된다. */
  url: string
  html: string
}

export type FetchPageOptions = {
  timeoutMs?: number
  maxBytes?: number
  maxRedirects?: number
  /**
   * 차단에서 빼 줄 주소. 테스트의 로컬 픽스처 서버(127.0.0.1)를 위한 것이다.
   * 운영 코드는 넘기지 않는다.
   */
  allowedAddresses?: readonly string[]
}

const blocked = new BlockList()
for (const [network, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv4')
}
for (const [network, prefix] of [
  ['::', 128],
  ['::1', 128],
  // `::ffff:0:0/96`(IPv4를 감싼 주소)은 넣지 않는다 — BlockList가 IPv4 전체를 그 범위로
  // 보아 공인 주소까지 막는다. 감싼 주소는 BlockList가 위 IPv4 규칙으로 판정한다.
  ['64:ff9b::', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
] as const) {
  blocked.addSubnet(network, prefix, 'ipv6')
}

/** 공인 인터넷 주소인가. IP 문자열이 아니면 false. */
export function isPublicAddress(address: string): boolean {
  const family = isIP(address)
  if (family === 0) return false
  return !blocked.check(address, family === 4 ? 'ipv4' : 'ipv6')
}

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])
/** 잠시 뒤 다시 하면 될 수 있는 응답. */
const TRANSIENT_STATUSES = new Set([408, 425, 429])

type Guard = (address: string) => boolean

function createGuardedLookup(isAllowed: Guard): LookupFunction {
  // 연결 직전의 DNS 결과를 검사한다. 미리 한 번 풀어 보고 나중에 다시 풀면, 그 사이에
  // 답을 바꾸는 호스트(DNS rebinding)를 놓친다.
  return (hostname, options, callback) => {
    dnsLookup(hostname, { ...options, all: true }, (error, addresses) => {
      if (error) return callback(error, '', 4)

      const list = addresses as unknown as LookupAddress[]
      const refused = list.find((entry) => !isAllowed(entry.address))
      if (refused || list.length === 0) {
        return callback(
          new FetchPageError(
            'permanent',
            'blocked_address',
            `허용되지 않는 주소로 풀렸습니다: ${hostname}`,
          ),
          '',
          4,
        )
      }

      if (options.all) return callback(null, list)
      callback(null, list[0]!.address, list[0]!.family)
    })
  }
}

type RawResponse = {
  status: number
  headers: IncomingMessage['headers']
  body: Buffer
}

function requestOnce(
  url: URL,
  options: { isAllowed: Guard; maxBytes: number; signal: AbortSignal },
): Promise<RawResponse> {
  // URL은 IPv6 리터럴을 대괄호로 감싼다.
  const host = url.hostname.replace(/^\[|\]$/g, '')
  // IP 리터럴은 DNS를 거치지 않으므로 lookup이 불리지 않는다. 여기서 직접 본다.
  if (isIP(host) !== 0 && !options.isAllowed(host)) {
    return Promise.reject(
      new FetchPageError('permanent', 'blocked_address', `허용되지 않는 주소입니다: ${host}`),
    )
  }

  const transport = url.protocol === 'https:' ? https : http

  return new Promise<RawResponse>((resolve, reject) => {
    const request = transport.request(
      url,
      {
        method: 'GET',
        // 연결을 재사용하지 않는다. 재사용하면 주소 검사를 건너뛴다.
        agent: false,
        lookup: createGuardedLookup(options.isAllowed),
        signal: options.signal,
        headers: {
          'user-agent': USER_AGENT,
          accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.1',
          'accept-encoding': 'gzip, deflate, br',
          'accept-language': 'ko,en;q=0.8',
        },
      },
      (response) => {
        const status = response.statusCode ?? 0

        // 본문을 읽을 이유가 없는 응답은 바로 놓는다.
        if (status < 200 || status >= 300) {
          response.destroy()
          return resolve({ status, headers: response.headers, body: Buffer.alloc(0) })
        }

        const encoding = String(response.headers['content-encoding'] ?? '')
          .trim()
          .toLowerCase()
        const decoder =
          encoding === 'gzip' || encoding === 'x-gzip'
            ? createGunzip()
            : encoding === 'deflate'
              ? createInflate()
              : encoding === 'br'
                ? createBrotliDecompress()
                : null
        const stream = decoder ? response.pipe(decoder) : response

        const chunks: Buffer[] = []
        let size = 0

        stream.on('data', (chunk: Buffer) => {
          size += chunk.length
          // 푼 뒤의 크기로 센다 — 작게 압축된 거대한 응답을 막는다.
          if (size > options.maxBytes) {
            request.destroy()
            reject(new FetchPageError('permanent', 'too_large', '응답이 너무 큽니다'))
            return
          }
          chunks.push(chunk)
        })
        stream.on('end', () =>
          resolve({ status, headers: response.headers, body: Buffer.concat(chunks) }),
        )
        stream.on('error', reject)
        response.on('error', reject)
      },
    )

    request.on('error', reject)
    request.end()
  })
}

function contentTypeOf(headers: IncomingMessage['headers']): { type: string; charset?: string } {
  const header = String(headers['content-type'] ?? '')
  const [type = '', ...parameters] = header.split(';')
  const charset = parameters
    .map((parameter) => /^\s*charset\s*=\s*"?([^";\s]+)"?/i.exec(parameter)?.[1])
    .find((value) => value !== undefined)
  return { type: type.trim().toLowerCase(), charset }
}

/** 문서 앞부분의 `<meta charset>` 선언. 한국 사이트에는 EUC-KR이 아직 많다. */
function sniffCharset(body: Buffer): string | undefined {
  const head = body.subarray(0, 4096).toString('latin1')
  return /<meta[^>]+charset\s*=\s*["']?\s*([a-z0-9_-]+)/i.exec(head)?.[1]
}

function decode(body: Buffer, charset: string | undefined): string {
  if (charset) {
    try {
      return new TextDecoder(charset).decode(body)
    } catch {
      // 모르는 이름이면 UTF-8로 읽는다.
    }
  }
  return new TextDecoder('utf-8').decode(body)
}

function toFetchPageError(error: unknown, signal: AbortSignal): FetchPageError {
  if (error instanceof FetchPageError) return error
  // lookup이 던진 차단 오류는 소켓 오류로 감싸여 올 수 있다.
  const cause = (error as { cause?: unknown } | null)?.cause
  if (cause instanceof FetchPageError) return cause

  if (signal.aborted) {
    return new FetchPageError('transient', 'timeout', '응답을 시간 안에 받지 못했습니다', {
      cause: error,
    })
  }
  return new FetchPageError('transient', 'network', '페이지에 연결하지 못했습니다', {
    cause: error,
  })
}

/**
 * 페이지 하나를 가져와 HTML 문자열로 돌려준다.
 *
 * 실패는 모두 `FetchPageError` 다. `kind` 가 `transient` 인 것만 다시 시도한다.
 */
export async function fetchPage(
  target: string,
  options: FetchPageOptions = {},
): Promise<FetchedPage> {
  const timeoutMs = options.timeoutMs ?? FETCH_LIMITS.timeoutMs
  const maxBytes = options.maxBytes ?? FETCH_LIMITS.maxBytes
  const maxRedirects = options.maxRedirects ?? FETCH_LIMITS.maxRedirects
  const allowed = new Set(options.allowedAddresses ?? [])
  const isAllowed: Guard = (address) => allowed.has(address) || isPublicAddress(address)

  const signal = AbortSignal.timeout(timeoutMs)

  let url: URL
  try {
    url = new URL(target)
  } catch {
    throw new FetchPageError('permanent', 'unsupported_protocol', '주소를 읽을 수 없습니다')
  }

  for (let redirects = 0; ; redirects += 1) {
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new FetchPageError('permanent', 'unsupported_protocol', 'http(s) 주소가 아닙니다')
    }

    let response: RawResponse
    try {
      response = await requestOnce(url, { isAllowed, maxBytes, signal })
    } catch (error) {
      throw toFetchPageError(error, signal)
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      if (redirects >= maxRedirects) {
        throw new FetchPageError('permanent', 'too_many_redirects', '리다이렉트가 너무 많습니다')
      }
      const location = response.headers.location
      if (!location) {
        throw new FetchPageError('permanent', 'bad_redirect', '리다이렉트에 주소가 없습니다')
      }
      try {
        url = new URL(location, url)
      } catch {
        throw new FetchPageError('permanent', 'bad_redirect', '리다이렉트 주소를 읽을 수 없습니다')
      }
      continue
    }

    if (response.status < 200 || response.status >= 300) {
      const transient = response.status >= 500 || TRANSIENT_STATUSES.has(response.status)
      throw new FetchPageError(
        transient ? 'transient' : 'permanent',
        'http_status',
        `페이지가 ${response.status} 로 응답했습니다`,
      )
    }

    const { type, charset } = contentTypeOf(response.headers)
    // 종류를 밝히지 않은 응답은 HTML로 보고 읽어 본다.
    if (type !== '' && type !== 'text/html' && type !== 'application/xhtml+xml') {
      throw new FetchPageError('permanent', 'not_html', `HTML이 아닙니다: ${type}`)
    }

    return {
      url: url.toString(),
      html: decode(response.body, charset ?? sniffCharset(response.body)),
    }
  }
}
