📄 Blackbean Match – Agent Development Request (v1.0)
1. 한 줄 요약

👉 “라운드 기반, 오픈 선택형, Operator 통제 매칭 시스템”

2. 제품 개요 (Context)

Blackbean Match는 일반적인 데이팅 앱이 아니라:

• Trust 기반 소개 네트워크
• Operator 주도 매칭
• 라운드 기반 탐색 경험
• 제한된 선택 + 완전한 정보 공개

👉 핵심은:

👉 “노출은 설계하고, 선택은 제한하고, 연결은 통제한다”

3. 사용자 타입 (Roles)
3.1 PARTICIPANT (일반 사용자)

• 소개 대상
• 라운드 참여
• 후보 선택

3.2 INVITOR (모집인)

• 신규 유저 초대
• 네트워크 확장
• 직접 매칭 개입 없음

3.3 ADMIN (운영자 / Operator)

• 매칭 조율
• 노출 밸런싱
• Fast Track 실행

4. 핵심 시스템 구조
4.1 User State FSM
INCOMPLETE
→ READY
→ (라운드 참여)
→ PROGRESSING
→ HOLD
→ STOP_REQUESTED
→ ARCHIVED
→ BLOCKED
핵심 규칙

• PROGRESSING 상태에서는 신규 매칭 금지
• READY 상태만 라운드 참여 가능

4.2 Intro Case FSM
OFFERED
→ A_INTERESTED
→ B_OFFERED
→ MATCHED
→ CONNECTED
→ MEETING_DONE
→ RESULT_PENDING
→ SUCCESS / FAILED
5. 핵심 기능 요구사항
5.1 Onboarding
목표

• 빠른 진입
• 라운드 참여 준비

Flow
1. 초대 링크 진입
2. 기본 프로필 작성
3. 오픈 레벨 선택
4. READY 상태 진입
필드

• 이름
• 나이
• 직업
• 키
• 자기소개 (자연어)
• 이상형 (자연어)
• 오픈 레벨

5.2 Open Level 시스템
PRIVATE → Operator 매칭만
SEMI_OPEN → 제한된 풀 노출
FULL_OPEN → 전체 라운드 참여
규칙

• FULL_OPEN만 전체 풀 노출
• PRIVATE는 큐레이션 only

5.3 Round System (핵심)
라운드 정의
주 2회 (예: 수요일 / 일요일)
라운드 흐름
[START]
→ 참여 유저 FULL 공개

[USER ACTION]
→ 최대 2명 선택

[END]
→ Operator 매칭 조율

→ 결과 전달
제한

• 선택 가능 인원: 2명
• 선택 변경 불가

5.4 Candidate Pool (라운드 내)

각 유저는 라운드에서:

- visible_candidates: 전체 풀
- selected_candidates: max 2
5.5 Entry Queue (신규 유저)
구조
user_id
joined_at
status: WAITING / READY
규칙

• 신규 유저는 즉시 라운드 참여 불가
• 다음 라운드에서 FULL 공개

5.6 Fast Track 매칭
조건

• Operator high confidence
• strong match 예상

흐름
READY →
즉시 FULL 정보 공개 →
바로 매칭 진행
제한

• 전체의 10~20% 이내

5.7 Matching Logic
기본 규칙
1. mutual selection → 자동 매칭
2. single selection → operator 판단
3. 인기 과다 유저 → 분산 배치
5.8 Exposure Control
규칙
- PROGRESSING 유저 노출 제외
- 과다 선택 유저 노출 제한
- 저노출 유저 우선 노출
5.9 Communication
원칙

• 외부 연락처 즉시 공유 금지
• CONNECTED 단계에서 공개

기능

• 내부 메시지 or relay 시스템
• 알림 시스템 필수

6. 운영자(Admin) 기능
6.1 Dashboard
- 유저 리스트
- 상태 필터링
- 매칭 상태 확인
- 선택 데이터 확인
6.2 Matching Control
- 매칭 승인 / 거절
- Fast Track 실행
- 후보 재배치
6.3 Load Control
- 특정 유저 노출 제한
- 선택 집중 분산
7. 모집인(INVITOR) 시스템
7.1 초대 구조
invitor → 초대 링크 생성 → 신규 유저 가입
7.2 보상 구조 (선택)
- 가입 1명
- 매칭 발생
- 성공 발생
7.3 역할 제한

• 매칭 개입 없음
• 커뮤니케이션 개입 없음

👉 오직 유입 역할

8. 데이터 모델 (핵심)
User
id
state
open_level
profile_data
preferences
created_at
Round
id
status (OPEN / CLOSED)
start_at
end_at
Selection
id
round_id
from_user_id
to_user_id
created_at
Intro Case
id
user_a
user_b
status
created_at
Entry Queue
user_id
status
joined_at
9. KPI (초기 핵심 지표)
- 라운드 참여율
- 선택률 (selection rate)
- mutual selection rate
- MATCHED 전환율
- CONNECTED 전환율
10. 개발 우선순위 (MVP)
1. User + Onboarding
2. Round System
3. Selection 기능 (2명 제한)
4. Matching (mutual 기반)
5. Admin Dashboard
6. Entry Queue
7. Notification
