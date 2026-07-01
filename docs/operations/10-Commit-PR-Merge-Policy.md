# Commit, PR, Merge Policy

## 1. Commit Message 정책
Conventional Commits 사용.

형식:
`type(scope): summary`

예시:
- `feat(admin): add progressing status filter`
- `fix(fsm): block intro creation for active users`
- `docs(erd): clarify photo ownership constraint`
- `chore(ci): add pull request checks`

## 2. Pull Request 본문 템플릿

```md
## Summary
무엇을 왜 바꿨는지

## Changes
- 변경 1
- 변경 2
- 변경 3

## Domain Impact
- User.status 영향
- IntroCase FSM 영향
- ERD/API 영향 여부

## Validation
- [ ] lint
- [ ] typecheck
- [ ] test
- [ ] build
- [ ] docs updated if needed

## Risk
배포/운영 리스크

## Rollback
되돌리는 방법
```

## 3. Auto Merge 기준
자동 머지는 아래 조건 모두 만족 시에만 허용한다.
- PR이 draft 아님
- CI 전부 green
- branch protection 통과
- 충돌 없음
- required checks 통과
- required review 충족 또는 bot auto-approval 조건 충족
- migration risk label 없음
- security review 필요 label 없음

## 4. PR 완료 기준
- 모든 개발 변경은 PR 생성이 완료되어야 작업 종료로 본다.
- 에이전트는 사용자 요청이 있으면 스스로 PR을 생성할 수 있다.
- PR 본문은 Summary, Changes, Domain Impact, Validation, Risk, Rollback을 포함한다.
- 개발 작업은 예외 없이 PR 병행을 기본으로 한다. 핫픽스나 작은 수정도 브랜치와 PR을 먼저 만들고, 이후에만 병합/배포 절차를 진행한다.

## 5. Auto Merge 금지 조건
아래 항목이 있으면 사람 승인 전 merge 금지
- `breaking-change`
- `db-destructive`
- `security-sensitive`
- `privacy-sensitive`
- `legal-copy-change`
- `production-risk-high`
