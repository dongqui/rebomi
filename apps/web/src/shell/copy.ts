import type { ExtractionLevel } from '@rebomi/api-contract'
import type { Locale } from '@/lib/locale'
import type { Theme } from '@/theme/theme'

/*
 * 로그인한 뒤의 화면(`/app`)의 문구. 디자인(RebomiWeb, rebomi-kit)에 있는 것은 그 문구
 * 그대로이고, 디자인에 없는 것(링크 저장 대화상자, 오류, 테마 메뉴, 주소 일치)은 같은 말투로 썼다.
 */
export type AppCopy = {
  nav: { label: string; home: string; search: string; settings: string }
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
  search: {
    /** 검색창의 자리표시이자 이름, 그리고 입력 전 화면의 제목. */
    placeholder: string
    clear: string
    results: string
    idleDesc: string
    searching: string
    found: (count: number) => string
    more: string
    noMatch: string
    emptyLine1: string
    emptyLine2: string
    failed: string
    errLine1: string
    errLine2: string
    tooLong: string
    tooLongDesc: (maxTerms: number) => string
    /** 일치 근거의 이름표. */
    related: string
    titleMatch: string
    titleWords: (words: string[]) => string
    urlMatch: string
    archive: string
    archiveLong: string
    /** 결과 하나의 더 보기 메뉴. */
    menu: string
    deleteLong: string
    deleteTitle: string
    deleteDesc: string
    cancel: string
    archived: string
    trashed: string
    undo: string
    archiveFailed: string
    deleteFailed: string
    undoFailed: string
  }
}

const ko: AppCopy = {
  nav: { label: '주요 메뉴', home: '홈', search: '검색', settings: '설정' },
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
  search: {
    placeholder: '어떤 내용을 찾고 있나요?',
    clear: '검색어 지우기',
    results: '검색 결과',
    // 디자인은 "떠오르는 내용을 문장으로 적어 보세요"다. 뜻으로 찾는 검색이 생길 때 그 문구로 바꾼다.
    idleDesc: '제목이나 주소, 본문에 있던 단어로 찾아요.',
    searching: '찾고 있어요',
    found: (count) => `${count}개를 찾았어요`,
    more: '결과 더 보기',
    noMatch: '맞는 콘텐츠를 찾지 못했어요',
    emptyLine1: '다른 표현으로 다시 찾아보세요.',
    emptyLine2: '제목이나 주소의 일부만 입력해도 돼요.',
    failed: '검색하지 못했어요',
    errLine1: '연결에 잠깐 문제가 생겼어요.',
    errLine2: '잠시 후 다시 시도해주세요.',
    tooLong: '검색어가 너무 길어요',
    tooLongDesc: (maxTerms) => `단어를 ${maxTerms}개까지 줄여서 다시 찾아보세요.`,
    related: '관련 문장',
    titleMatch: '제목이 일치해요',
    titleWords: (words) => `${words.map((word) => `‘${word}’`).join(', ')} 단어가 제목에 있어요`,
    urlMatch: '주소가 일치해요',
    archive: '보관',
    archiveLong: '보관하기',
    menu: '더 보기',
    deleteLong: '삭제하기',
    deleteTitle: '이 콘텐츠를 삭제할까요?',
    deleteDesc: '휴지통으로 옮겨요. 30일 안에 복구할 수 있어요.',
    cancel: '취소',
    archived: '보관했어요',
    trashed: '휴지통으로 옮겼어요',
    undo: '되돌리기',
    archiveFailed: '보관하지 못했어요. 다시 시도해 주세요.',
    deleteFailed: '삭제하지 못했어요. 다시 시도해 주세요.',
    undoFailed: '되돌리지 못했어요. 다시 시도해 주세요.',
  },
}

const en: AppCopy = {
  nav: { label: 'Main menu', home: 'Home', search: 'Search', settings: 'Settings' },
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
  search: {
    placeholder: 'What are you looking for?',
    clear: 'Clear search',
    results: 'Search results',
    idleDesc: 'Search by words from the title, URL, or text.',
    searching: 'Searching',
    found: (count) => `${count} found`,
    more: 'More results',
    noMatch: 'No matching items',
    emptyLine1: 'Try different words.',
    emptyLine2: 'Part of a title or URL works too.',
    failed: 'Search didn’t work',
    errLine1: 'There was a brief connection problem.',
    errLine2: 'Please try again in a moment.',
    tooLong: 'That search is too long',
    tooLongDesc: (maxTerms) => `Use up to ${maxTerms} words and try again.`,
    related: 'Related sentence',
    titleMatch: 'Title match',
    titleWords: (words) => `${words.map((word) => `‘${word}’`).join(', ')} in the title`,
    urlMatch: 'URL match',
    archive: 'Archive',
    archiveLong: 'Archive',
    menu: 'More',
    deleteLong: 'Delete',
    deleteTitle: 'Delete this item?',
    deleteDesc: 'It moves to the trash. You can restore it within 30 days.',
    cancel: 'Cancel',
    archived: 'Archived',
    trashed: 'Moved to trash',
    undo: 'Undo',
    archiveFailed: 'We couldn’t archive that. Please try again.',
    deleteFailed: 'We couldn’t delete that. Please try again.',
    undoFailed: 'We couldn’t undo that. Please try again.',
  },
}

export const APP_COPY: Record<Locale, AppCopy> = { ko, en }
