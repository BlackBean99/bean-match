# Agent Operating Model (RPI Methodology)

## 1. 목적
이 문서는 에이전트가 저장소 내 문서를 읽고, 작업을 스스로 계획하고, 구현하고, 검증하고, 커밋/PR 생성까지 이어지는 운영 원칙을 정의한다.

RPI는 본 프로젝트에서 다음 의미로 사용한다.

- **R: Read / Research**
  - 저장소의 PRD, ERD, FSM, 기술 스펙, 운영 정책을 읽는다.
  - 현재 브랜치 상태, 열려 있는 이슈, 최근 변경사항을 조사한다.
- **P: Plan / Propose**
  - 작업 범위를 정의한다.
  - 변경 파일 목록, 예상 리스크, 테스트 범위, 롤백 포인트를 정리한다.
  - 구현 전에 작업 계획을 문서 또는 PR 설명 초안으로 남긴다.
- **I: Implement / Inspect**
  - 코드를 구현한다.
  - 테스트, 린트, 타입체크, 빌드를 수행한다.
  - 결과를 요약하고 커밋, PR 생성, 머지 조건 충족 여부를 점검한다.

## 2. 에이전트 기본 실행 순서
### Step 1. Read
에이전트는 항상 아래 파일을 우선 읽는다.
1. `README.md`
2. `docs/context/01-PRD.md`
3. `docs/context/02-Domain-State-FSM.md`
4. `docs/context/03-ERD-and-Schema.md`
5. `docs/context/04-API-File-Storage-and-Security.md`
6. `docs/context/05-Operations-Admin-Policy.md`
7. `docs/context/06-design-style-generic-guide.md`
8. `docs/context/07-Technical-Specification.md`

### Step 2. Plan
에이전트는 작업 전 아래 형식으로 계획을 생성한다.

```md
## RPI Plan
### Goal
이번 작업의 목표

### Scope
수정 파일 / 신규 파일

### Constraints
상태 전이 규칙, 보안, 파일 업로드 정책, UI 가이드 등

### Validation
lint, typecheck, test, build, smoke test

### Rollback
되돌릴 수 있는 단위와 방법
```

### Step 3. Implement
에이전트는 계획 범위 안에서만 변경한다. 범위를 벗어나는 변경은 별도 커밋으로 분리한다.

### Step 4. Inspect
아래 순서로 검증한다.
1. formatting
2. lint
3. typecheck
4. unit/integration test
5. build
6. 문서 업데이트 필요 여부 확인

### Step 5. Commit
에이전트는 검증 완료 후 커밋한다. 커밋 메시지는 Conventional Commits를 따른다.

### Step 6. PR
에이전트는 PR에 다음을 반드시 적는다.
- 작업 목적
- 변경 요약
- FSM/ERD/PRD 영향
- 테스트 결과
- 위험요소 및 롤백 방법

### Step 7. Merge
자동 머지는 아래 조건 충족 시에만 허용한다.
- CI green
- 필수 리뷰 충족 또는 auto-approve 정책 충족
- main 보호 규칙 통과
- 마이그레이션/보안 리스크 체크 완료

## 3. 자율 Merge 허용 범위
자동 머지는 기본적으로 아래 범위에서만 허용한다.
- docs 수정
- 테스트 추가
- UI copy 변경
- 내부 리팩터링
- 운영 스크립트 개선

아래는 자동 머지 금지 권장
- 개인정보 처리 방식 변경
- 인증/권한 변경
- DB destructive migration
- 결제/정산/법률 문서 변경
- 업로드/다운로드 접근 정책 변경
