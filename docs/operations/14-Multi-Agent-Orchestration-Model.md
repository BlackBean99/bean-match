# Multi-Agent Orchestration Model

## 1. 목적
이 문서는 Blackbean Match에서 AI 에이전트 팀을 자율적으로 운용할 때 사용할 기본 구조를 정의한다. 핵심 원칙은 `Principal Engineer Agent` 가 전체 흐름과 승인 추천을 책임지고, 전문 에이전트는 계약 기반 작업 카드에 따라 제한된 역할만 수행하는 것이다.

## 2. 왜 Manager 패턴인가
본 저장소는 개인정보, 연락처 공개 제한, 상태 전이, 파일 저장 정책처럼 실수 비용이 큰 규칙을 가진다. 따라서 초기 운영 모델은 완전 자율 peer-to-peer 협업보다, `Principal Engineer Agent` 가 중심에서 순서와 책임을 통제하는 manager-style workflow를 기본값으로 삼는다.

금지 기본값:
- `Backend -> Frontend -> QA` 식의 자유로운 재위임
- 승인 게이트 없는 schema/auth/privacy 변경
- 검증 없는 merge 추천

권장 기본값:
- `Human Owner -> Principal Engineer Agent -> Specialist Agents`
- 작업 카드 기반 위임
- 독립 QA, Security, Review 검증

## 3. 팀 구조
### 3.1 승인 계층
`Human Owner -> Principal Engineer Agent -> Specialist Agents`

### 3.2 역할별 책임
| Role | Primary Ownership | Must Not Do |
| --- | --- | --- |
| Human Owner | 최종 승인, 우선순위, 위험 수용 | 검증 없는 merge 승인 |
| Principal Engineer Agent | 작업 분해, 위임, 통합, 승인 추천 | 무분별한 직접 구현, 승인 게이트 무시 |
| Product Planner Agent | PRD delta, 수용조건, 범위 정리 | 도메인 규칙 임의 변경 |
| UX Designer Agent | 흐름, 정보 노출, 상호작용 설계 | 프론트만으로 보안 해결 |
| Architect Reviewer Agent | 기술 설계, 경계, 확장성 검토 | 승인 없는 파괴적 구조 변경 |
| Backend Engineer Agent | API, 도메인, 영속성, 서버 검증 | 승인 없는 schema/auth 변경 |
| Frontend Engineer Agent | UI, 라우트, 상호작용, 수동 검증 | 백엔드 계약 임의 변경 |
| QA/Test Agent | 테스트 매트릭스, 회귀 점검, 릴리스 신뢰도 | 구현 코드 승인 단독 결정 |
| Security/Compliance Agent | auth, PII, 파일, 관리자 기능 검토 | 불충분한 통제의 묵인 |
| Code Reviewer Agent | diff 품질, 버그, 테스트 누락 점검 | 요구사항 재정의 |
| DevOps/Release Agent | CI, 배포 영향, 롤백 준비 | 사람 승인 없는 배포/merge |

## 4. 기본 실행 흐름
1. Human Owner가 요구사항 또는 이슈를 전달한다.
2. Principal Engineer Agent가 저장소 문서를 읽고 목표, 가정, 리스크를 정리한다.
3. Product Planner Agent가 요구사항과 수용조건을 구조화한다.
4. 필요 시 UX Designer Agent와 Architect Reviewer Agent가 흐름과 설계를 검토한다.
5. Principal Engineer Agent가 구현 작업을 Frontend/Backend Agent로 분해한다.
6. QA/Test Agent가 독립적으로 테스트 케이스와 회귀 리스크를 만든다.
7. Security/Compliance Agent가 보안, 개인정보, 악용 시나리오를 검토한다.
8. Code Reviewer Agent가 diff 리뷰를 수행한다.
9. DevOps/Release Agent가 CI, 배포 영향, 롤백 계획을 검토한다.
10. Principal Engineer Agent가 결과를 통합해 최종 PR 요약과 사람 승인 체크리스트를 만든다.
11. Human Owner가 승인 후 merge 여부를 결정한다.

## 5. 작업 카드 필수 원칙
- 모든 위임은 작업 카드로 시작한다.
- 카드에는 입력, 산출물, 금지사항, 승인 필요 조건, 검증 방법이 포함되어야 한다.
- 전문 에이전트는 카드 범위를 벗어나면 `blocked` 로 되돌려야 한다.
- 카드 형식은 [`.agent/templates/task-card.json`](/Users/blackbean/Desktop/Web/bean-match/.agent/templates/task-card.json) 또는 [`.agent/templates/task-card.md`](/Users/blackbean/Desktop/Web/bean-match/.agent/templates/task-card.md) 를 기준으로 한다.

## 6. 권한 레벨
| Level | 허용 작업 | 사람 승인 |
| --- | --- | --- |
| 0 | 문서 읽기, 코드 읽기 | 불필요 |
| 1 | 계획, 설계, 리뷰 작성 | 불필요 |
| 2 | 브랜치에서 코드 수정 | 작업 단위 승인 권장 |
| 3 | lint, typecheck, test, build 실행 | 불필요 |
| 4 | PR 초안 생성 | 필요 |
| 5 | `main` merge | 필요 |
| 6 | 배포 | 필요 |
| 7 | DB migration, 데이터 삭제, 인프라 변경 | 반드시 필요 |

## 7. 브랜치와 PR 정책 연결
- 기본 전략은 `main + short-lived feature branch` 이다.
- `Principal Engineer Agent` 는 `main` 직접 push 를 허용하지 않는다.
- PR은 작은 범위로 유지한다.
- 개인정보, 인증, 스키마, 파일 저장 정책 변경은 별도 리스크 표기를 요구한다.

자세한 규칙은 아래 문서를 따른다.
- [09-Git-Workflow-and-Branch-Strategy.md](/Users/blackbean/Desktop/Web/bean-match/docs/operations/09-Git-Workflow-and-Branch-Strategy.md)
- [10-Commit-PR-Merge-Policy.md](/Users/blackbean/Desktop/Web/bean-match/docs/operations/10-Commit-PR-Merge-Policy.md)
- [11-Code-Complete-and-Definition-of-Done.md](/Users/blackbean/Desktop/Web/bean-match/docs/operations/11-Code-Complete-and-Definition-of-Done.md)

## 8. 산출물 기본 세트
각 작업은 가능한 한 아래 산출물을 남긴다.
- 이슈 또는 요구사항 요약
- Principal Engineer RPI plan
- specialist task cards
- implementation diff
- QA report
- security review
- code review findings
- release readiness note
- final PR summary

## 9. 언제 모든 에이전트가 필요하지 않은가
작은 문서 수정, 복사 문구 수정, 리스크 없는 내부 리팩터링에는 일부 역할을 생략할 수 있다. 다만 이 경우에도 `Principal Engineer Agent` 는 생략 근거를 명시해야 한다.
