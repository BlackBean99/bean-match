# API / 파일 저장 / 보안 설계

## 1. API 개요
권장 API 스타일은 REST 기반이며, 운영자용과 사용자용을 분리하는 것이 좋다.

---

## 2. 주요 API 목록

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

### 2.5 IntroCase
- `POST /api/intro-cases` : 소개 건 생성
- `GET /api/intro-cases/{id}` : 소개 건 상세 조회
- `PATCH /api/intro-cases/{id}/status` : 소개 건 상태 변경
- `POST /api/intro-cases/{id}/responses` : 참여자 응답 등록
- `POST /api/intro-cases/{id}/result` : 결과 확인 등록

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
- 서버 디스크에 원본을 저장한다.
- DB에는 메타데이터를 저장한다.

### 4.2 저장 예시
파일 경로 예시:

`/var/app/uploads/profile/2026/04/07/{uuid}.jpg`

저장 메타데이터:
- `original_file_name`
- `stored_file_name`
- `file_path`
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
- `/uploads/profile/yyyy/MM/dd/`
- `/uploads/profile-thumbs/yyyy/MM/dd/` (선택)
- `/uploads/temp/` (선택)

### 4.5 삭제 정책
- DB soft delete + 파일 비동기 삭제 또는 보존 정책 선택
- 대표 사진 삭제 시 다른 사진을 대표로 승격하거나 `main_photo_id = null` 처리

---

## 5. 보안 요구사항

### 5.1 접근 제어
- 운영자만 전체 사용자 조회 가능
- 사용자는 본인 프로필만 수정 가능
- 연락처는 `CONNECTED` 전까지 비공개 정책을 권장

### 5.2 업로드 보안
- 허용 MIME type 제한: `image/jpeg`, `image/png`, `image/webp`
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

---

## 7. 추천 기술 구현 포인트
- 파일 업로드는 multipart/form-data
- 메타데이터 추출을 위한 이미지 라이브러리 사용
- 대용량 운영 시 썸네일 비동기 생성 고려
- 상태 전이 검증은 enum + transition map 또는 state machine library 활용
