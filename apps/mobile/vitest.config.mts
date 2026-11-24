import { defineConfig } from 'vitest/config'

// 여기서 도는 것은 React Native를 불러오지 않는 순수 로직뿐이다(토큰 저장소, 세션, 주소 해석).
// 화면 컴포넌트 테스트는 아직 없다.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
