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

export type Verification = {
  id: string
  routine_id: string
  user_id: string
  group_id: string | null
  photo_url: string | null
  memo: string | null
  verified_at: string
  profiles?: Profile
  routines?: Routine
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
