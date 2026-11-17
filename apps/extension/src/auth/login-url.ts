/** 웹 로그인 페이지의 주소. 웹 오리진 끝의 `/` 는 있어도 없어도 된다. */
export function loginUrl(webBaseUrl: string): string {
  return `${webBaseUrl.replace(/\/+$/, '')}/login`
}
