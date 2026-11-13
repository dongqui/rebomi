import { ApiError } from '@rebomi/api-client'
import { ERROR_CODES, type ExtractionLevel, type MetadataStatus } from '@rebomi/api-contract'
import { UNREACHABLE_MESSAGE } from '@/auth/messages'

/** 추출 수준을 화면에 보이는 말로 (capture.md CAP-7). */
export const EXTRACTION_LABELS: Record<ExtractionLevel, string> = {
  full: '본문',
  partial: '일부',
  metadata_only: '메타데이터만',
}

/** 서버 측 메타데이터 수집의 처리 상태를 화면에 보이는 말로. */
export const METADATA_LABELS: Record<MetadataStatus, string> = {
  pending: '처리 중',
  done: '완료',
  failed: '실패',
}

const savedDateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium' })

/** 저장일. 보는 사람의 시간대 기준 날짜다. */
export function formatSavedDate(savedAt: string): string {
  return savedDateFormat.format(new Date(savedAt))
}

/** 서버에 닿지 못한 오류인가. */
function isUnreachable(error: unknown): boolean {
  return error instanceof ApiError && error.code === ERROR_CODES.NETWORK
}

/** 저장 실패를 사용자에게 보일 문구로 바꾼다. 분기는 에러 코드로만 한다. */
export function saveErrorMessage(error: unknown): string {
  if (isUnreachable(error)) return UNREACHABLE_MESSAGE
  if (error instanceof ApiError && error.code === ERROR_CODES.VALIDATION_FAILED) {
    return 'http 또는 https 주소만 저장할 수 있습니다.'
  }
  return '저장하지 못했습니다. 다시 시도해 주세요.'
}

/** 목록을 받지 못한 이유를 사용자에게 보일 문구로 바꾼다. */
export function listErrorMessage(error: unknown): string {
  return isUnreachable(error)
    ? UNREACHABLE_MESSAGE
    : '목록을 불러오지 못했습니다. 다시 시도해 주세요.'
}
