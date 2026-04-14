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

### 3.3 DB (Prisma 모드)
- `DATABASE_URL` (비밀)

### 3.4 File Storage / R2 (향후)
- `R2_PUBLIC_BASE_URL` (공개 가능)

## 4. “구성 값 전부 보여줘”에 대한 운영 원칙
- `SUPABASE_SERVICE_ROLE_KEY`, `NOTION_TOKEN`, `DATABASE_URL` 같은 비밀 값은 문서/PR/스크린샷/채팅에 그대로 남기지 않습니다.
- 대신 “설정됨/미설정됨” 또는 “접두부 몇 글자 + 마스킹” 형태로 확인합니다.

예: `SUPABASE_SERVICE_ROLE_KEY=***redacted***`

