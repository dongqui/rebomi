import type { ComponentType } from 'react'

/**
 * 로그인 수단 하나가 받는 것. 수단은 자기 버튼(또는 폼)을 그리고, 자격을 얻으면 `attempt`
 * 로 로그인을 실행한다. 진행 표시·오류 문구·화면 이동은 로그인 화면이 맡는다.
 *
 * 수단이 서버에 무엇을 보내는지는 로그인 화면이 모른다 — Google·Apple은 신원 토큰을
 * 보내지만, 나중에 이메일 로그인이 생기면 다른 요청을 같은 `attempt` 로 실행하면 된다.
 */
export type LoginMethodProps = {
  /** 다른 로그인이 진행 중이다. */
  disabled: boolean
  /** 로그인을 실행한다. `run` 이 던지면 로그인 화면이 이유를 보인다. */
  attempt(run: () => Promise<void>): void
  /** 서버에 보내기 전에 끝났다(취소, 제공자 쪽 실패). 사용자에게 보일 문구를 넘긴다. */
  fail(message: string): void
}

/** 로그인 화면에 나열되는 수단. 새 수단은 이 모양으로 만들어 목록에 넣는다. */
export type LoginMethod = {
  id: string
  Component: ComponentType<LoginMethodProps>
}
