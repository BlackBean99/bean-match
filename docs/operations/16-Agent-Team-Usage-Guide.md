# Agent Team Usage Guide

## 1. 목적
이 문서는 Blackbean Match에서 `Principal Engineer` 중심 멀티 에이전트 팀을 실제로 어떻게 실행할지 설명한다.

## 2. 기본 원칙
- 시작점은 항상 `Principal Engineer Agent` 다.
- 모든 전문 에이전트 작업은 task card 로 전달한다.
- 구현과 검증 역할을 분리한다.
- 사람은 최종 승인자다.

## 3. 준비물
- 저장소 최신 문서
- 작업 요청 또는 GitHub Issue
- `.agent/` 디렉터리의 역할 프롬프트
- `.agent/templates/` 의 task card 와 final report 템플릿

## 4. 권장 실행 순서
1. Human Owner가 요구사항 또는 이슈를 작성한다.
2. `Principal Engineer Agent` 프롬프트를 열고 요구사항을 넣는다.
3. Principal Engineer Agent가 RPI 계획, 가정, 리스크, task card 를 만든다.
4. Product Planner Agent가 수용조건을 정리한다.
5. 필요 시 UX Designer Agent 와 Architect Reviewer Agent 가 선행 검토를 한다.
6. Backend/Frontend Agent 가 구현한다.
7. QA/Test Agent 가 테스트 매트릭스와 회귀 리스크를 만든다.
8. Security/Compliance Agent 가 보안과 개인정보 리스크를 검토한다.
9. Code Reviewer Agent 가 diff 리뷰를 한다.
10. DevOps/Release Agent 가 CI, 배포 영향, 롤백 계획을 검토한다.
11. Principal Engineer Agent 가 최종 보고서를 작성한다.
12. Human Owner 가 승인 후 PR merge 여부를 결정한다.

## 5. Codex / Claude / Cursor 에서 쓰는 방법
### 5.1 Principal Engineer kickoff
아래 두 가지를 함께 넣는다.
- `.agent/principal-engineer.md` 내용
- 작업 요청 또는 GitHub Issue 링크/본문

### 5.2 Specialist kickoff
각 전문 에이전트에는 아래 두 가지를 함께 넣는다.
- 해당 역할 프롬프트 파일
- Principal Engineer Agent 가 만든 task card

### 5.3 도구 지원 차이
- 하위 에이전트를 네이티브로 지원하는 도구에서는 Principal Engineer Agent 가 task card 를 직접 위임한다.
- 단일 채팅 기반 도구에서는 task card 단위로 대화를 분리해서 수동 실행한다.
- 어떤 도구를 쓰더라도 최종 통합과 승인 추천은 Principal Engineer Agent 가 맡는다.

## 6. 추천 프롬프트 시작 문구
### 6.1 Human -> Principal Engineer

```md
Use the repository-local Principal Engineer workflow for Blackbean Match.
Read `.agent/principal-engineer.md` and the required repo docs first.
Then:
1. restate the goal
2. list assumptions and approval gates
3. create an RPI plan
4. generate specialist task cards
5. define validation and rollback

Human request:
<paste the feature or bug request here>
```

### 6.2 Principal Engineer -> Specialist

```md
Use the repository-local specialist role prompt and execute only the assigned task card.
Do not widen scope. Report blockers instead of silently deciding.

Role prompt:
<paste one file from .agent/>

Task card:
<paste one task card>
```

## 7. 어떤 작업에 어떤 에이전트를 부를지
| Change Type | Minimum Roles |
| --- | --- |
| 문서 수정 | Principal Engineer, Code Reviewer |
| UI copy / low-risk frontend | Principal Engineer, Frontend, QA, Code Reviewer |
| API or domain logic | Principal Engineer, Product Planner, Backend, QA, Code Reviewer |
| Cross-cutting feature | Principal Engineer, Product Planner, UX, Architect, Backend, Frontend, QA, Code Reviewer |
| Auth, privacy, file, admin, external integration | Principal Engineer, Architect, Backend/Frontend, QA, Security, Code Reviewer, DevOps |

## 8. GitHub 추천 운영
- 이슈는 `.github/ISSUE_TEMPLATE/agent-task.md` 로 생성한다.
- PR 은 `.github/PULL_REQUEST_TEMPLATE.md` 형식을 따른다.
- CI 는 `.github/workflows/ci.yml` 로 lint, typecheck, build 를 기본 강제한다.
- 고위험 작업은 PR 본문에 승인 게이트와 rollback 을 반드시 적는다.

## 9. 작게 시작하는 운영법
처음부터 모든 작업에 9개 에이전트를 모두 쓰지 않아도 된다. 기본 운영은 아래 순서를 권장한다.
- Phase 1: Principal Engineer + Backend/Frontend + QA + Reviewer
- Phase 2: Product Planner, UX, Security, DevOps 추가
- Phase 3: 복잡한 변경에 Architect Reviewer 를 상시 포함

## 10. 최종 보고서
마지막 결과는 [`.agent/templates/principal-final-report.md`](/Users/blackbean/Desktop/Web/bean-match/.agent/templates/principal-final-report.md) 형식을 기본으로 쓴다.

사람 승인 체크는 [`.agent/templates/human-approval-checklist.md`](/Users/blackbean/Desktop/Web/bean-match/.agent/templates/human-approval-checklist.md) 를 따른다.
