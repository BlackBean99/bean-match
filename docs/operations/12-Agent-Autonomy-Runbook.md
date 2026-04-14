# Agent Autonomy Runbook

## 1. 목적
이 문서는 에이전트가 저장소를 읽고, 작업을 수행하고, 커밋/PR/머지까지 이어지는 실행 절차를 정의한다.

## 2. 권장 저장소 파일
에이전트 자율 실행을 위해 아래 파일 추가를 권장한다.
- `AGENTS.md`
- `.github/pull_request_template.md`
- `.github/workflows/ci.yml`
- `.github/workflows/automerge.yml`
- `CODEOWNERS`
- `CONTRIBUTING.md`

## 3. 추천 GitHub Actions 흐름
### CI
- install
- lint
- typecheck
- test
- build

### PR Gate
- PR title lint
- changed files docs check
- migration safety check
- automerge eligibility check

### Auto Merge
조건:
- label `automerge-ok`
- all checks green
- no blocked labels

## 4. 사람이 반드시 개입해야 하는 작업
- 법률 문구 변경
- 개인정보 정책 변경
- 파괴적 마이그레이션
- 인증 구조 변경
- 공개 범위/권한 정책 변경
- 비용 큰 인프라 전환
