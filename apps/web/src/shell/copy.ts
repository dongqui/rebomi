import type { ExtractionLevel } from '@rebomi/api-contract'
import type { Locale } from '@/lib/locale'
import type { Theme } from '@/theme/theme'

/*
 * 로그인한 뒤의 화면(`/app`)의 문구. 디자인(RebomiWeb, rebomi-kit)에 있는 것은 그 문구
 * 그대로이고, 디자인에 없는 것(링크 저장 대화상자, 오류, 테마 메뉴)은 같은 말투로 썼다.
 */
export type AppCopy = {
  nav: { label: string; home: string; settings: string }
  saveLink: string
  settings: { theme: string; themes: Record<Theme, string>; signOut: string }
  home: {
    recent: string
    loading: string
    retry: string
    more: string
    open: string
    /** 원문 링크의 이름. 화면에는 `open` 만 보이고 보조 기술에는 제목까지 읽힌다. */
    openLabel: (title: string) => string
    pending: string
    failed: string
    firstTitle: string
    firstDesc: string
    saveLinkLong: string
  }
  /** 추출 수준 (capture.md CAP-7). */
  extraction: Record<ExtractionLevel, string>
  saved: { justNow: string }
  saveDialog: {
    title: string
    label: string
    save: string
    close: string
    created: string
    duplicate: string
    empty: string
    invalid: string
    failed: string
  }
  errors: { unreachable: string; list: string }
}

const ko: AppCopy = {
  nav: { label: '주요 메뉴', home: '홈', settings: '설정' },
  saveLink: '링크 저장',
  settings: {
    theme: '테마',
    themes: { system: '시스템 설정', light: '라이트', dark: '다크' },
    signOut: '로그아웃',
  },
  home: {
    recent: '최근 저장',
    loading: '불러오는 중이에요',
    retry: '다시 시도하기',
    more: '더 보기',
    open: '원문 보기',
    openLabel: (title) => `원문 보기: ${title}`,
    pending: '처리 중',
    failed: '페이지 정보를 가져오지 못했어요',
    firstTitle: '저장한 콘텐츠가 아직 없어요',
    firstDesc: '링크를 저장하면 짧게 요약해 두고, 시간이 지나면 여기에서 다시 보여드려요.',
    saveLinkLong: '링크 저장하기',
  },
  extraction: { full: '본문 확보', partial: '본문 일부', metadata_only: '메타데이터만' },
  saved: { justNow: '방금' },
  saveDialog: {
    title: '링크 저장하기',
    label: '링크 주소',
    save: '저장',
    close: '닫기',
    created: '저장했어요.',
    duplicate: '이미 저장한 링크예요.',
    empty: '주소를 입력해 주세요.',
    invalid: 'http 또는 https 주소만 저장할 수 있어요.',
    failed: '저장하지 못했어요. 다시 시도해 주세요.',
  },
  errors: {
    unreachable: '서버에 연결할 수 없어요. 잠시 후 다시 시도해 주세요.',
    list: '목록을 불러오지 못했어요. 다시 시도해 주세요.',
  },
}

const en: AppCopy = {
  nav: { label: 'Main menu', home: 'Home', settings: 'Settings' },
  saveLink: 'Save link',
  settings: {
    theme: 'Theme',
    themes: { system: 'System', light: 'Light', dark: 'Dark' },
    signOut: 'Sign out',
  },
  home: {
    recent: 'Recently saved',
    loading: 'Loading',
    retry: 'Try again',
    more: 'More',
    open: 'Open original',
    openLabel: (title) => `Open original: ${title}`,
    pending: 'Processing',
    failed: 'Couldn’t fetch the page details',
    firstTitle: 'Nothing saved yet',
    firstDesc: 'Save a link and we’ll summarize it, then bring it back here after a while.',
    saveLinkLong: 'Save a link',
  },
  extraction: { full: 'Full text', partial: 'Partial text', metadata_only: 'Metadata only' },
  saved: { justNow: 'Just now' },
  saveDialog: {
    title: 'Save a link',
    label: 'Link URL',
    save: 'Save',
    close: 'Close',
    created: 'Saved.',
    duplicate: 'You’ve already saved this link.',
    empty: 'Enter a URL.',
    invalid: 'Only http or https URLs can be saved.',
    failed: 'We couldn’t save that. Please try again.',
  },
  errors: {
    unreachable: 'Can’t reach the server. Please try again in a moment.',
    list: 'We couldn’t load your list. Please try again.',
  },
}

export const APP_COPY: Record<Locale, AppCopy> = { ko, en }
