import { describe, expect, it } from 'vitest'
import { CONTENT_PROCESS_RETRY, QUEUES, type ContentProcessPayload } from './index.js'

describe('QUEUES', () => {
  it('콘텐츠 처리 큐와 스캐폴드의 noop 큐를 정의한다', () => {
    expect(QUEUES.CONTENT_PROCESS).toBe('content-process')
    expect(QUEUES.NOOP).toBe('noop')
  })

  it('큐 이름이 서로 겹치지 않는다', () => {
    const names = Object.values(QUEUES)
    expect(new Set(names).size).toBe(names.length)
  })

  it('큐 이름이 pg-boss가 허용하는 문자만 쓴다', () => {
    for (const name of Object.values(QUEUES)) {
      expect(name).toMatch(/^[A-Za-z0-9_.-]+$/)
    }
  })
})

describe('ContentProcessPayload', () => {
  it('처리할 콘텐츠의 ID만 싣는다', () => {
    const payload: ContentProcessPayload = { contentId: '0b0e7c7e-7b1f-4d0a-9d55-0d6f2f1f6a11' }
    expect(Object.keys(payload)).toEqual(['contentId'])
  })
})

describe('CONTENT_PROCESS_RETRY', () => {
  it('일시 오류를 최대 3번, 30초부터 간격을 늘려 가며 다시 시도한다', () => {
    expect(CONTENT_PROCESS_RETRY).toEqual({ retryLimit: 3, retryDelay: 30, retryBackoff: true })
  })
})
