import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import type { AddressInfo } from 'node:net'

/**
 * 테스트용 로컬 HTTP 서버. 외부 사이트를 부르지 않고 페이지 가져오기를 검증한다.
 * 경로마다 응답을 정하고, 경로별 요청 횟수를 센다.
 */
export type FixtureHandler = (
  request: IncomingMessage,
  response: ServerResponse,
  /** 이 경로가 불린 횟수. 첫 요청이 1. */
  hit: number,
) => void

export type FixtureServer = {
  /** `http://127.0.0.1:<port>` */
  readonly origin: string
  url(path: string): string
  on(path: string, handler: FixtureHandler): void
  hits(path: string): number
  userAgents(path: string): string[]
  close(): Promise<void>
}

export const FIXTURE_ADDRESS = '127.0.0.1'

export function html(response: ServerResponse, body: string | Buffer, contentType?: string): void {
  response.writeHead(200, { 'content-type': contentType ?? 'text/html; charset=utf-8' })
  response.end(body)
}

export async function startFixtureServer(): Promise<FixtureServer> {
  const handlers = new Map<string, FixtureHandler>()
  const hits = new Map<string, number>()
  const userAgents = new Map<string, string[]>()

  const server = createServer((request, response) => {
    const path = new URL(request.url ?? '/', 'http://fixture').pathname
    const hit = (hits.get(path) ?? 0) + 1
    hits.set(path, hit)
    userAgents.set(path, [...(userAgents.get(path) ?? []), request.headers['user-agent'] ?? ''])

    const handler = handlers.get(path)
    if (!handler) {
      response.writeHead(404, { 'content-type': 'text/plain' })
      response.end('not found')
      return
    }
    handler(request, response, hit)
  })

  await new Promise<void>((resolve) => server.listen(0, FIXTURE_ADDRESS, resolve))
  const { port } = server.address() as AddressInfo
  const origin = `http://${FIXTURE_ADDRESS}:${port}`

  return {
    origin,
    url: (path) => `${origin}${path}`,
    on: (path, handler) => void handlers.set(path, handler),
    hits: (path) => hits.get(path) ?? 0,
    userAgents: (path) => userAgents.get(path) ?? [],
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.closeAllConnections()
        server.close((error) => (error ? reject(error) : resolve()))
      }),
  }
}
