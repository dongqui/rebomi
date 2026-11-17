import { CONTENT_SAVE_LIMITS } from '@rebomi/api-contract'
import { describe, expect, it } from 'vitest'
import { extractPage } from './extract.js'

const PAGE_URL = 'https://example.com/posts/1?utm_source=x'

function page(html: string): Document {
  return new DOMParser().parseFromString(html, 'text/html')
}

const paragraphs = (count: number, text: string) =>
  Array.from({ length: count }, (_, index) => `<p>${text} ${index + 1}번째 문단입니다.</p>`).join('')

const ARTICLE = `<!doctype html>
<html>
  <head>
    <title>탭 제목 | 사이트</title>
    <meta property="og:title" content="  기사   제목 " />
    <meta property="og:description" content="기사 설명" />
    <meta property="og:image" content="/images/cover.png" />
  </head>
  <body>
    <nav><a href="/">홈</a><a href="/about">소개</a></nav>
    <article>
      <h1>기사 제목</h1>
      ${paragraphs(8, '로그인한 사용자에게만 보이는 긴 본문 문장이 여기에 이어집니다. 충분히 길어야 본문으로 인정됩니다.')}
    </article>
    <footer>저작권 안내</footer>
  </body>
</html>`

describe('extractPage', () => {
  it('기사 페이지에서 제목·설명·대표 이미지와 본문을 뽑는다', () => {
    const result = extractPage(page(ARTICLE), PAGE_URL)

    expect(result.title).toBe('기사 제목')
    expect(result.description).toBe('기사 설명')
    expect(result.imageUrl).toBe('https://example.com/images/cover.png')
    expect(result.body).toContain('로그인한 사용자에게만 보이는 긴 본문 문장')
    expect(result.body).toContain('8번째 문단입니다.')
  })

  it('og 값이 없으면 <title> 과 meta description 을 쓴다', () => {
    const result = extractPage(
      page(
        `<html><head><title>탭 제목</title><meta name="description" content="메타 설명" /></head><body></body></html>`,
      ),
      PAGE_URL,
    )

    expect(result.title).toBe('탭 제목')
    expect(result.description).toBe('메타 설명')
    expect(result.imageUrl).toBeNull()
  })

  it('보고 있는 문서를 고치지 않는다', () => {
    const document = page(ARTICLE)
    const before = document.documentElement.outerHTML

    extractPage(document, PAGE_URL)

    expect(document.documentElement.outerHTML).toBe(before)
  })

  it('기사 구조가 없는 페이지는 화면의 텍스트를 본문으로 쓴다 — 스크립트와 스타일은 빼고', () => {
    const result = extractPage(
      page(`<html><head><title>피드</title></head><body>
        <div><span>작성자</span><span>짧은 게시물 내용</span></div>
        <script>window.secret = '스크립트 내용'</script>
        <style>.a { color: red }</style>
        <noscript>자바스크립트를 켜 주세요</noscript>
      </body></html>`),
      PAGE_URL,
    )

    expect(result.body).toContain('짧은 게시물 내용')
    expect(result.body).not.toContain('스크립트 내용')
    expect(result.body).not.toContain('color: red')
    expect(result.body).not.toContain('자바스크립트를 켜 주세요')
  })

  it('텍스트가 없는 페이지는 본문이 없다', () => {
    const result = extractPage(
      page(`<html><head><title>빈 페이지</title></head><body><img src="a.png" /></body></html>`),
      PAGE_URL,
    )

    expect(result.title).toBe('빈 페이지')
    expect(result.body).toBeNull()
  })

  it('서버가 거부하지 않게 상한에 맞춰 자른다', () => {
    const long = '가'.repeat(CONTENT_SAVE_LIMITS.title + 50)
    const result = extractPage(
      page(`<html><head><title>${long}</title>
        <meta name="description" content="${'나'.repeat(CONTENT_SAVE_LIMITS.description + 50)}" />
        </head><body><article>${paragraphs(5000,'상한을 넘기기 위한 아주 긴 본문 문장입니다. 계속 이어집니다. 끝이 없습니다. 정말 깁니다.')}</article></body></html>`),
      PAGE_URL,
    )

    expect(result.title).toHaveLength(CONTENT_SAVE_LIMITS.title)
    expect(result.description).toHaveLength(CONTENT_SAVE_LIMITS.description)
    expect(result.body).toHaveLength(CONTENT_SAVE_LIMITS.body)
  })

  it.each([
    ['data: 주소', 'data:image/png;base64,AAAA'],
    ['너무 긴 주소', `https://example.com/${'a'.repeat(CONTENT_SAVE_LIMITS.imageUrl)}`],
  ])('대표 이미지가 %s 이면 보내지 않는다', (_name, value) => {
    const result = extractPage(
      page(`<html><head><meta property="og:image" content="${value}" /></head><body></body></html>`),
      PAGE_URL,
    )

    expect(result.imageUrl).toBeNull()
  })

  it('본문의 줄바꿈은 살리고 빈 줄과 줄 안의 공백은 줄인다', () => {
    const result = extractPage(
      page(`<html><body><pre>첫 줄    끝


둘째 줄</pre></body></html>`),
      PAGE_URL,
    )

    expect(result.body).toBe('첫 줄 끝\n\n둘째 줄')
  })
})
