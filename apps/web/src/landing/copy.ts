import type {
  WaitlistFrustration,
  WaitlistHeadline,
  WaitlistLocale,
  WaitlistOccupation,
  WaitlistSaveIntent,
  WaitlistWantedHelp,
} from '@rebomi/api-contract'

/*
 * 랜딩과 등록 대화상자의 문구. 디자인(RebomiLanding)의 문구 그대로다.
 *
 * 설문의 선택지는 화면 문구와 서버로 보내는 키를 함께 둔다 — 서버에는 언어와 무관한
 * 키만 간다 (`@rebomi/api-contract` 의 waitlist).
 */

type Option<Key extends string> = { key: Key; label: string }

type Question<Key extends string> = {
  title: string
  /** 마지막 선택지는 늘 `other`(기타)다. 고르면 직접 적는 칸이 열린다. */
  options: Option<Key>[]
}

/** 방문자가 정한 메일 주소가 아니라 우리 주소다 — 삭제 요청을 받는다 (waitlist.md WAIT-12). */
export const PRIVACY_CONTACT = 'projectn.contact@gmail.com'

export type LandingCopy = {
  meta: { title: string; description: string }
  /** 두 줄로 나눠 쓴다. 한 줄짜리는 둘째가 빈 문자열이다. */
  headlines: Record<WaitlistHeadline, readonly [string, string]>
  lede: string
  /** `progress` 헤드라인에만 붙는 설명. */
  ledeProgress: string
  cta: string
  problemTitle: readonly [string, string]
  problemBody: string
  pileNote: string
  pilesAlt: string
  piles: { app: string; name: string; count: string }[]
  doesTitle: string
  rediscover: { title: string; text: string; head: string; items: string[] }
  summary: { title: string; text: string; cardTitle: string; label: string; cardText: string }
  search: { title: string; text: string; query: string; result: string; note: string }
  save: { title: string; text: string; url: string; saved: string; note: string }
  endTitle: string
  footer: string
  /** 첫 화면 그림 "카드". */
  card: {
    alt: string
    thumb: string
    duration: string
    title: string
    source: string
    saved: string
    summaryLabel: string
    summary: string
    details: string
    open: string
  }
  /** 첫 화면 그림 "알림". */
  notice: { alt: string; app: string; when: string; title: string; body: string }
  /** 첫 화면 그림 "휴대폰". */
  phone: {
    label: string
    today: string
    position: string
    listView: string
    thumbAlt: string
    title: string
    source: string
    saved: string
    summaryLabel: string
    summary: string
    noteLabel: string
    note: string
    details: string
    open: string
    skip: string
    later: string
    archive: string
    tabs: { home: string; search: string; library: string }
  }
  dialog: {
    close: string
    back: string
    next: string
    progress: (current: number, total: number) => string
    lastStep: string
    otherPlaceholder: string
    occupation: Question<WaitlistOccupation>
    saveIntent: Question<WaitlistSaveIntent>
    frustration: Question<WaitlistFrustration>
    wantedHelp: Question<WaitlistWantedHelp>
    emailTitle: string
    emailLabel: string
    emailHelp: string
    emailError: string
    /** 이메일 저장이 실패했을 때. 디자인에 없는 문구다 (WAIT-4). */
    emailSaveFailed: string
    /** 수집 고지. 디자인에 없는 문구다 (WAIT-12). */
    privacy: string
    doneTitle: string
    doneBody: string
    doneClose: string
  }
}

const en: LandingCopy = {
  meta: {
    title: 'Rebomi — See what you forgot you saved',
    description:
      'Rebomi brings back the links, videos and posts you saved, a few at a time, with a short summary so you know what’s worth opening.',
  },
  headlines: {
    progress: ['Saving feels like progress.', 'Then you never see it again.'],
    forgot: ['You saved it.', 'Then forgot it.'],
    scattered: ['Your saves are scattered across five apps.', ''],
    find: ['You know you saved it.', 'You just can’t find it.'],
  },
  lede: 'Rebomi brings back the links, videos and posts you saved, a few at a time, with a short summary so you know what’s worth opening.',
  ledeProgress: 'Rebomi brings back what caught your interest, so it can move you forward.',
  cta: 'Join the waitlist',
  problemTitle: ['Your apps don’t care what you saved.', 'They care what you watch next.'],
  problemBody:
    'Meanwhile, your saves keep piling up across apps—until you don’t know where to start.',
  pileNote: 'Yours probably looks something like this.',
  pilesAlt: 'Saved lists in five different apps, holding between 96 and 1,140 items each.',
  piles: [
    { app: 'Instagram', name: 'Saved', count: '847' },
    { app: 'YouTube', name: 'Watch later', count: '312' },
    { app: 'Reddit', name: 'Saved', count: '96' },
    { app: 'X', name: 'Bookmarks', count: '203' },
    { app: 'Your browser', name: 'Bookmarks', count: '1,140' },
  ],
  doesTitle: 'What Rebomi does with your saves',
  rediscover: {
    title: 'Rediscover what you forgot you saved.',
    text: 'Every so often, Rebomi brings back a few of your saves. Keep what matters. Delete what doesn’t.',
    head: 'Today’s finds',
    items: [
      'I tracked every dollar for a year. Here’s what changed.',
      'Lisbon on a budget: 12 places locals actually eat',
      'One-pan tomato orzo',
    ],
  },
  summary: {
    title: 'Know if it’s worth your time.',
    text: 'Get the gist in a few lines. Then decide what deserves a closer look.',
    cardTitle: 'I tracked every dollar for a year. Here’s what changed.',
    label: 'AI summary',
    cardText:
      'A year of logging every purchase. Most of the savings came from three forgotten subscriptions and weekday lunches, not coffee.',
  },
  search: {
    title: 'Find it by what you remember.',
    text: 'Forgot the title? Describe it in a sentence.',
    query: 'that post about cheap places to eat in Lisbon',
    result: 'Lisbon on a budget: 12 places locals actually eat',
    note: 'Found by what it’s about, not by its title',
  },
  save: {
    title: 'Save from the apps you use.',
    text: 'Share a link from your phone, use the Chrome extension, or paste it in.',
    url: 'youtube.com/watch?v=…',
    saved: 'Saved to Rebomi',
    note: 'Shared from YouTube',
  },
  endTitle: 'See what you forgot you saved.',
  footer: 'Rebomi is still being built. The waitlist is how we’ll tell you when it opens.',
  card: {
    alt: 'A video saved three weeks ago, brought back with a short AI summary.',
    thumb: 'video thumbnail',
    duration: '18:24',
    title: 'I tracked every dollar for a year. Here’s what changed.',
    source: 'YouTube',
    saved: 'Saved 3 weeks ago',
    summaryLabel: 'AI summary',
    summary:
      'A year of logging every purchase. Most of the savings came from three forgotten subscriptions and weekday lunches, not coffee.',
    details: 'See details',
    open: 'Open original',
  },
  notice: {
    alt: 'A Rebomi notification bringing back a video saved three weeks ago.',
    app: 'Rebomi',
    when: 'now',
    title: 'You saved this 3 weeks ago',
    body: 'One-pan tomato orzo · YouTube',
  },
  phone: {
    label: 'A preview of the Rebomi app showing one saved article with its summary',
    today: 'Today’s finds',
    position: '1 / 4',
    listView: 'List view',
    thumbAlt: 'Thumbnail placeholder',
    title:
      'Shipping multiple services independently with Next.js Multi-Zones: how we split releases by team in a monorepo',
    source: 'dev.to',
    saved: 'Saved 3 weeks ago',
    summaryLabel: 'AI summary',
    summary:
      'A write-up of building and deploying several Next.js apps separately under one domain with Multi-Zones. Moving between zones triggers a full page reload, so the author recommends keeping screens people switch between often in the same zone.',
    noteLabel: 'My note',
    note: 'Revisit when we look at the monorepo move',
    details: 'See details',
    open: 'Open original',
    skip: 'Skip',
    later: 'Later',
    archive: 'Archive',
    tabs: { home: 'Home', search: 'Search', library: 'Library' },
  },
  dialog: {
    close: 'Close',
    back: 'Back',
    next: 'Next',
    progress: (current, total) => `${current} of ${total}`,
    lastStep: 'Last step',
    otherPlaceholder: 'Tell us in your own words',
    occupation: {
      title: 'Which best describes what you’re doing these days?',
      options: [
        { key: 'studying', label: 'Studying or learning new skills' },
        { key: 'employed', label: 'Working at a company' },
        { key: 'freelance', label: 'Freelancing' },
        { key: 'own_business', label: 'Running a business or my own project' },
        { key: 'creator', label: 'Creating content' },
        { key: 'other', label: 'Other' },
      ],
    },
    saveIntent: {
      title: 'When you save something, what are you hoping to do with it?',
      options: [
        { key: 'learn', label: 'Learn something' },
        { key: 'work', label: 'Use it for work or a project' },
        { key: 'try', label: 'Try something' },
        { key: 'enjoy', label: 'Enjoy it later' },
        { key: 'reference', label: 'Keep it for reference' },
        { key: 'other', label: 'Other' },
      ],
    },
    frustration: {
      title: 'What frustrates you most about the things you save?',
      options: [
        { key: 'forget', label: 'I forget I saved them at all' },
        { key: 'cant_find', label: 'I can’t find them when I need them' },
        { key: 'too_many', label: 'There are so many, I don’t know where to start' },
        {
          key: 'no_time',
          label: 'When I open them again, I don’t have time to read or watch',
        },
        { key: 'never_use', label: 'Even after I look at them, I never put them to use' },
        { key: 'none', label: 'Nothing really bothers me' },
        { key: 'other', label: 'Other' },
      ],
    },
    wantedHelp: {
      title: 'If Rebomi could help you with one thing, what would you want it to be?',
      options: [
        { key: 'rediscover', label: 'Rediscovering good things I’d forgotten about' },
        { key: 'find', label: 'Finding what I need the moment I need it' },
        { key: 'pick', label: 'Picking what’s worth my time right now' },
        {
          key: 'use',
          label: 'Actually using what I saved for study, work or everyday life',
        },
        { key: 'one_place', label: 'Seeing saves from different places in one spot' },
        { key: 'other', label: 'Other' },
      ],
    },
    emailTitle: 'Where should we send your invite?',
    emailLabel: 'Email',
    emailHelp: 'We’ll only email you about Rebomi’s launch.',
    emailError: 'Enter a valid email address.',
    emailSaveFailed: 'We couldn’t save that. Please try again.',
    privacy: `We collect your email and survey answers to tell you about the launch and to understand demand. We keep them for one year, then delete them. To have yours deleted sooner, email ${PRIVACY_CONTACT}.`,
    doneTitle: 'You’re on the list.',
    doneBody: 'We’ll email you when Rebomi opens. Thanks for telling us how you save.',
    doneClose: 'Back to the page',
  },
}

const ko: LandingCopy = {
  meta: {
    title: 'Rebomi — 잊고 있던 저장물을 다시 만나 보세요',
    description:
      'Rebomi는 저장해 둔 링크와 영상, 게시물을 몇 개씩 다시 보여드려요. 짧은 요약이 함께 있어서 열어 볼지 바로 정할 수 있어요.',
  },
  headlines: {
    progress: ['저장하면 뭔가 한 것 같죠.', '그러고는 다시 안 봐요.'],
    forgot: ['저장해 놓고,', '잊어버렸죠.'],
    scattered: ['저장한 것들이 앱 다섯 곳에 흩어져 있어요.', ''],
    find: ['분명히 저장했는데,', '찾을 수가 없죠.'],
  },
  lede: 'Rebomi는 저장해 둔 링크와 영상, 게시물을 몇 개씩 다시 보여드려요. 짧은 요약이 함께 있어서 열어 볼지 바로 정할 수 있어요.',
  ledeProgress:
    'Rebomi가 관심 갔던 것들을 다시 꺼내 드려요. 저장한 것이 실제로 앞으로 나아가는 힘이 되도록요.',
  cta: '대기 명단 등록하기',
  problemTitle: ['앱은 뭘 저장했는지에는 관심이 없어요.', '다음에 뭘 볼지에만 관심이 있죠.'],
  problemBody:
    '그러는 사이 저장한 것들은 여러 앱에 계속 쌓여서, 어디서부터 봐야 할지 모르게 돼요.',
  pileNote: '당신 저장함도 아마 이런 모습일걸요.',
  pilesAlt: '앱 다섯 곳의 저장함. 적게는 96개, 많게는 1,140개가 쌓여 있어요.',
  piles: [
    { app: '인스타그램', name: '저장됨', count: '847' },
    { app: '유튜브', name: '나중에 볼 동영상', count: '312' },
    { app: '레딧', name: '저장됨', count: '96' },
    { app: 'X', name: '북마크', count: '203' },
    { app: '브라우저', name: '북마크', count: '1,140' },
  ],
  doesTitle: 'Rebomi가 저장한 것들로 하는 일',
  rediscover: {
    title: '저장해 놓고 잊은 것들을 다시 만나요.',
    text: '가끔씩 Rebomi가 저장한 것 몇 개를 다시 꺼내 드려요. 필요한 건 남기고, 아닌 건 지우세요.',
    head: '오늘의 재발견',
    items: [
      '1년 동안 쓴 돈을 전부 기록해 봤더니 달라진 것',
      '리스본 가성비 맛집: 현지인이 가는 12곳',
      '원팬 토마토 오르조 파스타',
    ],
  },
  summary: {
    title: '볼 만한지 바로 알 수 있어요.',
    text: '몇 줄로 핵심만 보여드려요. 더 볼지는 그다음에 정하면 돼요.',
    cardTitle: '1년 동안 쓴 돈을 전부 기록해 봤더니 달라진 것',
    label: 'AI 요약',
    cardText:
      '1년간 모든 지출을 기록한 이야기예요. 아낀 돈의 대부분은 커피가 아니라 잊고 있던 구독 세 개와 평일 점심에서 나왔어요.',
  },
  search: {
    title: '기억나는 내용으로 찾아요.',
    text: '제목이 생각나지 않나요? 떠오르는 대로 한 문장으로 적어 보세요.',
    query: '리스본에서 싸게 먹을 수 있는 곳 알려주던 글',
    result: '리스본 가성비 맛집: 현지인이 가는 12곳',
    note: '제목이 아니라 내용으로 찾았어요',
  },
  save: {
    title: '쓰던 앱에서 바로 저장해요.',
    text: '휴대폰에서 링크를 공유하거나, 크롬 확장 프로그램을 쓰거나, 링크를 붙여 넣으세요.',
    url: 'youtube.com/watch?v=…',
    saved: 'Rebomi에 저장했어요',
    note: '유튜브에서 공유함',
  },
  endTitle: '잊고 있던 저장물을 다시 만나 보세요.',
  footer: 'Rebomi는 아직 만드는 중이에요. 열리면 대기 명단으로 가장 먼저 알려드려요.',
  card: {
    alt: '3주 전에 저장한 영상을 짧은 AI 요약과 함께 다시 꺼낸 카드.',
    thumb: 'video thumbnail',
    duration: '18:24',
    title: '1년 동안 쓴 돈을 전부 기록해 봤더니 달라진 것',
    source: '유튜브',
    saved: '3주 전 저장',
    summaryLabel: 'AI 요약',
    summary:
      '1년간 모든 지출을 기록한 이야기예요. 아낀 돈의 대부분은 커피가 아니라 잊고 있던 구독 세 개와 평일 점심에서 나왔어요.',
    details: '자세히 보기',
    open: '원문 열기',
  },
  notice: {
    alt: '3주 전에 저장한 영상을 다시 알려 주는 Rebomi 알림.',
    app: 'Rebomi',
    when: '지금',
    title: '3주 전에 저장한 영상이에요',
    body: '원팬 토마토 오르조 파스타 · 유튜브',
  },
  phone: {
    label: '저장한 글 하나와 요약을 보여 주는 Rebomi 앱 미리보기',
    today: '오늘의 재발견',
    position: '1 / 4',
    listView: '목록으로 보기',
    thumbAlt: '썸네일 자리',
    title:
      'Next.js Multi-Zones로 여러 서비스를 독립 배포하기 — 모노레포에서 팀별 릴리스를 분리한 과정',
    source: 'velog.io',
    saved: '3주 전 저장',
    summaryLabel: 'AI 요약',
    summary:
      'Multi-Zones로 하나의 도메인 아래 여러 Next.js 앱을 따로 빌드하고 배포한 경험을 정리한 글이에요. zone 사이를 오갈 때는 전체 새로고침이 일어나서, 자주 오가는 화면은 같은 zone에 두라고 권해요.',
    noteLabel: '내 메모',
    note: '모노레포 전환 검토할 때 다시 보기',
    details: '자세히 보기',
    open: '원문 보기',
    skip: '넘기기',
    later: '나중에',
    archive: '보관',
    tabs: { home: '홈', search: '검색', library: '보관함' },
  },
  dialog: {
    close: '닫기',
    back: '이전',
    next: '다음',
    progress: (current, total) => `${total}개 중 ${current}번째`,
    lastStep: '마지막 단계',
    otherPlaceholder: '자유롭게 적어 주세요',
    occupation: {
      title: '지금 주로 어떤 일을 하고 있나요?',
      options: [
        { key: 'studying', label: '공부하거나 새로운 기술을 배우고 있어요' },
        { key: 'employed', label: '회사에서 일하고 있어요' },
        { key: 'freelance', label: '프리랜서로 일하고 있어요' },
        { key: 'own_business', label: '사업이나 개인 프로젝트를 하고 있어요' },
        { key: 'creator', label: '콘텐츠를 만들고 있어요' },
        { key: 'other', label: '기타' },
      ],
    },
    saveIntent: {
      title: '무언가를 저장할 때, 그걸로 무엇을 하고 싶나요?',
      options: [
        { key: 'learn', label: '무언가를 배우기' },
        { key: 'work', label: '일이나 프로젝트에 쓰기' },
        { key: 'try', label: '직접 해 보기' },
        { key: 'enjoy', label: '나중에 즐기기' },
        { key: 'reference', label: '참고용으로 보관하기' },
        { key: 'other', label: '기타' },
      ],
    },
    frustration: {
      title: '저장한 것과 관련해 가장 답답한 점은 무엇인가요?',
      options: [
        { key: 'forget', label: '저장했다는 사실 자체를 잊어요' },
        { key: 'cant_find', label: '필요할 때 다시 찾을 수 없어요' },
        { key: 'too_many', label: '너무 많이 쌓여서 어디서부터 봐야 할지 모르겠어요' },
        { key: 'no_time', label: '다시 열어도 읽거나 볼 시간이 없어요' },
        { key: 'never_use', label: '보고 나서도 실제로 활용하지 못해요' },
        { key: 'none', label: '특별히 불편하지는 않아요' },
        { key: 'other', label: '기타' },
      ],
    },
    wantedHelp: {
      title: 'Rebomi가 한 가지를 도와준다면, 무엇이 가장 좋을까요?',
      options: [
        { key: 'rediscover', label: '잊고 있던 좋은 콘텐츠를 다시 만나기' },
        { key: 'find', label: '필요한 순간 원하는 자료를 바로 찾기' },
        { key: 'pick', label: '많이 쌓인 것 중 지금 볼 만한 것을 고르기' },
        { key: 'use', label: '저장한 내용을 공부·업무·일상에 실제로 써먹기' },
        { key: 'one_place', label: '여러 곳에 흩어진 저장물을 한곳에서 보기' },
        { key: 'other', label: '기타' },
      ],
    },
    emailTitle: '초대장을 어디로 보내드릴까요?',
    emailLabel: '이메일',
    emailHelp: 'Rebomi 출시 소식만 보내드려요.',
    emailError: '이메일 주소를 다시 확인해 주세요.',
    emailSaveFailed: '저장하지 못했어요. 다시 시도해 주세요.',
    privacy: `이메일과 설문 답은 출시 안내와 수요 파악에만 써요. 받은 날부터 1년 동안 보관한 뒤 지워요. 그 전에 지우고 싶으면 ${PRIVACY_CONTACT} 으로 알려 주세요.`,
    doneTitle: '대기 명단에 등록됐어요.',
    doneBody: 'Rebomi가 열리면 메일로 알려드릴게요. 답해 주셔서 고마워요.',
    doneClose: '페이지로 돌아가기',
  },
}

export const COPY: Record<WaitlistLocale, LandingCopy> = { en, ko }
