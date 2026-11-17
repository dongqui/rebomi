import { describe, expect, it } from 'vitest'
import { loginUrl } from './login-url.js'

describe('loginUrl', () => {
  it('웹 오리진에 /login 을 붙인다', () => {
    expect(loginUrl('http://localhost:3000')).toBe('http://localhost:3000/login')
  })

  it('오리진 끝의 / 를 겹쳐 쓰지 않는다', () => {
    expect(loginUrl('https://rebomi.example/')).toBe('https://rebomi.example/login')
  })
})
