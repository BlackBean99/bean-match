# Agent Task Contract

## 1. 목적
이 문서는 에이전트 간 위임을 자유 대화가 아니라 계약 기반 작업 카드로 통제하기 위한 표준을 정의한다.

## 2. 왜 계약이 필요한가
다음과 같은 위임은 실패하기 쉽다.
- "Backend가 알아서 만들어줘"
- "Frontend가 맞춰줘"
- "QA가 한번 봐줘"

이 방식은 입력이 모호하고, 금지사항이 없고, 승인 게이트와 완료 기준이 빠진다.

본 저장소는 개인정보, 소개 상태, 라운드 노출, 연락처 공개, 파일 저장 정책 같은 고위험 규칙이 있으므로 모든 위임에 계약이 필요하다.

## 3. 필수 필드
작업 카드는 아래 필드를 반드시 포함한다.

| Field | Description |
| --- | --- |
| `task_id` | 추적 가능한 ID |
| `requester_role` | 작업을 발행한 역할. 기본적으로 `Principal Engineer Agent` |
| `role` | 작업을 수행할 전문 에이전트 |
| `objective` | 한 문장 목표 |
| `context` | 반드시 읽어야 할 문서와 파일 |
| `inputs` | 구현 또는 분석 입력물 |
| `constraints` | 금지사항, 범위 제한, 리스크 규칙 |
| `expected_outputs` | 결과물 목록 |
| `approval_required_for` | 사람 승인 또는 추가 검토가 필요한 항목 |
| `validation` | 완료 전에 확인해야 할 검증 명령 또는 테스트 범위 |
| `status_contract` | 허용 상태와 blocker 보고 규칙 |

## 4. 상태 계약
기본 상태값:
- `planned`
- `in_progress`
- `blocked`
- `review`
- `done`

`blocked` 를 사용할 때는 아래 값을 같이 제출한다.
- blocker summary
- decision needed
- proposed options

## 5. 출력 계약
전문 에이전트는 최소한 아래 형식으로 응답한다.
1. Summary
2. Assumptions
3. Files changed
4. Tests run
5. Risks
6. Next actions

QA, Security, Review 역할은 아래 형식을 추가로 사용할 수 있다.
- Test matrix
- Findings
- Release confidence
- Residual risk

## 6. 예시 JSON
[`.agent/templates/task-card.json`](/Users/blackbean/Desktop/Web/bean-match/.agent/templates/task-card.json) 파일을 복사해서 사용한다.

핵심 예시:

```json
{
  "task_id": "MATCH-102",
  "requester_role": "Principal Engineer Agent",
  "role": "Backend Engineer Agent",
  "objective": "Create the matching offer API",
  "constraints": [
    "Do not change existing auth flow",
    "Do not modify production migration",
    "Add unit and integration tests"
  ],
  "approval_required_for": [
    "schema change",
    "auth logic change",
    "data deletion",
    "external API integration"
  ]
}
```

## 7. 예시 Markdown
[`.agent/templates/task-card.md`](/Users/blackbean/Desktop/Web/bean-match/.agent/templates/task-card.md) 파일을 사용하면 사람과 LLM이 함께 다루기 쉽다.

권장 상황:
- GitHub Issue 본문
- Notion task card
- 리뷰 요청 문서
- 채팅 기반 에이전트 실행

## 8. 승인 게이트
아래 조건이 카드에 포함되면 사람 승인을 기본값으로 본다.
- DB schema 변경
- migration 파일 추가 또는 수정
- auth/session/token 로직 변경
- 개인정보 노출 정책 변경
- 파일 저장 또는 다운로드 정책 변경
- 데이터 삭제 또는 복구 불가능한 스크립트
- 외부 API, 결제, 인프라, 배포

## 9. Principal Engineer 체크포인트
Principal Engineer Agent 는 카드를 발행하기 전에 아래를 확인한다.
- 목표가 하나의 역할로 수행 가능한가
- 범위가 너무 넓지 않은가
- 검증 요구사항이 명시되었는가
- 승인 게이트가 누락되지 않았는가
- 관련 문서가 카드에 포함되었는가

## 10. 저장 위치
- 역할 프롬프트: [`.agent/`](/Users/blackbean/Desktop/Web/bean-match/.agent)
- 작업 카드 템플릿: [`.agent/templates/`](/Users/blackbean/Desktop/Web/bean-match/.agent/templates)
- 이슈 템플릿: [`.github/ISSUE_TEMPLATE/agent-task.md`](/Users/blackbean/Desktop/Web/bean-match/.github/ISSUE_TEMPLATE/agent-task.md)
