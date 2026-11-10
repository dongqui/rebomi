import shared from '@rebomi/config/eslint'

// 이 패키지는 React Native에서도 돌아야 한다. tsconfig에 DOM lib이 들어 있어
// window·localStorage 같은 것이 타입체크를 통과하므로, 린트로 막는다.
export default [
  ...shared,
  {
    files: ['src/**/*.ts'],
    rules: {
      'no-restricted-globals': [
        'error',
        { name: 'window', message: 'api-client는 React Native에서도 돌아야 합니다.' },
        { name: 'document', message: 'api-client는 React Native에서도 돌아야 합니다.' },
        { name: 'localStorage', message: 'api-client는 React Native에서도 돌아야 합니다.' },
        { name: 'sessionStorage', message: 'api-client는 React Native에서도 돌아야 합니다.' },
        { name: 'navigator', message: 'api-client는 React Native에서도 돌아야 합니다.' },
        { name: 'XMLHttpRequest', message: 'fetch만 씁니다.' },
      ],
    },
  },
]
