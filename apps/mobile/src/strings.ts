/**
 * 화면 문구. 로그인 화면의 제목·부제·버튼·기본 오류 문구는 디자인(RebomiLogin)의 것이다.
 * 기기 언어가 한국어면 한국어, 아니면 영어.
 */
const ko = {
  login: {
    title: 'Rebomi에 로그인',
    sub: '저장해 두고 잊은 것들을 다시 만나 보세요.',
    google: 'Google로 계속하기',
    apple: 'Apple로 계속하기',
    errors: {
      generic: '로그인하지 못했어요. 다시 시도해 주세요.',
      emailNotVerified: '이메일이 확인되지 않은 계정이에요. 다른 계정으로 로그인해 주세요.',
      methodUnavailable: '지금은 이 로그인 방법을 쓸 수 없어요.',
    },
  },
  unreachable: '서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.',
  retry: '다시 시도',
  signedIn: '로그인됐어요.',
  signOut: '로그아웃',
}

export type Strings = typeof ko

const en: Strings = {
  login: {
    title: 'Sign in to Rebomi',
    sub: 'Pick up the things you saved and forgot about.',
    google: 'Continue with Google',
    apple: 'Continue with Apple',
    errors: {
      generic: 'We couldn’t sign you in. Please try again.',
      emailNotVerified: 'This account’s email isn’t verified. Please use a different account.',
      methodUnavailable: 'This sign-in method isn’t available right now.',
    },
  },
  unreachable: 'We couldn’t reach the server. Please try again in a moment.',
  retry: 'Try again',
  signedIn: 'You’re signed in.',
  signOut: 'Sign out',
}

export function stringsFor(languageCode: string | null | undefined): Strings {
  return languageCode === 'ko' ? ko : en
}
