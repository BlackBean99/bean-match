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
- `CLOUDFLARE_API_TOKEN` (Cloudflare 배포 + Cloudflare Images 업로드/삭제용 공통 비밀)
- `CLOUDFLARE_IMAGES_TOKEN` (선택, Images 전용 토큰. 런타임과 백필은 이 값을 `CLOUDFLARE_API_TOKEN`보다 우선해 읽습니다)
- `CLOUDFLARE_IMAGES_ACCOUNT_ID` (Cloudflare Images delivery/관리용, `CLOUDFLARE_ACCOUNT_ID`도 fallback으로 허용)
- `CLOUDFLARE_IMAGES_VARIANT` (선택, 기본값 `public`)
- `AUTO_SYNC_ON_START` (선택, 기본값 `true`; 서버 시작 시 Notion sync 1회를 자동 실행합니다)

### 3.5 Cloudflare Pages runtime
- Cloudflare Pages에서는 Variables and Secrets를 런타임 env로 읽습니다.
- 서버 코드에서는 `process.env`만 보지 말고 Pages runtime env를 우선 확인해야 합니다.
- 로컬 개발은 `.env.local`, Pages 배포는 Pages Variables/Secrets를 사용합니다.
- 배포 URL 생성용 `AUTH_URL` 이 없으면 `CF_PAGES_URL` 또는 로컬 기본값으로 폴백합니다.
- 사진 조회는 `/api/photos/{photoId}`를 통해 Cloudflare Images delivery URL로 리다이렉트합니다.
- Cloudflare Pages에서 운영 버튼을 눌러 sync를 실행하면 Functions 로그에 `scope=notion-sync` JSON이 남습니다. 여기서 `cloudflareTokenPresent`, `notionTokenPresent`, `supabaseServiceRoleKeyPresent` 같은 불리언을 확인합니다.
- Cloudflare 로그는 Pages deployment 상세 화면 또는 `wrangler pages deployment tail` 로 확인합니다.

### 3.6 GitHub Actions CD
- `main` 브랜치에 push 되면 `.github/workflows/cloudflare-deploy.yml` 이 Cloudflare 배포를 실행합니다.
- 이 workflow의 `PAGES_PROJECT_NAME` 은 Cloudflare Pages 프로젝트명 기준이며, 현재 운영 대상은 `bean-match-admin` 입니다. `wrangler.jsonc` 의 `name` 은 Worker 이름이라 서로 다를 수 있습니다.
- 그 workflow는 배포 전에 `wrangler pages secret bulk` 로 GitHub Secrets를 Cloudflare Pages project secrets로 동기화합니다. 즉, 실제 코드가 참조하는 `NOTION_SYNC_GITHUB_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NOTION_TOKEN`, `NOTION_API_VERSION`, `NOTION_MAIN_DATA_SOURCE_ID` 또는 `NOTION_USERS_DATABASE_ID`, `NOTION_INVITOR_DATA_SOURCE_ID`, `NOTION_MATCHING_HISTORY_DATA_SOURCE_ID`, `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_IMAGES_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_ID`(또는 `CLOUDFLARE_ACCOUNT_ID`), `CLOUDFLARE_IMAGES_VARIANT` 만 GitHub Secrets에 넣고 workflow가 Pages 런타임에 주입합니다.
- `.github/workflows/notion-sync.yml` 은 `workflow_dispatch` 로 수동 sync를 수행합니다. Cloudflare Pages의 운영 버튼은 production에서 이 workflow를 dispatch합니다.
- GitHub Secrets에는 `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` 를 넣습니다.
- Cloudflare Images를 쓰려면 Pages/앱 런타임과 GitHub Actions sync job에 `CLOUDFLARE_API_TOKEN` 또는 `CLOUDFLARE_IMAGES_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_ID`(또는 `CLOUDFLARE_ACCOUNT_ID`), `CLOUDFLARE_IMAGES_VARIANT` 를 넣습니다.
- Cloudflare Pages 배포 워크플로우는 현재 코드가 참조하는 범위만 전달합니다. `AUTH_SECRET`, `R2_*`, `SENTRY_DSN`, `NEXT_PUBLIC_POSTHOG_*`, `CLOUDFLARE_ACCESS_CLIENT_ID`, `CLOUDFLARE_ACCESS_CLIENT_SECRET` 는 이 저장소의 현재 런타임에서 사용하지 않으므로 배포 secret 주입 대상에서 제외했습니다.
- Notion sync workflow를 쓰려면 GitHub Actions Secrets에 `NOTION_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `NOTION_MAIN_DATA_SOURCE_ID` 또는 `NOTION_USERS_DATABASE_ID` 를 넣습니다. 필요하면 `NOTION_INVITOR_DATA_SOURCE_ID`, `NOTION_MATCHING_HISTORY_DATA_SOURCE_ID` 도 함께 넣습니다.
- 런타임이 참조하는 DB/Supabase/기타 비밀값은 Cloudflare 쪽 Variables and Secrets 에도 동일하게 설정합니다.
- Cloudflare Pages 운영 버튼이 GitHub Actions sync를 dispatch하려면 `NOTION_SYNC_GITHUB_TOKEN` 과 `NOTION_SYNC_GITHUB_REPOSITORY` 가 필요합니다.
- GitHub Actions의 `notion-sync.yml` 은 job 초반에 required secret presence 로그를 출력합니다. `Actions` 탭에서 workflow run을 열고 해당 job 로그를 확인합니다.
- 백필 스크립트는 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `CLOUDFLARE_API_TOKEN` 또는 `CLOUDFLARE_IMAGES_TOKEN`, `CLOUDFLARE_IMAGES_ACCOUNT_ID`(또는 `CLOUDFLARE_ACCOUNT_ID`) 가 필요하고, `NOTION_TOKEN`이 있으면 오래된 Notion 파일 URL을 재조회할 수 있습니다.
- 운영자용 백필 실행 예시는 `npm run backfill:cloudflare-images -- --write` 입니다.

## 4. “구성 값 전부 보여줘”에 대한 운영 원칙
- `SUPABASE_SERVICE_ROLE_KEY`, `NOTION_TOKEN`, `DATABASE_URL` 같은 비밀 값은 문서/PR/스크린샷/채팅에 그대로 남기지 않습니다.
- 대신 “설정됨/미설정됨” 또는 “접두부 몇 글자 + 마스킹” 형태로 확인합니다.

예: `SUPABASE_SERVICE_ROLE_KEY=***redacted***`
