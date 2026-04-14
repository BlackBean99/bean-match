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

`main` 을 유일한 통합 기준 브랜치로 둔다. `develop` 은 MVP 단계에서 사용하지 않는다.

### 3.1 Commit
- 작업 단위는 작고 리뷰 가능한 크기로 나눈다.
- 커밋 메시지는 Conventional Commits를 따른다.
- 도메인, API, 스키마, 운영 정책 변경이 있으면 같은 커밋 또는 같은 PR 안에서 관련 문서를 갱신한다.
- 개인정보, 권한, 연락처 공개, 파일 저장 정책 변경은 별도 커밋으로 분리하고 PR 본문에 위험도를 명시한다.

### 3.2 Push
- `main` 으로 직접 push 하지 않는다.
- 모든 작업 브랜치는 `origin/<branch>` 로 push한다.
- PR 대상 브랜치는 기본적으로 `main` 으로 지정한다.
- 원격에 push하기 전 `lint`, `typecheck`, `test` 또는 변경 범위에 맞는 최소 검증을 수행한다.

### 3.3 Merge
- merge 대상은 `main` 이다.
- 기본 merge 방식은 Squash Merge를 사용한다.
- CI가 green이고 충돌이 없으며 필수 리뷰/보호 규칙을 통과한 경우에만 merge한다.
- 자동 머지는 docs, 테스트, 내부 리팩터링 같은 저위험 변경에만 허용한다.
- 보안, 개인정보, 권한, destructive migration, 연락처 공개 정책 변경은 자동 머지하지 않는다.

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
