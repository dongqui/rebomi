import type {
  WaitlistHeadline,
  WaitlistLocale,
  WaitlistMostHelpful,
  WaitlistRevisitFrequency,
  WaitlistSavePlace,
  WaitlistWillingnessToPay,
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
  /** 없으면 빈 문자열. 자리는 그대로 둔다. */
  hint: string
  options: Option<Key>[]
}

export type LandingCopy = {
  meta: { title: string; description: string }
  headlines: Record<WaitlistHeadline, string>
  lede: string
  cta: string
  ctaNote: string
  problemTitle: string
  problemBody: string
  piles: { app: string; name: string }[]
  doesTitle: string
  features: { title: string; text: string }[]
  summaryCard: { title: string; label: string; text: string }
  searchCard: { query: string; title: string; note: string }
  feedCard: { head: string; items: string[] }
  calmTitle: string
  calm: { title: string; text: string }[]
  howTitle: string
  steps: { title: string; text: string }[]
  endTitle: string
  footer: string
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
    savePlaces: Question<WaitlistSavePlace>
    revisitFrequency: Question<WaitlistRevisitFrequency>
    mostHelpful: Question<WaitlistMostHelpful>
    willingnessToPay: Question<WaitlistWillingnessToPay>
    emailTitle: string
    emailLabel: string
    emailHelp: string
    emailError: string
    /** 이메일 저장이 실패했을 때. 디자인에 없는 문구다 (WAIT-4). */
    emailSaveFailed: string
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
    forgot: 'You saved it. Then forgot it.',
    scattered: 'Your saves are scattered across five apps.',
    find: 'You know you saved it. You just can’t find it.',
  },
  lede: 'Rebomi brings back the links, videos and posts you saved, a few at a time, with a short summary so you know what’s worth opening.',
  cta: 'Join the waitlist',
  ctaNote: 'Four quick questions, then your email. About a minute.',
  problemTitle: 'Saving feels like progress. It isn’t.',
  problemBody: 'Each app keeps its own pile, and none of them will remind you what’s in it.',
  piles: [
    { app: 'Instagram', name: 'Saved' },
    { app: 'YouTube', name: 'Watch later' },
    { app: 'Reddit', name: 'Saved' },
    { app: 'X', name: 'Bookmarks' },
    { app: 'Your browser', name: 'Bookmarks' },
  ],
  doesTitle: 'What Rebomi does with your saves',
  features: [
    {
      title: 'Know what it is in five seconds',
      text: 'Every save gets a short AI summary. Decide without opening it.',
    },
    {
      title: 'Find it by what you remember',
      text: 'Forgot the title? Describe it in a sentence.',
    },
    {
      title: 'A few come back each week',
      text: 'Three to five saves, a couple of times a week. Skip, keep or open. Then you’re done.',
    },
  ],
  summaryCard: {
    title: 'One-pan tomato orzo',
    label: 'AI summary',
    text: 'Orzo, cherry tomatoes and stock simmer in one pan for about 15 minutes. Butter and parmesan go in at the end.',
  },
  searchCard: {
    query: 'that article about deploying several services',
    title: 'Shipping multiple services independently with Next.js Multi-Zones',
    note: 'Found by what it says, not by its title',
  },
  feedCard: {
    head: 'Today’s finds',
    items: [
      'Shipping multiple services independently with Next.js',
      'One-pan tomato orzo',
      'Korean full-text search in PostgreSQL',
    ],
  },
  calmTitle: 'Built to stay calm',
  calm: [
    { title: 'Skipping changes nothing.', text: 'A skipped save stays exactly where it was.' },
    {
      title: 'It ends.',
      text: 'A handful of saves, then you’re done. There is no infinite feed.',
    },
    {
      title: 'The AI summarizes. It doesn’t guess.',
      text: 'It never invents why you saved something. Notes are only the ones you wrote.',
    },
  ],
  howTitle: 'How it works',
  steps: [
    {
      title: 'Save from anywhere',
      text: 'Share a link to Rebomi from any app, or paste it on the web.',
    },
    {
      title: 'Rebomi reads it',
      text: 'It writes a short summary, so you don’t have to remember what it was.',
    },
    {
      title: 'It comes back',
      text: 'A while later it shows up again, about when you’ve forgotten it.',
    },
  ],
  endTitle: 'See what you forgot you saved.',
  footer: 'Rebomi is still being built. The waitlist is how we’ll tell you when it opens.',
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
    savePlaces: {
      title: 'Where do your saves pile up?',
      hint: 'Pick all that apply.',
      options: [
        { key: 'instagram', label: 'Instagram' },
        { key: 'youtube', label: 'YouTube' },
        { key: 'reddit', label: 'Reddit' },
        { key: 'x', label: 'X' },
        { key: 'browser', label: 'Browser bookmarks' },
        { key: 'notes', label: 'Notes or messages to myself' },
        { key: 'other', label: 'Somewhere else' },
      ],
    },
    revisitFrequency: {
      title: 'How often do you go back to them?',
      hint: '',
      options: [
        { key: 'almost_never', label: 'Almost never' },
        { key: 'sometimes', label: 'Once in a while' },
        { key: 'most_weeks', label: 'Most weeks' },
      ],
    },
    mostHelpful: {
      title: 'What would help you most?',
      hint: 'Pick one.',
      options: [
        { key: 'summary', label: 'A short summary of each save' },
        { key: 'search', label: 'Finding things by what I remember' },
        { key: 'resurfacing', label: 'A few saves brought back each week' },
        { key: 'one_place', label: 'Everything in one place' },
      ],
    },
    willingnessToPay: {
      title: 'If Rebomi did this well, would you pay for it?',
      hint: '',
      options: [
        { key: 'yes', label: 'Yes, a few dollars a month' },
        { key: 'maybe', label: 'Maybe, if I end up using it a lot' },
        { key: 'no', label: 'No, only if it’s free' },
      ],
    },
    emailTitle: 'Where should we send your invite?',
    emailLabel: 'Email',
    emailHelp: 'We’ll only email you about Rebomi’s launch.',
    emailError: 'Enter a valid email address.',
    emailSaveFailed: 'We couldn’t save that. Please try again.',
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
    forgot: '저장해 놓고, 잊어버렸죠.',
    scattered: '저장한 것들이 앱 다섯 곳에 흩어져 있어요.',
    find: '분명히 저장했는데, 찾을 수가 없죠.',
  },
  lede: 'Rebomi는 저장해 둔 링크와 영상, 게시물을 몇 개씩 다시 보여드려요. 짧은 요약이 함께 있어서 열어 볼지 바로 정할 수 있어요.',
  cta: '대기 명단 등록하기',
  ctaNote: '짧은 질문 네 개와 이메일이면 끝나요. 1분쯤 걸려요.',
  problemTitle: '저장하면 뭔가 한 것 같죠. 사실은 아니에요.',
  problemBody: '앱마다 저장함이 따로 있고, 그 안에 뭐가 있는지 알려주는 앱은 없어요.',
  piles: [
    { app: '인스타그램', name: '저장됨' },
    { app: '유튜브', name: '나중에 볼 동영상' },
    { app: '레딧', name: '저장됨' },
    { app: 'X', name: '북마크' },
    { app: '브라우저', name: '북마크' },
  ],
  doesTitle: 'Rebomi가 저장한 것들로 하는 일',
  features: [
    {
      title: '5초 만에 무슨 내용인지',
      text: '저장한 것마다 짧은 AI 요약이 붙어요. 열지 않고도 정할 수 있어요.',
    },
    {
      title: '기억나는 내용으로 찾기',
      text: '제목이 생각나지 않아도 괜찮아요. 떠오르는 내용을 문장으로 적으면 돼요.',
    },
    {
      title: '매주 몇 개만 다시',
      text: '일주일에 두세 번, 한 번에 세 개에서 다섯 개예요. 넘기거나 보관하거나 열어 보면 끝이에요.',
    },
  ],
  summaryCard: {
    title: '원팬 토마토 오르조 파스타',
    label: 'AI 요약',
    text: '팬 하나에 오르조와 방울토마토, 육수를 넣고 15분쯤 끓여요. 마지막에 버터와 파르메산을 넣어요.',
  },
  searchCard: {
    query: '여러 서비스를 따로 배포하는 방법에 관한 글',
    title: 'Next.js Multi-Zones로 여러 서비스를 독립 배포하기',
    note: '제목이 아니라 내용으로 찾았어요',
  },
  feedCard: {
    head: '오늘의 재발견',
    items: [
      'Next.js Multi-Zones로 여러 서비스를 독립 배포하기',
      '원팬 토마토 오르조 파스타',
      'PostgreSQL에서 한국어 전문 검색',
    ],
  },
  calmTitle: '차분하게 쓰도록 만들었어요',
  calm: [
    {
      title: '넘겨도 아무 일도 일어나지 않아요.',
      text: '넘긴 콘텐츠는 있던 자리에 그대로 있어요.',
    },
    { title: '끝이 있어요.', text: '몇 개만 보고 끝나요. 끝없는 피드가 없어요.' },
    {
      title: 'AI는 요약만 해요.',
      text: '저장한 이유를 지어내지 않아요. 메모는 직접 쓴 것만 보여요.',
    },
  ],
  howTitle: '이렇게 써요',
  steps: [
    {
      title: '어디서든 저장',
      text: '어느 앱에서든 공유 버튼으로 Rebomi에 보내거나, 웹에서 링크를 붙여 넣어요.',
    },
    {
      title: 'Rebomi가 읽어 둬요',
      text: '짧게 요약해 두니까 무슨 내용이었는지 기억할 필요가 없어요.',
    },
    { title: '다시 돌아와요', text: '잊어버릴 때쯤 다시 보여드려요.' },
  ],
  endTitle: '잊고 있던 저장물을 다시 만나 보세요.',
  footer: 'Rebomi는 아직 만드는 중이에요. 열리면 대기 명단으로 가장 먼저 알려드려요.',
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
    savePlaces: {
      title: '저장한 것들이 주로 어디에 쌓여 있나요?',
      hint: '해당하는 걸 모두 골라 주세요.',
      options: [
        { key: 'instagram', label: '인스타그램' },
        { key: 'youtube', label: '유튜브' },
        { key: 'reddit', label: '레딧' },
        { key: 'x', label: 'X' },
        { key: 'browser', label: '브라우저 북마크' },
        { key: 'notes', label: '메모나 나에게 보내기' },
        { key: 'other', label: '그 밖의 곳' },
      ],
    },
    revisitFrequency: {
      title: '저장한 걸 얼마나 자주 다시 보나요?',
      hint: '',
      options: [
        { key: 'almost_never', label: '거의 안 봐요' },
        { key: 'sometimes', label: '가끔 봐요' },
        { key: 'most_weeks', label: '거의 매주 봐요' },
      ],
    },
    mostHelpful: {
      title: '무엇이 가장 도움이 될까요?',
      hint: '하나만 골라 주세요.',
      options: [
        { key: 'summary', label: '저장한 것마다 짧은 요약' },
        { key: 'search', label: '기억나는 내용으로 찾기' },
        { key: 'resurfacing', label: '매주 몇 개씩 다시 보여주기' },
        { key: 'one_place', label: '한곳에 모아 두기' },
      ],
    },
    willingnessToPay: {
      title: 'Rebomi가 이걸 잘 해낸다면 돈을 낼 의향이 있나요?',
      hint: '',
      options: [
        { key: 'yes', label: '네, 한 달에 몇 천 원쯤' },
        { key: 'maybe', label: '많이 쓰게 되면 그럴 수도 있어요' },
        { key: 'no', label: '아니요, 무료일 때만 써요' },
      ],
    },
    emailTitle: '초대장을 어디로 보내드릴까요?',
    emailLabel: '이메일',
    emailHelp: 'Rebomi 출시 소식만 보내드려요.',
    emailError: '이메일 주소를 다시 확인해 주세요.',
    emailSaveFailed: '저장하지 못했어요. 다시 시도해 주세요.',
    doneTitle: '대기 명단에 등록됐어요.',
    doneBody: 'Rebomi가 열리면 메일로 알려드릴게요. 답해 주셔서 고마워요.',
    doneClose: '페이지로 돌아가기',
  },
}

export const COPY: Record<WaitlistLocale, LandingCopy> = { en, ko }
