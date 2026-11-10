---
name: rebomi-issue-run
description: Use when given a Rebomi GitHub issue number to work on or check — "#23 진행해줘", "23번 이슈 구현해줘", "#23 이어서 해줘", "#23 상태 확인하고 완료됐으면 정리해줘", "PR 머지했어, 이슈 정리해줘" — including resuming an issue already in progress and closing out an issue after its PR merged.
---

# Rebomi Issue 실행·정리

Issue 번호 하나를 받아 GitHub 상태를 실제로 갱신하면서 Superpowers로 구현하고, 완료 기준을 충족하면 닫는다.

**REQUIRED:** 시작할 때 `docs/workflow/github.md`를 읽는다. 도구, 상태 라벨, 브랜치·PR 규칙, 완료 기준이 거기 있다.

## 0. 항상 먼저: 현재 상태 조회

무엇을 요청받았든 먼저 `git fetch origin`을 하고 GitHub에서 읽는다. 기억이나 이전 대화로 대신하지 않는다.

- Issue 본문, 열림/닫힘(닫혔다면 사유), 라벨, 댓글 전체
- 연결된 PR: `Closes #N`·`Refs #N`을 가진 PR과 `issue/N-*` 브랜치의 PR (열린 것·병합된 것·닫힌 것), 열린 PR의 CI 결과
- 로컬·원격의 `issue/N-*` 브랜치, 그 브랜치의 `docs/superpowers/specs|plans/*issue-N-*`
- "선행 Issue"에 적힌 각 Issue: 닫혔는지, **병합으로 완료된 것인지**

아래 표를 **위에서부터 읽어 처음 맞는 행**을 따른다.

| 조회 결과 | 할 일 |
| --- | --- |
| 그 번호의 Issue가 없다, 또는 PR 번호다 | 아무것도 만들지 않는다. 없다는 사실을 보고하고 번호를 확인받는다 |
| 닫힘 + 병합된 PR 있음 | **다시 구현하지 않는다.** §3 정리(라벨, 완료 조건 대조)만 하고 보고한다 |
| 닫힘 + 병합된 PR 없음 (수동 종료, not planned) | 아무것도 하지 않는다. 경위를 보고하고 사용자에게 묻는다 |
| 열림 + PR이 병합됨 | §3 정리 |
| 열림 + PR이 열려 있음 | 새로 구현하지 않는다. CI·리뷰 상태를 보고한다. 요청이 "진행"이고 CI 실패나 리뷰 지적이 있으면 **그 브랜치에서** 고친다 |
| 열림 + `needs-decision`, 또는 본문 "미결정 사항"이 비어 있지 않음 | 실행하지 않는다. 필요한 결정을 사용자에게 묻는다. 답을 받으면 `rebomi-prd`로 문서에 반영하고 Issue 본문을 고친 뒤 라벨을 `status:todo`로 바꾸고 계속한다 |
| 열림 + 선행이 충족되지 않음 | 실행하지 않는다. 남은 선행과 그 상태를 보고한다. 라벨·댓글은 건드리지 않는다 |
| 열림 + `status:in-progress` (브랜치·진행 기록 있음) | 그 브랜치와 계획 문서에서 **이어서** 한다. 브랜치가 없으면 §1.4부터 |
| 열림 + `status:todo` + 선행 충족 | 요청이 "진행"이면 §1부터. 요청이 "상태 확인·정리"면 구현하지 않고 상태만 보고한다 |

**선행 충족**이란 적힌 선행이 모두 병합으로 닫혔다는 뜻이다. 다음은 충족이 아니다: 열려 있음, `(미등록)`으로 적힌 선행, 병합 없이 닫힌 선행(not planned). 마지막 경우는 사용자에게 묻는다.

## 1. 실행 준비

1. **읽기** — Issue 본문, "PRD 참조"에 적힌 문서의 **그 절**, 그 절이 인용한 다른 문서의 요구사항 ID·공통 규칙 절, 관련 코드. 기능 문서를 통째로 읽거나 인용되지 않은 기능 문서를 읽는 데서 시작하지 않는다. 구현 중 공통 계약(상태·인증·API)에 닿으면 `docs/architecture.md`의 해당 절로 넓힌다.
2. **실행 가능 확인** — 완료 조건 하나하나가 검증 가능한가. 아니면 §0 표의 `needs-decision` 행으로 간다.
3. **브랜치** — `origin/main`의 최신 커밋에서 `issue/<번호>-<슬러그>`를 만든다. **REQUIRED SUB-SKILL:** superpowers:using-git-worktrees (브랜치 이름은 이 규칙을 따르게 한다)
4. **진행 중 표시** — 브랜치를 만든 뒤 라벨을 `status:in-progress`로 바꾸고, 브랜치 이름을 적은 시작 댓글을 남긴다.

## 2. Superpowers로 구현

Issue의 목표·범위·완료 조건이 요구사항이다. 설치된 Superpowers 스킬을 쓴다. 여기서 절차를 다시 정의하지 않는다.

| 단계 | 스킬 | 비고 |
| --- | --- | --- |
| 설계 | superpowers:brainstorming | Issue가 설계 판단을 남긴 경우. `docs/superpowers/specs/YYYY-MM-DD-issue-<N>-<주제>-design.md` |
| 계획 | superpowers:writing-plans | `docs/superpowers/plans/YYYY-MM-DD-issue-<N>-<주제>.md` |
| 구현 | superpowers:subagent-driven-development 또는 superpowers:executing-plans, superpowers:test-driven-development | |
| 막힘 | superpowers:systematic-debugging | |
| 검증 | superpowers:verification-before-completion | 완료 조건을 **하나씩** 실제로 확인한다. `pnpm lint && pnpm typecheck && pnpm test && pnpm build` |
| 리뷰 | superpowers:requesting-code-review | |
| 마무리 | superpowers:finishing-a-development-branch | 선택지는 언제나 **push + PR**이다. 로컬 병합을 고르지 않는다. worktree는 PR이 병합될 때까지 둔다 |

**Superpowers가 사용자 승인을 기다리는 지점**

"#N 진행해줘"는 그 Issue의 범위 안에서 PR까지 가라는 요청이다.

| 결정의 종류 | 처리 |
| --- | --- |
| 기술 결정 (라이브러리, 스키마 모양, 파일 구조, 테스트 방식) | 묻지 않고 정한다. 근거와 함께 Issue 댓글과 PR 본문에 남긴다 |
| 제품 동작 결정 (사용자에게 보이는 동작, 한도, 문구의 뜻, 완료 조건의 해석) | 임의로 정하지 않는다. 아래 "제품 결정이 필요해지면" |
| 설계·계획 문서 자체의 승인 | 기다리지 않는다. 문서를 브랜치에 커밋하고 계속한다. 사용자가 이 Issue에 대해 "설계부터 보여줘"라고 했으면 그때는 기다린다 |

공통 계약이 생기거나 바뀌면 `docs/architecture.md`를 같은 PR에서 고친다.

**범위를 지킨다**

- Issue의 "제외"에 있는 것, 관련 없는 P1 기능, 구조 개편을 넣지 않는다.
- 완료 조건이 틀렸거나 달성할 수 없다고 판단되면 조건을 조용히 바꾸지 않는다. 제품 결정과 같은 방식으로 되돌린다.

**제품 결정이 필요해지면**

1. 그 부분의 구현을 멈춘다. 영향받지 않는 완료 조건은 계속한다.
2. Issue 댓글로 무엇이 정해져야 하는지 남기고 사용자에게 묻는다.
3. 남은 완료 조건이 전부 그 결정에 걸려 있으면 라벨을 `needs-decision`으로 바꾼다. 일부만이면 `status:in-progress`를 둔다.
4. 답이 PRD를 바꾸면 `rebomi-prd`로 반영하고, 그 문서 변경을 이 Issue 브랜치에 커밋한다.

**그 밖의 이유로 막혔을 때** — 완료로 처리하지 않는다. 원인, 시도한 것, 필요한 조치를 Issue 댓글로 남기고 라벨은 `status:in-progress`로 둔다. 사용자에게 같은 내용을 보고한다.

## 2.5. PR

완료 조건을 모두 확인한 뒤에만:

1. 브랜치를 push한다.
2. PR을 만든다. 본문은 `.github/pull_request_template.md` — `Closes #N`, 완료 조건별 검증 증거.
3. 라벨을 `status:in-review`로 바꾸고, PR 링크와 검증 요약을 Issue 댓글로 남긴다.
4. CI 결과를 확인한다. 실패하면 같은 브랜치에서 고친다. 고치지 못하면 라벨을 `status:in-progress`로 되돌리고 원인을 댓글로 남긴다.
5. **Issue를 닫지 않는다. PR을 병합하지 않는다.**

사용자에게 보고: 무엇을 만들었는지, 완료 조건별 검증 결과, CI 결과, PR 링크, 내린 기술 결정, 남은 결정·차단 사항, 병합은 사용자 몫이라는 것.

## 3. 정리 (상태 확인·완료 처리)

완료 조건 대조는 Issue 본문의 완료 조건을 PR의 검증 증거와 **병합된 커밋의 CI 결과**에 하나씩 맞춰 보는 것이다. Issue가 이미 자동으로 닫혔어도 한다.

| 확인된 사실 | 처리 |
| --- | --- |
| PR이 `origin/main`에 병합됨 + 완료 조건 모두 충족 + Issue 열림 | 병합 사실을 댓글로 남기고 닫는다. 상태 라벨을 뗀다 |
| 위와 같고 Issue가 이미 닫힘 | 상태 라벨을 뗀다 |
| PR 병합됨 + 완료 조건 일부 미충족 | 열려 있으면 닫지 않는다. 남은 조건을 댓글로 남기고 `status:in-progress`로 바꾼다. 남은 작업은 `origin/main`에서 새로 딴 `issue/<N>-<슬러그>-2` 브랜치와 후속 PR로 한다. 이미 자동으로 닫혔으면 다시 열지 말고 사용자에게 보고해 다시 열지 묻는다 |
| PR 열림, CI 통과 | 닫지 않는다. 리뷰·병합 대기임을 보고한다 |
| PR 열림, CI 실패 | 닫지 않는다. 라벨을 `status:in-progress`로 바꾸고 실패 내용을 보고한다. 고칠지 묻는다 |
| PR이 병합 없이 닫힘 | 닫지 않는다. 경위를 보고하고 사용자에게 묻는다 |
| 코드·문서 변경이 없는 Issue (조사, 결정 기록) | 완료 조건을 하나씩 검증하고 근거를 댓글로 남긴 뒤 닫는다. 근거를 댈 수 없는 조건이 하나라도 있으면 닫지 않는다. 저장소 파일을 바꾸는 일(문서 포함)은 여기 해당하지 않는다 — PR이 필요하다 |

Issue가 완료 상태가 된 뒤에는(직접 닫았든 자동으로 닫혔든):

- 열린 Issue 가운데 본문 "선행 Issue"에 `#N`이 있는 것을 찾아, 이제 실행 가능해진 것을 보고에 넣는다.
- 병합된 로컬 브랜치·worktree가 있으면 지울지 사용자에게 묻는다.

## 하지 않는 것

- PR 생성만으로 Issue를 닫는 것
- PR 병합, auto-merge 설정 (사용자가 그 PR의 병합을 직접 요청한 경우만 예외)
- 닫힌 Issue나 PR이 이미 있는 Issue를 처음부터 다시 구현하는 것
- 같은 Issue에 열린 PR이 있는데 또 다른 브랜치·PR을 만드는 것
- 실패·차단 상태를 완료로 보고하는 것
