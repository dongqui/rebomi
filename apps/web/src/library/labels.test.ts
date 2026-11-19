import { describe, expect, it } from 'vitest'
import { APP_COPY } from '@/shell/copy'
import { formatSaved } from './labels'

// 보는 사람의 시간대로 만든 시각이다 — 어느 시간대에서 돌려도 날짜 경계가 같다.
const NOW = new Date(2026, 10, 19, 15, 0, 0)
const ago = (ms: number) => new Date(NOW.getTime() - ms).toISOString()
const at = (...args: [number, number, number, number, number]) => new Date(...args).toISOString()

const MINUTE = 60_000
const HOUR = 60 * MINUTE

describe('formatSaved', () => {
  it.each([
    ['30초 전', ago(30_000), '방금', 'Just now'],
    ['5분 전', ago(5 * MINUTE), '5분 전', '5 minutes ago'],
    ['3시간 전', ago(3 * HOUR), '3시간 전', '3 hours ago'],
    ['어제 밤 (16시간 전)', at(2026, 10, 18, 23, 0), '어제', 'Yesterday'],
    ['2일 전', at(2026, 10, 17, 9, 0), '2일 전', '2 days ago'],
    ['6일 전', at(2026, 10, 13, 23, 59), '6일 전', '6 days ago'],
    ['7일 전부터는 날짜', at(2026, 10, 12, 9, 0), '2026. 11. 12.', 'Nov 12, 2026'],
    ['시계가 어긋나 미래로 보이는 것', ago(-5 * MINUTE), '방금', 'Just now'],
  ])('%s', (_name, savedAt, ko, en) => {
    expect(formatSaved(savedAt, NOW, 'ko', APP_COPY.ko)).toBe(ko)
    expect(formatSaved(savedAt, NOW, 'en', APP_COPY.en)).toBe(en)
  })
})
