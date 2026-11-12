/** 테스트가 쓰는 페이지 모음. 실제 사이트의 모양을 줄여 놓은 것이다. */

const PARAGRAPHS = [
  '저장만 하고 다시 보지 않는 글이 쌓이는 이유는 저장하는 순간과 필요한 순간이 다르기 때문이다. 읽을 시간이 없어서 저장했는데, 시간이 생겼을 때는 무엇을 저장했는지 기억나지 않는다.',
  '그래서 목록을 잘 정리하는 것만으로는 문제가 풀리지 않는다. 정리된 목록도 열어 보지 않으면 없는 것과 같다. 필요한 것은 적절한 때에 다시 눈앞에 가져다 주는 장치다.',
  '다시 보여 주는 시점을 고르는 일은 생각보다 어렵다. 너무 자주 보여 주면 소음이 되고, 너무 드물면 잊힌다. 사람마다 견딜 수 있는 빈도가 다르다는 점도 고려해야 한다.',
  '이 글에서는 저장한 콘텐츠를 다시 만나게 하는 세 가지 방법을 살펴본다. 하루 한 번의 묶음, 비슷한 주제를 읽을 때의 제안, 그리고 오래 묵은 글의 정리 제안이다.',
]

/** 정상 기사. 제목·설명·이미지와 충분한 본문이 있다. */
export const ARTICLE_HTML = `<!doctype html>
<html lang="ko">
<head>
<meta charset="utf-8">
<title>다시 만나는 글 | 예시 블로그</title>
<meta property="og:title" content="다시 만나는 글">
<meta property="og:description" content="저장한 글을 다시 보게 만드는 방법">
<meta property="og:image" content="/images/cover.png">
<meta name="description" content="메타 설명">
</head>
<body>
<header><nav><a href="/">홈</a> <a href="/about">소개</a></nav></header>
<main>
<article>
<h1>다시 만나는 글</h1>
${PARAGRAPHS.map((paragraph) => `<p>${paragraph}</p>`).join('\n')}
</article>
</main>
<footer><p>© 예시 블로그</p></footer>
</body>
</html>`

export const ARTICLE_FIRST_SENTENCE = '저장만 하고 다시 보지 않는 글이 쌓이는 이유는'

/** 본문이 없는 페이지. 스크립트가 내용을 그리는 앱의 빈 껍데기. */
export const NO_BODY_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<title>앱</title>
<meta property="og:title" content="로그인이 필요한 앱">
<meta property="og:description" content="앱 설명">
<meta property="og:image" content="https://cdn.example.com/app.png">
</head>
<body>
<div id="root"></div>
<script src="/app.js"></script>
</body>
</html>`

/** 메타데이터조차 없는 페이지. */
export const BARE_HTML = '<!doctype html><html><head></head><body></body></html>'
