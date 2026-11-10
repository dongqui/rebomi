import { createApiClient } from '@rebomi/api-client'

const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL

// 조용히 localhost로 폴백하지 않는다 — 잘못된 주소를 가리키는 앱이 더 나쁘다.
if (!baseUrl) {
  throw new Error('NEXT_PUBLIC_API_BASE_URL이 없습니다. `cp .env.example .env` 를 실행하세요.')
}

export const api = createApiClient({ baseUrl })
export const apiBaseUrl = baseUrl
