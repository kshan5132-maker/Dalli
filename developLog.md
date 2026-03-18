# Dalli 개발 로그

## [Beta 1.0.8 - 피드백 대량 반영] - 2026-03-14

### 신규 기능 (5건)

#### 1. 운동 종류/운동량 입력
- **변경**: 인증 시 운동 종류(드롭다운)와 운동량(텍스트) 입력 가능
- **종류**: 웨이트, 런닝, 수영, 자전거, 등산, 요가, 기타
- **운동량 예시**: "30분", "5km", "3세트" 등 자유 입력
- **표시**: 그룹 피드에서 운동 종류/운동량이 인증 카드에 함께 표시
- **파일**: `src/app/verify/page.tsx`, `src/lib/types.ts`
- **DB**: `verifications` 테이블에 `exercise_type`, `exercise_amount` 컬럼 추가

#### 2. 좋아요/싫어요 리액션
- **변경**: 그룹 피드의 각 인증에 👍/👎 리액션 가능
- **동작**: 토글(같은 버튼 재클릭 시 취소), 전환(👍→👎 변경) 지원
- **과반수 이의**: 멤버 과반수 이상이 👎 시 "⚠️ 과반수 이의 — 인증 무효" 표시
- **파일**: `src/app/group/[id]/page.tsx`, `src/lib/types.ts`
- **DB**: `verification_reactions` 테이블 신규 생성

#### 3. 주간 히스토리 네비게이션
- **변경**: 미션현황 탭에서 이전 주/다음 주 화살표로 이동 가능
- **표시**: "이번 주", "지난 주", 또는 "M/D ~ M/D" 형식으로 날짜 표시
- **요일별 상세**: 과거 주 조회 시 미래 일자를 '-' 대신 실제 인증 여부 표시
- **파일**: `src/app/group/[id]/page.tsx`, `src/lib/utils.ts`

#### 4. 멤버 프로필 상세 모달
- **변경**: 미션현황 카드 클릭 시 멤버 상세 모달 표시
- **내용**: 프로필 사진, 닉네임, 이번 주 인증/달성률/누적 벌금 통계
- **최근 기록**: 최근 30건의 인증 기록 (사진 미리보기, 루틴명, 운동 종류/량, 메모)
- **파일**: `src/app/group/[id]/page.tsx`

#### 5. 누적 벌금 표시
- **변경**: 과거 4주간 미달성 주를 계산하여 누적 벌금 표시
- **표시 위치**: 미션현황 카드 닉네임 아래 + 멤버 상세 모달 통계
- **계산 기준**: 각 주의 고유 인증 일수 < 주간 목표 → 벌금 1회 부과
- **파일**: `src/app/group/[id]/page.tsx`

### 빌드 결과
- `npx next build`: ✅ 성공 (0 에러)

---

## [Beta 1.0.7 - 피드백 반영] - 2026-03-14

### 수정 사항 (3건)

#### 1. 하루 1회 인증 제한 (UI 차단)
- **변경**: 당일 이미 인증한 루틴은 인증 버튼 비활성화
- **이전**: 경고 메시지만 표시, 제출은 가능 (카운트만 안 됨)
- **이후**: 버튼 텍스트 "오늘 인증 완료됨"으로 변경, disabled 처리
- **DEV_MODE**: 테스트 모드에서는 기존처럼 추가 인증 가능
- **파일**: `src/app/verify/page.tsx`

#### 2. 목표 초과 인증 표시 개선
- **변경**: 미션현황 카드에서 목표 초과 시 "초과 달성! (N회 추가) ✅" 메시지 표시
- **이전**: 100% 이상이면 동일하게 "완료! ✅" 표시
- **이후**: 초과분을 명시적으로 보여줌 (예: "초과 달성! (2회 추가) ✅")
- **파일**: `src/app/group/[id]/page.tsx`

#### 3. PC 인증 사진 확대 개선
- **변경**: 사진 뷰어에서 이미지를 `object-contain`으로 전체 표시 + 클릭 시 원본 크기 새 탭
- **이전**: `object-cover`로 잘린 상태, PC에서 확대 불가
- **이후**: 전체 이미지 표시, 클릭하면 원본 해상도로 새 탭에서 열림, 안내 텍스트 추가
- **파일**: `src/app/group/[id]/page.tsx`

### 빌드 결과
- `npx next build`: ✅ 성공 (0 에러)

---

## [UI Redesign - 미션현황] - 2026-03-10

### 변경 대상
그룹 상세 페이지 → 미션현황 탭 전체 리디자인

### 변경 사유
- 기존 요일별 체크 표가 빈 칸(-)으로 가득 차서 정보 밀도가 낮음
- 누가 잘하고 있는지 한눈에 파악이 안 됨
- 긴장감/동기부여 요소 부족

### 새로운 UI 구조

#### 1. 상단 요약 카드 개선
- "이번 주 미션 달성 현황" 헤더 유지
- 주간 목표 횟수 표시 (예: "주간 목표: 3회 인증")
- **남은 기간 표시**: "남은 기간: N일" 또는 일요일이면 "오늘이 마지막 날!" (빨간 강조, 애니메이션)
- 벌금 금액 표시

#### 2. 멤버 카드형 리스트 (메인 뷰)
- 달성률 높은 순 정렬 (같으면 이름순)
- 각 카드 구성:
  - 왼쪽: 순위 이모지 (🥇🥈🥉 또는 순번) + 프로필 사진 + 닉네임
  - 오른쪽: N/목표회수
  - 아래: 프로그레스 바 (색상 코딩) + 상태 메시지
- 프로그레스 바 색상:
  - 100%: 초록 (#10B981)
  - 50~99%: 노랑 (#F59E0B)
  - 1~49%: 주황 (#F97316)
  - 0%: 빨강 (#EF4444)
- 상태 메시지:
  - 목표 달성: "완료! ✅" (초록)
  - 50% 이상: "N회 남음" (주황)
  - 50% 미만: "N회 남음 🔴" (빨강)
  - 0%: "아직 시작 안 함 🔴" (빨강)
- 본인 카드: primary 색상 테두리 + 배경 강조 + "(나)" 표시

#### 3. 요일별 상세보기 (접힘/펼침)
- "📊 요일별 상세보기" 버튼 (기본: 접힘)
- 클릭 시 기존 요일별 체크 매트릭스(✅/❌) 표시
- 화살표 아이콘 회전 애니메이션

### 기술 노트
- 달성 횟수는 DISTINCT DATE 기준 카운트 (핫픽스 로직 유지)
- `showMissionDetail` state 추가로 접힘/펼침 관리
- 정렬: `memberStats`를 rate desc → nickname asc로 재정렬

### 변경된 파일
- `src/app/group/[id]/page.tsx` — 미션현황 탭 전체 리디자인

### 빌드 결과
- `npx next build`: ✅ 성공 (0 에러)

---

## [Hotfix - Beta 1.0.6] - 2026-03-10

### 버전: Beta 1.0.6 Hotfix

### 수정된 버그 (3건)

#### Hotfix 1: 인증 횟수 중복 카운트 (추가 수정)
- **증상**: Beta 1.0.6에서 일부 위치만 수정되어 여전히 중복 카운트 발생
- **원인**: `routine/[id]/page.tsx`, `group/[id]/page.tsx`, `dashboard/page.tsx` 그룹 요약에서 여전히 raw `.length` 사용
- **수정**: 프로젝트 전체 grep 후 남은 모든 위치에 고유 날짜(day) 카운트 적용
  - `routine/[id]/page.tsx`: weeklyDone, monthlyDone, totalDone, 그룹 랭킹 모두 `new Set(...toDateString()).size` 패턴 적용
  - `group/[id]/page.tsx`: memberStats weeklyDone 수정
  - `dashboard/page.tsx`: 그룹 요약 memberRates 쿼리에 `verified_at` 추가, unique day 카운트 적용
- **패턴**: `const uniqueDays = new Set(verifs.map(v => new Date(v.verified_at).toDateString())); done = uniqueDays.size`

#### Hotfix 2: 주간 결과 팝업 위치 변경
- **변경**: 홈(`page.tsx`)에서 그룹 상세(`group/[id]/page.tsx`)로 이동
- **조건 추가**:
  - 그룹 상세 페이지 진입 시에만 표시
  - 이번 주에 생성된 그룹(`created_at >= 이번 주 월요일`)이면 표시하지 않음
  - 지난 주 인증 데이터가 0건이면 표시하지 않음
  - localStorage 키: `dalli_lastCheckedWeek_group` (값: `${groupId}_${weekStartDate}`)로 그룹별 추적

#### Hotfix 3: 카메라 버튼 갤러리 열림 재확인
- **상태**: Beta 1.0.6에서 이미 분리된 input 적용 확인 완료
- **카메라**: `cameraInputRef` + `capture="environment"`
- **갤러리**: `galleryInputRef` (capture 없음)

### UI 변경 (2건)

#### UI 1: 미션 탭 "벌금 대상자" 섹션 제거
- **변경**: `group/[id]/page.tsx` 미션현황 탭에서 벌금 대상자 요약 Card 전체 제거
- **이유**: 불필요한 부정적 UI 제거

#### UI 2: 대시보드 그룹 탭 "이번 달" 달성률 제거
- **변경**: `dashboard/page.tsx` 루틴별 달성률에서 그룹 탭일 때 "이번 달" 진행 바 숨김
- **조건**: `tab === 'personal'`일 때만 이번 달 표시

### 변경된 파일
- `src/app/page.tsx` — 주간 결과 팝업 제거
- `src/app/group/[id]/page.tsx` — 주간 결과 팝업 추가, memberStats 중복 카운트 수정, 벌금 대상자 섹션 제거
- `src/app/routine/[id]/page.tsx` — weeklyDone/monthlyDone/totalDone/그룹 랭킹 중복 카운트 수정
- `src/app/dashboard/page.tsx` — 그룹 요약 중복 카운트 수정, 이번 달 달성률 그룹 탭에서 숨김

### 빌드 결과
- `npx next build`: ✅ 성공 (0 에러)

---

## [Beta 1.0.6 Update] - 2026-03-10

### 버전: Beta 1.0.6

### 수정된 버그 (4건)

#### 버그 1: 카메라 버튼이 갤러리를 여는 문제
- **증상**: 인증 페이지에서 "카메라로 촬영" 버튼 클릭 시 갤러리가 열림
- **원인**: 하나의 `<input type="file">`에 `capture` 속성을 동적으로 토글하면 일부 기기에서 작동하지 않음
- **수정**: 카메라용/갤러리용 `<input>` 2개로 분리
  - `cameraInputRef`: `accept="image/*" capture="environment"`
  - `galleryInputRef`: `accept="image/jpeg,image/png,image/heic,image/webp"` (capture 없음)
- **파일**: `src/app/verify/page.tsx`

#### 버그 2 (Critical): 같은 날 같은 루틴 인증이 중복 카운트
- **증상**: 같은 날 같은 루틴을 여러 번 인증하면 횟수가 중복으로 올라감
- **원인**: 인증 횟수를 레코드 수로 카운트 → 하루에 여러 번 인증하면 모두 합산
- **수정**: 고유 날짜(day)별로 카운트하는 패턴 적용
  ```ts
  const routineDays: Record<string, Set<string>> = {}
  vList.forEach((v) => {
    const dayKey = new Date(v.verified_at).toDateString()
    if (!routineDays[v.routine_id]) routineDays[v.routine_id] = new Set()
    routineDays[v.routine_id].add(dayKey)
  })
  // days.size = 고유 일수
  ```
- **DEV_MODE 예외**: 개발 모드에서는 기존 방식(전체 카운트) 유지
- **파일**: `src/app/verify/page.tsx`, `src/app/page.tsx`, `src/app/routine/page.tsx`, `src/app/dashboard/page.tsx`

#### 버그 3: 그룹 루틴 데이터가 개인 대시보드 탭에 표시
- **증상**: 대시보드 "개인" 탭에서 그룹 루틴 통계가 함께 표시됨
- **원인**: `weeklyData` 상태가 개인/그룹 구분 없이 전체 데이터를 저장
- **수정**: `personalWeeklyData`와 `groupWeeklyData`로 분리, 탭 선택에 따라 표시
- **파일**: `src/app/dashboard/page.tsx`

#### 버그 4: 그룹 설명 줄바꿈이 렌더링되지 않음
- **증상**: 그룹 설명에 입력한 줄바꿈(\n)이 한 줄로 표시됨
- **수정**: `whitespace-pre-wrap` CSS 클래스 적용
- **파일**: `src/app/group/[id]/page.tsx`

### 추가된 기능 (7건)

#### Feature 5: 프로필 사진 업로드/표시
- Supabase Storage `avatars` 버킷에 `profiles/{userId}/avatar.{ext}` 경로로 업로드
- `upsert: true`로 기존 사진 덮어쓰기
- 캐시 버스터 `?t=${Date.now()}` 적용
- 프로필 페이지에서 사진 변경 가능 (hover 오버레이 + 카메라 아이콘)
- 홈 화면 프로필 아바타에 사진 표시 (없으면 이니셜 폴백)
- **파일**: `src/app/profile/page.tsx`, `src/app/page.tsx`

#### Feature 6: 피드 사진 클릭 확대 (Photo Viewer)
- 인증 피드의 사진 클릭 시 풀스크린 모달로 확대
- 다크 오버레이 + 닉네임/날짜/메모 표시
- 모달 외부 클릭 또는 X 버튼으로 닫기
- **파일**: `src/app/group/[id]/page.tsx`

#### Feature 7: 그룹 프로필 사진
- 그룹 생성 시 사진 선택 가능 (미리보기 포함)
- 그룹 설정에서 관리자가 사진 변경 가능
- `groups.avatar_url` 컬럼 추가 (DB 스키마 변경)
- 그룹 목록, 그룹 상세 헤더에 그룹 사진 표시
- **파일**: `src/app/group/new/page.tsx`, `src/app/group/[id]/settings/page.tsx`, `src/app/group/page.tsx`, `src/app/group/[id]/page.tsx`

#### Feature 8: 그룹 설명 "더보기" 접기/펼치기
- 긴 설명은 2줄까지만 표시 (`line-clamp-2`)
- "더보기"/"접기" 토글 버튼
- 60자 이상일 때 버튼 표시
- **파일**: `src/app/group/[id]/page.tsx`

#### Feature 9: 주간 결과 팝업
- 새 주가 시작된 후 처음 접속한 사용자에게 지난 주 그룹 결과 팝업 표시
- `localStorage`에 `dalli_lastCheckedWeek` 키로 마지막 확인 주 저장
- 그룹 멤버 순위 표시 (🥇🥈🥉 메달 + 달성률)
- 미달성자에 "벌금" 표시
- **파일**: `src/app/page.tsx`

#### Feature 10: 미션 현황 매트릭스
- 그룹 상세 "미션현황" 탭 전면 개편
- 루틴별 × 멤버별 × 요일별(월~일) 매트릭스 그리드
- ✅(인증)/❌(미인증)/-(미래) 표시
- 오늘 요일 강조 표시
- 하단 벌금 대상자 요약 카드
- **파일**: `src/app/group/[id]/page.tsx`

#### Feature 11: 대시보드 그룹 순위 팝업
- 대시보드 그룹 카드 클릭 시 페이지 이동 대신 순위 팝업 표시
- 멤버별 달성률/완료 횟수 + 메달 아이콘
- 본인 강조 표시 ("나")
- "그룹 보기" 버튼으로 그룹 상세 이동
- **파일**: `src/app/dashboard/page.tsx`

### DB 스키마 변경
- `groups` 테이블에 `avatar_url TEXT` 컬럼 추가
- `avatars` 스토리지 버킷 생성 (public)
- 스토리지 정책: 인증 사용자 업로드/조회/수정/삭제
- **파일**: `src/db/schema_v4.sql` (신규)

### 기타 개선
- 채팅 아바타에 프로필 사진 표시 (기존 이니셜 → 사진 우선)
- 피드 카드 아바타에 프로필 사진 표시
- 멤버 목록에 프로필 사진 + 역할 뱃지(관리자/멤버) 표시
- `types.ts`에 Group 타입 `avatar_url` 필드 추가
- 프로필 페이지 버전 v1.0.6으로 업데이트

### 변경된 파일 전체 목록
1. `src/lib/types.ts` - Group 타입에 avatar_url 추가
2. `src/db/schema_v4.sql` - 신규 (DB 마이그레이션)
3. `src/app/verify/page.tsx` - 카메라 분리 + 고유 일수 카운트
4. `src/app/page.tsx` - 고유 일수 카운트 + 프로필 사진 + 주간 결과 팝업
5. `src/app/routine/page.tsx` - 고유 일수 카운트
6. `src/app/dashboard/page.tsx` - 개인/그룹 데이터 분리 + 순위 팝업
7. `src/app/group/[id]/page.tsx` - 설명 줄바꿈 + 사진 뷰어 + 매트릭스 + 그룹 아바타 + 채팅 아바타
8. `src/app/profile/page.tsx` - 프로필 사진 업로드 + v1.0.6
9. `src/app/group/page.tsx` - 그룹 목록 아바타 표시
10. `src/app/group/[id]/settings/page.tsx` - 그룹 사진 업로드
11. `src/app/group/new/page.tsx` - 그룹 생성 시 사진 선택

### 빌드 결과
- TypeScript 에러: 0
- 빌드 성공

---

## [Critical Fix - Group Routine Sharing + Edit] - 2026-03-09

### 버전: Beta 1.0.5

### 수정된 버그

#### 버그 1: 그룹 루틴이 멤버에게 표시되지 않음
- **증상**: 그룹 관리자가 만든 그룹 루틴이 다른 멤버의 루틴 목록/홈/대시보드에 표시되지 않음
- **원인**: 루틴 쿼리가 `.eq('user_id', uid)`로 필터 → 루틴 생성자(관리자)만 볼 수 있음
- **수정**: 개인 루틴과 그룹 루틴을 분리 쿼리
  - 개인 루틴: `.eq('user_id', uid).eq('type', 'personal')`
  - 그룹 루틴: `group_members`에서 내가 속한 그룹 조회 → `.eq('type', 'group').in('group_id', groupIds)`
  - 두 결과를 합쳐서 `allRoutines`로 사용

**수정된 파일:**
1. `src/app/routine/page.tsx` - 루틴 목록 `loadRoutines()`
2. `src/app/page.tsx` - 홈 페이지 `loadData()`
3. `src/app/dashboard/page.tsx` - 대시보드 `loadDashboard()`

#### 버그 2: 그룹 멤버 인증 목표 횟수 0 표시
- **증상**: 그룹 멤버 "주닝닝"이 "주간 1/0회 완료"로 표시 (목표가 0)
- **원인**: `memberRoutines.filter(r => r.user_id === member.user_id)`로 멤버별 목표 계산 → 루틴 생성자가 아닌 멤버는 0
- **수정**: 그룹 루틴은 모든 멤버에게 공유 → 전체 그룹 루틴의 `FREQUENCY_TARGETS` 합산을 `sharedWeeklyTarget`으로 사용
  ```ts
  const sharedWeeklyTarget = allGroupRoutines.reduce(
    (sum, r) => sum + (FREQUENCY_TARGETS[r.frequency] || 0), 0
  )
  ```

**수정된 파일:**
1. `src/app/group/[id]/page.tsx` - 그룹 상세 멤버 통계
2. `src/app/dashboard/page.tsx` - 대시보드 그룹 요약 멤버 순위

### 추가된 기능

#### 인증 메모 수정 기능
- **조건**: 본인 인증만, 당일(오늘)만, 메모 텍스트만 (사진 수정 불가)
- **UI**: 피드 카드에 연필 아이콘 (조건 충족 시만 표시)
- **모달**: 메모 입력 + 저장 버튼
- **DB**: `supabase.from('verifications').update({ memo }).eq('id', verificationId)`

**수정된 파일:**
1. `src/app/group/[id]/page.tsx` - 피드 카드 연필 아이콘 + 메모 수정 모달

### 변경된 파일 전체 목록
1. `src/app/routine/page.tsx` - 그룹 루틴 쿼리 분리
2. `src/app/page.tsx` - 그룹 루틴 쿼리 분리
3. `src/app/dashboard/page.tsx` - 그룹 루틴 쿼리 분리 + 멤버 목표 공유
4. `src/app/group/[id]/page.tsx` - 멤버 목표 공유 + 메모 수정 기능

### 빌드 결과
- TypeScript 에러: 0
- 빌드 성공

---

## [Feature - Group Settings & Delete] - 2026-03-09

### 추가된 기능

#### 1. 그룹 설정 페이지 (`/group/[id]/settings`)
- **관리자 전용** 페이지: 비관리자 접근 시 그룹 상세로 리다이렉트
- **그룹 정보 수정**: 이름, 설명, 벌금, 정산 주기/요일 편집
- **초대 코드 표시**: 초대 코드 확인 및 클립보드 복사
- **그룹 루틴 관리**: 루틴 추가 (모달) / 삭제 기능
- **멤버 관리**: 멤버 목록 확인, 비관리자 멤버 강퇴 기능 (확인 모달)
- **그룹 삭제**: 위험 구역에 삭제 버튼, 그룹 이름 입력 확인 모달

#### 2. 그룹 상세 페이지 설정 아이콘
- 관리자(`myRole === 'admin'`)에게만 헤더에 ⚙️ 설정 아이콘 표시
- 기존 공유 아이콘 옆에 배치, `/group/[id]/settings`로 이동

#### 3. 그룹 삭제 기능
- 관리자만 삭제 가능 (서버 사이드 admin 재확인)
- 확인 모달: 그룹 이름을 정확히 입력해야 삭제 버튼 활성화
- DB `ON DELETE CASCADE` 설정으로 관련 데이터 자동 정리:
  - group_members, routines, verifications, messages 모두 삭제
- 삭제 후 `/group` 목록으로 리다이렉트

#### 4. 멤버 강퇴 기능
- 강퇴 시 해당 멤버의 `group_members` 레코드 삭제
- 강퇴 시 해당 멤버의 그룹 루틴(`routines.type='group'`)도 함께 삭제
- 관리자 자신과 다른 관리자는 강퇴 대상에서 제외

### 변경된 파일
1. `src/app/group/[id]/settings/page.tsx` - 신규 (그룹 설정 페이지)
2. `src/app/group/[id]/page.tsx` - 설정 아이콘 추가, Link import 추가

### 사용된 컴포넌트
- Header, Card, Button, Input, Modal, ErrorRetry, GroupDetailSkeleton
- 기존 디자인 시스템과 일관된 UI/UX

### 빌드 결과
- TypeScript 에러: 0
- 빌드 성공

---

## [Critical Fix - Auth Lock Conflict] - 2026-03-08

### 진단 결과
- **증상**: 콘솔 에러:
  - `@supabase/gotrue-js: Lock 'lock:sb-mpwvcjxpsxgzdvifqbgi-auth-token' was not released within 5000ms. Forcefully acquiring the lock to recover.`
  - `AbortError: Lock broken by another request with the 'steal' option.`
- **직접 쿼리 테스트**: DATA: 2건 정상 반환, ERROR: null → DB 연결 자체는 정상
- **원인**: AuthProvider + 각 페이지(7곳)가 동시에 `getSession()`을 호출 → Auth Lock 충돌 → Lock이 5초 안에 해제되지 않아 강제 steal → 진행 중인 쿼리가 Abort됨

### 수정 내용

#### 1. Auth 호출을 AuthProvider 한 곳으로 집중
- **핵심 원칙**: `getSession()`은 AuthProvider에서만 딱 1번 호출
- 각 페이지에서 `getSession()`, `getUser()` 직접 호출 전부 제거
- 대신 `useAuth()` 훅으로 AuthProvider의 상태(user, loading, profile)를 가져다 사용

**변경 패턴:**
```ts
// 변경 전 (각 페이지에서 직접 호출 → Lock 충돌)
const { data: { session } } = await supabase.auth.getSession()
const user = session?.user ?? null

// 변경 후 (AuthProvider에서 제공하는 상태 사용)
const { user, loading: authLoading } = useAuth()
```

**변경된 파일 (7개 페이지):**
1. `src/app/page.tsx` - 홈 페이지 (Page 컴포넌트에서 useAuth로 교체)
2. `src/app/routine/page.tsx` - 루틴 목록
3. `src/app/routine/[id]/page.tsx` - 루틴 상세
4. `src/app/verify/page.tsx` - 인증 페이지 (ErrorRetry 내 getSession도 제거)
5. `src/app/dashboard/page.tsx` - 대시보드 (ErrorRetry 내 getSession도 제거)
6. `src/app/group/page.tsx` - 그룹 목록
7. `src/app/group/[id]/page.tsx` - 그룹 상세

#### 2. 각 페이지 데이터 로드 패턴
```ts
const { user, loading: authLoading } = useAuth()

useEffect(() => {
  if (authLoading) return  // Auth 로딩 중이면 대기
  if (!user) {
    setLoading(false)
    return
  }
  loadData(user.id)
}, [user, authLoading])
```

#### 3. Supabase 클라이언트 Auth 설정 추가
`src/lib/supabase/client.ts`에 auth 옵션 추가:
```ts
const supabase = supabaseCreateClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'dalli-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})
```

#### 4. userId 상태 제거
- 각 페이지의 `const [userId, setUserId] = useState(null)` 전부 제거
- `user?.id` (useAuth 훅에서 제공)로 대체
- ErrorRetry 핸들러도 `user?.id` 사용

### 핵심 변경 원칙
1. **getSession()은 AuthProvider에서만 딱 1번 호출**
2. **각 페이지에서 getSession(), getUser() 직접 호출 절대 금지**
3. **useAuth() 훅으로만 인증 정보 접근**
4. **.single(), .maybeSingle() 사용 금지** (기존 원칙 유지)

### 빌드 결과
- TypeScript 에러: 0
- 빌드 성공

---

## [Critical Fix - Profile Query Hang] - 2026-03-07

### 진단 결과
- **증상**: 콘솔에 `[Dalli] 프로필 쿼리 실행 직전: userId` 까지만 출력, 이후 응답 로그 없음 → Promise가 영원히 resolve되지 않음
- **환경**: localhost + Vercel 배포 모두 동일 증상. DB는 정상 (SQL Editor로 SELECT 성공, RLS 비활성)
- **원인**:
  1. `@supabase/ssr`의 `createBrowserClient`가 cookie 기반 세션 처리 시 내부적으로 Promise를 올바르게 resolve하지 못하는 경우 발생
  2. `.maybeSingle()` 체이닝이 특정 조건에서 Promise를 hang시킴
  3. `middleware.ts`에서 매 요청마다 `getUser()` 호출 → Supabase 서버 요청이 다른 쿼리를 방해

### 수정 내용

#### 1. Supabase 클라이언트 완전 재작성
- **변경 전**: `@supabase/ssr`의 `createBrowserClient` 사용
- **변경 후**: `@supabase/supabase-js`의 `createClient` 직접 사용
- 싱글톤 패턴: 모듈 레벨에서 1회 생성, `createClient()` 함수는 동일 인스턴스 반환
- 초기화 시 URL/Key 미리보기 로그 출력

```ts
// src/lib/supabase/client.ts
import { createClient as supabaseCreateClient } from '@supabase/supabase-js'
const supabase = supabaseCreateClient(supabaseUrl, supabaseAnonKey)
export function createClient() { return supabase }
```

#### 2. AuthProvider 프로필 로드 재작성
- `.single()` / `.maybeSingle()` 완전 제거
- `.select('*')` + `response.data?.[0]` 패턴으로 통일
- RAW 응답 로깅: data, error, status, count 모두 출력
- **핵심**: 프로필 로드 실패 시 기본 프로필 설정 → 앱 절대 멈추지 않음
  - error 발생 → `{ id: userId, nickname: email.split('@')[0] }` 기본 프로필
  - catch 예외 → 동일 기본 프로필
  - 프로필 미존재 → 새로 생성 시도, 실패해도 기본 프로필

#### 3. `.maybeSingle()` 프로젝트 전체 제거
**`.select()` + `data?.[0]` 패턴으로 교체된 파일:**
1. `src/components/AuthProvider.tsx` - 프로필 조회 (select + insert)
2. `src/app/routine/[id]/page.tsx` - 루틴 상세 조회
3. `src/app/group/page.tsx` - 초대코드 그룹 조회 + 기존 멤버 확인
4. `src/app/group/[id]/page.tsx` - 그룹 조회 + 실시간 메시지 fetch
5. `src/app/group/new/page.tsx` - 그룹 생성 (insert+select, 2곳)
6. `src/app/group/invite/[code]/page.tsx` - 초대링크 그룹 조회 + 멤버 확인
7. `src/app/dashboard/page.tsx` - 그룹 이름 조회

**교체 패턴:**
```ts
// 변경 전
const { data } = await supabase.from('table').select('*').eq('id', id).maybeSingle()

// 변경 후
const { data: rows } = await supabase.from('table').select('*').eq('id', id)
const data = rows?.[0] || null
```

#### 4. Middleware Supabase 로직 완전 제거
- 기존: `createServerClient` + `getUser()` → 매 요청마다 Supabase 서버 호출
- 수정: 모든 supabase 임포트/로직 제거, `NextResponse.next()` 만 반환
- matcher: 빈 배열 (미들웨어 실행 안 함)
- 라우트 보호는 각 페이지에서 `getSession()`으로 처리

### 빌드 결과
- 14개 라우트 정상
- TypeScript 에러: 0
- `.single()` 잔존: 0건
- `.maybeSingle()` 잔존: 0건
- 빌드 성공

### 쿼리 안전성 비교
| 방식 | 0건 결과 | Promise Hang 위험 | 추천 |
|---|---|---|---|
| `.single()` | PGRST116 에러 | 있음 | ❌ |
| `.maybeSingle()` | null 반환 | 간헐적 있음 | ❌ |
| `.select()` + `data[0]` | 빈 배열 → null | 없음 | ✅ |

### 핵심 변경 원칙
1. **Supabase 클라이언트 1개만 유지** → `@supabase/supabase-js` 직접 사용, SSR 패키지 제거
2. **`.single()` / `.maybeSingle()` 전면 금지** → `.select()` + `data[0]` 패턴만 사용
3. **Middleware에서 Supabase 제거** → 서버 호출 차단, 클라이언트 세션으로 보호
4. **프로필 실패 ≠ 앱 멈춤** → 기본 프로필로 항상 동작 보장

---

## [Debug Fix - single() issue] - 2026-03-07

### 진단 결과
- **증상**: 콘솔에 `[Dalli] 프로필 로드 시작: 1fe832e3...` 까지만 출력, 이후 완료/에러 로그 없음
- **원인**: `.single()`은 결과가 정확히 1건이 아닐 때 에러를 throw/반환
  - 에러가 제대로 catch되지 않으면 이후 코드가 실행되지 않아 무한 대기
  - AuthProvider의 fetchProfile에서 `.single()` 응답 후 코드 실행이 멈춤
  - 프로젝트 전체 12곳에서 `.single()` 사용 → 어디서든 같은 문제 발생 가능

### 수정 내용

#### 1. `.single()` → `.maybeSingle()` 전체 교체 (12곳)
- `.single()`: 0건이면 PGRST116 에러, 2건 이상이면 에러 throw → 코드 멈춤 위험
- `.maybeSingle()`: 0건이면 `null` 반환, 2건 이상이면 에러 → 안전한 처리

**교체 파일 목록:**
1. `src/components/AuthProvider.tsx` - 프로필 조회 (2곳: select + insert)
2. `src/app/routine/[id]/page.tsx` - 루틴 상세 조회
3. `src/app/group/page.tsx` - 초대코드 그룹 조회 + 기존 멤버 확인
4. `src/app/group/[id]/page.tsx` - 그룹 조회 + 실시간 메시지 fetch
5. `src/app/group/new/page.tsx` - 그룹 생성 (insert+select, 2곳)
6. `src/app/group/invite/[code]/page.tsx` - 초대링크 그룹 조회 + 멤버 확인
7. `src/app/dashboard/page.tsx` - 그룹 이름 조회

#### 2. AuthProvider 프로필 로드 상세 로그 추가
```ts
// 쿼리 직전 로그
console.log('[Dalli] 프로필 쿼리 실행 직전:', userId)
// 응답 로그 (data, error, status 모두 출력)
console.log('[Dalli] 프로필 쿼리 응답:', { data, error, status })
// 에러 상세
console.error('[Dalli] 프로필 쿼리 에러:', error.message, error.code)
// 프로필 미존재 시 생성
console.log('[Dalli] 프로필 없음 → 새로 생성 시도')
// 생성 결과
console.log('[Dalli] 프로필 생성 결과:', { newProfile, insertError })
```

#### 3. group/invite/[code] try-catch 추가
- 기존: try-catch 없이 직접 쿼리 → 에러 시 로딩 무한
- 수정: try-catch-finally 추가, finally에서 setLoading(false) 보장

### 빌드 결과
- 14개 라우트 정상
- TypeScript 에러: 0
- `.single()` 잔존: 0건 (전체 제거 확인)
- 빌드 성공

### .single() vs .maybeSingle() 비교
| | .single() | .maybeSingle() |
|---|---|---|
| 0건 | PGRST116 에러 반환 | `null` 반환 (에러 없음) |
| 1건 | 데이터 반환 | 데이터 반환 |
| 2건+ | 에러 throw | 에러 반환 |
| 안전성 | 낮음 (에러 처리 필수) | 높음 (null 체크만 필요) |

---

## [Critical Fix - getUser to getSession] - 2026-03-07

### 진단 결과
- **증상**: 콘솔에 `auth.getUser() 시작` 로그만 찍히고 응답 로그 없음 → 무한 대기
- **원인**: `supabase.auth.getUser()`는 매 호출마다 Supabase 서버에 네트워크 요청을 보냄
  - Supabase 무료 티어 Cold Start 또는 네트워크 지연 시 응답 못 받아 앱 전체가 멈춤
  - 모든 페이지에서 독립적으로 getUser()를 호출하므로 페이지 전환마다 반복 발생

### 수정 내용

#### 1. getUser() → getSession() 전체 교체
- `getUser()`: 매번 Supabase 서버에 HTTP 요청 (느림, 타임아웃 위험)
- `getSession()`: 로컬 캐시된 JWT 세션 확인 (즉시 응답, 네트워크 불필요)

**교체 패턴:**
```ts
// 변경 전
const { data: { user } } = await supabase.auth.getUser()
// 변경 후
const { data: { session } } = await supabase.auth.getSession()
const user = session?.user ?? null
```

**교체된 파일 (8개):**
1. `src/components/AuthProvider.tsx` - 초기화 시 getSession 사용
2. `src/app/page.tsx` - 홈 페이지 인증 확인
3. `src/app/routine/page.tsx` - 루틴 목록
4. `src/app/routine/[id]/page.tsx` - 루틴 상세
5. `src/app/verify/page.tsx` - 인증 페이지 (2곳: 초기화 + ErrorRetry)
6. `src/app/dashboard/page.tsx` - 대시보드 (2곳: 초기화 + ErrorRetry)
7. `src/app/group/page.tsx` - 그룹 목록
8. `src/app/group/[id]/page.tsx` - 그룹 상세

**유지된 파일 (1개):**
- `src/lib/supabase/middleware.ts` - 서버사이드 미들웨어는 getUser() 유지 (Supabase 공식 권장)

#### 2. AuthProvider 단순화
- getUser() → getSession()으로 교체
- onAuthStateChange 리스너 유지 (로그인/로그아웃 감지)
- 타임아웃 로직 불필요 (getSession은 즉시 응답)

#### 3. 디버그 로그 유지
- 각 페이지 `console.log('[Dalli] [PageName] getSession 시작/완료')` 패턴 유지
- 쿼리 시작/완료/에러 로그 전부 유지

#### 4. manifest.json 404 에러 수정
- `public/manifest.json` 신규 생성
- PWA 기본 설정: name, short_name, display: standalone, theme_color 등

### 빌드 결과
- 14개 라우트 정상
- TypeScript 에러: 0
- 빌드 성공

### 핵심 차이: getUser vs getSession
| | getUser() | getSession() |
|---|---|---|
| 동작 | Supabase 서버에 HTTP 요청 | 로컬 JWT 토큰 확인 |
| 속도 | 네트워크 의존 (100ms~수초) | 즉시 (~0ms) |
| Cold Start 영향 | 받음 (타임아웃 위험) | 없음 |
| 용도 | 서버사이드 인증 검증 | 클라이언트 세션 확인 |

---

## [Performance Fix + Beta 1.0.4] - 2026-03-07

### 근본 원인 분석
- **증상**: 앱 로딩 시 무한 로딩. HAR 네트워크 분석 결과 localhost 응답은 ~150ms로 정상이나 **Supabase 요청이 0건**
- **원인 1**: AuthProvider의 SplashScreen이 모든 children 렌더링을 차단 → 페이지의 useEffect가 실행되지 않아 Supabase 쿼리 자체가 발생하지 않음
- **원인 2**: fetchWithRetry의 Promise.race가 타임아웃과 실제 쿼리를 경쟁시켜 쿼리 시작 전에 타임아웃 발생 가능
- **원인 3**: useEffect 의존성 이슈로 쿼리 타이밍 누락

### Part A: Supabase 연결 아키텍처 전면 개편

#### A-1: AuthProvider 비블로킹 재설계
- SplashScreen 제거 → **항상 children 렌더링** (비블로킹)
- Pre-warming ping 제거 (PromiseLike 타입 이슈 및 불필요)
- Auth 상태: `'loading' | 'authenticated' | 'unauthenticated'`
- AuthProvider는 인증 상태 표시/관리용으로만 사용 (데이터 페칭 차단 안 함)
- onAuthStateChange 리스너 유지 (로그인/로그아웃 감지)

#### A-2: fetchWithRetry 완전 제거
- `src/lib/fetch.ts`: fetchWithRetry, TIMEOUT, RETRY_DELAY, MAX_RETRIES 모두 삭제
- `export const isDevMode` 만 남김
- Promise.race 패턴 완전 제거

#### A-3: Supabase 클라이언트 단순화
- 기존 createBrowserClient 유지 (이미 단순한 구조)
- 복잡한 래퍼/팩토리 없음

#### A-4: 전 페이지 데이터 Fetch 통일
- **모든 데이터 페이지가 독립적으로** `supabase.auth.getUser()` 호출
- AuthProvider에 의존하지 않고 각 페이지 useEffect에서 직접 인증 확인
- 직접 `await supabase.from().select()` 호출 (래퍼 없음)
- 각 쿼리마다 `console.log('[Dalli] [PageName] 쿼리시작/완료')` 디버그 로그
- 10초 타임아웃 + ErrorRetry 컴포넌트로 에러 복구

**수정된 데이터 페이지 (7개):**
1. `src/app/page.tsx` - 독립 getUser + 루틴/인증 쿼리
2. `src/app/routine/page.tsx` - 독립 getUser + 루틴 목록 쿼리
3. `src/app/routine/[id]/page.tsx` - 독립 getUser + 루틴 상세/통계 쿼리
4. `src/app/verify/page.tsx` - 독립 getUser + 개인/그룹 루틴 쿼리
5. `src/app/dashboard/page.tsx` - 독립 getUser + 대시보드 통계 쿼리
6. `src/app/group/page.tsx` - 독립 getUser + 그룹 목록 쿼리
7. `src/app/group/[id]/page.tsx` - 독립 getUser + 그룹 상세/채팅 쿼리

**useAuth 유지 페이지 (호환됨):**
- `routine/new/page.tsx` - 제출 시 user.id 참조
- `group/new/page.tsx` - 제출 시 user.id 참조
- `profile/page.tsx` - user/profile 표시 및 수정

### Part B: Beta 1.0.4 피드백 보존
- 회원가입 자동 로그인 ✅
- 홈 화면 긍정적 문구 ✅
- 루틴 상세 페이지 ✅
- 인증 축하 스트릭 수정 ✅
- 그룹 탭명 "피드" ✅
- 대시보드 그룹 탭 강화 ✅
- 스켈레톤 UI 전 페이지 유지 ✅

### 빌드 결과
- 14개 라우트 정상
- TypeScript 에러: 0
- 빌드 성공

### 핵심 변경 원칙
1. **AuthProvider가 렌더링을 차단하지 않는다** → children 항상 렌더링
2. **모든 데이터 페이지가 독립적** → 각자 getUser() 호출
3. **직접 Supabase 호출** → fetchWithRetry/Promise.race 없음
4. **스키마 변경 없음** → schema_v3.sql 유지

---

## [Beta 1.0.4 Update] - 2026-03-07

### Part A: 타임아웃/Cold Start/스켈레톤 UI
- **AuthProvider 타임아웃**: 5초 → 15초로 변경 (Supabase 무료 서버 Cold Start 대응)
- **fetchWithRetry 타임아웃**: 5초 → 10초, 재시도 간격: 1초 → 2초
- **Cold Start 스플래시 화면**: Dalli 로고 + 단계별 메시지
  - 0~10초: "서버에 연결하고 있어요..." + 스피너
  - 10~20초: "서버가 깨어나고 있어요..." + 무료 서버 안내
  - 20초 이후: "연결이 지연되고 있어요" + 다시 시도 버튼
- **스켈레톤 UI**: 전 페이지에 스피너 대신 레이아웃 유지형 스켈레톤 적용
  - HomeSkeleton, RoutineListSkeleton, VerifySkeleton, DashboardSkeleton, GroupListSkeleton, GroupDetailSkeleton
- **Pre-warming ping**: 앱 로드 시 `profiles` 테이블에 가벼운 쿼리로 서버 깨움
- **전 페이지 로딩 타임아웃**: 5초 → 10초로 통일

### Part B: 회원가입 자동 로그인
- signUp 성공 후 `signInWithPassword()`로 자동 로그인 시도
- 이메일 확인 미필요 설정 시 즉시 홈으로 이동
- 회원가입 문구: "작심삼일을 끝내볼" → "함께 성장할 준비 되셨나요?"

### Part C: 홈 화면 문구 수정 (긍정적 톤)
- "안 하면 들킨다" → "함께하면 더 쉬워요"
- "사회적 압력으로 작심삼일을 끝내세요" → "서로 응원하며 꾸준히 성장하세요"
- "서로 견제" → "함께 인증하고 서로 동기부여"
- "벌금 정산 - 미달성 시 자동으로 벌금 대상 표시" → "미션 달성 현황 - 주간 달성률과 스트릭으로 성장 확인"
- 루틴 설정 설명: "금주" → "독서"

### Part D: 루틴 상세 페이지 (routine/[id]/page.tsx)
- 새 페이지 생성: `/routine/[id]`
- 루틴 기본 정보 (이름, 주기, 인증방식, 타입)
- 주간/월간 달성률 프로그레스 바
- 누적 통계 (총 인증, 스트릭, 주간 달성률)
- 그룹 루틴: 그룹 정보 링크 + 그룹 내 랭킹 표시
- 최근 인증 기록 (사진/메모 포함)
- 액션 버튼: "인증하기" → /verify, "설정 변경" → /routine
- 홈, 루틴 리스트, 대시보드에서 카드 클릭으로 진입 가능

### Part E: 인증 축하 스트릭 수정
- streak ≤ 1: "첫 인증 완료! 좋은 시작이에요!"
- streak > 1: "N일 연속 달성 중!"
- 조건부 렌더링 → 항상 표시 방식으로 변경

### Part F: 그룹 상세 탭명 변경
- "인증피드" → "피드"

### Part G: 대시보드 그룹 탭 강화
- 그룹별 요약 카드 추가: 그룹명, 내 순위, 멤버 수, 달성률
- 1위 멤버 표시
- 그룹 카드 클릭 → 그룹 상세 페이지 이동
- 기존 루틴별 달성률 유지

### 빌드 결과
- 14개 라우트 (신규: /routine/[id])
- TypeScript 에러: 0
- 빌드 성공

### 수정된 파일 목록
1. `src/lib/fetch.ts` - 타임아웃/재시도 간격 변경
2. `src/components/AuthProvider.tsx` - 15초 타임아웃, 스플래시 화면, pre-warming ping
3. `src/components/Skeleton.tsx` - 신규 생성 (6개 페이지별 스켈레톤)
4. `src/app/page.tsx` - 긍정적 문구, 스켈레톤 UI, 루틴 카드 링크
5. `src/app/signup/page.tsx` - 자동 로그인, 문구 수정
6. `src/app/verify/page.tsx` - 스트릭 표시 수정, 스켈레톤 UI, 타임아웃 10초
7. `src/app/routine/page.tsx` - 스켈레톤 UI, 타임아웃 10초, 카드 클릭 링크
8. `src/app/routine/[id]/page.tsx` - 신규 생성 (루틴 상세 페이지)
9. `src/app/dashboard/page.tsx` - 그룹 탭 강화, 스켈레톤 UI, 카드 클릭 링크
10. `src/app/group/page.tsx` - 스켈레톤 UI, 타임아웃 10초
11. `src/app/group/[id]/page.tsx` - 탭명 "피드", 스켈레톤 UI, 타임아웃 10초
12. `src/app/profile/page.tsx` - 버전 v1.0.4

### 자체 피드백
- Cold Start 문제는 Supabase 무료 티어의 근본적 한계. 스플래시 화면과 충분한 타임아웃으로 UX를 최대한 보완함
- 스켈레톤 UI로 레이아웃 이동 없이 자연스러운 로딩 경험 제공
- 루틴 상세 페이지 추가로 앱의 깊이감 확보. 인증 기록 확인과 그룹 내 경쟁 요소 강화
- 긍정적 톤 변경으로 사용자 친화적 메시지 전달
- PromiseLike 타입 이슈는 Supabase SDK 특성. async IIFE로 해결
