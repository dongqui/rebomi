import { describe, expect, it } from 'vitest'
import { createTokenStore } from './token-store'

const tokens = { accessToken: 'a', refreshToken: null }

describe('createTokenStore', () => {
  it('저장한 토큰을 돌려준다', () => {
    const store = createTokenStore()
    expect(store.get()).toBeNull()
    store.set(tokens)
    expect(store.get()).toEqual(tokens)
  })

  it('바뀔 때마다 구독자에게 알리고, 구독을 끊으면 알리지 않는다', () => {
    const store = createTokenStore()
    const seen: unknown[] = []
    const unsubscribe = store.subscribe((next) => seen.push(next))

    store.set(tokens)
    store.set(null)
    unsubscribe()
    store.set(tokens)

    expect(seen).toEqual([tokens, null])
  })
})
