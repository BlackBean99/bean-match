# Blackbean Match

Blackbean Match는 운영자가 통제하는 프라이빗 소개 운영 플랫폼입니다. 일반 데이팅 앱이 아니라 사용자 상태, 소개 진행 상태, 자동 노출/관심 데이터, 사진과 연락처 공개 정책을 운영자가 안전하게 관리하는 것을 목표로 합니다.

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
3. 환경 구성을 점검합니다.
   ```sh
   npm run env:check
   ```
4. Prisma Client를 생성합니다.
   ```sh
   npm run prisma:generate
   ```
5. 개발 서버를 실행합니다.
   ```sh
   npm run dev
   ```

개발 서버가 실행되면 기본 접속은 `http://localhost:3000` 입니다. 같은 네트워크(LAN)에서 모바일로 테스트할 때는 `npm run dev` 출력에 표시되는 `Network` 주소를 사용합니다.

참고: dev 서버를 켠 상태로 `npm run build`를 실행하면 `.next` 산출물이 꼬여 500 에러가 날 수 있습니다. 이 경우 `pkill -f "next dev"` 후 `rm -rf .next` 하고 `npm run dev`로 재시작합니다.

### 2. 검증 명령
변경 후 아래 순서로 확인합니다.

```sh
npm run lint
npm run typecheck
npm run build
npm run start
```

`npm run start` 검증은 `next dev` 와 별개로, 실제 프로덕션 빌드 산출물이 정상 부팅되고 주요 경로가 500 없이 열리는지 확인하기 위한 필수 절차입니다.
Cloudflare Pages로 배포할 때는 로컬 `.env.local` 값을 빌드 산출물에 굳히지 말고, Pages Variables and Secrets를 런타임에서 읽도록 설정합니다.

Notion 데이터를 Supabase로 동기화할 때는 먼저 dry-run을 실행합니다.

```sh
npm run env:check
npm run sync:notion
npm run sync:notion -- --write
```

### 3. 운영 핵심 규칙
- `PROGRESSING` 사용자는 새 소개를 생성하지 않습니다.
- 연락처는 `CONNECTED` 전까지 노출하지 않습니다.
- 참가자는 운영자가 발급한 토큰 링크 `/onboarding/access/{token}` 으로 진입하며, 자동 노출 풀 참여 여부와 알림 수신 여부를 직접 선택합니다.
- 참가자 개인 풀 URL은 `/pool/{userId}` 입니다. 신규 가입자는 여기서 최대 3명의 관심을 제출하고, 기존 회원은 새 멤버 알림에서 관심을 남깁니다.
- 운영자는 사용자 상세에서 프로필 열람 토큰을 발급하고 `/readonly/pool/{userId}` 에서 같은 성별을 제외한 소개 가능 후보를 보여 주며, 토큰으로 접속한 사용자는 최대 3명까지 관심을 제출할 수 있습니다.
- `INVITOR` 전용 회원은 기본 목록에서 숨기고, 필요할 때만 읽기 전용으로 확인합니다.
- 운영자는 `/matches` 에서 오퍼 관심 기록과 상호 관심 전환 상태를 확인하고, `/rounds` 에서 자동 노출 큐와 소개 후보 승인/반려/전환을 관리합니다.
- 프로덕션 업로드 파일은 임시 로컬 디스크에 저장하지 않습니다.
- 개인정보, 보안, 동의, 연락처 공개 정책 변경은 고위험 변경으로 취급합니다.
- 도메인, API, 스키마, 운영 정책이 바뀌면 관련 문서를 함께 갱신합니다.

### 4. 문서 구조
- `docs/context/`: 제품 요구사항, FSM, ERD, API, 보안, 운영 정책, 디자인, 기술 스펙
- `docs/operations/`: 에이전트 운영 모델, Git/PR/merge 정책, Definition of Done, 자율 실행 runbook, 멀티 에이전트 운영 가이드
- `docs/history/`: 이전 요구사항과 맥락 기록
- `AGENTS.md`: 에이전트가 작업 전 읽어야 하는 루트 지침
- `.agent/`: Principal Engineer 중심 멀티 에이전트 역할 프롬프트와 템플릿
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
- `docs/context/09-Deployment-and-Env.md`
- `docs/context/SUPABASE_NOTION_SYNC.md`
- `docs/operations/08-Agent-Operating-Model-RPI.md`
- `docs/operations/09-Git-Workflow-and-Branch-Strategy.md`
- `docs/operations/10-Commit-PR-Merge-Policy.md`
- `docs/operations/11-Code-Complete-and-Definition-of-Done.md`
- `docs/operations/12-Agent-Autonomy-Runbook.md`
- `docs/operations/13-Agent-Prompt-and-Skills.md`
- `docs/operations/14-Multi-Agent-Orchestration-Model.md`
- `docs/operations/15-Agent-Task-Contract.md`
- `docs/operations/16-Agent-Team-Usage-Guide.md`
- `docs/history/20260414_Requirement_Document.md`
