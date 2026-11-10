# Rebomi

저장한 콘텐츠를 다시 보여주고(재노출), 필요한 순간 찾아주는(검색) 서비스다. 차별점은 재노출이고, 수집·요약·검색·관리는 그 기반이다. 웹·Chrome 확장·iOS·Android 네 클라이언트와 API·워커가 한 모노레포에 있다. 현재는 스캐폴드 단계로 `/health` 한 경로만 구현돼 있다.

## 공통 원칙

- 저장하는 쪽이 본문도 함께 보낸다. 저장은 즉시, AI 처리는 비동기.
- 읽기나 Inbox 정리를 강요하지 않는다.
- AI는 원본을 이해하고 찾는 일을 돕되 원본을 대체하지 않는다.
- P0 범위를 임의로 줄이거나 P1으로 내리지 않는다. 답이 없는 제품 정책은 추측하지 말고 `docs/product.md` §9에 올린다.
- 서버–클라이언트 계약은 `packages/api-contract` 한 곳. 클라이언트는 `packages/api-client`로만 통신한다.
- 콘텐츠의 보관 상태·링크 상태·추출 수준·AI 처리 상태·재노출 포함 여부는 서로 다른 축이다. 한 필드에 섞지 않는다.

## 문서

| 문서 | 내용 |
| --- | --- |
| `docs/product.md` | 제품 기준: 원칙, P0/P1/P2, 단계·게이트, 지표·가설, **미결정 사항(D-xx)** |
| `docs/architecture.md` | 실제 구성과 구현 상태, 패키지 경계, 공통 상태, 데이터 흐름, 비용 통제, 확정 기술 vs 후보 |
| `docs/features/*.md` | 기능 PRD: account, capture, import, summary, search, resurfacing, library, billing. 요구사항 ID(`CAP-1`)와 완료 조건 |
| `docs/workflow/github.md` | Issue·라벨·브랜치·PR·완료 기준 |
| `docs/superpowers/specs|plans/` | Superpowers 설계·계획 |
| `docs/PRD-v0.5.md` | 이력용 원본. 기준이 아니다. 고치지 않는다 |

## 작업별 읽기 범위

전체 PRD를 매번 읽지 않는다. 아래는 시작점이며, 공통 계약이나 의존 기능에 닿으면 넓힌다.

| 작업 | 읽을 것 |
| --- | --- |
| 제품 방향·출시 범위 변경 | `product.md` + 영향받는 기능 문서 |
| 기능 기획·Issue 분해 | 해당 기능 문서 + 그 문서가 링크한 공통 규칙 |
| Issue 구현 | Issue + 참조된 PRD 절 + 관련 코드 |
| 작은 버그 수정 | 재현 조건 + 관련 코드. 필요할 때만 PRD |
| 인증·상태·API 등 공통 계약 변경 | `architecture.md` + 영향받는 기능 문서 |

## 스킬

| 요청 | 스킬 |
| --- | --- |
| 요구사항 추가·변경·결정, PRD 정리 | `rebomi-prd` |
| "이 PRD를 GitHub 이슈로 등록해줘" | `rebomi-issues` |
| "#23 진행해줘", "#23 상태 확인하고 완료됐으면 정리해줘" | `rebomi-issue-run` |

Issue는 초안을 사용자가 승인한 뒤에 등록한다. 구현·테스트·리뷰 절차는 Superpowers를 그대로 쓴다. PR 병합은 사용자가 한다.

## 명령

`pnpm dev` (web·api·worker) · `pnpm lint` · `pnpm typecheck` · `pnpm test` (실제 Postgres 필요: `docker compose -f docker/compose.yml up -d`) · `pnpm build` · `pnpm db:migrate`
