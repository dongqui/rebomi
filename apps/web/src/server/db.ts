import { createDb, type Db } from '@rebomi/db'

/*
 * 이 웹의 서버 쪽(`/api`)이 쓰는 DB 연결. 대기 명단 응답 저장만 쓴다.
 *
 * 서버리스 인스턴스 하나가 풀 하나를 갖고 요청 사이에 다시 쓴다. 개발 서버가 모듈을 다시
 * 읽어도 풀이 늘지 않게 전역에 둔다.
 */

const holder = globalThis as { rebomiWebDb?: Db }

/** `DATABASE_URL` 이 없으면 `null` — 로컬 개발은 API 서버로 저장하므로 없어도 웹은 뜬다. */
export function serverDb(): Db | null {
  const url = process.env.DATABASE_URL
  if (!url) return null
  holder.rebomiWebDb ??= createDb(url)
  return holder.rebomiWebDb
}
