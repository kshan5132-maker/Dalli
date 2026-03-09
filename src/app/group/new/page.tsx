'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Button from '@/components/Button'
import Input from '@/components/Input'
import { generateInviteCode } from '@/lib/utils'
import type { RoutineFrequency, VerificationType } from '@/lib/types'
import { FREQUENCY_LABELS, VERIFICATION_TYPE_LABELS } from '@/lib/types'

const frequencies: RoutineFrequency[] = ['daily', 'weekly_3', 'weekly_5', 'weekdays', 'weekends']
const verificationTypes: VerificationType[] = ['photo', 'check']

const PENALTY_PRESETS = ['5000', '10000', '20000']

const SETTLEMENT_DAYS = [
  { value: 'monday', label: '월' },
  { value: 'tuesday', label: '화' },
  { value: 'wednesday', label: '수' },
  { value: 'thursday', label: '목' },
  { value: 'friday', label: '금' },
  { value: 'saturday', label: '토' },
  { value: 'sunday', label: '일' },
] as const

interface RoutineEntry {
  id: string
  title: string
  frequency: RoutineFrequency
  verification_type: VerificationType
}

function createRoutineEntry(): RoutineEntry {
  return {
    id: crypto.randomUUID(),
    title: '',
    frequency: 'daily',
    verification_type: 'photo',
  }
}

export default function NewGroupPage() {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  // Group basic info
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [penaltyAmount, setPenaltyAmount] = useState('10000')

  // Settlement cycle
  const [settlementCycle, setSettlementCycle] = useState<'weekly' | 'monthly'>('weekly')
  const [settlementDay, setSettlementDay] = useState('monday')

  // Group routines
  const [routines, setRoutines] = useState<RoutineEntry[]>([])

  // UI state
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const addRoutine = () => {
    setRoutines((prev) => [...prev, createRoutineEntry()])
  }

  const removeRoutine = (id: string) => {
    setRoutines((prev) => prev.filter((r) => r.id !== id))
  }

  const updateRoutine = (id: string, field: keyof Omit<RoutineEntry, 'id'>, value: string) => {
    setRoutines((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim() || !user) return

    // Validate routine titles if any routines exist
    const hasEmptyRoutine = routines.some((r) => !r.title.trim())
    if (hasEmptyRoutine) {
      setError('루틴 이름을 모두 입력해주세요.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const inviteCode = generateInviteCode()
      const penalty = parseInt(penaltyAmount) || 10000

      const groupPayload = {
        name: name.trim(),
        description: description.trim() || null,
        invite_code: inviteCode,
        penalty_amount: penalty,
        settlement_cycle: settlementCycle,
        settlement_day: settlementDay,
        created_by: user.id,
      }

      let groupId: string

      // Insert group
      const { data: groupRows, error: insertError } = await supabase
        .from('groups')
        .insert(groupPayload)
        .select()
      const group = groupRows?.[0] || null

      if (insertError) {
        // Invite code collision retry
        if (insertError.message.includes('invite_code')) {
          const retryCode = generateInviteCode()
          const { data: retryRows, error: retryError } = await supabase
            .from('groups')
            .insert({ ...groupPayload, invite_code: retryCode })
            .select()
          const retryGroup = retryRows?.[0] || null

          if (retryError || !retryGroup) {
            setError('그룹 생성에 실패했습니다. 다시 시도해주세요.')
            setLoading(false)
            return
          }

          groupId = retryGroup.id
        } else {
          setError(insertError.message)
          setLoading(false)
          return
        }
      } else {
        groupId = group!.id
      }

      // Add creator as admin member
      const { error: memberError } = await supabase.from('group_members').insert({
        group_id: groupId,
        user_id: user.id,
        role: 'admin',
      })

      if (memberError) {
        setError('멤버 등록에 실패했습니다. 다시 시도해주세요.')
        setLoading(false)
        return
      }

      // Create group routines
      if (routines.length > 0) {
        const routineInserts = routines.map((r) => ({
          user_id: user.id,
          title: r.title.trim(),
          frequency: r.frequency,
          verification_type: r.verification_type,
          type: 'group' as const,
          group_id: groupId,
        }))

        const { error: routineError } = await supabase
          .from('routines')
          .insert(routineInserts)

        if (routineError) {
          setError('루틴 생성에 실패했습니다. 그룹은 생성되었으니 나중에 루틴을 추가해주세요.')
          setLoading(false)
          router.push(`/group/${groupId}`)
          return
        }
      }

      router.push(`/group/${groupId}`)
    } catch {
      setError('예기치 않은 오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  return (
    <>
      <Header title="그룹 만들기" showBack />

      <div className="px-4 pt-6 pb-10">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Group Name */}
          <Input
            label="그룹 이름"
            placeholder="예: 새벽 운동 크루, 다이어트 파이터즈"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            maxLength={30}
          />

          {/* Group Description */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              그룹 설명 <span className="text-text-muted">(선택)</span>
            </label>
            <textarea
              className="w-full px-4 py-2.5 text-sm bg-bg border border-border rounded-xl outline-none focus:border-primary transition-colors placeholder:text-text-muted resize-none"
              rows={3}
              placeholder="그룹의 규칙이나 목표를 적어주세요"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              maxLength={200}
            />
          </div>

          {/* Penalty Amount */}
          <div>
            <label className="block text-sm font-medium text-text mb-1.5">
              미달성 벌금 (원)
            </label>
            <div className="grid grid-cols-3 gap-2 mb-2">
              {PENALTY_PRESETS.map((amount) => (
                <button
                  key={amount}
                  type="button"
                  onClick={() => setPenaltyAmount(amount)}
                  className={`py-2 rounded-xl text-sm font-medium transition-all ${
                    penaltyAmount === amount
                      ? 'bg-warning text-white'
                      : 'bg-bg text-text-secondary border border-border'
                  }`}
                >
                  {parseInt(amount).toLocaleString()}원
                </button>
              ))}
            </div>
            <Input
              type="number"
              placeholder="직접 입력"
              value={penaltyAmount}
              onChange={(e) => setPenaltyAmount(e.target.value)}
              helperText="미달성 시 정산 기준 금액입니다"
            />
          </div>

          {/* Settlement Cycle */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              정산 주기
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSettlementCycle('weekly')}
                className={`py-3 rounded-xl text-sm font-medium transition-all ${
                  settlementCycle === 'weekly'
                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                    : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                }`}
              >
                주간
              </button>
              <button
                type="button"
                onClick={() => setSettlementCycle('monthly')}
                className={`py-3 rounded-xl text-sm font-medium transition-all ${
                  settlementCycle === 'monthly'
                    ? 'bg-primary text-white shadow-sm shadow-primary/20'
                    : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                }`}
              >
                월간
              </button>
            </div>
          </div>

          {/* Settlement Day (weekly only) */}
          {settlementCycle === 'weekly' && (
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                정산 시작 요일
              </label>
              <div className="grid grid-cols-7 gap-1.5">
                {SETTLEMENT_DAYS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => setSettlementDay(day.value)}
                    className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                      settlementDay === day.value
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Divider */}
          <div className="border-t border-border" />

          {/* Group Routines Section */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <label className="block text-sm font-medium text-text">
                그룹 루틴 추가
              </label>
              {routines.length > 0 && (
                <button
                  type="button"
                  onClick={() => setRoutines([])}
                  className="text-xs text-text-muted hover:text-text-secondary transition-colors"
                >
                  나중에 추가할게요
                </button>
              )}
            </div>

            {routines.length === 0 && (
              <p className="text-sm text-text-muted mb-3">
                그룹 멤버가 함께 수행할 루틴을 추가해보세요.
              </p>
            )}

            {/* Routine Entries */}
            <div className="space-y-4">
              {routines.map((routine, index) => (
                <div
                  key={routine.id}
                  className="p-4 bg-bg-card border border-border rounded-2xl space-y-3"
                >
                  {/* Routine Header */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-text">
                      루틴 {index + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeRoutine(routine.id)}
                      className="p-1 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 20 20"
                        fill="currentColor"
                        className="w-4 h-4"
                      >
                        <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
                      </svg>
                    </button>
                  </div>

                  {/* Routine Title */}
                  <Input
                    placeholder="루틴 이름을 입력하세요"
                    value={routine.title}
                    onChange={(e) => updateRoutine(routine.id, 'title', e.target.value)}
                    maxLength={30}
                  />

                  {/* Frequency Selector */}
                  <div>
                    <span className="block text-xs font-medium text-text-secondary mb-1.5">
                      인증 주기
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {frequencies.map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => updateRoutine(routine.id, 'frequency', f)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            routine.frequency === f
                              ? 'bg-primary text-white shadow-sm shadow-primary/20'
                              : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                          }`}
                        >
                          {FREQUENCY_LABELS[f]}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Verification Type Selector */}
                  <div>
                    <span className="block text-xs font-medium text-text-secondary mb-1.5">
                      인증 방식
                    </span>
                    <div className="flex gap-1.5">
                      {verificationTypes.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => updateRoutine(routine.id, 'verification_type', v)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            routine.verification_type === v
                              ? 'bg-primary text-white shadow-sm shadow-primary/20'
                              : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                          }`}
                        >
                          {v === 'photo' ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-3.5 h-3.5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z"
                                clipRule="evenodd"
                              />
                            </svg>
                          ) : (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-3.5 h-3.5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                          {VERIFICATION_TYPE_LABELS[v]}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Routine Button */}
            <button
              type="button"
              onClick={addRoutine}
              className="mt-3 w-full py-3 border-2 border-dashed border-border rounded-2xl text-sm font-medium text-text-secondary hover:border-primary/30 hover:text-primary transition-all flex items-center justify-center gap-1.5"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                className="w-4 h-4"
              >
                <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
              </svg>
              루틴 추가하기
            </button>

            {/* Skip Option (shown only when no routines) */}
            {routines.length === 0 && (
              <p className="mt-2 text-center text-xs text-text-muted">
                나중에 추가할게요
              </p>
            )}
          </div>

          {/* Error Display */}
          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          {/* Submit */}
          <Button type="submit" fullWidth size="lg" loading={loading}>
            그룹 생성하기
          </Button>
        </form>
      </div>
    </>
  )
}
