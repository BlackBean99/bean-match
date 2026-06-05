# API / 파일 저장 / 보안 설계

## 1. API 개요
권장 API 스타일은 REST 기반이며, 운영자용과 사용자용을 분리하는 것이 좋다.

---

## 2. 주요 API 목록

### 2.0 Operations
- `POST /api/migration/notion` : 운영자가 수동으로 Notion 데이터를 Supabase로 동기화한다. 응답은 항상 JSON이며, 실패도 `status: "error"` 상태로 반환해 현재 페이지 URL로 잘못 POST하지 않게 한다.
  - 앱 런타임에서 직접 sync job을 시작하고 `status: "queued"` 를 반환한다. 진행 상태는 같은 API의 `GET` 응답으로 폴링한다.

### 2.1 User
- `POST /api/users` : 사용자 생성
- `GET /api/users/{id}` : 사용자 상세 조회
- `PATCH /api/users/{id}` : 사용자 정보 수정
- `PATCH /api/users/{id}/status` : 사용자 상태 변경
- `GET /api/users` : 사용자 목록 조회 (상태/역할/키/성별/나이 필터)

### 2.2 Role
- `POST /api/users/{id}/roles` : 역할 추가
- `DELETE /api/users/{id}/roles/{role}` : 역할 제거

### 2.3 Preference
- `PUT /api/users/{id}/preferences` : 이상형 정보 저장/수정

### 2.4 Photo
- `POST /api/users/{id}/photos` : 사진 업로드
- `PATCH /api/users/{id}/photos/{photoId}/main` : 대표 사진 변경
- `DELETE /api/users/{id}/photos/{photoId}` : 사진 삭제
- `GET /api/users/{id}/photos/{photoId}` : 사진 조회/다운로드
- `GET /api/photos/{photoId}` : 앱 내부 사진 표시 URL. 저장된 사진이 Cloudflare Images에 있으면 delivery URL로 리다이렉트하고, 아직 캐시가 없으면 source URL을 Cloudflare Images에 올린 뒤 delivery URL로 연결한다. 캐시 생성이 일시적으로 실패해도 source 이미지를 서버 프록시로 반환해 fallback 이미지에 멈추지 않도록 한다.

### 2.5 IntroCase
- `POST /api/intro-cases` : 소개 건 생성
- `GET /api/intro-cases/{id}` : 소개 건 상세 조회
- `PATCH /api/intro-cases/{id}/status` : 소개 건 상태 변경
- `POST /api/intro-cases/{id}/responses` : 참여자 응답 등록
- `POST /api/intro-cases/{id}/result` : 결과 확인 등록

### 2.6 Auto Exposure / Interest
- `GET /invite/{invitorId}` : 모집인 초대 링크. 자동 노출 참여 진입 폼에 `invitorId`를 전달한다.
- `GET /onboarding?invitorId={invitorId}` : 초대 출처를 유지한 자동 노출 참여 진입 URL
- `GET /pool/{userId}` : 참가자 개인 풀 URL. 신규 가입자는 브라우징 관심을 제출하고, 기존 회원은 새 멤버 알림을 확인한다.
- `GET /offer/pool/{userId}` : 관리자 발급 토큰으로만 접근 가능한 외부 오퍼 후보 열람 URL
- `POST /pool/{userId}/browse-interests` : 신규 가입자가 최대 3명의 관심을 제출한다. 현재 구현은 Server Action을 사용한다.
- `POST /pool/{userId}/broadcast-interests` : 기존 회원이 새 멤버 알림 카드에 관심을 표시한다. 현재 구현은 Server Action을 사용한다.
- `GET /rounds` : 관리자 자동 노출 운영 화면
- `GET /users` : 관리자 사용자 풀 화면
- `GET /matches` : 관리자 매칭 조율 화면

---

## 3. 상태 변경 정책

### 3.1 사용자 상태 변경
직접 변경과 자동 변경을 혼합한다.

자동 전이:
- 활성 소개 건 생성/복구 -> `PROGRESSING`
- 탈퇴 요청 후 90일 -> `ARCHIVED`

운영자 확인 전이:
- 결과 확인 후 `READY` 또는 `HOLD`
- 정책 위반 시 `BLOCKED`

### 3.2 소개 건 상태 변경
`IntroCase`는 서비스 레이어에서 FSM 검증 후 상태를 바꿔야 한다.  
임의 업데이트 SQL로 상태를 바꾸지 않도록 한다.

---

## 4. 사진 파일 저장 전략

### 4.1 저장 원칙
- DB에는 이미지 바이너리를 저장하지 않는다.
- 운영 환경에서는 서버 디스크에 원본을 저장하지 않는다.
- 직접 업로드/클립보드 붙여넣기 이미지는 Cloudflare Images에 직접 업로드한다.
- Notion에서 가져온 파일은 source URL을 Cloudflare Images에 업로드하고, `file_url`에 delivery URL만 저장한다.
- UI는 Cloudflare Images delivery URL을 우선 사용한다. 오래된 레코드는 `/api/photos/{photoId}`를 통해 Cloudflare Images delivery URL로 정리한다. 이 라우트는 저장된 delivery URL을 반환하고, 아직 캐시가 없으면 Notion source를 다시 읽어 Cloudflare Images에 업로드한 뒤 delivery URL로 연결한다. 업로드가 일시적으로 실패해도 서버가 source 이미지를 프록시 응답해 사용자 화면이 fallback SVG로 멈추지 않도록 한다. Notion presigned URL은 최종 렌더링 URL로 직접 노출하지 않는다.
- DB에는 메타데이터를 저장한다.

### 4.2 저장 예시
파일 경로 예시:

저장 메타데이터:
- `original_file_name`
- `stored_file_name`
- `file_path`: source URL 또는 Cloudflare Images 식별자 메모
- `file_url`: Cloudflare Images delivery URL
- `mime_type`
- `file_size_bytes`
- `width_px`
- `height_px`
- `is_main`

### 4.3 파일명 규칙
- 업로드 시 원본명을 그대로 저장하지 않고 UUID 기반 저장명 사용
- 원본명은 별도 컬럼에 저장
- 확장자는 화이트리스트 검증 후 허용

### 4.4 디렉터리 구조 권장
- 애플리케이션은 별도 업로드 디렉터리를 만들지 않는다. 이미지 저장과 전송은 Cloudflare Images가 담당한다.

### 4.5 삭제 정책
- DB soft delete + 파일 비동기 삭제 또는 보존 정책 선택
- 대표 사진 삭제 시 다른 사진을 대표로 승격하거나 `main_photo_id = null` 처리

---

## 5. 보안 요구사항

### 5.1 접근 제어
- 운영자만 전체 사용자 조회 가능
- 사용자는 본인 프로필만 수정 가능
- `/offer/pool/{userId}` 는 관리자 발급 토큰이 유효할 때만 접근 가능해야 한다.
- `/offer/*`, `/invite/{invitorId}`, `/onboarding/access/{token}`, `/api/photos/*` 를 제외한 운영 경로는 운영 로그인 세션으로 보호해야 한다.
- 오퍼 토큰은 사용자별로 발급하고, 서버에는 원문 대신 해시만 저장한다.
- 연락처는 `CONNECTED` 전까지 비공개 정책을 권장

### 5.2 업로드 보안
- 허용 MIME type 제한: `image/jpeg`, `image/png`, `image/webp`, `image/gif`
- 최대 파일 크기 제한
- 파일 헤더 검사
- 실행 가능 파일 업로드 금지

### 5.3 파일 서빙 보안
- 정적 공개 URL 직접 노출보다 인증 후 다운로드 방식 권장
- 또는 서명 URL 방식 고려 가능

### 5.4 개인정보 처리
- 연락처와 사진은 개인정보 취급 대상으로 관리
- 탈퇴/보관 시 마스킹 또는 접근 제한 필요

---

## 6. 예외 처리

### 대표 사진 변경
1. 대상 사진이 해당 사용자의 사진인지 검증
2. 기존 대표 사진 `is_main = false`
3. 새 사진 `is_main = true`
4. `users.main_photo_id` 업데이트
5. 트랜잭션으로 처리

### 사진 삭제
1. 사진 소유자 검증
2. 삭제 대상이 대표 사진인지 확인
3. 대표 사진이면 대체 대표 설정 또는 null 처리
4. DB soft delete
5. 파일 삭제 큐 등록 또는 즉시 삭제

### 소개 생성
1. 참여자 2명인지 검증
2. 각 사용자가 `READY` 상태인지 검증
3. 각 사용자의 활성 소개 건 존재 여부 확인
4. `IntroCase` 생성
5. 참여자 매핑 생성
6. 두 사용자 상태를 `PROGRESSING` 으로 전환

### 관심 제출
1. 관심을 보내는 사용자와 받는 사용자가 모두 `READY` 조건을 만족하는지 검증
2. `PROGRESSING`, `HOLD`, `ARCHIVED`, `BLOCKED` 사용자는 자동 노출 대상에서 제외
3. `SEMI_OPEN` 또는 `FULL_OPEN` + 프로필 노출 동의 사용자만 후보로 노출
4. 신규 가입자는 최대 3명, 기존 회원은 새 멤버당 최대 1회 관심 표시
5. 상호 관심이 생기면 `IntroCandidate` 를 생성하고 즉시 `IntroCase` 로 연결하지 않음
6. 관심 데이터는 `ACTIVE/WITHDRAWN/EXPIRED/CONVERTED_TO_INTRO` 상태로만 갱신

### 오퍼 후보 열람
1. `read_only_browse_tokens` 에 저장된 해시 기준으로 토큰을 검증
2. 만료되었거나 해제된 토큰은 거절
3. 토큰이 유효하면 본인과 같은 성별을 제외한 후보만 노출
4. 후보는 `READY` + (`SEMI_OPEN` 또는 `FULL_OPEN`) + 프로필 노출 동의 상태여야 함
5. 활성 소개 중인 사용자와 기존 소개 이력이 있는 페어는 제외
6. 연락처와 관리자 메모는 어떤 경우에도 노출하지 않음

### 자동 노출 참여 진입
1. 사용자가 기존 데이터 ID와 이름을 입력
2. 서버가 ID와 이름이 같은 사용자 데이터를 조회
3. `PROGRESSING`, `HOLD`, `STOP_REQUESTED`, `ARCHIVED`, `BLOCKED` 상태면 거절
4. 사용자의 자동 노출 레벨, 노출 동의, 신규 멤버 알림 수신 여부를 갱신
5. 사용자를 `READY` 로 두고 자동 노출 큐를 갱신
6. 새 멤버가 자동 노출 대상이면 기존 eligible 사용자에게 in-app 알림 생성
7. `/pool/{userId}` 로 이동

---

## 7. 추천 기술 구현 포인트
- 파일 업로드는 multipart/form-data
- 메타데이터 추출을 위한 이미지 라이브러리 사용
- 대용량 운영 시 썸네일 비동기 생성 고려
- 상태 전이 검증은 enum + transition map 또는 state machine library 활용
