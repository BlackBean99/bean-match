# URL Sharing and Access Guide

## 목적
2026-04-14 요구사항 기준으로 사용자, 모집인, 관리자가 서로 다른 URL을 받도록 운영한다. URL은 역할별 목적을 분리하고, 연락처와 운영자 기능을 불필요하게 노출하지 않기 위한 경계다.

## 사용자(PARTICIPANT)
사용자는 가입과 라운드 선택 URL만 받는다.

- 온보딩: `/onboarding`
- 모집인 초대 기반 온보딩: `/invite/{invitorId}` 또는 `/onboarding?invitorId={invitorId}`
- 라운드 선택: `/rounds/{roundId}/participants/{userId}`

사용자 라운드 URL에서 가능한 일:
- 라운드 후보 확인
- 최대 2명 선택
- 이미 선택한 후보 확인

사용자 라운드 URL에서 금지되는 일:
- 연락처 확인
- 관리자 메모 확인
- 다른 사용자의 선택 데이터 확인
- 매칭 승인/거절

## 모집인(INVITOR)
모집인은 신규 유저 유입만 담당한다.

- 초대 공유 URL: `/invite/{invitorId}`

모집인이 할 수 있는 일:
- 초대 링크 공유
- 신규 사용자가 본인 초대 링크로 들어오도록 안내

모집인이 할 수 없는 일:
- 매칭 조율
- 후보 재배치
- 라운드 선택 데이터 확인
- 사용자 연락처 확인
- 커뮤니케이션 개입

## 관리자(ADMIN / Operator)
관리자는 내부 운영 URL을 사용한다.

- 사용자 풀: `/users`
- 사용자 상세: `/users/{userId}`
- 라운드 운영: `/rounds`
- 매칭 조율: `/matches`
- Notion 동기화: 운영 화면의 `Notion -> Supabase 동기화` 버튼

관리자가 할 수 있는 일:
- 라운드 생성과 상태 변경
- 선택 데이터 확인
- 상호 선택 자동 매칭 후보 확인
- 단방향 선택의 운영자 판단
- Fast Track 실행 판단
- 노출 제한과 후보 재배치
- `CONNECTED` 이후 연락처 공개 정책 처리

## 공유 원칙
- 공개 공유 URL은 `/invite/{invitorId}` 와 `/rounds/{roundId}/participants/{userId}` 만 사용한다.
- 관리자 URL은 내부 운영자에게만 공유한다.
- 연락처는 `CONNECTED` 전까지 어떤 URL에서도 노출하지 않는다.
- `PROGRESSING` 사용자는 라운드 후보와 신규 소개 생성에서 제외한다.
- 현재 MVP URL은 식별자 기반이다. 운영 배포 전에는 초대/라운드 URL에 서명 토큰 또는 인증 게이트를 추가해야 한다.
