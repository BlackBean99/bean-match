# Git Workflow and Branch Strategy

## 1. 목표
에이전트와 사람이 함께 작업할 때, 브랜치와 PR 흐름을 단순하면서도 안전하게 유지한다.

## 2. 브랜치 종류
### `main`
- 항상 배포 가능한 상태
- 직접 push 금지
- PR merge만 허용

### `develop` (선택)
- 기능 통합 브랜치
- MVP 단계에서는 생략 가능
- 팀이 커지면 도입

### `feat/*`
신규 기능

### `fix/*`
버그 수정

### `docs/*`
문서 작업

### `chore/*`
빌드/설정/CI/의존성

### `refactor/*`
동작 변화 없는 구조 개선

## 3. 권장 전략
본 프로젝트 현재 권장안:
**`main` + short-lived feature branch**

## 4. merge 방식
기본 권장:
- **Squash Merge**

## 5. 브랜치 보호 규칙
`main` 에 아래 규칙 권장
- direct push 금지
- PR 필수
- CI status checks 필수
- branch out-of-date 시 업데이트 요구
- 최소 1 review 또는 auto-approval policy
- squash merge only

## 6. 브랜치 네이밍 규칙
형식:
`<type>/<scope>-<short-description>`

예시:
- `feat/admin-user-search`
- `fix/intro-case-status-sync`
- `docs/agent-governance`
- `chore/ci-pipeline`
