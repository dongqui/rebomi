import { describe, expect, it } from 'vitest'
import { createResponseSaver } from './response-saver'

/** 요청을 테스트가 원하는 때에 끝낼 수 있는 가짜 전송. */
function manualSend() {
  const calls: { body: string; resolve: () => void; reject: (error: Error) => void }[] = []
  const send = (body: string) =>
    new Promise<void>((resolve, reject) => {
      calls.push({ body, resolve, reject })
    })
  return { calls, send }
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('createResponseSaver', () => {
  it('보내는 것이 없으면 바로 보낸다', () => {
    const { calls, send } = manualSend()
    const saver = createResponseSaver(send)

    void saver.save('a')

    expect(calls.map((call) => call.body)).toEqual(['a'])
  })

  it('보내는 중에 온 것은 기다렸다가, 앞 요청이 끝나면 가장 최신 것만 보낸다', async () => {
    const { calls, send } = manualSend()
    const saver = createResponseSaver(send)

    void saver.save('a')
    void saver.save('b')
    void saver.save('c')
    expect(calls.map((call) => call.body)).toEqual(['a'])

    calls[0]!.resolve()
    await settle()

    expect(calls.map((call) => call.body)).toEqual(['a', 'c'])
  })

  it('앞 요청이 실패해도 기다리던 최신 것을 보낸다', async () => {
    const { calls, send } = manualSend()
    const saver = createResponseSaver(send)

    const first = saver.save('a')
    void saver.save('b')
    calls[0]!.reject(new Error('offline'))
    await expect(first).rejects.toThrow('offline')
    await settle()

    expect(calls.map((call) => call.body)).toEqual(['a', 'b'])
  })

  it('돌려준 약속은 그 내용을 실어 보낸 요청의 결과를 따른다', async () => {
    const { calls, send } = manualSend()
    const saver = createResponseSaver(send)

    void saver.save('a')
    const superseded = saver.save('b')
    const latest = saver.save('c')
    calls[0]!.resolve()
    await settle()
    calls[1]!.reject(new Error('failed'))

    // 'b' 는 따로 가지 않았다. 'c' 가 그 내용을 포함하므로 같은 결과를 받는다.
    await expect(superseded).rejects.toThrow('failed')
    await expect(latest).rejects.toThrow('failed')
  })

  it('다 끝난 뒤에 온 것은 다시 바로 보낸다', async () => {
    const { calls, send } = manualSend()
    const saver = createResponseSaver(send)

    const first = saver.save('a')
    calls[0]!.resolve()
    await first
    void saver.save('b')

    expect(calls.map((call) => call.body)).toEqual(['a', 'b'])
  })
})
