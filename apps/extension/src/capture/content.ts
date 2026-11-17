import { CAPTURE_RESULT_KEY } from './capture-tab.js'
import { extractPage } from './extract.js'

/**
 * 사용자가 확장 버튼을 누른 탭에 그때 한 번 넣는 스크립트. 상시 실행되지 않는다.
 *
 * 페이지와 분리된 세계(isolated world)에서 돌고, 뽑은 결과를 그 세계의 전역에 둔다 —
 * 팝업이 바로 이어서 읽어 간다. 페이지의 스크립트는 이 값을 볼 수 없다.
 */
;(globalThis as Record<string, unknown>)[CAPTURE_RESULT_KEY] = extractPage(document, location.href)
