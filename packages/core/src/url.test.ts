import { describe, it, expect } from 'vitest'
import { domainOf, normalizeUrl, InvalidUrlError } from './index.js'

describe('normalizeUrl', () => {
  it('트래킹 파라미터를 제거한다', () => {
    expect(normalizeUrl('https://a.com/p?utm_source=x&id=7&fbclid=y&gclid=z&igshid=w&ref=r')).toBe(
      'https://a.com/p?id=7',
    )
  })

  it('호스트를 소문자로, 기본 포트를 제거한다', () => {
    expect(normalizeUrl('HTTPS://A.com:443/p')).toBe('https://a.com/p')
    expect(normalizeUrl('http://a.com:80/p')).toBe('http://a.com/p')
  })

  it('프래그먼트를 제거한다', () => {
    expect(normalizeUrl('https://a.com/p#section')).toBe('https://a.com/p')
  })

  it('빈 경로의 끝 슬래시를 제거한다', () => {
    expect(normalizeUrl('https://a.com/')).toBe('https://a.com')
  })

  it('남은 쿼리 파라미터를 정렬해 순서만 다른 URL을 같게 만든다', () => {
    expect(normalizeUrl('https://a.com/p?b=2&a=1')).toBe(normalizeUrl('https://a.com/p?a=1&b=2'))
  })

  // Review Focus 1
  it('URL이 아닌 입력에 InvalidUrlError를 던진다', () => {
    for (const bad of ['', 'not a url', '/relative/path', 'a.com/p']) {
      expect(() => normalizeUrl(bad)).toThrow(InvalidUrlError)
    }
  })

  it('http·https가 아닌 스킴에 InvalidUrlError를 던진다', () => {
    for (const bad of [
      'javascript:alert(1)',
      'data:text/html,x',
      'file:///etc/passwd',
      'ftp://a.com/p',
    ]) {
      expect(() => normalizeUrl(bad)).toThrow(InvalidUrlError)
    }
  })
})

describe('domainOf', () => {
  it('호스트를 소문자로 돌려준다', () => {
    expect(domainOf('https://Example.COM/a?b=1')).toBe('example.com')
  })

  it('앞의 www. 만 뗀다', () => {
    expect(domainOf('https://www.reddit.com/r/x')).toBe('reddit.com')
    expect(domainOf('https://old.reddit.com/r/x')).toBe('old.reddit.com')
    expect(domainOf('https://m.youtube.com/watch?v=1')).toBe('m.youtube.com')
    expect(domainOf('https://wwwexample.com')).toBe('wwwexample.com')
  })

  it('포트는 넣지 않는다', () => {
    expect(domainOf('http://localhost:8080/a')).toBe('localhost')
  })

  it('http(s) URL이 아니면 InvalidUrlError를 던진다', () => {
    expect(() => domainOf('ftp://a.com')).toThrow(InvalidUrlError)
    expect(() => domainOf('not a url')).toThrow(InvalidUrlError)
  })
})
