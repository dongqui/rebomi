/** `normalizeUrl` 이 http(s) URL로 해석할 수 없는 입력을 받았을 때 던진다. */
export class InvalidUrlError extends Error {
  readonly input: string

  constructor(input: string) {
    super(`유효한 http(s) URL이 아닙니다: ${JSON.stringify(input)}`)
    this.name = 'InvalidUrlError'
    this.input = input
  }
}
