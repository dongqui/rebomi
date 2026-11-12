import { describe, expect, it } from 'vitest'
import { EXTRACT_LIMITS, extractPage } from './extract.js'
import { ARTICLE_FIRST_SENTENCE, ARTICLE_HTML, BARE_HTML, NO_BODY_HTML } from './testing/pages.js'

const PAGE_URL = 'https://blog.example.com/posts/1'

const page = (head: string, body = '') =>
  `<!doctype html><html><head>${head}</head><body>${body}</body></html>`

describe('extractPage()', () => {
  it('기사에서 제목·설명·이미지와 본문을 뽑는다', () => {
    const result = extractPage(ARTICLE_HTML, PAGE_URL)

    expect(result.title).toBe('다시 만나는 글')
    expect(result.description).toBe('저장한 글을 다시 보게 만드는 방법')
    expect(result.imageUrl).toBe('https://blog.example.com/images/cover.png')
    expect(result.bodyText).toContain(ARTICLE_FIRST_SENTENCE)
    expect(result.bodyText).toContain('오래 묵은 글의 정리 제안이다.')
  })

  it('본문에 태그와 메뉴·바닥글을 남기지 않는다', () => {
    const { bodyText } = extractPage(ARTICLE_HTML, PAGE_URL)

    expect(bodyText).not.toMatch(/<\/?[a-z]/i)
    expect(bodyText).not.toContain('소개')
    expect(bodyText).not.toContain('©')
  })

  it('본문이 없는 페이지는 메타데이터만 주고 본문은 null이다', () => {
    expect(extractPage(NO_BODY_HTML, PAGE_URL)).toEqual({
      title: '로그인이 필요한 앱',
      description: '앱 설명',
      imageUrl: 'https://cdn.example.com/app.png',
      bodyText: null,
    })
  })

  it('아무것도 없는 페이지는 전부 null이다', () => {
    expect(extractPage(BARE_HTML, PAGE_URL)).toEqual({
      title: null,
      description: null,
      imageUrl: null,
      bodyText: null,
    })
  })

  it('og:title이 없으면 title 태그를 쓴다', () => {
    expect(extractPage(page('<title>  문서\n 제목 </title>'), PAGE_URL).title).toBe('문서 제목')
  })

  it('og:description이 없으면 meta description을 쓴다', () => {
    const result = extractPage(page('<meta name="description" content="메타 설명">'), PAGE_URL)

    expect(result.description).toBe('메타 설명')
  })

  it('og:image가 없으면 twitter:image를 쓴다', () => {
    const result = extractPage(
      page('<meta name="twitter:image" content="//cdn.example.com/t.png">'),
      PAGE_URL,
    )

    expect(result.imageUrl).toBe('https://cdn.example.com/t.png')
  })

  it.each(['javascript:alert(1)', 'data:image/png;base64,AAAA', 'http://'])(
    'http(s)가 아닌 이미지 주소 %s 는 버린다',
    (image) => {
      const result = extractPage(page(`<meta property="og:image" content="${image}">`), PAGE_URL)

      expect(result.imageUrl).toBeNull()
    },
  )

  it('내용이 빈 메타 태그는 없는 것으로 본다', () => {
    const result = extractPage(
      page('<meta property="og:title" content="  "><title>대신 쓰는 제목</title>'),
      PAGE_URL,
    )

    expect(result.title).toBe('대신 쓰는 제목')
  })

  it('짧은 글도 Readability가 뽑으면 본문이다', () => {
    const result = extractPage(
      page('<title>짧은 글</title>', '<article><p>한 줄짜리 글입니다.</p></article>'),
      PAGE_URL,
    )

    expect(result.bodyText).toBe('한 줄짜리 글입니다.')
  })

  it('너무 긴 값은 상한에서 자르고 NUL 문자를 뺀다', () => {
    const longTitle = '가'.repeat(EXTRACT_LIMITS.title + 50)
    const paragraphs = Array.from({ length: 30 }, () => `<p>${'나'.repeat(9_000)}.</p>`).join('')

    const result = extractPage(
      page(`<title>${longTitle}</title>`, `<article>${paragraphs}<p>끝\u0000문장</p></article>`),
      PAGE_URL,
    )

    expect(result.title).toHaveLength(EXTRACT_LIMITS.title)
    expect(result.bodyText).toHaveLength(EXTRACT_LIMITS.bodyText)
    expect(extractPage(page('<title>a\u0000b</title>'), PAGE_URL).title).toBe('ab')
  })

  it('깨진 HTML에도 던지지 않는다', () => {
    expect(() =>
      extractPage('<html><head><title>깨진</title><body><div><p>열린 채', PAGE_URL),
    ).not.toThrow()
    expect(() => extractPage('', PAGE_URL)).not.toThrow()
  })
})
