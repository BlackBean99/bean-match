# Code Complete and Definition of Done

## 1. 목적
이 문서는 “작업이 끝났다”를 감으로 판단하지 않고, 코드 완료 기준을 객관적으로 정의하기 위한 문서다.

## 2. Code Complete 정의
다음이 모두 충족되면 Code Complete 로 본다.
1. 요구사항이 PRD와 일치한다.
2. 상태/FSM 규칙을 위반하지 않는다.
3. 타입체크, 린트, 테스트, 빌드가 통과한다.
4. 프로덕션 빌드 결과물을 `npm run start` 로 직접 실행해 주요 경로가 정상 응답한다.
5. 운영 문서 또는 API 문서가 필요한 경우 업데이트되었다.
6. 로그/에러 처리/빈값 처리 등 기본 예외가 반영되었다.
7. 리뷰 가능한 단위로 정리되었다.

## 3. Definition of Done 체크리스트
### 기능
- [ ] 요구한 사용자 시나리오가 동작한다
- [ ] 예외 시나리오를 처리한다
- [ ] 권한 체크가 있다
- [ ] 상태 전이 규칙을 지킨다

### 데이터
- [ ] DB schema 반영 완료
- [ ] migration 존재
- [ ] seed/test fixture 필요 시 반영
- [ ] soft delete / unique constraint 등 데이터 규칙 검토

### 파일 업로드
- [ ] MIME type 검증
- [ ] 파일 크기 제한
- [ ] 대표 사진 처리 로직 검증
- [ ] object storage 연동 확인

### 테스트
- [ ] unit test
- [ ] integration test
- [ ] happy path
- [ ] edge case
- [ ] regression test
- [ ] `npm run lint`
- [ ] `npm run typecheck`
- [ ] `npm run build`
- [ ] `npm run start` 로 프로덕션 서버 부팅 확인

### 문서
- [ ] README 또는 관련 문서 갱신
- [ ] PR 설명 작성
- [ ] 변경 이유 기록
