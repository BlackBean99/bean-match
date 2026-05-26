# Deployment and Environment Configuration

## 1. 결론(현재 상태)
2026-04-14 기준, 이 저장소에는 외부 퍼블리싱(공개 IP/도메인) 배포 구성이 포함되어 있지 않습니다.

- Vercel/Netlify/Railway/Render/Fly 설정 파일 없음
- Dockerfile 없음
- 로컬 실행은 `npm run dev` / `npm run build` / `npm run start`

따라서 “운영자가 참가자/모집인에게 외부에서 바로 열리는 URL”을 공유하려면 먼저 호스팅(예: Vercel)과 환경 변수 설정을 완료해야 합니다.

## 2. 로컬/내부 테스트 URL
- 로컬: `http://localhost:3000`
- 같은 LAN: `npm run dev` 출력의 `Network` 주소(예: `http://192.168.x.x:3000`)

## 3. 환경 변수(키 목록)
이 프로젝트는 Supabase(REST + Storage) 및 Notion 동기화를 사용합니다.

### 3.1 Supabase
- `NEXT_PUBLIC_SUPABASE_URL` (공개 가능)
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` (공개 가능, 단 권한 범위 확인 필요)
- `SUPABASE_URL` (선택, 서버용)
- `SUPABASE_SERVICE_ROLE_KEY` (비밀)

### 3.2 Notion Sync (`npm run sync:notion`)
- `NOTION_TOKEN` (비밀)
- `NOTION_API_VERSION` (선택)
- `NOTION_MAIN_DATA_SOURCE_ID` 또는 `NOTION_USERS_DATABASE_ID` (비밀 아님, 하지만 외부 노출 주의)
- `NOTION_INVITOR_DATA_SOURCE_ID` (선택)
- `NOTION_SYNC_GITHUB_TOKEN` (Cloudflare Pages에서 운영 버튼이 GitHub Actions sync workflow를 dispatch할 때 사용)
- `NOTION_SYNC_GITHUB_REPOSITORY` (선택, 기본값 `BlackBean99/bean-match`)
- `NOTION_SYNC_GITHUB_WORKFLOW` (선택, 기본값 `notion-sync.yml`)
- `NOTION_SYNC_GITHUB_REF` (선택, 기본값 `main`)

### 3.3 DB (Prisma 모드)
- `DATABASE_URL` (비밀)

### 3.4 File Storage / R2 (향후)
- `R2_PUBLIC_BASE_URL` (공개 가능)

### 3.5 Cloudflare Pages runtime
- Cloudflare Pages에서는 Variables and Secrets를 런타임 env로 읽습니다.
- 서버 코드에서는 `process.env`만 보지 말고 Pages runtime env를 우선 확인해야 합니다.
- 로컬 개발은 `.env.local`, Pages 배포는 Pages Variables/Secrets를 사용합니다.
- 배포 URL 생성용 `AUTH_URL` 이 없으면 `CF_PAGES_URL` 또는 로컬 기본값으로 폴백합니다.

### 3.6 GitHub Actions CD
- `main` 브랜치에 push 되면 `.github/workflows/cloudflare-deploy.yml` 이 Cloudflare 배포를 실행합니다.
- `.github/workflows/notion-sync.yml` 은 `workflow_dispatch` 로 수동 sync를 수행합니다. Cloudflare Pages의 운영 버튼은 production에서 이 workflow를 dispatch합니다.
- GitHub Secrets에는 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 를 넣습니다.
- Notion sync workflow를 쓰려면 GitHub Actions Secrets에 `NOTION_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTION_MAIN_DATA_SOURCE_ID` 또는 `NOTION_USERS_DATABASE_ID` 를 넣습니다. 필요하면 `NOTION_INVITOR_DATA_SOURCE_ID`, `NOTION_MATCHING_HISTORY_DATA_SOURCE_ID` 도 함께 넣습니다.
- 런타임이 참조하는 DB/Supabase/기타 비밀값은 Cloudflare 쪽 Variables and Secrets 에도 동일하게 설정합니다.
- Cloudflare Pages 운영 버튼이 GitHub Actions sync를 dispatch하려면 `NOTION_SYNC_GITHUB_TOKEN` 과 `NOTION_SYNC_GITHUB_REPOSITORY` 가 필요합니다.
- `CLOUDFLARE_API_TOKEN` 에 client IP address filtering을 걸면 GitHub-hosted runner의 동적 IP가 거부될 수 있습니다. `Cannot use the access token from location` 오류가 나오면 토큰이 IP 제한된 상태인지 먼저 확인합니다.
- GitHub Actions 배포용 토큰은 보통 IP 제한 없이 새로 발급하거나, 기존 토큰을 롤해서 제한을 제거하는 방식이 안전합니다.
- IP 제한이 꼭 필요하면 self-hosted runner처럼 고정 IP가 있는 실행 환경으로 옮겨야 합니다.

#### 토큰 재발급 절차
1. Cloudflare Dashboard에서 `My Profile -> API Tokens` 로 이동합니다.
2. 배포용 기존 토큰을 선택합니다.
3. `Roll` 을 쓰면 기존 권한을 유지한 새 토큰이 발급됩니다.
4. 새 토큰을 만들 경우 `Pages Write` 권한이 포함되도록 설정합니다.
5. client IP address filtering은 비워 두거나, GitHub Actions가 아닌 고정 IP 실행 환경에서만 제한을 겁니다.
6. GitHub Secrets의 `CLOUDFLARE_API_TOKEN` 값을 새 토큰으로 교체합니다.

## 4. “구성 값 전부 보여줘”에 대한 운영 원칙
- `SUPABASE_SERVICE_ROLE_KEY`, `NOTION_TOKEN`, `DATABASE_URL` 같은 비밀 값은 문서/PR/스크린샷/채팅에 그대로 남기지 않습니다.
- 대신 “설정됨/미설정됨” 또는 “접두부 몇 글자 + 마스킹” 형태로 확인합니다.

예: `SUPABASE_SERVICE_ROLE_KEY=***redacted***`
