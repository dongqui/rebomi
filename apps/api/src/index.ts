/*
 * 다른 워크스페이스 패키지가 api를 프로세스 안에서 띄울 때 쓰는 입구다
 * (`apps/e2e` 의 연결 테스트). 실행 진입점은 `server.ts` 다 — 이 파일은 환경변수를
 * 읽지 않고 아무것도 띄우지 않는다.
 */
export { buildApp, type BuildAppDeps } from './app.js'
export {
  startJobQueue,
  type JobQueue,
  type StartedJobQueue,
  type StartJobQueueOptions,
} from './jobs.js'
export { signAccessToken } from './auth/tokens.js'
