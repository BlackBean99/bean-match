🎨 Blackbean Match – Web Design System
1. Design Philosophy

Blackbean Match는 단순한 소개 서비스가 아니라
신뢰 기반 큐레이션 네트워크다.

디자인 원칙은 다음과 같다.

핵심 원칙
Simple Structure, Strong Motion
High Contrast, High Emotion
Minimal UI, Maximal Interaction
Speed + Precision + Delight
2. Visual Identity
2.1 Brand Tone
프라이빗
고급스러움
신뢰
큐레이션
실험적 인터랙션
2.2 Color System

👉 핵심: 고채도 + 제한된 팔레트

Primary
Electric Purple: #7B61FF
Neon Pink: #FF3CAC
Secondary
Deep Black: #0B0B0F
Dark Gray: #1A1A22
Accent
Cyan Glow: #00E5FF
Lime Highlight: #A3FF12
⚠️ 규칙
배경은 항상 어둡게
컬러는 포인트로만 사용
한 화면에 2개 이상 포인트 색 금지
3. Typography
Font Strategy
Heading: Inter / Space Grotesk
Body: Pretendard / Noto Sans KR
Typography Scale
Type	Size	Weight
H1	48px	Bold
H2	32px	SemiBold
H3	24px	Medium
Body	16px	Regular
Caption	12px	Regular
규칙
line-height: 1.5 ~ 1.7
글자 대비는 WCAG 기준 이상 유지
고채도 배경 위 텍스트는 항상 white or near-white
4. Layout System
핵심 구조

👉 Grid 기반 + 넓은 여백

Max Width: 1200px
Padding: 24px
Section Gap: 80px
특징
카드 중심 레이아웃
중앙 정렬
정보 밀도 낮음
❗ 금지
복잡한 테이블 UI
정보 과다 노출
긴 텍스트 블록
5. Interaction System

이 서비스의 핵심이다.

5.1 Motion Principles
1. Physical Movement
밀린다
뒤집힌다
당겨진다
2. Layer Transition
화면이 겹친다
depth가 있다
3. Velocity Control
빠른 반응 + 부드러운 감속
5.2 Transition Types
1. Page Transition

👉 기본 전환

Slide (좌 → 우)
Fade + Scale
2. Advanced Transition

👉 강조 화면

Flip (카드 뒤집기)
Swipe Reveal
Fullscreen Expansion
3. Micro Interaction
Hover → Glow + Lift
Click → Ripple + Depth 감소
Drag → Elastic 반응
6. Component Design
6.1 Profile Card
구조
이미지 (70%)
이름 / 나이
키 / 직업
태그 (이상형)
Interaction
Hover → 확대 + 그림자 증가
Click → 카드 뒤집힘 (상세 정보)
6.2 Match Card (핵심 컴포넌트)

👉 Tinder 느낌 금지 → 대신 “큐레이션 카드”

Interaction
Swipe → Reject / Accept
Drag → Elastic Motion
Release → Snap
Motion
Physics 기반 애니메이션 (spring)
6.3 Button
스타일
Rounded (12px)
Gradient Background
Interaction
Hover → 색상 shift + glow
Click → scale 0.95
6.4 Modal
특징
중앙 등장 X
아래에서 올라옴 (bottom sheet 느낌)
Motion
spring animation
backdrop blur
7. Page Design
7.1 Dashboard
구조
상단: 상태 (READY / PROGRESSING)
중앙: 현재 매칭 카드
하단: 추천 리스트
Interaction
카드 클릭 → 전체 화면 확장
상태 변경 → 애니메이션 강조
7.2 User Detail Page
구조
Hero Image (Full width)
정보 카드
사진 슬라이드
Interaction
Scroll → 이미지 패럴랙스
사진 → 확대 + swipe
7.3 Match Flow
단계
OFFER
MATCH
CONNECTED
RESULT
UX
단계별 진행 UI (Progress Bar)
상태 변경 시 애니메이션 강조
8. Motion Spec
기본 값
Duration: 200ms ~ 400ms
Easing:
ease-out
cubic-bezier(0.22, 1, 0.36, 1)
Spring (추천)
stiffness: 200
damping: 20
9. 기술 스택 (추천)
Frontend
React + Next.js
Framer Motion (필수)
Tailwind CSS
Animation
Framer Motion
GSAP (고급 인터랙션)
10. UX 핵심 규칙
1. 상태는 항상 눈에 보이게
READY / PROGRESSING 강조
2. 인터랙션은 즉각 반응
100ms 이내 반응 시작
3. 화면 전환은 경험이다
단순 페이지 이동 금지
11. 레퍼런스 스타일 (방향성)

이런 느낌을 목표로 한다:

Apple (절제 + 모션)
Stripe (깔끔 + 인터랙션)
Linear (빠른 UX)
Superhuman (속도 중심)
Vercel (미니멀 + 디테일)
12. 금지 사항

❌ 저가형 소개팅 앱 느낌
❌ 과도한 텍스트
❌ 복잡한 UI
❌ 의미 없는 애니메이션

13. 핵심 한 줄

“Simple UI, but feels alive”

🔥 마지막 핵심 정리

너 디자인 방향은 이거다:

👉 “정적인 UI + 강한 물리 기반 인터랙션”

원하면 다음 단계로:

👉 React + Tailwind + Framer Motion 기반 실제 컴포넌트 코드
👉 랜딩 페이지 디자인 (실제 화면 구조)
👉 Figma 구조 (컴포넌트 설계)

까지 바로 만들어줄게.
