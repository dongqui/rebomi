/**
 * 큐 이름은 여기 한 곳에만 둔다 — 보내는 쪽(api)과 받는 쪽(worker)이 문자열을
 * 따로 쓰면 조용히 어긋난다. 페이로드 타입도 같은 이유로 여기 둔다.
 */
export const QUEUES = {
  /** 스캐폴드용. 큐와 스케줄러 경로가 살아 있는지 확인한다. */
  NOOP: 'noop',
  /** 저장된 콘텐츠의 서버 측 처리(메타데이터 수집·보조 추출). */
  CONTENT_PROCESS: 'content-process',
} as const

export type QueueName = (typeof QUEUES)[keyof typeof QUEUES]

/**
 * `QUEUES.CONTENT_PROCESS` 의 페이로드. ID만 싣는다 — 잡이 실행될 때 DB에서
 * 최신 행을 읽어야 재시도 사이에 바뀐 상태를 놓치지 않는다.
 */
export type ContentProcessPayload = {
  contentId: string
}
