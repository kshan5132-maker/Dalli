'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Card from '@/components/Card'
import type { Routine, Profile } from '@/lib/types'
import ErrorRetry from '@/components/ErrorRetry'
import { DashboardSkeleton } from '@/components/Skeleton'
import { FREQUENCY_TARGETS, FREQUENCY_LABELS } from '@/lib/types'
import { getWeekRange, getMonthRange } from '@/lib/utils'

type RoutineStats = {
  routine: Routine
  weeklyDone: number
  weeklyTarget: number
  monthlyDone: number
  monthlyTarget: number
  streak: number
}

type GroupSummary = {
  groupId: string
  groupName: string
  myRate: number
  myRank: number
  totalMembers: number
  myWeeklyDone: number
  myWeeklyTarget: number
  topMember: { nickname: string; rate: number } | null
}

export default function DashboardPage() {
  const supabase = createClient()
  const [userId, setUserId] = useState<string | null>(null)
  const [stats, setStats] = useState<RoutineStats[]>([])
  const [weeklyData, setWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [groupSummaries, setGroupSummaries] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'personal' | 'group'>('personal')

  // Get user via getSession (로컬 캐시, 즉시 응답)
  useEffect(() => {
    const init = async () => {
      console.log('[Dalli] [Dashboard] getSession 시작')
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      const user = session?.user ?? null
      console.log('[Dalli] [Dashboard] getSession 완료', user?.id, authError?.message)

      if (authError || !user) {
        setLoading(false)
        setError('로그인이 필요합니다.')
        return
      }

      setUserId(user.id)
      await loadDashboard(user.id)
    }

    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setError('데이터를 불러오는데 시간이 너무 오래 걸립니다.')
    }, 10000)
    return () => clearTimeout(timer)
  }, [loading])

  const loadDashboard = async (uid: string) => {
    setError('')
    try {
      console.log('[Dalli] [Dashboard] Routines 쿼리 시작')
      const { data: routines, error: routineError } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', uid)
      console.log('[Dalli] [Dashboard] Routines 쿼리 완료', routines?.length)

      if (routineError) {
        setError(routineError.message)
        return
      }

      if (!routines || (routines as Routine[]).length === 0) {
        setLoading(false)
        return
      }

      const { start: weekStart, end: weekEnd } = getWeekRange()
      const { start: monthStart, end: monthEnd } = getMonthRange()

      console.log('[Dalli] [Dashboard] MonthlyVerifications 쿼리 시작')
      const { data: monthlyVerifications, error: monthlyError } = await supabase
        .from('verifications')
        .select('routine_id, verified_at')
        .eq('user_id', uid)
        .gte('verified_at', monthStart.toISOString())
        .lte('verified_at', monthEnd.toISOString())
      console.log('[Dalli] [Dashboard] MonthlyVerifications 쿼리 완료', monthlyVerifications?.length)

      if (monthlyError) {
        setError(monthlyError.message)
        return
      }

      const streakStart = new Date()
      streakStart.setDate(streakStart.getDate() - 365)
      console.log('[Dalli] [Dashboard] StreakVerifications 쿼리 시작')
      const { data: allVerifications, error: streakError } = await supabase
        .from('verifications')
        .select('routine_id, verified_at')
        .eq('user_id', uid)
        .gte('verified_at', streakStart.toISOString())
        .order('verified_at', { ascending: false })
      console.log('[Dalli] [Dashboard] StreakVerifications 쿼리 완료', allVerifications?.length)

      if (streakError) {
        setError(streakError.message)
        return
      }

      const dailyCounts = [0, 0, 0, 0, 0, 0, 0]
      const monthlyV = (monthlyVerifications || []) as { routine_id: string; verified_at: string }[]
      const weeklyVerifs = monthlyV.filter((v) => {
        const d = new Date(v.verified_at)
        return d >= weekStart && d <= weekEnd
      })

      weeklyVerifs.forEach((v) => {
        const d = new Date(v.verified_at)
        const dayOfWeek = d.getDay()
        const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
        dailyCounts[idx]++
      })
      setWeeklyData(dailyCounts)

      const daysInMonth = monthEnd.getDate()
      const weeksInMonth = Math.ceil(daysInMonth / 7)
      const allV = (allVerifications || []) as { routine_id: string; verified_at: string }[]

      const routineStats: RoutineStats[] = (routines as Routine[]).map((routine) => {
        const weeklyTarget = FREQUENCY_TARGETS[routine.frequency]
        const weeklyDone = weeklyVerifs.filter((v) => v.routine_id === routine.id).length
        const monthlyDone = monthlyV.filter((v) => v.routine_id === routine.id).length
        const monthlyTarget = weeklyTarget * weeksInMonth

        let streak = 0
        const routineVerifs = allV.filter((v) => v.routine_id === routine.id).map((v) => new Date(v.verified_at).toDateString())
        const uniqueDays = [...new Set(routineVerifs)]
        const today = new Date()

        for (let i = 0; i < 365; i++) {
          const checkDate = new Date(today)
          checkDate.setDate(today.getDate() - i)
          if (uniqueDays.includes(checkDate.toDateString())) {
            streak++
          } else if (i > 0) {
            break
          }
        }

        return { routine, weeklyDone, weeklyTarget, monthlyDone, monthlyTarget, streak }
      })

      setStats(routineStats)

      // Group tab: group-level summary data
      const groupRoutines = (routines as Routine[]).filter(r => r.type === 'group')
      const uniqueGroupIds = [...new Set(groupRoutines.map(r => r.group_id).filter(Boolean))] as string[]

      if (uniqueGroupIds.length > 0) {
        const summaries: GroupSummary[] = []

        for (const groupId of uniqueGroupIds) {
          // Group info
          console.log('[Dalli] [Dashboard] Group 쿼리 시작', groupId)
          const { data: groupData } = await supabase.from('groups').select('name').eq('id', groupId).maybeSingle()
          console.log('[Dalli] [Dashboard] Group 쿼리 완료', groupId, groupData?.name)
          if (!groupData) continue

          // Group members
          console.log('[Dalli] [Dashboard] GroupMembers 쿼리 시작', groupId)
          const { data: members } = await supabase
            .from('group_members')
            .select('user_id, profiles(*)')
            .eq('group_id', groupId)
          console.log('[Dalli] [Dashboard] GroupMembers 쿼리 완료', groupId, members?.length)

          if (!members || members.length === 0) continue

          // Group routines
          console.log('[Dalli] [Dashboard] GroupRoutines 쿼리 시작', groupId)
          const { data: grRoutines } = await supabase
            .from('routines')
            .select('*')
            .eq('type', 'group')
            .eq('group_id', groupId)
          console.log('[Dalli] [Dashboard] GroupRoutines 쿼리 완료', groupId, grRoutines?.length)

          // Weekly verifications (whole group)
          console.log('[Dalli] [Dashboard] GroupVerifications 쿼리 시작', groupId)
          const { data: grVerifs } = await supabase
            .from('verifications')
            .select('user_id, routine_id')
            .eq('group_id', groupId)
            .gte('verified_at', weekStart.toISOString())
            .lte('verified_at', weekEnd.toISOString())
          console.log('[Dalli] [Dashboard] GroupVerifications 쿼리 완료', groupId, grVerifs?.length)

          // Per-member rate calculation
          const memberRates = members.map(m => {
            const memberRoutines = (grRoutines || []).filter(r => r.user_id === m.user_id)
            const memberTarget = memberRoutines.reduce((sum, r) => sum + (FREQUENCY_TARGETS[r.frequency as keyof typeof FREQUENCY_TARGETS] || 0), 0)
            const memberDone = (grVerifs || []).filter(v => v.user_id === m.user_id).length
            const rate = memberTarget > 0 ? Math.round((memberDone / memberTarget) * 100) : 0
            const profile = m.profiles as unknown as Profile
            return {
              userId: m.user_id,
              nickname: profile?.nickname || '알 수 없음',
              done: memberDone,
              target: memberTarget,
              rate,
            }
          })

          memberRates.sort((a, b) => b.rate - a.rate)
          const myData = memberRates.find(m => m.userId === uid)
          const myRank = memberRates.findIndex(m => m.userId === uid) + 1
          const topMember = memberRates.length > 0 && memberRates[0].userId !== uid
            ? { nickname: memberRates[0].nickname, rate: memberRates[0].rate }
            : memberRates.length > 1
              ? { nickname: memberRates[1].nickname, rate: memberRates[1].rate }
              : null

          summaries.push({
            groupId,
            groupName: groupData.name,
            myRate: myData?.rate || 0,
            myRank,
            totalMembers: members.length,
            myWeeklyDone: myData?.done || 0,
            myWeeklyTarget: myData?.target || 0,
            topMember,
          })
        }

        setGroupSummaries(summaries)
      }
    } catch (err) {
      console.error('[Dalli] [Dashboard] 데이터 로드 실패:', err)
      setError('대시보드 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const filteredStats = stats.filter((s) => s.routine.type === tab)
  const totalWeeklyDone = filteredStats.reduce((sum, s) => sum + s.weeklyDone, 0)
  const totalWeeklyTarget = filteredStats.reduce((sum, s) => sum + s.weeklyTarget, 0)
  const totalRate = totalWeeklyTarget > 0 ? Math.round((totalWeeklyDone / totalWeeklyTarget) * 100) : 0
  const maxStreak = filteredStats.length > 0 ? Math.max(...filteredStats.map((s) => s.streak)) : 0

  const dayLabels = ['월', '화', '수', '목', '금', '토', '일']
  const maxDailyCount = Math.max(...weeklyData, 1)

  if (loading) {
    return (
      <>
        <Header title="대시보드" />
        <DashboardSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header title="대시보드" />
        <ErrorRetry
          error={error}
          onRetry={() => {
            setError('')
            setLoading(true)
            if (userId) {
              loadDashboard(userId)
            } else {
              const init = async () => {
                const { data: { session } } = await supabase.auth.getSession()
                const user = session?.user ?? null
                if (user) {
                  setUserId(user.id)
                  await loadDashboard(user.id)
                } else {
                  setLoading(false)
                  setError('로그인이 필요합니다.')
                }
              }
              init()
            }
          }}
        />
      </>
    )
  }

  return (
    <>
      <Header title="대시보드" />

      <div className="px-4 pt-4 space-y-4">
        {/* Personal/Group tabs */}
        <div className="flex gap-1 bg-bg rounded-xl p-1">
          <button
            onClick={() => setTab('personal')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'personal' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
          >
            개인
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'group' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
          >
            그룹
          </button>
        </div>

        {/* Weekly summary */}
        <div className="grid grid-cols-3 gap-3">
          <Card className="text-center py-4">
            <p className="text-2xl font-extrabold text-primary">{totalRate}%</p>
            <p className="text-[10px] text-text-muted mt-1">이번 주 달성률</p>
          </Card>
          <Card className="text-center py-4">
            <p className="text-2xl font-extrabold text-secondary">{totalWeeklyDone}</p>
            <p className="text-[10px] text-text-muted mt-1">이번 주 인증</p>
          </Card>
          <Card className="text-center py-4">
            <p className="text-2xl font-extrabold text-warning">{maxStreak}</p>
            <p className="text-[10px] text-text-muted mt-1">최대 스트릭</p>
          </Card>
        </div>

        {/* Weekly chart */}
        <Card>
          <h3 className="text-sm font-bold mb-4">이번 주 인증 현황</h3>
          <div className="flex items-end justify-between gap-2 h-32">
            {weeklyData.map((count, idx) => {
              const height = (count / maxDailyCount) * 100
              const today = new Date()
              const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1
              const isToday = idx === todayIdx
              return (
                <div key={idx} className="flex-1 flex flex-col items-center gap-1">
                  <span className="text-[10px] font-semibold text-text-secondary">{count > 0 ? count : ''}</span>
                  <div className="w-full flex items-end h-20">
                    <div
                      className={`w-full rounded-t-md transition-all duration-500 ${isToday ? 'bg-primary' : count > 0 ? 'bg-primary/30' : 'bg-border/50'}`}
                      style={{ height: `${Math.max(height, 8)}%` }}
                    />
                  </div>
                  <span className={`text-[10px] font-medium ${isToday ? 'text-primary' : 'text-text-muted'}`}>{dayLabels[idx]}</span>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Group tab: group-level stats with rankings */}
        {tab === 'group' && groupSummaries.length > 0 && (
          <div>
            <h3 className="text-sm font-bold mb-3">그룹별 내 순위</h3>
            <div className="space-y-3">
              {groupSummaries.map((gs) => (
                <Link key={gs.groupId} href={`/group/${gs.groupId}`}>
                  <Card hover className="mb-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-gradient-to-br from-primary to-primary-dark rounded-lg flex items-center justify-center text-white text-xs font-bold">
                          {gs.groupName.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-bold">{gs.groupName}</p>
                          <p className="text-[10px] text-text-muted">{gs.totalMembers}명 참여</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className={`text-lg font-extrabold ${gs.myRank <= 1 ? 'text-warning' : gs.myRank <= 3 ? 'text-primary' : 'text-text-secondary'}`}>
                          {gs.myRank}위
                        </p>
                        <p className="text-[10px] text-text-muted">{gs.totalMembers}명 중</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-bg rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${gs.myRate >= 100 ? 'bg-success' : 'bg-primary'}`}
                          style={{ width: `${Math.min(gs.myRate, 100)}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-text-secondary shrink-0">
                        {gs.myRate}%
                      </span>
                    </div>
                    {gs.topMember && (
                      <p className="text-[10px] text-text-muted mt-2">
                        1위: {gs.topMember.nickname} ({gs.topMember.rate}%)
                      </p>
                    )}
                  </Card>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Per-routine progress bars */}
        <div>
          <h3 className="text-sm font-bold mb-3">{tab === 'personal' ? '개인' : '그룹'} 루틴별 달성률</h3>
          {filteredStats.length === 0 ? (
            <Card className="text-center py-6">
              <p className="text-sm text-text-muted">{tab === 'personal' ? '등록된 개인 루틴이 없어요' : '참여 중인 그룹 루틴이 없어요'}</p>
            </Card>
          ) : (
            <div className="space-y-3">
              {filteredStats.map((stat) => {
                const weeklyRate = stat.weeklyTarget > 0 ? Math.min(Math.round((stat.weeklyDone / stat.weeklyTarget) * 100), 100) : 0
                const monthlyRate = stat.monthlyTarget > 0 ? Math.min(Math.round((stat.monthlyDone / stat.monthlyTarget) * 100), 100) : 0
                return (
                  <Link key={stat.routine.id} href={`/routine/${stat.routine.id}`}>
                    <Card hover>
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <h4 className="text-sm font-bold">{stat.routine.title}</h4>
                          <p className="text-xs text-text-muted">
                            {FREQUENCY_LABELS[stat.routine.frequency]}
                            {stat.streak > 0 && <span className="text-warning ml-2">{stat.streak}일 연속</span>}
                          </p>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-text-secondary">이번 주</span>
                            <span className="font-semibold">{stat.weeklyDone}/{stat.weeklyTarget} ({weeklyRate}%)</span>
                          </div>
                          <div className="h-2 bg-bg rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${weeklyRate >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${weeklyRate}%` }} />
                          </div>
                        </div>
                        <div>
                          <div className="flex items-center justify-between text-xs mb-1">
                            <span className="text-text-secondary">이번 달</span>
                            <span className="font-semibold">{stat.monthlyDone}/{stat.monthlyTarget} ({monthlyRate}%)</span>
                          </div>
                          <div className="h-2 bg-bg rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all duration-500 ${monthlyRate >= 100 ? 'bg-success' : 'bg-secondary'}`} style={{ width: `${monthlyRate}%` }} />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
