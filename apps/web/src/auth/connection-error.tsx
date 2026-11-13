'use client'

import { UNREACHABLE_MESSAGE } from './messages'

/** 서버에 닿지 못해 로그인 여부를 모를 때. 로그인 화면으로 보내지 않고 다시 시도하게 한다. */
export function ConnectionError({ onRetry }: { onRetry: () => void }) {
  return (
    <div>
      <p role="alert" style={{ color: '#b00' }}>
        {UNREACHABLE_MESSAGE}
      </p>
      <button type="button" onClick={onRetry}>
        다시 시도
      </button>
    </div>
  )
}
