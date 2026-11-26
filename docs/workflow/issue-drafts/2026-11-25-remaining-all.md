# 남은 작업 전체 — Issue 초안 (2026-11-25)

**상태: 2026-11-25 사용자 승인 후 등록했다 — 초안 1~35 = #61~#95, 초안 40~44 = #96~#100. 초안 36~39(재노출 설정·푸시·이메일)는 문서 PR #51(RES-8, D-24)이 병합된 뒤에 등록한다. 등록된 본문에서는 "초안 N"이 Issue 번호로 바뀌어 있다.**

범위: `docs/product.md`와 `docs/features/*.md` 전체를 돌며, 아직 Issue가 없는 남은 작업을 모두 뽑았다. 사용자가 남은 작업 전체를 보려고 요청했다(2026-11-25). 평소의 "한 묶음씩" 분해와 달리 결정 대기인 것도 전부 `needs-decision`으로 적었다.

- 이미 있는 Issue는 다시 만들지 않았다: #7(웹 로그인 — Apple 확인이 남아 열려 있다), #43(모바일 로그인 — 실제 계정 확인이 남아 열려 있다), #44(모바일 뼈대와 홈), #52~#58(마이페이지).
- `2026-11-18-semantic-search.md`의 초안 A·B는 여기 15·16으로 옮겼다.
- 재노출 이메일(RES-8)·D-24·푸시 대상 결정은 문서 PR #51에 있다. 39번과 36·38번의 일부는 #51이 병합된 뒤에 등록한다.
- 본문 안의 "초안 N"은 이 문서의 번호다. 등록할 때 Issue 번호로 바꾼다.
- 디자인 유무는 2026-11-24에 확인한 내용(웹: 홈·검색·재노출 카드, 모바일: 홈·검색·탭)을 따랐다. 화면 Issue를 실행할 때 다시 읽는다.

## 한눈에

| | 제목 | 라벨 | 선행 | 막고 있는 것 |
| --- | --- | --- | --- | --- |
| **출시 기반·계정** | | | | |
| 1 (#61) | [api] API 서버와 워커를 운영에 배포한다 | `status:todo` | 없음 |  |
| 2 (#62) | [web] 개인정보처리방침과 이용약관 페이지 | `needs-decision` | 없음 | 문서의 문구는 사용자가 정한다(운영 주체, 연락처, 보관 기간); D-21 문의 보관 기간, D-23 삭제한 콘텐츠의 보관, D-06 계정 삭제 |
| 3 (#63) | [extension] 운영 빌드와 Chrome 웹 스토어 등록 | `status:todo` | 초안 1, 초안 2 |  |
| 4 (#64) | [mobile] iOS 빌드와 로그인·홈 동작 확인 | `status:todo` | #43, #44 |  |
| 5 (#65) | [api] 데이터 내보내기 | `needs-decision` | #55 | D-06 내보내기의 출시 범위와 형식 |
| 6 (#66) | [api] 계정과 데이터 삭제 | `needs-decision` | #55, #56 | D-06 출시 범위; D-21 문의도 함께 지우는지; D-23 휴지통 콘텐츠를 완전히 지우는 방법 |
| **수집** | | | | |
| 7 (#67) | [api] 공유 텍스트를 함께 받는 저장 (추출 수준 "일부") | `status:todo` | 없음 |  |
| 8 (#68) | [mobile] Android 공유 메뉴로 저장 (Share Intent) | `status:todo` | 초안 7, #43 |  |
| 9 (#69) | [mobile] iOS 공유 메뉴로 저장 (Share Extension, Safari 본문) | `status:todo` | 초안 7, 초안 4 |  |
| 10 (#70) | [worker] YouTube는 자막을 본문으로 쓴다 | `needs-decision` | 없음 | capture §8 [확인 필요] |
| 11 (#71) | [api] 사용자 행동 계측의 기록 기반 | `needs-decision` | 없음 | D-18 계측을 기록하는 곳과 방식; D-07 재활용 지표의 집계 기준 |
| **요약** | | | | |
| 12 (#72) | [worker] 자동 요약 생성과 요약 상태 | `needs-decision` | 없음 | 요약 LLM 제공자·모델 (architecture §9); D-13 요약 언어의 기준 |
| 13 (#73) | [web] 요약과 요약 상태 표시 | `status:todo` | 초안 12 |  |
| 14 (#74) | [worker] 같은 URL의 요약·임베딩을 사용자 간에 재사용한다 | `needs-decision` | 초안 12, 초안 15 | D-12 공개 페이지 판정과 캐시 공유 범위 |
| **검색** | | | | |
| 15 (#75) | [worker] 저장한 콘텐츠의 임베딩 생성 | `needs-decision` | 없음 | 임베딩 모델과 호스팅 방식 (architecture §9, 위 초안의 "먼저 정할 것" 1~3) |
| 16 (#76) | [api] 의미 검색과 키워드 결과의 결합 | `status:todo` | 초안 15 |  |
| 17 (#77) | [docs] 한·영 혼합 평가 쿼리 100개와 검색 모델 비교 평가 | `status:todo` | 초안 16 |  |
| 18 (#78) | [api] 요약을 키워드 검색 대상에 넣는다 | `status:todo` | 초안 12 |  |
| 19 (#79) | [mobile] 검색 화면 | `status:todo` | #44 |  |
| **관리** | | | | |
| 20 (#80) | [api] 한 줄 메모와 메모 검색 | `status:todo` | 없음 |  |
| 21 (#81) | [api] 여러 콘텐츠의 일괄 보관·삭제 | `status:todo` | 없음 |  |
| 22 (#82) | [web] 보관함·Inbox·휴지통 화면 | `needs-decision` | 초안 29 | 디자인에 보관함·Inbox·휴지통 화면이 없다 (2026-11-24 확인); D-22 Inbox의 범위; library §5 [확인 필요] 보관함 화면의 범위; D-11 "나중에 보기"의 동작; D-23 휴지통에서 완전히 지우기 |
| 23 (#83) | [web] 메모 편집과 여러 콘텐츠 일괄 처리 | `needs-decision` | 초안 20, 초안 21, 초안 22 | 디자인에 메모 편집과 일괄 선택이 없다 |
| 24 (#84) | [mobile] Inbox·보관함과 보관·삭제 | `needs-decision` | #44 | library §3 [확인 필요] 모바일에서 정리 화면·일괄 처리까지 제공하는지; D-22 Inbox의 범위; 디자인에 모바일 보관함 화면이 있는지 확인되지 않았다 |
| 25 (#85) | [web] 정리 화면 (링크 소멸 일괄 삭제) | `needs-decision` | 초안 21, 초안 28 | D-01 정리 화면이 P0에서 다루는 범위; 디자인에 정리 화면이 없다 |
| **가져오기** | | | | |
| 26 (#86) | [api] Chrome 북마크 HTML 가져오기 | `needs-decision` | 없음 | import §8 [확인 필요] 저장일을 북마크의 추가 날짜로 할지 가져온 시점으로 할지 |
| 27 (#87) | [worker] 가져온 콘텐츠를 최근 북마크부터 처리한다 | `status:todo` | 초안 26 |  |
| 28 (#88) | [worker] 링크 생존 확인과 링크 소멸 분류 | `needs-decision` | 없음 | D-04 일시적 접근 실패와 링크 소멸의 구분 |
| 29 (#89) | [api] 가져온 폴더 목록과 폴더별 필터 | `status:todo` | 초안 26 |  |
| 30 (#90) | [web] 북마크 가져오기 화면 | `needs-decision` | 초안 26 | 디자인에 가져오기 화면이 없다 |
| **재노출** | | | | |
| 31 (#91) | [core] 재노출 선정 규칙 | `needs-decision` | 없음 | D-05 회당 개수, 후보 부족 시 동작, "최근 7일 내 확인"의 정의; D-22 Inbox 콘텐츠가 재노출 대상인지; resurfacing §5 [제안] 대상 풀이 겹칠 때의 우선순위 |
| 32 (#92) | [worker] 주기적 회차 선정과 저장, 재노출 설정 API | `needs-decision` | 초안 31 | D-05 기본 빈도와 빈도 선택지 |
| 33 (#93) | [api] 홈 재노출 피드와 카드 액션 | `needs-decision` | 초안 32 | D-05 "나중에 다시 보기"의 기간, 홈의 "오늘의 재노출"과 주 2~3회의 관계; D-11 Inbox "나중에 보기"와의 관계 |
| 34 (#94) | [web] 홈 재노출 피드, 카드 액션, 자세히 보기 | `status:todo` | 초안 33, 초안 13 |  |
| 35 (#95) | [mobile] 홈 재노출 피드와 카드 액션 | `status:todo` | 초안 33, #44 |  |
| 36 (미등록) | [web] 재노출 설정 (웹·모바일 마이페이지) | `needs-decision` | 초안 32, #55, #56 | D-05 빈도 선택지; D-24 이메일 수신 동의; 디자인에 설정 화면이 없다 |
| 37 (미등록) | [mobile] 푸시 권한 동의와 수신 | `needs-decision` | #44 | 푸시 제공자 (architecture §9); 동의를 언제 묻는지 (디자인) |
| 38 (미등록) | [worker] 재노출 푸시 발송 | `needs-decision` | 초안 32, 초안 37 | 푸시 제공자 (architecture §9); D-05 보내는 시각 |
| 39 (미등록) | [worker] 재노출 이메일 발송 | `needs-decision` | 초안 32 | D-24 재노출 이메일의 대상 요금제, 동의·수신 거부, 내용; 이메일 발송 제공자 (architecture §9) |
| **과금** | | | | |
| 40 (#96) | [api] 요금제 상태와 사용량 집계 | `status:todo` | #52 |  |
| 41 (#97) | [api] 저장·가져오기 한도 집행 | `needs-decision` | 초안 40 | D-03 한도 초과 동작, 가져오기 "최초 1회"의 판정 |
| 42 (#98) | [worker] AI 월 한도 집행 | `needs-decision` | 초안 40, 초안 12 | D-03 AI 한도 초과 시 동작과 사용자에게 보이는 상태 |
| 43 (#99) | [api] Pro 구독 결제 | `needs-decision` | 초안 40, #55, #56 | D-10 결제 수단, Pro 가격, 모바일 앱 내 결제, 해지·다운그레이드 처리; 디자인에 요금제 화면이 없다 |
| **대기 명단** | | | | |
| 44 (#100) | [worker] 1년이 지난 대기 명단 응답을 지운다 | `needs-decision` | 초안 1 | D-19 지우는 방법(주기 작업 / 수동), 이메일 없이 남은 응답도 지우는지 |

## Issue로 만들지 않은 것

- **ACC-3 기기 간 동기화** — 같은 계정의 API를 쓰므로 다음 조회에 반영된다. 실시간 반영이 필요한지는 D-08(남은 부분)이다. 결정되면 Issue가 생길 수 있다.
- **D-23 휴지통 완전 삭제, D-17 랜딩 방문 계측** — 요구사항이 아직 없다. 결정이 요구사항을 만든다.
- **모바일 스토어 배포(EAS)** — 어느 기능 문서에도 없다. 출시 준비에 필요하다 — PRD에 올릴지 사용자에게 묻는다.
- **계측 완료 조건** — 기능별로 흩어 넣지 않고 11번에 모았다(D-18). 한도 도달·요금제 전환만 과금 Issue에 남겼다.

## 결정이 풀어 주는 것

| 결정 | 풀리는 초안 |
| --- | --- |
| 요약 LLM 제공자, D-13 | 12 → 13, 18, 42 |
| 임베딩 모델·호스팅 | 15 → 16, 17 |
| D-05 (재노출 기본값) | 31, 32, 33 → 34, 35, 38 |
| 마이페이지·보관함·설정·가져오기·정리 화면의 디자인 | 22, 23, 24, 25, 30, 36 (그리고 #55~#58) |
| D-03 (한도 초과) | 41, 42 |
| D-10 (결제) | 43 |
| D-04 (링크 소멸 판정) | 28 → 25 |
| D-06 (내보내기·삭제) | 5, 6 |
| D-22, D-11, 보관함 범위 | 22, 24, 31, 33 |
| D-18, D-07 (계측) | 11 |
| D-24, 이메일·푸시 제공자 | 37, 38, 39 |
| D-01, D-12, D-19, D-20, D-21, import 저장일, YouTube 자막 수단 | 25, 14, 44, #54, 2, 26, 10 |

---

## 1. [api] API 서버와 워커를 운영에 배포한다

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/architecture.md | req: - -->

## 목표

배포된 웹(rebomi.app)에서 로그인하고 저장하면 처리까지 끝난다. 지금은 랜딩과 설문만 배포돼 있다.

## PRD 참조

- `docs/architecture.md` §1 배포, 환경 설정 / §3 (웹과 API가 같은 등록 도메인이라는 전제)

## 범위

**포함**

- API 서버와 워커의 운영 배포, 운영 DB에 전체 스키마 적용(지금은 `waitlist_responses`만 손으로 만들어져 있다)
- 운영 환경변수(비밀값은 저장소에 두지 않는다), 웹의 `NEXT_PUBLIC_API_BASE_URL` 전환
- `architecture.md` §1 갱신

**제외**

- 모바일·확장의 스토어 배포
- 모니터링·알림 체계

## 완료 조건

- [ ] 배포된 웹에서 Google 로그인 → 링크 저장 → 처리 완료가 보인다
- [ ] 운영 DB에 마이그레이션 기록이 있고 `pnpm db:migrate`를 다시 돌려도 안전하다
- [ ] 대기 명단 설문이 배포 전과 같이 저장된다
- [ ] 비밀값이 저장소·로그·PR에 없다

## 검증 방법

배포된 주소에서 수동 확인을 PR에 기록

## 선행 Issue

없음

## 미결정 사항

없음 — 설계에서 사용자에게 묻는다: API·워커를 올릴 곳과 비용, 운영 DB(지금의 Supabase를 그대로 쓰는지)

---

## 2. [web] 개인정보처리방침과 이용약관 페이지

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/capture.md | req: CAP-2,CAP-3 -->

## 목표

무엇을 수집하고 어떻게 보관하는지 적힌 페이지가 있고, 로그인 화면과 스토어 등록정보가 그 페이지를 가리킨다.

## PRD 참조

- `docs/features/capture.md` §5 본문 저장 고지 / §6 완료 조건 11
- `docs/features/waitlist.md` WAIT-12 (이미 있는 고지와의 관계)

## 범위

**포함**

- 개인정보처리방침·이용약관 페이지, 웹과 모바일 로그인 화면의 약관 문구와 링크
- 페이지 본문 수집을 적는다

**제외**

- 법률 검토

## 완료 조건

- [ ] 두 페이지가 로그인 없이 열린다
- [ ] 페이지 본문을 수집한다는 사실이 적혀 있다
- [ ] 웹·모바일 로그인 화면에서 두 페이지로 갈 수 있다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

화면 테스트, 브라우저 확인

## 선행 Issue

없음

## 미결정 사항

- 문서의 문구는 사용자가 정한다(운영 주체, 연락처, 보관 기간)
- D-21 문의 보관 기간, D-23 삭제한 콘텐츠의 보관, D-06 계정 삭제 — 방침에 적을 내용이다

---

## 3. [extension] 운영 빌드와 Chrome 웹 스토어 등록

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/capture.md | req: CAP-2 -->

## 목표

사용자가 Chrome 웹 스토어에서 확장을 설치해 운영 서버에 저장할 수 있다.

## PRD 참조

- `docs/features/capture.md` §5 본문 저장 고지 / §6 완료 조건 11
- `docs/architecture.md` §1 `apps/extension`

## 범위

**포함**

- 운영 API를 가리키는 빌드, 스토어 등록정보(페이지 본문 수집 명시, 개인정보처리방침 링크), 등록 절차 문서

**제외**

- 다른 Chromium 브라우저·Firefox

## 완료 조건

- [ ] 운영 빌드가 운영 웹의 로그인을 재사용해 저장한다
- [ ] 스토어 등록정보에 페이지 본문 수집이 적혀 있다
- [ ] 스토어 제출은 사용자가 한다 — 제출에 필요한 파일과 문구가 준비돼 있다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

운영 빌드를 직접 불러와 수동 확인

## 선행 Issue

- 초안 1 (API 운영 배포)
- 초안 2 (개인정보처리방침)

## 미결정 사항

없음

---

## 4. [mobile] iOS 빌드와 로그인·홈 동작 확인

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/account.md | req: ACC-2,ACC-6,ACC-8 -->

## 목표

#43, #44에서 이월한 iOS 확인을 끝낸다. 지금까지 Android 에뮬레이터에서만 확인했다.

## PRD 참조

- `docs/features/account.md` §5
- `docs/architecture.md` §1 `apps/mobile`

## 범위

**포함**

- iOS 개발 빌드, 로그인(브라우저 창)·세션 유지·로그아웃·홈 확인, 발견한 문제의 수정

**제외**

- 스토어 배포

## 완료 조건

- [ ] iOS 시뮬레이터 또는 기기에서 Google·Apple 로그인이 된다
- [ ] 앱을 다시 열어도 로그인 상태다
- [ ] 로그아웃이 된다
- [ ] 홈의 최근 저장이 보인다

## 검증 방법

iOS에서 수동 확인을 PR에 기록 (macOS가 필요하다 — 지금 개발 환경은 Windows다)

## 선행 Issue

- #43
- #44

## 미결정 사항

없음

---

## 5. [api] 데이터 내보내기

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/account.md | req: ACC-4 -->

## 목표

사용자가 자기 데이터를 파일로 받는다.

## PRD 참조

- `docs/features/account.md` §2 ACC-4
- `docs/product.md` §9 D-06

## 범위

**포함**

- 내보내기 API와 계약
- 웹 마이페이지의 진입점

**제외**

- 가져오기 형식과의 호환(정해지지 않았다)

## 완료 조건

- [ ] D-06에 정한 형식으로 자기 콘텐츠 전부를 받는다
- [ ] 다른 사용자의 데이터가 섞이지 않는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트

## 선행 Issue

- #55 (웹 마이페이지 — 진입점)

## 미결정 사항

- D-06 내보내기의 출시 범위와 형식

---

## 6. [api] 계정과 데이터 삭제

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/account.md | req: ACC-5 -->

## 목표

사용자가 계정과 자기 데이터를 지운다.

## PRD 참조

- `docs/features/account.md` §2 ACC-5
- `docs/product.md` §9 D-06, D-21, D-23

## 범위

**포함**

- 계정 삭제 API와 계약, 삭제되는 데이터의 범위(콘텐츠, 본문, 토큰, 문의)
- 웹·모바일 마이페이지의 진입점과 확인 절차

**제외**

- 삭제 유예 기간(정해지지 않았다)

## 완료 조건

- [ ] 계정을 지우면 그 계정의 콘텐츠·본문·로그인 정보가 DB에 남지 않는다
- [ ] 지운 뒤 같은 제공자 계정으로 로그인하면 새 계정이다
- [ ] 다른 사용자의 데이터는 그대로다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트

## 선행 Issue

- #55, #56 (마이페이지 — 진입점)

## 미결정 사항

- D-06 출시 범위
- D-21 문의도 함께 지우는지
- D-23 휴지통 콘텐츠를 완전히 지우는 방법

---

## 7. [api] 공유 텍스트를 함께 받는 저장 (추출 수준 "일부")

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/capture.md | req: CAP-3,CAP-4,CAP-7 -->

## 목표

모바일 공유로 온 텍스트를 저장 요청에 실을 수 있고, 그런 콘텐츠의 추출 수준이 "일부"다.

## PRD 참조

- `docs/features/capture.md` §5 본문 추출 우선순위(2순위)
- `docs/architecture.md` §4 추출 수준, §5 저장 API

## 범위

**포함**

- 저장 계약에 공유 텍스트를 싣는 방법, `POST /contents`의 처리, `api-client`
- 워커가 "일부"인 콘텐츠를 어떻게 다루는지(서버 보조 추출을 시도하는지)
- `architecture.md` §5 갱신

**제외**

- 모바일 화면 — 초안 8, 초안 9

## 완료 조건

- [ ] 공유 텍스트와 함께 저장하면 추출 수준이 "일부"이고 텍스트가 저장된다
- [ ] 본문(1순위)이 함께 오면 "본문"이다
- [ ] 같은 URL을 다시 저장할 때의 규칙이 capture §5의 중복 규칙과 어긋나지 않는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api·worker 테스트

## 선행 Issue

없음

## 미결정 사항

없음

---

## 8. [mobile] Android 공유 메뉴로 저장 (Share Intent)

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/capture.md | req: CAP-4,CAP-6,CAP-11 -->

## 목표

Android에서 다른 앱의 공유 메뉴로 Rebomi에 저장하고 원래 앱으로 돌아간다.

## PRD 참조

- `docs/features/capture.md` §2 CAP-4, CAP-11 / §4 / §5 / §6 완료 조건 5~7
- `docs/architecture.md` §9 모바일(구현 방식 미정)

## 범위

**포함**

- Share Intent를 받는 저장 전용 UI, 공유된 텍스트·URL의 해석
- 메인 앱의 로그인 세션 사용
- 성공·중복·실패·로그인 필요 표시와 종료 동작

**제외**

- iOS — 초안 9

## 완료 조건

- [ ] 다른 앱(예: Reddit)에서 공유하면 저장 UI에서 성공이 표시되고 원래 앱으로 돌아간다
- [ ] 메인 앱에 로그인돼 있으면 다시 로그인하지 않는다. 로그아웃 상태면 저장되지 않고 로그인이 필요함을 알린다
- [ ] 네트워크가 끊기면 실패가 표시되고 성공으로 보이지 않는다
- [ ] 이미 저장한 URL은 중복으로 표시된다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

Android 에뮬레이터 개발 빌드에서 수동 확인을 PR에 기록, 공유 텍스트 해석의 단위 테스트

## 선행 Issue

- 초안 7 (공유 텍스트 저장)
- #43

## 미결정 사항

없음 — 설계에서 사용자에게 묻는다: Share Intent 구현 방식(Expo config plugin 등), 저장 UI의 모양(디자인)

---

## 9. [mobile] iOS 공유 메뉴로 저장 (Share Extension, Safari 본문)

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/capture.md | req: CAP-3,CAP-6,CAP-11 -->

## 목표

iOS에서 메인 앱을 열지 않고 공유창 안에서 저장이 끝난다. Safari에서는 페이지 본문도 함께 저장된다.

## PRD 참조

- `docs/features/capture.md` §2 CAP-3, CAP-11 / §5 (메모리 120MB 전제, 본문 저장 고지) / §6 완료 조건 4~7, 10

## 범위

**포함**

- Share Extension, App Group으로 메인 앱과 세션 공유, Safari의 JavaScript preprocessing으로 본문 수신
- 성공·중복·실패·로그인 필요 표시와 공유창 종료

**제외**

- Android — 초안 8

## 완료 조건

- [ ] Safari에서 공유하면 메인 앱이 열리지 않고 저장이 끝나며 추출 수준이 "본문"이다
- [ ] 다른 앱에서 공유하면 공유창에서 성공이 표시되고 원래 앱으로 돌아간다
- [ ] 메인 앱에 로그인돼 있으면 다시 로그인하지 않는다. 로그아웃 상태면 로그인이 필요함을 알린다
- [ ] 네트워크가 끊기면 실패가 표시된다
- [ ] 캡처 전에 안내로 저장을 막지 않는다

## 검증 방법

iOS 기기·시뮬레이터에서 수동 확인을 PR에 기록 (macOS 필요)

## 선행 Issue

- 초안 7 (공유 텍스트 저장)
- 초안 4 (iOS 빌드 확인)

## 미결정 사항

없음 — 설계에서 사용자에게 묻는다: Share Extension 구현 방식, 갱신 토큰을 App Group에 두는 방법

---

## 10. [worker] YouTube는 자막을 본문으로 쓴다

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/capture.md | req: CAP-9 -->

## 목표

YouTube 동영상을 저장하면 자막이 본문이 되고, 자막을 얻지 못하면 제목·설명으로 처리된다.

## PRD 참조

- `docs/features/capture.md` §2 CAP-9 / §8 [확인 필요]

## 범위

**포함**

- YouTube URL 판별, 자막 수신, 실패 시 제목·설명으로 처리

**제외**

- 자막 기반 상세 요약 (P1)

## 완료 조건

- [ ] 자막이 있는 동영상은 추출 수준이 "본문"이다
- [ ] 자막을 얻지 못한 동영상은 저장에 실패하지 않고 제목·설명으로 남는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

가짜 응답을 쓰는 worker 테스트

## 선행 Issue

없음

## 미결정 사항

- capture §8 [확인 필요] — YouTube 자막 접근 수단

---

## 11. [api] 사용자 행동 계측의 기록 기반

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/product.md | req: - -->

## 목표

기능 문서마다 있는 "계측: ~가 기록된다" 완료 조건을 채울 기록 수단이 있다.

## PRD 참조

- `docs/product.md` §8 지표와 가설 / §9 D-18, D-07, D-17
- 각 기능 문서 §6의 계측 완료 조건(capture, import, summary, search, library, resurfacing, billing)

## 범위

**포함**

- D-18에 정한 곳에 이벤트를 남기는 공통 수단
- 이미 구현된 동작(저장, 검색, 보관·삭제)의 계측

**제외**

- 아직 없는 기능의 계측 — 그 기능의 Issue에서 이 수단을 쓴다

## 완료 조건

- [ ] 저장 시도·완료와 추출 수준, 검색 실행·결과 수·결과 클릭, 보관·삭제가 기록된다
- [ ] 기록에 본문·검색어 원문 등 무엇이 남는지가 문서에 적혀 있다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

api 테스트

## 선행 Issue

없음

## 미결정 사항

- D-18 계측을 기록하는 곳과 방식
- D-07 재활용 지표의 집계 기준

---

## 12. [worker] 자동 요약 생성과 요약 상태

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/summary.md | req: SUM-1,SUM-2,SUM-3,SUM-6 -->

## 목표

본문이 있는 콘텐츠는 저장 후 1~3문장 요약이 만들어지고, 요약 상태(생성 중·완료·실패·본문 없음)가 콘텐츠 응답에 있다.

## PRD 참조

- `docs/features/summary.md` §2 / §5 / §6
- `docs/architecture.md` §4 AI 처리 상태, §7 비용 통제, §8 외부 AI 데이터 정책, §9 요약 LLM

## 범위

**포함**

- 요약 잡, 재시도, 입력 토큰 상한, 링크 소멸·본문 없음은 호출하지 않는다
- 콘텐츠 계약에 요약 필드
- LLM 호출은 인터페이스 뒤에 두고 자동 테스트는 가짜 구현으로 돈다
- 요약 1건당 비용의 측정·기록

**제외**

- 사용자 간 캐시 공유 — 초안 14
- 월 AI 한도 집행 — 초안 42
- 요약 재생성 (P1)

## 완료 조건

- [ ] 본문이 있는 콘텐츠는 요약이 1~3문장으로 저장되고 상태가 "완료"다
- [ ] 메타데이터만 있는 콘텐츠는 LLM 호출 없이 "본문 없음"이다
- [ ] 토큰 상한을 넘는 본문은 잘려 입력되고 실패하지 않는다
- [ ] 링크 소멸 콘텐츠에는 요약 잡이 실행되지 않는다
- [ ] 일시적 LLM 오류는 재시도되고 소진되면 "실패"다
- [ ] 한국어·영어 본문의 요약 언어가 D-13대로 정해진다
- [ ] 요약 1건당 비용이 기록된다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

가짜 LLM을 쓰는 worker 테스트, 실제 호출로 비용 측정 1회

## 선행 Issue

없음

## 미결정 사항

- 요약 LLM 제공자·모델 (architecture §9)
- D-13 요약 언어의 기준

---

## 13. [web] 요약과 요약 상태 표시

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/summary.md | req: SUM-3,SUM-4,SUM-5 -->

## 목표

웹의 목록과 검색 결과에서 요약을 보고, 요약이 어떤 상태인지 구분한다.

## PRD 참조

- `docs/features/summary.md` §2 SUM-3~5 / §4 / §6 완료 조건 2, 3

## 범위

**포함**

- 홈 최근 저장과 검색 결과의 요약 표시, 상태별 표시(생성 중·완료·실패·본문 없음)
- 메타데이터만 있으면 OG 설명을 요약 자리에

**제외**

- 재노출 카드 — 초안 34

## 완료 조건

- [ ] 요약 전·중·후·실패·본문 없음이 화면에서 서로 구분된다
- [ ] 메타데이터만 있는 콘텐츠는 OG 설명이 요약 자리에 나온다
- [ ] 요약과 함께 제목·출처·이미지가 보인다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

화면 컴포넌트 테스트

## 선행 Issue

- 초안 12 (요약 생성)

## 미결정 사항

없음

---

## 14. [worker] 같은 URL의 요약·임베딩을 사용자 간에 재사용한다

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/summary.md | req: SUM-6 -->

## 목표

공개 페이지의 같은 URL은 요약·임베딩을 한 번만 만든다.

## PRD 참조

- `docs/features/summary.md` §2 SUM-6
- `docs/architecture.md` §7
- `docs/product.md` §9 D-12

## 범위

**포함**

- 캐시 조회·저장, 공개 페이지 판정

**제외**

- 없음

## 완료 조건

- [ ] D-12에 정한 공개 페이지의 같은 URL은 두 번째 사용자부터 LLM·임베딩 호출이 없다
- [ ] 공개가 아닌 페이지의 본문에서 나온 요약은 다른 사용자에게 가지 않는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

worker 테스트

## 선행 Issue

- 초안 12 (요약 생성)
- 초안 15 (임베딩 생성)

## 미결정 사항

- D-12 공개 페이지 판정과 캐시 공유 범위

---

## 15. [worker] 저장한 콘텐츠의 임베딩 생성

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/search.md | req: SRCH-2 -->

## 목표

저장한 콘텐츠가 청크 단위로 임베딩된다. (`2026-11-18-semantic-search.md` 초안 A를 그대로 잇는다)

## PRD 참조

- `docs/features/search.md` §2 SRCH-2 / §5
- `docs/architecture.md` §5, §8, §9 의미 검색
- `docs/workflow/issue-drafts/2026-11-18-semantic-search.md` A

## 범위

**포함**

- 청크 분할, 임베딩 잡, pgvector 저장과 인덱스
- 임베딩 호출은 인터페이스 뒤에 두고 자동 테스트는 가짜 구현으로 돈다
- 임베딩 1건당 비용 측정

**제외**

- 월 AI 한도 집행 — 초안 42

## 완료 조건

- [ ] 본문이 있는 콘텐츠는 저장 후 청크 임베딩이 생긴다
- [ ] 본문이 없으면 제목·설명으로 임베딩한다
- [ ] 실패는 재시도되고 저장과 키워드 검색을 막지 않는다
- [ ] 휴지통으로 간 콘텐츠의 처리가 정해져 있다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

가짜 임베딩을 쓰는 worker 테스트

## 선행 Issue

없음

## 미결정 사항

- 임베딩 모델과 호스팅 방식 (architecture §9, 위 초안의 "먼저 정할 것" 1~3)

---

## 16. [api] 의미 검색과 키워드 결과의 결합

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/search.md | req: SRCH-2,SRCH-3,SRCH-4 -->

## 목표

자연어 문장으로 뜻이 가까운 콘텐츠를 찾고, 키워드 결과와 RRF로 합친다. (`2026-11-18-semantic-search.md` 초안 B)

## PRD 참조

- `docs/features/search.md` §2 SRCH-2~4 / §5 / §6 완료 조건 3~5
- `docs/workflow/issue-drafts/2026-11-18-semantic-search.md` B

## 범위

**포함**

- 쿼리 임베딩, 벡터 질의, RRF 결합(`core`), 매칭 근거로 관련 문장
- 웹 검색 화면에 관련 문장 표시

**제외**

- 모델 비교 평가 — 초안 17

## 완료 조건

- [ ] 쿼리 단어가 하나도 없지만 뜻이 가까운 콘텐츠가 검색된다
- [ ] 정확한 키워드가 제목에 있는 콘텐츠가 밀려 사라지지 않는다
- [ ] 각 결과에 매칭 근거(일치 키워드 또는 관련 문장)가 있다
- [ ] 임베딩이 없는 콘텐츠도 키워드로는 나온다
- [ ] 다른 사용자의 콘텐츠와 휴지통 콘텐츠는 나오지 않는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres와 가짜 임베딩을 쓰는 api 테스트

## 선행 Issue

- 초안 15 (임베딩 생성)

## 미결정 사항

없음

---

## 17. [docs] 한·영 혼합 평가 쿼리 100개와 검색 모델 비교 평가

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/search.md | req: SRCH-1,SRCH-2,SRCH-3 -->

## 목표

키워드 엔진과 임베딩 모델을 확정할 근거가 저장소에 있다 (Phase 2 게이트).

## PRD 참조

- `docs/features/search.md` §5 / §6 완료 조건 10 / §8
- `docs/product.md` §7
- `docs/architecture.md` §9

## 범위

**포함**

- 평가 쿼리 100개와 정답 세트, 평가 스크립트, 후보 비교 결과, `architecture.md` §9의 확정 기록

**제외**

- 검색 품질 개선 (P1)

## 완료 조건

- [ ] 한·영 혼합 쿼리 100개 세트가 저장소에 있다
- [ ] 후보(키워드 엔진, 임베딩 모델)별 결과가 기록돼 있다
- [ ] 확정한 구성이 `architecture.md` §9에 적혀 있다

## 검증 방법

평가 스크립트 실행 결과

## 선행 Issue

- 초안 16 (의미 검색과 결합)

## 미결정 사항

없음 — 설계에서 사용자에게 묻는다: 쿼리와 정답을 누가 어떻게 만드는지, 비교할 후보

---

## 18. [api] 요약을 키워드 검색 대상에 넣는다

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/search.md | req: SRCH-1 -->

## 목표

요약에만 있는 단어로도 콘텐츠가 검색된다.

## PRD 참조

- `docs/features/search.md` §2 SRCH-1
- `docs/architecture.md` §5 키워드 검색 인덱스

## 범위

**포함**

- 검색 인덱스와 질의에 요약 추가, 매칭 근거에 요약 구분

**제외**

- 메모 — 초안 20

## 완료 조건

- [ ] 요약에만 있는 단어로 검색된다
- [ ] 요약이 없는 콘텐츠의 검색은 지금과 같다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트

## 선행 Issue

- 초안 12 (요약 생성)

## 미결정 사항

없음

---

## 19. [mobile] 검색 화면

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/search.md | req: SRCH-4,SRCH-5,SRCH-6 -->

## 목표

모바일 앱에서 저장한 콘텐츠를 검색한다.

## PRD 참조

- `docs/features/search.md` §2 SRCH-4~6 / §3 모바일 / §6
- 디자인 `RebomiMobile`

## 범위

**포함**

- 검색 화면(디자인 기준), 결과의 제목·출처·저장일·매칭 근거·추출 수준, 원문 열기, 결과 없음 안내, 결과에서 보관·삭제

**제외**

- 의미 검색 자체 — 서버가 지원하면 같은 화면이 그대로 쓴다

## 완료 조건

- [ ] 단어로 검색하면 결과와 매칭 근거가 보인다
- [ ] 결과가 없으면 안내가 나온다
- [ ] 결과에서 원문 열기, 보관, 삭제가 된다
- [ ] 서버와의 통신은 `@rebomi/api-client`만 쓴다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

로직 단위 테스트, Android 에뮬레이터에서 수동 확인

## 선행 Issue

- #44

## 미결정 사항

없음

---

## 20. [api] 한 줄 메모와 메모 검색

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/library.md | req: LIB-5,SRCH-1 -->

## 목표

콘텐츠에 한 줄 메모를 달고, 메모의 단어로 검색된다.

## PRD 참조

- `docs/features/library.md` §2 LIB-5 / §6 완료 조건 3
- `docs/features/search.md` §2 SRCH-1

## 범위

**포함**

- 메모 저장·수정·삭제의 계약과 API, `api-client`
- 메모를 키워드 검색 대상과 매칭 근거에 넣는다

**제외**

- 메모 편집 화면 — 초안 23

## 완료 조건

- [ ] 메모를 저장하면 콘텐츠 응답에 나온다
- [ ] 메모의 단어로 검색된다
- [ ] 다른 사용자의 콘텐츠에는 메모를 달 수 없다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트

## 선행 Issue

없음

## 미결정 사항

없음 — 설계에서 사용자에게 묻는다: 메모의 길이 제한

---

## 21. [api] 여러 콘텐츠의 일괄 보관·삭제

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/library.md | req: LIB-8 -->

## 목표

여러 콘텐츠를 한 번에 보관하거나 휴지통으로 보낸다.

## PRD 참조

- `docs/features/library.md` §2 LIB-8 / §5 (일괄 삭제도 휴지통으로) / §6 완료 조건 5

## 범위

**포함**

- 일괄 보관·삭제의 계약과 API, `api-client`

**제외**

- 화면 — 초안 23

## 완료 조건

- [ ] 고른 콘텐츠가 한 번의 요청으로 보관 또는 삭제된다
- [ ] 일괄 삭제한 콘텐츠는 휴지통에서 복구된다
- [ ] 다른 사용자의 콘텐츠가 섞인 요청은 그 콘텐츠를 바꾸지 않는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트

## 선행 Issue

없음

## 미결정 사항

없음 — 설계에서 사용자에게 묻는다: 한 번에 받는 개수의 상한, 일부만 실패했을 때의 응답

---

## 22. [web] 보관함·Inbox·휴지통 화면

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/library.md | req: LIB-1,LIB-2,LIB-3,LIB-4,LIB-6 -->

## 목표

웹에서 Inbox, 보관함, 휴지통을 보고 정렬하고 가져온 폴더로 거른다.

## PRD 참조

- `docs/features/library.md` §2 LIB-1~4, LIB-6 / §4 / §5 / §6

## 범위

**포함**

- 세 화면(디자인 기준), 최근순·오래된 순 정렬, 가져온 폴더 필터, 보관·삭제·복구

**제외**

- 메모와 일괄 처리 — 초안 23
- 정리 화면 — 초안 25

## 완료 조건

- [ ] 새로 저장한 콘텐츠가 Inbox에 나타난다
- [ ] 보관·삭제·복구가 화면에서 되고 복구한 콘텐츠가 휴지통에서 사라진다
- [ ] 최근순·오래된 순 정렬이 된다
- [ ] 가져온 폴더를 고르면 그 폴더의 콘텐츠만 나온다
- [ ] 각 콘텐츠에 저장일·출처·추출 수준이 보인다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

화면 컴포넌트 테스트

## 선행 Issue

- 초안 29 (가져온 폴더 필터) — 폴더 필터 부분만

## 미결정 사항

- 디자인에 보관함·Inbox·휴지통 화면이 없다 (2026-11-24 확인)
- D-22 Inbox의 범위
- library §5 [확인 필요] 보관함 화면의 범위
- D-11 "나중에 보기"의 동작
- D-23 휴지통에서 완전히 지우기

---

## 23. [web] 메모 편집과 여러 콘텐츠 일괄 처리

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/library.md | req: LIB-5,LIB-8 -->

## 목표

웹에서 메모를 쓰고, 여러 콘텐츠를 골라 한 번에 보관·삭제한다.

## PRD 참조

- `docs/features/library.md` §2 LIB-5, LIB-8 / §6 완료 조건 3, 5

## 범위

**포함**

- 메모 편집, 여러 개 고르기와 일괄 보관·삭제

**제외**

- 없음

## 완료 조건

- [ ] 메모를 쓰고 고칠 수 있고 새로 고쳐도 남아 있다
- [ ] 여러 콘텐츠를 골라 한 번에 보관·삭제한다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

화면 컴포넌트 테스트

## 선행 Issue

- 초안 20 (메모)
- 초안 21 (일괄 처리)
- 초안 22 (보관함 화면)

## 미결정 사항

- 디자인에 메모 편집과 일괄 선택이 없다

---

## 24. [mobile] Inbox·보관함과 보관·삭제

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/library.md | req: LIB-2,LIB-3,LIB-4 -->

## 목표

모바일 앱에서 Inbox와 보관함을 보고 보관·삭제한다.

## PRD 참조

- `docs/features/library.md` §3 모바일 / §4 / §6

## 범위

**포함**

- Inbox·보관함 화면(디자인 기준), 보관·삭제·복구

**제외**

- 없음

## 완료 조건

- [ ] 새로 저장한 콘텐츠가 Inbox에 나타난다
- [ ] 보관·삭제가 되고 웹에도 반영된다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

Android 에뮬레이터에서 수동 확인

## 선행 Issue

- #44

## 미결정 사항

- library §3 [확인 필요] 모바일에서 정리 화면·일괄 처리까지 제공하는지
- D-22 Inbox의 범위
- 디자인에 모바일 보관함 화면이 있는지 확인되지 않았다

---

## 25. [web] 정리 화면 (링크 소멸 일괄 삭제)

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/library.md | req: LIB-7 -->

## 목표

링크가 죽은 콘텐츠를 모아 보고 한 번에 삭제한다.

## PRD 참조

- `docs/features/library.md` §2 LIB-7 / §4 / §6 완료 조건 6
- `docs/features/import.md` §4 (가져오기 뒤 진입 유도)

## 범위

**포함**

- 링크 소멸 콘텐츠 목록 조회(API), 정리 화면, 일괄 삭제, 가져오기 완료 뒤의 진입 유도

**제외**

- 중복·유사 정리, 오래된 콘텐츠 정리 추천 (P1, 단 D-01)

## 완료 조건

- [ ] 정리 화면에 링크 소멸 콘텐츠가 모여 나온다
- [ ] 한 번에 삭제되고 휴지통에서 복구할 수 있다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

api 테스트, 화면 컴포넌트 테스트

## 선행 Issue

- 초안 21 (일괄 처리)
- 초안 28 (링크 소멸 분류)

## 미결정 사항

- D-01 정리 화면이 P0에서 다루는 범위
- 디자인에 정리 화면이 없다

---

## 26. [api] Chrome 북마크 HTML 가져오기

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/import.md | req: IMP-1,IMP-2,IMP-3,IMP-4,IMP-7 -->

## 목표

Chrome 북마크 HTML 파일을 올리면 URL들이 한 번에 등록되고, 진행 상태를 조회할 수 있다.

## PRD 참조

- `docs/features/import.md` §2 / §4 / §5 / §6
- `docs/architecture.md` §4 (출처 `import`, 재노출 포함 여부)

## 범위

**포함**

- 파일 파싱, 정규화 URL 기준 중복 제거, 일괄 등록, 가져온 폴더명 저장, 재노출 기본 제외
- 가져오기 작업과 진행 상태 조회의 계약·API·`api-client`

**제외**

- Free 한도 집행 — 초안 41
- 링크 소멸 분류 — 초안 28
- 화면 — 초안 30

## 완료 조건

- [ ] 폴더가 있는 북마크 HTML을 올리면 모든 유효 URL이 등록되고 가져온 폴더명이 남는다
- [ ] 파일 안의 중복과 이미 저장된 URL은 다시 등록되지 않는다
- [ ] 등록 직후 목록에 보이고 제목·URL로 검색된다
- [ ] 북마크 형식이 아닌 파일은 거부되고 이유를 구분할 수 있다
- [ ] 1,000개 이상도 등록 요청이 사용자를 기다리게 하지 않는다
- [ ] 가져온 콘텐츠는 재노출 포함 여부가 꺼져 있다
- [ ] 진행 상태(전체 대비 완료 수)를 조회할 수 있다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트 (1,000개 이상 파일 포함)

## 선행 Issue

없음

## 미결정 사항

- import §8 [확인 필요] 저장일을 북마크의 추가 날짜로 할지 가져온 시점으로 할지

---

## 27. [worker] 가져온 콘텐츠를 최근 북마크부터 처리한다

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/import.md | req: IMP-6 -->

## 목표

가져온 북마크의 메타데이터 수집과 본문 추출이 최근 것부터 차례로 진행되고, 직접 저장한 콘텐츠의 처리를 막지 않는다.

## PRD 참조

- `docs/features/import.md` §2 IMP-6 / §5 / §6 완료 조건 6
- `docs/architecture.md` §5 (요청 제한·재시도)

## 범위

**포함**

- 가져온 콘텐츠의 처리 순서, 진행 상태 갱신, 같은 도메인으로의 요청 제한

**제외**

- 요약·임베딩 — 초안 12, 초안 15

## 완료 조건

- [ ] 처리 순서가 최근 북마크부터다
- [ ] 대량 가져오기 중에도 직접 저장한 콘텐츠가 밀리지 않는다
- [ ] 진행 상태가 갱신된다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

worker 테스트, e2e 연결 테스트

## 선행 Issue

- 초안 26 (북마크 가져오기 API)

## 미결정 사항

없음

---

## 28. [worker] 링크 생존 확인과 링크 소멸 분류

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/import.md | req: IMP-5 -->

## 목표

응답이 없거나 사라진 링크가 링크 소멸로 분류되고, 그런 콘텐츠에는 AI 비용을 쓰지 않는다.

## PRD 참조

- `docs/features/import.md` §2 IMP-5 / §5
- `docs/architecture.md` §4 링크 상태
- `docs/product.md` §9 D-04

## 범위

**포함**

- 링크 생존 확인, 링크 상태 전이, 링크 소멸이면 요약·임베딩 생략

**제외**

- 정리 화면 — 초안 25

## 완료 조건

- [ ] 404를 돌려주는 URL은 링크 소멸로 표시된다
- [ ] 링크 소멸 콘텐츠에는 요약·임베딩 잡이 실행되지 않는다
- [ ] 일시적 실패는 D-04에 정한 대로 소멸과 구분된다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

가짜 응답을 쓰는 worker 테스트

## 선행 Issue

없음

## 미결정 사항

- D-04 일시적 접근 실패와 링크 소멸의 구분

---

## 29. [api] 가져온 폴더 목록과 폴더별 필터

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/library.md | req: LIB-6,IMP-2 -->

## 목표

가져온 폴더의 목록을 받고, 폴더로 콘텐츠 목록을 거른다.

## PRD 참조

- `docs/features/library.md` §2 LIB-6 / §6 완료 조건 4
- `docs/features/import.md` §2 IMP-2

## 범위

**포함**

- 가져온 폴더 목록 API, 콘텐츠 목록의 폴더 필터, 계약과 `api-client`

**제외**

- 화면 — 초안 22

## 완료 조건

- [ ] 사용자의 가져온 폴더 목록이 나온다
- [ ] 폴더를 지정하면 그 폴더의 콘텐츠만 나온다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트

## 선행 Issue

- 초안 26 (북마크 가져오기 API)

## 미결정 사항

없음

---

## 30. [web] 북마크 가져오기 화면

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/import.md | req: IMP-1,IMP-4 -->

## 목표

웹에서 북마크 파일을 올리고 진행 상태를 본다.

## PRD 참조

- `docs/features/import.md` §3 웹 / §4 / §6 완료 조건 4, 8

## 범위

**포함**

- 파일 올리기, 거부 이유 표시, 진행 상태, 완료 뒤 정리 화면으로의 안내
- 마이페이지의 진입점

**제외**

- 없음

## 완료 조건

- [ ] 북마크 파일을 올리면 등록된 수가 보이고 목록에 나타난다
- [ ] 처리 중 진행 상태가 갱신된다
- [ ] 북마크 형식이 아닌 파일은 이유와 함께 거부된다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

화면 컴포넌트 테스트, 브라우저 확인

## 선행 Issue

- 초안 26 (북마크 가져오기 API)

## 미결정 사항

- 디자인에 가져오기 화면이 없다

---

## 31. [core] 재노출 선정 규칙

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-1,RES-2 -->

## 목표

후보와 설정을 받아 한 회차를 돌려주는 순수 함수가 있다.

## PRD 참조

- `docs/features/resurfacing.md` §5 대상 풀, 선정 기준 / §6 완료 조건 1~5
- `docs/architecture.md` §6

## 범위

**포함**

- 선정 규칙(다섯 기준), 대상 풀 판정(출처 기본값, 콘텐츠별 설정, 폴더 포함, 보관됨 포함)

**제외**

- 주기 실행과 저장 — 초안 32

## 완료 조건

- [ ] 다섯 기준 각각을 어기는 후보가 선정되지 않음을 단위 테스트로 보인다
- [ ] 직접 저장은 기본 후보, 가져온 콘텐츠는 폴더를 포함시키기 전까지 후보가 아니다
- [ ] 링크 소멸과 "재노출 중단"은 어떤 설정으로도 선정되지 않는다
- [ ] 한 회차에 같은 도메인이 3개 이상 들어가지 않는다
- [ ] 후보가 모자랄 때 D-05대로 동작한다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

`core` 단위 테스트

## 선행 Issue

없음

## 미결정 사항

- D-05 회당 개수, 후보 부족 시 동작, "최근 7일 내 확인"의 정의
- D-22 Inbox 콘텐츠가 재노출 대상인지
- resurfacing §5 [제안] 대상 풀이 겹칠 때의 우선순위

---

## 32. [worker] 주기적 회차 선정과 저장, 재노출 설정 API

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-1,RES-3,RES-6 -->

## 목표

사용자마다 정한 빈도로 회차가 만들어져 저장되고, 사용자가 빈도와 대상을 바꿀 수 있다.

## PRD 참조

- `docs/features/resurfacing.md` §2 RES-1, RES-3, RES-6 / §5 / §6 완료 조건 7, 8
- `docs/architecture.md` §6

## 범위

**포함**

- 주기 실행 잡, 회차와 노출 기록 저장
- 재노출 설정(빈도, 끄기, 보관됨 포함, 가져온 폴더 포함)과 콘텐츠별 중단·포함의 계약·API·`api-client`

**제외**

- 푸시·이메일 — 초안 37~39

## 완료 조건

- [ ] 빈도 설정대로 회차가 만들어진다
- [ ] 빈도를 바꾸면 다음 회차부터 반영되고, 끄면 선정이 멈춘다
- [ ] 보관됨 포함을 끄면 보관됨 콘텐츠가 선정되지 않는다
- [ ] 가져온 폴더를 포함시키면 그 폴더의 콘텐츠가 후보가 된다
- [ ] 같은 회차가 두 번 만들어지지 않는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

시간을 주입한 worker·api 테스트

## 선행 Issue

- 초안 31 (선정 규칙)

## 미결정 사항

- D-05 기본 빈도와 빈도 선택지

---

## 33. [api] 홈 재노출 피드와 카드 액션

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-4,RES-5 -->

## 목표

홈이 보여줄 이번 회차의 카드와, 카드에서 하는 다섯 액션의 API가 있다.

## PRD 참조

- `docs/features/resurfacing.md` §2 RES-4~5 / §5 그 밖의 규칙 / §6 완료 조건 6

## 범위

**포함**

- 홈 피드 조회, 액션: 원문 열기(기록), 나중에 다시 보기, 보관하기, 재노출 중단, 삭제하기
- 계약과 `api-client`

**제외**

- 화면 — 초안 34, 초안 35

## 완료 조건

- [ ] 이번 회차의 카드 3~5개가 나온다
- [ ] 다섯 액션이 각각 동작한다
- [ ] 원문 열기는 콘텐츠를 풀에서 빼지 않는다
- [ ] 보관하기는 보관 상태만 바꾼다
- [ ] "재노출 중단"한 콘텐츠는 다시 선정되지 않는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트

## 선행 Issue

- 초안 32 (회차 선정과 저장)

## 미결정 사항

- D-05 "나중에 다시 보기"의 기간, 홈의 "오늘의 재노출"과 주 2~3회의 관계
- D-11 Inbox "나중에 보기"와의 관계

---

## 34. [web] 홈 재노출 피드, 카드 액션, 자세히 보기

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-4,RES-5 -->

## 목표

웹 홈에 재노출 카드가 보이고 카드에서 바로 처리한다.

## PRD 참조

- `docs/features/resurfacing.md` §2 RES-4~5 / §4 / §6 완료 조건 6
- 디자인 `RebomiWeb`(재노출 카드, 자세히 보기)

## 범위

**포함**

- 홈의 재노출 카드(디자인 기준), 카드 펼침과 요약, 다섯 액션, 자세히 보기
- 회차가 없을 때의 홈

**제외**

- 재노출 설정 — 초안 36

## 완료 조건

- [ ] 홈에 재노출 카드가 표시된다
- [ ] 다섯 액션이 각각 동작하고 결과가 화면에 반영된다
- [ ] 회차가 없으면 빈 화면이 아니라 지금의 홈이 보인다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

화면 컴포넌트 테스트

## 선행 Issue

- 초안 33 (홈 피드 API)
- 초안 13 (요약 표시)

## 미결정 사항

없음

---

## 35. [mobile] 홈 재노출 피드와 카드 액션

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-4,RES-5 -->

## 목표

모바일 홈에 재노출 카드가 보이고 카드에서 바로 처리한다.

## PRD 참조

- `docs/features/resurfacing.md` §2 RES-4~5 / §3 모바일
- 디자인 `RebomiMobile`("오늘의 재발견")

## 범위

**포함**

- 홈의 재노출 카드(디자인 기준), 요약 표시, 다섯 액션

**제외**

- 푸시 — 초안 37

## 완료 조건

- [ ] 홈에 재노출 카드가 표시된다
- [ ] 다섯 액션이 각각 동작한다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

Android 에뮬레이터에서 수동 확인

## 선행 Issue

- 초안 33 (홈 피드 API)
- #44

## 미결정 사항

없음

---

## 36. [web] 재노출 설정 (웹·모바일 마이페이지)

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-3,RES-6,RES-8 -->

## 목표

마이페이지에서 재노출 빈도와 대상, 이메일 수신을 바꾼다.

## PRD 참조

- `docs/features/resurfacing.md` §2 RES-3, RES-6, RES-8 / §4
- `docs/features/mypage.md` §2 제외(다른 문서의 요구사항)

## 범위

**포함**

- 빈도 선택과 한 번에 끄기, 보관됨 포함, 가져온 폴더 선택, 이메일 수신
- 웹과 모바일의 마이페이지 양쪽

**제외**

- 없음

## 완료 조건

- [ ] 빈도를 바꾸거나 끌 수 있고 다시 열어도 남아 있다
- [ ] 보관됨 포함과 가져온 폴더 선택을 바꿀 수 있다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

화면 테스트

## 선행 Issue

- 초안 32 (재노출 설정 API)
- #55
- #56

## 미결정 사항

- D-05 빈도 선택지
- D-24 이메일 수신 동의
- 디자인에 설정 화면이 없다

---

## 37. [mobile] 푸시 권한 동의와 수신

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-7 -->

## 목표

동의한 사용자의 기기가 재노출 푸시를 받을 수 있게 등록된다.

## PRD 참조

- `docs/features/resurfacing.md` §2 RES-7 / §5 알림 / §6
- `docs/architecture.md` §9 푸시

## 범위

**포함**

- 권한 동의 요청, 기기 토큰 등록·해제의 계약과 API, 푸시를 눌렀을 때 홈으로

**제외**

- 발송 — 초안 38

## 완료 조건

- [ ] 동의하면 기기가 등록되고, 거부하거나 로그아웃하면 등록이 없다
- [ ] 푸시를 누르면 앱의 홈이 열린다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

Android 에뮬레이터·기기에서 수동 확인

## 선행 Issue

- #44

## 미결정 사항

- 푸시 제공자 (architecture §9)
- 동의를 언제 묻는지 (디자인)

---

## 38. [worker] 재노출 푸시 발송

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-7 -->

## 목표

회차가 만들어지면 동의한 사용자에게 푸시가 간다.

## PRD 참조

- `docs/features/resurfacing.md` §2 RES-7 / §5 알림 / §6 완료 조건 7, 9

## 범위

**포함**

- 회차마다 발송, 재노출을 끄면 중단, 만료된 기기 토큰 정리

**제외**

- 없음

## 완료 조건

- [ ] 동의하지 않은 사용자에게는 푸시가 가지 않는다. Free 사용자도 동의하면 받는다
- [ ] 재노출을 끄면 푸시가 멈춘다
- [ ] 한 회차의 푸시가 같은 기기에 두 번 가지 않는다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

가짜 발송기를 쓰는 worker 테스트

## 선행 Issue

- 초안 32 (회차 선정과 저장)
- 초안 37 (푸시 수신)

## 미결정 사항

- 푸시 제공자 (architecture §9)
- D-05 보내는 시각

---

## 39. [worker] 재노출 이메일 발송

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/resurfacing.md | req: RES-8 -->

## 목표

회차가 만들어지면 이메일 수신에 동의한 사용자에게 재노출 콘텐츠가 메일로 간다.

## PRD 참조

- `docs/features/resurfacing.md` §2 RES-8 / §5 알림 / §6
- `docs/product.md` §9 D-24
- `docs/architecture.md` §9 이메일 발송

## 범위

**포함**

- 이메일 수신 동의의 저장, 회차마다 발송, 수신 거부

**제외**

- 없음

## 완료 조건

- [ ] 동의한 사용자에게 회차마다 메일이 가고, 동의하지 않은 사용자에게는 가지 않는다
- [ ] 한 회차의 메일이 같은 사용자에게 두 번 가지 않는다
- [ ] 재노출을 끄면 메일이 멈춘다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

가짜 발송기를 쓰는 worker 테스트

## 선행 Issue

- 초안 32 (회차 선정과 저장)

## 미결정 사항

- D-24 재노출 이메일의 대상 요금제, 동의·수신 거부, 내용
- 이메일 발송 제공자 (architecture §9)

---

## 40. [api] 요금제 상태와 사용량 집계

라벨: `status:todo`

<!-- rebomi-issue | prd: docs/features/billing.md | req: BILL-1,BILL-4 -->

## 목표

사용자의 요금제와 이번 달 사용량(저장 수, AI 처리 수)을 서버가 알고 조회할 수 있다.

## PRD 참조

- `docs/features/billing.md` §2 / §6 완료 조건 1, 3 / §8 (집계는 결정과 무관하게 먼저 할 수 있다)
- `docs/architecture.md` §7

## 범위

**포함**

- 요금제 상태의 저장, 저장 수와 AI 처리 수의 집계, 달이 바뀌면 AI 집계 초기화, 조회 계약·API·`api-client`

**제외**

- 한도 집행 — 초안 41, 초안 42
- 결제 — 초안 43

## 완료 조건

- [ ] 사용자의 요금제와 이번 달 저장 수·AI 처리 수가 조회된다
- [ ] AI 집계는 달이 바뀌면 0부터 다시 센다
- [ ] 다른 사용자의 사용량은 볼 수 없다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

시간을 주입한 api 테스트

## 선행 Issue

- #52 (내 계정 정보 — 요금제 이름의 자리)

## 미결정 사항

없음 — AI 처리 수는 요약(초안 12)·임베딩(초안 15)이 생긴 뒤에 실제로 올라간다

---

## 41. [api] 저장·가져오기 한도 집행

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/billing.md | req: BILL-2 -->

## 목표

Free의 저장 개수와 가져오기 한도를 서버가 지킨다.

## PRD 참조

- `docs/features/billing.md` §2 BILL-2 / §5 / §6 완료 조건 2, 4
- `docs/product.md` §9 D-03

## 범위

**포함**

- 저장·가져오기 요청의 한도 판정, 초과를 알리는 에러 코드, 웹·확장·모바일의 초과 이유 표시

**제외**

- 없음

## 완료 조건

- [ ] Free 사용자의 저장·가져오기가 D-03에 정한 대로 동작한다
- [ ] 클라이언트를 우회한 요청도 한도를 넘지 못한다
- [ ] 확장에서 한도 초과로 저장이 실패하면 이유가 보인다
- [ ] 계측: 한도 도달이 기록된다 (D-18)
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

실제 Postgres를 쓰는 api 테스트

## 선행 Issue

- 초안 40 (사용량 집계)

## 미결정 사항

- D-03 한도 초과 동작, 가져오기 "최초 1회"의 판정

---

## 42. [worker] AI 월 한도 집행

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/billing.md | req: BILL-3 -->

## 목표

요약·임베딩이 월 한도를 넘지 않는다.

## PRD 참조

- `docs/features/billing.md` §2 BILL-3 / §5
- `docs/features/summary.md` §5
- `docs/architecture.md` §7

## 범위

**포함**

- 잡 실행 직전의 한도 판정, 한도를 넘은 콘텐츠의 상태

**제외**

- 없음

## 완료 조건

- [ ] 월 한도를 넘으면 요약·임베딩 호출이 일어나지 않는다
- [ ] 대량 가져오기에서 한도를 넘는 분량은 메타데이터만 남는다
- [ ] 한도를 넘은 콘텐츠가 사용자에게 D-03에 정한 상태로 보인다
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

worker 테스트

## 선행 Issue

- 초안 40 (사용량 집계)
- 초안 12 (요약 생성)

## 미결정 사항

- D-03 AI 한도 초과 시 동작과 사용자에게 보이는 상태

---

## 43. [api] Pro 구독 결제

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/billing.md | req: BILL-4 -->

## 목표

Pro를 결제하면 한도가 바뀌고, 구독이 끝나면 Free로 돌아간다.

## PRD 참조

- `docs/features/billing.md` §2 BILL-4 / §6 완료 조건 5, 6, 8
- `docs/product.md` §9 D-10

## 범위

**포함**

- 결제 시작, 결제 웹훅, 요금제 전환, 해지·만료 처리
- 웹의 요금제·사용량·결제 화면과 모바일의 요금제·남은 한도 표시(마이페이지)

**제외**

- 연간 구독, 팀 요금제

## 완료 조건

- [ ] Pro 결제가 성공하면 한도가 즉시 바뀌고, 실패하면 Free로 남는다
- [ ] 구독이 끝나면 Free 한도로 돌아가고 저장된 데이터는 D-10대로 처리된다
- [ ] 요금제와 이번 달 사용량이 마이페이지에 보인다
- [ ] 계측: Free→Pro 전환이 기록된다 (D-18)
- [ ] `pnpm lint && pnpm typecheck && pnpm test && pnpm build`가 통과한다

## 검증 방법

결제 제공자의 테스트 모드

## 선행 Issue

- 초안 40 (사용량 집계)
- #55
- #56

## 미결정 사항

- D-10 결제 수단, Pro 가격, 모바일 앱 내 결제, 해지·다운그레이드 처리
- 디자인에 요금제 화면이 없다

---

## 44. [worker] 1년이 지난 대기 명단 응답을 지운다

라벨: `needs-decision`

<!-- rebomi-issue | prd: docs/features/waitlist.md | req: WAIT-12 -->

## 목표

고지한 보관 기간(1년)이 지난 설문 응답과 이메일이 남아 있지 않다.

## PRD 참조

- `docs/features/waitlist.md` WAIT-12
- `docs/product.md` §9 D-19

## 범위

**포함**

- D-19에 정한 방법의 삭제

**제외**

- 없음

## 완료 조건

- [ ] 받은 날부터 1년이 지난 응답이 D-19에 정한 대로 지워진다

## 검증 방법

시간을 주입한 테스트 또는 절차 문서

## 선행 Issue

- 초안 1 (운영 배포 — 워커가 운영에 있어야 한다)

## 미결정 사항

- D-19 지우는 방법(주기 작업 / 수동), 이메일 없이 남은 응답도 지우는지
