# Agent Team Assets

이 디렉터리는 Blackbean Match에서 `Principal Engineer` 중심의 멀티 에이전트 운영을 바로 실행할 수 있도록 역할 프롬프트와 템플릿을 제공한다.

## Team Topology
- Human Owner
- Principal Engineer Agent
- Product Planner Agent
- UX Designer Agent
- Architect Reviewer Agent
- Backend Engineer Agent
- Frontend Engineer Agent
- QA/Test Agent
- Security/Compliance Agent
- Code Reviewer Agent
- DevOps/Release Agent

## Core Rules
- 모든 에이전트는 먼저 [AGENTS.md](/Users/blackbean/Desktop/Web/bean-match/AGENTS.md) 와 관련 문서를 읽는다.
- `Principal Engineer Agent` 만 작업 분해, 위임, 최종 통합, merge 추천 판단을 수행한다.
- 전문 에이전트끼리 직접 업무를 넘기지 않는다. 모든 결과는 다시 `Principal Engineer Agent` 에게 보고한다.
- 모든 위임은 `.agent/templates/task-card.json` 또는 `.agent/templates/task-card.md` 형식의 작업 카드로 전달한다.
- 테스트 증거가 없으면 `Principal Engineer Agent` 는 승인을 추천하지 않는다.
- 사람 승인이 필요한 작업은 에이전트가 자율적으로 밀어붙이지 않는다.

## Human Approval Gates
- DB schema 변경
- migration 파일 추가/수정
- 인증, 세션, 토큰, 권한 로직 변경
- 개인정보 노출 정책 변경
- 파일 저장/다운로드 접근 정책 변경
- 외부 API 또는 결제 연동
- 데이터 삭제, 파괴적 스크립트, 운영 배포

## Directory Map
- `principal-engineer.md`: 최상위 오케스트레이터 프롬프트
- `product-planner.md`: 요구사항, 사용자 스토리, 수용조건 정리
- `ux-designer.md`: 화면 흐름, 정보 노출, UX 제약 검토
- `architect-reviewer.md`: 기술 설계와 경계 검토
- `backend-engineer.md`: API, 도메인, 영속성, 통합 테스트 구현
- `frontend-engineer.md`: UI, 라우트, 사용자 상호작용 구현
- `qa-test-engineer.md`: 테스트 설계와 회귀 리스크 점검
- `security-compliance-reviewer.md`: 보안, 개인정보, 악용 시나리오 검토
- `code-reviewer.md`: diff 리뷰와 유지보수성 점검
- `devops-release-manager.md`: CI, 배포, 롤백, 릴리스 준비
- `templates/task-card.json`: 계약 기반 작업 카드 JSON 예시
- `templates/task-card.md`: 사람이 읽고 작성하기 쉬운 작업 카드 템플릿
- `templates/principal-final-report.md`: 최종 보고서 템플릿
- `templates/human-approval-checklist.md`: 사람 승인 체크리스트

## Quickstart
1. `.agent/principal-engineer.md` 를 작업 시작 프롬프트로 연다.
2. Human Owner 요청과 저장소 문서 컨텍스트를 넣는다.
3. `Principal Engineer Agent` 가 RPI 계획과 작업 카드를 만든다.
4. 각 전문 에이전트에 역할 프롬프트와 작업 카드를 함께 전달한다.
5. `QA`, `Security`, `Code Reviewer` 결과를 독립적으로 수집한다.
6. `Principal Engineer Agent` 가 최종 보고서와 사람 승인 체크리스트를 작성한다.

실행 방법과 예시는 [docs/operations/16-Agent-Team-Usage-Guide.md](/Users/blackbean/Desktop/Web/bean-match/docs/operations/16-Agent-Team-Usage-Guide.md) 를 따른다.
