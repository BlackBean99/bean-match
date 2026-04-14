# Blackbean Match

Blackbean Match는 운영자가 통제하는 프라이빗 소개팅 운영 플랫폼입니다. 일반 데이팅 앱이 아니라 사용자 상태, 소개 진행 상태, 라운드/선택 데이터, 사진과 연락처 공개 정책을 운영자가 안전하게 관리하는 것을 목표로 합니다.

## 사용가이드

### 1. 프로젝트 실행
1. 의존성을 설치합니다.
   ```sh
   npm install
   ```
2. 환경 변수를 준비합니다.
   ```sh
   cp .env.example .env.local
   ```
3. Prisma Client를 생성합니다.
   ```sh
   npm run prisma:generate
   ```
4. 개발 서버를 실행합니다.
   ```sh
   npm run dev
   ```

### 2. 검증 명령
변경 후 아래 순서로 확인합니다.

```sh
npm run lint
npm run typecheck
npm run build
```

Notion 데이터를 Supabase로 동기화할 때는 먼저 dry-run을 실행합니다.

```sh
npm run sync:notion
npm run sync:notion -- --write
```

### 3. 운영 핵심 규칙
- `PROGRESSING` 사용자는 새 소개를 생성하지 않습니다.
- 연락처는 `CONNECTED` 전까지 노출하지 않습니다.
- 프로덕션 업로드 파일은 임시 로컬 디스크에 저장하지 않습니다.
- 개인정보, 보안, 동의, 연락처 공개 정책 변경은 고위험 변경으로 취급합니다.
- 도메인, API, 스키마, 운영 정책이 바뀌면 관련 문서를 함께 갱신합니다.

### 4. 문서 구조
- `docs/context/`: 제품 요구사항, FSM, ERD, API, 보안, 운영 정책, 디자인, 기술 스펙
- `docs/operations/`: 에이전트 운영 모델, Git/PR/merge 정책, Definition of Done, 자율 실행 runbook
- `docs/history/`: 이전 요구사항과 맥락 기록
- `AGENTS.md`: 에이전트가 작업 전 읽어야 하는 루트 지침
- `CONTRIBUTING.md`: 기여 절차와 커밋 규칙
- `CODEOWNERS`: 코드 오너 정책

자세한 문서 인덱스는 `docs/README.md`를 참고합니다.

## 빠른 문서 링크
- `docs/context/01-PRD.md`
- `docs/context/02-Domain-State-FSM.md`
- `docs/context/03-ERD-and-Schema.md`
- `docs/context/04-API-File-Storage-and-Security.md`
- `docs/context/05-Operations-Admin-Policy.md`
- `docs/context/06-design-style-generic-guide.md`
- `docs/context/07-Technical-Specification.md`
- `docs/context/08-URL-Sharing-and-Access-Guide.md`
- `docs/context/SUPABASE_NOTION_SYNC.md`
- `docs/operations/08-Agent-Operating-Model-RPI.md`
- `docs/operations/09-Git-Workflow-and-Branch-Strategy.md`
- `docs/operations/10-Commit-PR-Merge-Policy.md`
- `docs/operations/11-Code-Complete-and-Definition-of-Done.md`
- `docs/operations/12-Agent-Autonomy-Runbook.md`
- `docs/history/20260414_Requirement_Document.md`
