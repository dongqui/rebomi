import { describe, expect, it, vi } from 'vitest'
import { fakeStorage } from '../test/fake-api'
import { createTokenStore } from './token-store'

describe('createTokenStore', () => {
  it('저장된 갱신 토큰이 없으면 null이다', async () => {
    const store = createTokenStore(fakeStorage())
    expect(await store.get()).toBeNull()
  })

  it('앱을 다시 연 직후에는 갱신 토큰만 있고 액세스 토큰은 비어 있다', async () => {
    const store = createTokenStore(fakeStorage('stored-refresh'))
    expect(await store.get()).toEqual({ accessToken: '', refreshToken: 'stored-refresh' })
  })

  it('보안 저장소는 한 번만 읽는다', async () => {
    const storage = fakeStorage('stored-refresh')
    const read = vi.spyOn(storage, 'read')
    const store = createTokenStore(storage)

    await store.get()
    await store.get()

    expect(read).toHaveBeenCalledTimes(1)
  })

  it('갱신 토큰만 보안 저장소에 쓴다 — 액세스 토큰은 쓰지 않는다', async () => {
    const storage = fakeStorage()
    const store = createTokenStore(storage)

    await store.set({ accessToken: 'access-1', refreshToken: 'refresh-1' })

    expect(storage.writes).toEqual(['refresh-1'])
    expect(await store.get()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' })
  })

  it('액세스 토큰만 바뀌면 저장소에 다시 쓰지 않는다', async () => {
    const storage = fakeStorage('refresh-1')
    const store = createTokenStore(storage)
    await store.get()

    await store.set({ accessToken: 'access-2', refreshToken: 'refresh-1' })

    expect(storage.writes).toEqual([])
    expect(await store.get()).toEqual({ accessToken: 'access-2', refreshToken: 'refresh-1' })
  })

  it('null을 넣으면 저장소에서 지운다', async () => {
    const storage = fakeStorage('refresh-1')
    const store = createTokenStore(storage)

    await store.set(null)

    expect(storage.value).toBeNull()
    expect(await store.get()).toBeNull()
  })

  it('갱신 토큰이 없는 토큰은 보관하지 않는다', async () => {
    const storage = fakeStorage('refresh-1')
    const store = createTokenStore(storage)

    await store.set({ accessToken: 'access-1', refreshToken: null })

    expect(storage.value).toBeNull()
    expect(await store.get()).toBeNull()
  })

  it('구독자에게 바뀐 토큰을 알리고, 구독을 끊으면 알리지 않는다', async () => {
    const store = createTokenStore(fakeStorage())
    const listener = vi.fn()
    const unsubscribe = store.subscribe(listener)

    await store.set({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    await store.set(null)
    unsubscribe()
    await store.set({ accessToken: 'access-2', refreshToken: 'refresh-2' })

    expect(listener.mock.calls).toEqual([
      [{ accessToken: 'access-1', refreshToken: 'refresh-1' }],
      [null],
    ])
  })

  it('저장소에서 지우지 못해도 메모리에서는 지우고 구독자에게 알린다', async () => {
    const storage = fakeStorage('refresh-1')
    const store = createTokenStore(storage)
    await store.set({ accessToken: 'access-1', refreshToken: 'refresh-1' })
    const listener = vi.fn()
    store.subscribe(listener)
    storage.broken = true

    await expect(store.set(null)).rejects.toThrow()

    storage.broken = false
    expect(listener).toHaveBeenCalledWith(null)
    expect(await store.get()).toBeNull()
  })
})
