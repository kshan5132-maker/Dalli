export type Profile = {
  id: string
  nickname: string | null
  avatar_url: string | null
  created_at: string
}

export type RoutineFrequency = 'daily' | 'weekly_3' | 'weekly_5' | 'weekdays' | 'weekends'
export type VerificationType = 'photo' | 'check'
export type RoutineType = 'personal' | 'group'

export type Routine = {
  id: string
  user_id: string
  title: string
  frequency: RoutineFrequency
  verification_type: VerificationType
  type: RoutineType
  group_id: string | null
  created_at: string
}

export type Group = {
  id: string
  name: string
  description: string | null
  avatar_url: string | null
  invite_code: string
  penalty_amount: number
  settlement_cycle: 'weekly' | 'monthly'
  settlement_day: string
  created_by: string
  created_at: string
}

export type MemberRole = 'admin' | 'member'

export type GroupMember = {
  group_id: string
  user_id: string
  role: MemberRole
  joined_at: string
  profiles?: Profile
}

export type ExerciseEntry = {
  type: string
  amount: string
}

export type Verification = {
  id: string
  routine_id: string
  user_id: string
  group_id: string | null
  photo_url: string | null
  memo: string | null
  exercise_type: string | null
  exercise_amount: string | null
  exercises: ExerciseEntry[] | null
  verified_at: string
  profiles?: Profile
  routines?: Routine
}

/** exercises 배열 우선, 없으면 exercise_type/exercise_amount 폴백 */
export function getExerciseList(v: Pick<Verification, 'exercises' | 'exercise_type' | 'exercise_amount'>): ExerciseEntry[] {
  if (v.exercises && v.exercises.length > 0) return v.exercises
  if (v.exercise_type) return [{ type: v.exercise_type, amount: v.exercise_amount || '' }]
  return []
}

export type VerificationReaction = {
  id: string
  verification_id: string
  user_id: string
  type: 'like' | 'dislike'
  created_at: string
}

export type Message = {
  id: string
  group_id: string
  user_id: string
  content: string
  created_at: string
  profiles?: Profile
}

export const FREQUENCY_LABELS: Record<RoutineFrequency, string> = {
  daily: '매일',
  weekly_3: '주 3회',
  weekly_5: '주 5회',
  weekdays: '평일',
  weekends: '주말',
}

export const FREQUENCY_TARGETS: Record<RoutineFrequency, number> = {
  daily: 7,
  weekly_3: 3,
  weekly_5: 5,
  weekdays: 5,
  weekends: 2,
}

export const VERIFICATION_TYPE_LABELS: Record<VerificationType, string> = {
  photo: '사진 인증',
  check: '체크 인증',
}

export const EXERCISE_TYPES = [
  { value: '', label: '선택 안 함' },
  { value: 'weight', label: '웨이트' },
  { value: 'running', label: '런닝' },
  { value: 'swimming', label: '수영' },
  { value: 'cycling', label: '자전거' },
  { value: 'hiking', label: '등산' },
  { value: 'yoga', label: '요가' },
  { value: 'etc', label: '기타' },
] as const

export const EXERCISE_TYPE_LABELS: Record<string, string> = {
  weight: '웨이트',
  running: '런닝',
  swimming: '수영',
  cycling: '자전거',
  hiking: '등산',
  yoga: '요가',
  etc: '기타',
}
