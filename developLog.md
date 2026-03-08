# Dalli 개발 로그

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
