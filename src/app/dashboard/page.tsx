'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Card from '@/components/Card'
import type { Routine, Profile } from '@/lib/types'
import ErrorRetry from '@/components/ErrorRetry'
import Modal from '@/components/Modal'
import Button from '@/components/Button'
import { DashboardSkeleton } from '@/components/Skeleton'
import { FREQUENCY_TARGETS, FREQUENCY_LABELS, EXERCISE_TYPE_LABELS } from '@/lib/types'
import { getWeekRange, getMonthRange } from '@/lib/utils'
import { isDevMode } from '@/lib/fetch'

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
  allMembers?: { userId: string; nickname: string; done: number; target: number; rate: number }[]
}

type MileageVerif = {
  id: string
  exercise_type: string | null
  exercise_amount: string | null
  memo: string | null
  photo_url: string | null
  verified_at: string
  routines: { title: string } | null
}

const EXERCISE_ICONS: Record<string, string> = {
  weight: '\uD83C\uDFCB\uFE0F',
  running: '\uD83C\uDFC3',
  swimming: '\uD83C\uDFCA',
  cycling: '\uD83D\uDEB4',
  hiking: '\uD83E\uDD7E',
  yoga: '\uD83E\uDDD8',
  etc: '\uD83D\uDCAA',
}

export default function DashboardPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()
  const [stats, setStats] = useState<RoutineStats[]>([])
  const [personalWeeklyData, setPersonalWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [groupWeeklyData, setGroupWeeklyData] = useState<number[]>([0, 0, 0, 0, 0, 0, 0])
  const [groupSummaries, setGroupSummaries] = useState<GroupSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'personal' | 'group' | 'mileage'>('personal')
  // 그룹 순위 팝업
  const [rankPopup, setRankPopup] = useState<GroupSummary | null>(null)
  const [rankMembers, setRankMembers] = useState<{ nickname: string; rate: number; userId: string; done: number; target: number }[]>([])

  // 마일리지 탭 상태
  const [calendarMonth, setCalendarMonth] = useState(() => new Date())
  const [selectedDate, setSelectedDate] = useState(() => {
    const now = new Date()
    return new Date(now.getFullYear(), now.getMonth(), now.getDate())
  })
  const [mileageVerifs, setMileageVerifs] = useState<MileageVerif[]>([])
  const [mileageLoading, setMileageLoading] = useState(false)
  const prevMileageKey = useRef('')

  // useAuth()에서 인증 정보 가져오기
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadDashboard(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading])

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setError('데이터를 불러오는데 시간이 너무 오래 걸립니다.')
    }, 10000)
    return () => clearTimeout(timer)
  }, [loading])

  // 마일리지 데이터 로드
  useEffect(() => {
    if (tab !== 'mileage' || !user) return
    const key = `${calendarMonth.getFullYear()}-${calendarMonth.getMonth()}`
    if (prevMileageKey.current === key) return
    prevMileageKey.current = key
    loadMileageData(user.id, calendarMonth.getFullYear(), calendarMonth.getMonth())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, calendarMonth, user?.id])

  const loadDashboard = async (uid: string) => {
    setError('')
    try {
      // 1. 개인 루틴
      console.log('[Dalli] [Dashboard] PersonalRoutines 쿼리 시작')
      const { data: personalData, error: personalError } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', uid)
        .eq('type', 'personal')
      console.log('[Dalli] [Dashboard] PersonalRoutines 쿼리 완료', personalData?.length)

      if (personalError) {
        setError(personalError.message)
        return
      }

      // 2. 내가 속한 그룹의 그룹 루틴
      const { data: memberData } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', uid)

      let groupRoutineData: Routine[] = []
      if (memberData && memberData.length > 0) {
        const groupIds = memberData.map((m) => m.group_id)
        const { data: grData } = await supabase
          .from('routines')
          .select('*')
          .eq('type', 'group')
          .in('group_id', groupIds)
        groupRoutineData = (grData || []) as Routine[]
      }
      console.log('[Dalli] [Dashboard] GroupRoutines 쿼리 완료', groupRoutineData.length)

      const routines = [...(personalData || []) as Routine[], ...groupRoutineData]

      if (routines.length === 0) {
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

      // 개인/그룹 루틴 ID 세트 생성
      const personalRoutineIds = new Set(routines.filter(r => (r as Routine).type === 'personal').map(r => r.id))
      const groupRoutineIds = new Set(routines.filter(r => (r as Routine).type === 'group').map(r => r.id))

      const personalDailyCounts = [0, 0, 0, 0, 0, 0, 0]
      const groupDailyCounts = [0, 0, 0, 0, 0, 0, 0]
      const monthlyV = (monthlyVerifications || []) as { routine_id: string; verified_at: string }[]
      const weeklyVerifs = monthlyV.filter((v) => {
        const d = new Date(v.verified_at)
        return d >= weekStart && d <= weekEnd
      })

      // 같은 날 같은 루틴 중복 카운트 방지 (DEV_MODE 제외)
      if (isDevMode) {
        weeklyVerifs.forEach((v) => {
          const d = new Date(v.verified_at)
          const dayOfWeek = d.getDay()
          const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          if (personalRoutineIds.has(v.routine_id)) personalDailyCounts[idx]++
          if (groupRoutineIds.has(v.routine_id)) groupDailyCounts[idx]++
        })
      } else {
        const seen = new Set<string>()
        weeklyVerifs.forEach((v) => {
          const dayKey = new Date(v.verified_at).toDateString()
          const uniqueKey = `${v.routine_id}_${dayKey}`
          if (seen.has(uniqueKey)) return
          seen.add(uniqueKey)
          const d = new Date(v.verified_at)
          const dayOfWeek = d.getDay()
          const idx = dayOfWeek === 0 ? 6 : dayOfWeek - 1
          if (personalRoutineIds.has(v.routine_id)) personalDailyCounts[idx]++
          if (groupRoutineIds.has(v.routine_id)) groupDailyCounts[idx]++
        })
      }
      setPersonalWeeklyData(personalDailyCounts)
      setGroupWeeklyData(groupDailyCounts)

      const daysInMonth = monthEnd.getDate()
      const weeksInMonth = Math.ceil(daysInMonth / 7)
      const allV = (allVerifications || []) as { routine_id: string; verified_at: string }[]

      const routineStats: RoutineStats[] = (routines as Routine[]).map((routine) => {
        const weeklyTarget = FREQUENCY_TARGETS[routine.frequency]
        // 같은 날 같은 루틴 → 1회만 카운트
        let weeklyDone: number
        let monthlyDone: number
        if (isDevMode) {
          weeklyDone = weeklyVerifs.filter((v) => v.routine_id === routine.id).length
          monthlyDone = monthlyV.filter((v) => v.routine_id === routine.id).length
        } else {
          const weeklyDays = new Set(weeklyVerifs.filter(v => v.routine_id === routine.id).map(v => new Date(v.verified_at).toDateString()))
          weeklyDone = weeklyDays.size
          const monthlyDays = new Set(monthlyV.filter(v => v.routine_id === routine.id).map(v => new Date(v.verified_at).toDateString()))
          monthlyDone = monthlyDays.size
        }
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
          const { data: groupRows } = await supabase.from('groups').select('name').eq('id', groupId)
          const groupData = groupRows?.[0] || null
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
            .select('user_id, routine_id, verified_at')
            .eq('group_id', groupId)
            .gte('verified_at', weekStart.toISOString())
            .lte('verified_at', weekEnd.toISOString())
          console.log('[Dalli] [Dashboard] GroupVerifications 쿼리 완료', groupId, grVerifs?.length)

          // Per-member rate calculation (그룹 루틴은 전체 멤버 공유 → 목표는 동일)
          const sharedTarget = (grRoutines || []).reduce((sum, r) => sum + (FREQUENCY_TARGETS[r.frequency as keyof typeof FREQUENCY_TARGETS] || 0), 0)
          const memberRates = members.map(m => {
            const memberVerifs = (grVerifs || []).filter(v => v.user_id === m.user_id)
            const uniqueDays = new Set(memberVerifs.map(v => new Date(v.verified_at).toDateString()))
            const memberDone = uniqueDays.size
            const rate = sharedTarget > 0 ? Math.round((memberDone / sharedTarget) * 100) : 0
            const profile = m.profiles as unknown as Profile
            return {
              userId: m.user_id,
              nickname: profile?.nickname || '알 수 없음',
              done: memberDone,
              target: sharedTarget,
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
            allMembers: memberRates,
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

  // === 마일리지 데이터 로드 ===
  const loadMileageData = async (uid: string, year: number, month: number) => {
    setMileageLoading(true)
    try {
      const start = new Date(year, month, 1)
      const end = new Date(year, month + 1, 0, 23, 59, 59, 999)

      const { data } = await supabase
        .from('verifications')
        .select('id, exercise_type, exercise_amount, memo, photo_url, verified_at, routines(title)')
        .eq('user_id', uid)
        .gte('verified_at', start.toISOString())
        .lte('verified_at', end.toISOString())
        .order('verified_at', { ascending: false })

      setMileageVerifs((data || []) as unknown as MileageVerif[])
    } catch (err) {
      console.error('[Dalli] [Mileage] 로드 실패:', err)
    } finally {
      setMileageLoading(false)
    }
  }

  // === 마일리지 헬퍼 ===
  const handleMonthChange = (delta: number) => {
    const newMonth = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + delta, 1)
    setCalendarMonth(newMonth)
    prevMileageKey.current = '' // 강제 리로드

    const now = new Date()
    if (newMonth.getFullYear() === now.getFullYear() && newMonth.getMonth() === now.getMonth()) {
      setSelectedDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))
    } else {
      setSelectedDate(new Date(newMonth.getFullYear(), newMonth.getMonth(), 1))
    }
  }

  const getSelectedWeekRange = () => {
    const d = new Date(selectedDate)
    const day = d.getDay()
    const mon = new Date(d)
    mon.setDate(d.getDate() - (day === 0 ? 6 : day - 1))
    mon.setHours(0, 0, 0, 0)
    const sun = new Date(mon)
    sun.setDate(mon.getDate() + 6)
    sun.setHours(23, 59, 59, 999)
    return { start: mon, end: sun }
  }

  const getExerciseBreakdown = (verifs: MileageVerif[]) => {
    const map: Record<string, { count: number; totalAmount: number }> = {}
    verifs.forEach(v => {
      if (!v.exercise_type) return
      if (!map[v.exercise_type]) map[v.exercise_type] = { count: 0, totalAmount: 0 }
      map[v.exercise_type].count++
      if (v.exercise_amount) {
        const parsed = parseFloat(v.exercise_amount)
        if (!isNaN(parsed)) map[v.exercise_type].totalAmount += parsed
      }
    })
    return Object.entries(map).map(([type, data]) => ({
      type,
      label: EXERCISE_TYPE_LABELS[type] || type,
      icon: EXERCISE_ICONS[type] || '\uD83D\uDCAA',
      ...data,
    }))
  }

  const buildCalendarCells = () => {
    const year = calendarMonth.getFullYear()
    const month = calendarMonth.getMonth()
    const firstDay = new Date(year, month, 1)
    const lastDay = new Date(year, month + 1, 0)
    const daysInMonth = lastDay.getDate()

    // Monday = 0 패딩
    let startPadding = firstDay.getDay() - 1
    if (startPadding < 0) startPadding = 6

    const cells: { day: number | null; date: Date | null }[] = []
    for (let i = 0; i < startPadding; i++) {
      cells.push({ day: null, date: null })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, date: new Date(year, month, d) })
    }
    return cells
  }

  // === 기존 대시보드 계산 ===
  const filteredStats = stats.filter((s) => s.routine.type === (tab === 'mileage' ? 'personal' : tab))
  const totalWeeklyDone = filteredStats.reduce((sum, s) => sum + s.weeklyDone, 0)
  const totalWeeklyTarget = filteredStats.reduce((sum, s) => sum + s.weeklyTarget, 0)
  const totalRate = totalWeeklyTarget > 0 ? Math.round((totalWeeklyDone / totalWeeklyTarget) * 100) : 0
  const maxStreak = filteredStats.length > 0 ? Math.max(...filteredStats.map((s) => s.streak)) : 0

  const weeklyData = tab === 'personal' ? personalWeeklyData : groupWeeklyData
  const dayLabels = ['월', '화', '수', '목', '금', '토', '일']
  const maxDailyCount = Math.max(...weeklyData, 1)

  // === 마일리지 계산 ===
  const verifiedDatesSet = new Set(mileageVerifs.map(v => new Date(v.verified_at).toDateString()))
  const selectedWeek = getSelectedWeekRange()
  const weeklyMileageVerifs = mileageVerifs.filter(v => {
    const d = new Date(v.verified_at)
    return d >= selectedWeek.start && d <= selectedWeek.end
  })
  const monthlyMileageVerifs = mileageVerifs
  const dailyMileageVerifs = mileageVerifs.filter(v =>
    new Date(v.verified_at).toDateString() === selectedDate.toDateString()
  )
  const weeklyBreakdown = getExerciseBreakdown(weeklyMileageVerifs)
  const monthlyBreakdown = getExerciseBreakdown(monthlyMileageVerifs)
  const calendarCells = buildCalendarCells()
  const todayStr = new Date().toDateString()
  const selectedStr = selectedDate.toDateString()

  // 주간 라벨
  const weekStartLabel = `${selectedWeek.start.getMonth() + 1}/${selectedWeek.start.getDate()}`
  const weekEndLabel = `${selectedWeek.end.getMonth() + 1}/${selectedWeek.end.getDate()}`

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
            if (user) {
              loadDashboard(user.id)
            } else {
              setLoading(false)
              setError('로그인이 필요합니다.')
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
        {/* Personal/Group/Mileage tabs */}
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
          <button
            onClick={() => setTab('mileage')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'mileage' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
          >
            마일리지
          </button>
        </div>

        {/* ========== 마일리지 탭 ========== */}
        {tab === 'mileage' && (
          <div className="space-y-4">
            {/* 월 네비게이션 */}
            <div className="flex items-center justify-between">
              <button onClick={() => handleMonthChange(-1)} className="p-2 rounded-lg hover:bg-bg active:bg-bg">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" /></svg>
              </button>
              <h3 className="text-base font-bold">
                {calendarMonth.getFullYear()}년 {calendarMonth.getMonth() + 1}월
              </h3>
              <button onClick={() => handleMonthChange(1)} className="p-2 rounded-lg hover:bg-bg active:bg-bg">
                <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" /></svg>
              </button>
            </div>

            {/* 캘린더 */}
            <Card>
              {mileageLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : (
                <div className="grid grid-cols-7 gap-1 text-center">
                  {/* 요일 헤더 */}
                  {dayLabels.map(d => (
                    <div key={d} className="text-[10px] font-medium text-text-muted py-1">{d}</div>
                  ))}
                  {/* 날짜 셀 */}
                  {calendarCells.map((cell, i) => {
                    if (!cell.day || !cell.date) {
                      return <div key={`empty-${i}`} />
                    }
                    const dateStr = cell.date.toDateString()
                    const isSelected = dateStr === selectedStr
                    const isToday = dateStr === todayStr
                    const hasVerif = verifiedDatesSet.has(dateStr)
                    // 선택된 주 범위에 속하는지
                    const inSelectedWeek = cell.date >= selectedWeek.start && cell.date <= selectedWeek.end

                    return (
                      <button
                        key={`day-${cell.day}`}
                        onClick={() => setSelectedDate(new Date(cell.date!))}
                        className={`relative flex flex-col items-center justify-center py-1.5 rounded-lg transition-all text-xs
                          ${isSelected ? 'bg-primary text-white font-bold' : ''}
                          ${!isSelected && inSelectedWeek ? 'bg-primary/10' : ''}
                          ${!isSelected && isToday ? 'font-bold text-primary' : ''}
                          ${!isSelected && !isToday && !inSelectedWeek ? 'text-text-secondary' : ''}
                        `}
                      >
                        {cell.day}
                        {hasVerif && (
                          <span className={`absolute bottom-0.5 w-1 h-1 rounded-full ${isSelected ? 'bg-white' : 'bg-success'}`} />
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>

            {/* 주간/월간 마일리지 요약 */}
            <div className="grid grid-cols-2 gap-3">
              {/* 주간 */}
              <Card>
                <p className="text-[10px] text-text-muted mb-1">{weekStartLabel} ~ {weekEndLabel} 주간</p>
                <p className="text-xl font-extrabold text-primary">{weeklyMileageVerifs.length}<span className="text-sm font-medium text-text-muted ml-0.5">회</span></p>
                {weeklyBreakdown.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {weeklyBreakdown.map(b => (
                      <div key={b.type} className="flex items-center justify-between text-[10px]">
                        <span className="text-text-secondary">{b.icon} {b.label}</span>
                        <span className="font-semibold">
                          {b.count}회
                          {b.totalAmount > 0 && <span className="text-text-muted ml-1">{b.totalAmount}{b.type === 'running' || b.type === 'cycling' || b.type === 'swimming' ? 'km' : b.type === 'weight' ? 'min' : ''}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {weeklyBreakdown.length === 0 && !mileageLoading && (
                  <p className="text-[10px] text-text-muted mt-1">기록 없음</p>
                )}
              </Card>
              {/* 월간 */}
              <Card>
                <p className="text-[10px] text-text-muted mb-1">{calendarMonth.getMonth() + 1}월 월간</p>
                <p className="text-xl font-extrabold text-secondary">{monthlyMileageVerifs.length}<span className="text-sm font-medium text-text-muted ml-0.5">회</span></p>
                {monthlyBreakdown.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {monthlyBreakdown.map(b => (
                      <div key={b.type} className="flex items-center justify-between text-[10px]">
                        <span className="text-text-secondary">{b.icon} {b.label}</span>
                        <span className="font-semibold">
                          {b.count}회
                          {b.totalAmount > 0 && <span className="text-text-muted ml-1">{b.totalAmount}{b.type === 'running' || b.type === 'cycling' || b.type === 'swimming' ? 'km' : b.type === 'weight' ? 'min' : ''}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {monthlyBreakdown.length === 0 && !mileageLoading && (
                  <p className="text-[10px] text-text-muted mt-1">기록 없음</p>
                )}
              </Card>
            </div>

            {/* 선택된 날짜 인증 상세 */}
            <div>
              <h3 className="text-sm font-bold mb-3">
                {selectedDate.getMonth() + 1}월 {selectedDate.getDate()}일 ({['일', '월', '화', '수', '목', '금', '토'][selectedDate.getDay()]})
                {dailyMileageVerifs.length > 0 && (
                  <span className="text-text-muted font-normal ml-2">{dailyMileageVerifs.length}건</span>
                )}
              </h3>
              {dailyMileageVerifs.length === 0 ? (
                <Card className="text-center py-6">
                  <p className="text-sm text-text-muted">이 날은 인증 기록이 없어요</p>
                </Card>
              ) : (
                <div className="space-y-2">
                  {dailyMileageVerifs.map(v => {
                    const time = new Date(v.verified_at)
                    const hh = time.getHours().toString().padStart(2, '0')
                    const mm = time.getMinutes().toString().padStart(2, '0')
                    const icon = v.exercise_type ? (EXERCISE_ICONS[v.exercise_type] || '\uD83D\uDCAA') : '\u2705'
                    const typeLabel = v.exercise_type ? (EXERCISE_TYPE_LABELS[v.exercise_type] || v.exercise_type) : '체크 인증'

                    return (
                      <Card key={v.id}>
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-2 flex-1 min-w-0">
                            <span className="text-lg shrink-0">{icon}</span>
                            <div className="min-w-0">
                              <p className="text-sm font-semibold">
                                {typeLabel}
                                {v.exercise_amount && <span className="text-text-muted font-normal ml-1.5">{v.exercise_amount}</span>}
                              </p>
                              {v.routines?.title && (
                                <p className="text-xs text-text-muted truncate">{v.routines.title}</p>
                              )}
                              {v.memo && (
                                <p className="text-xs text-text-secondary mt-0.5">{v.memo}</p>
                              )}
                            </div>
                          </div>
                          <span className="text-[10px] text-text-muted shrink-0 ml-2">{hh}:{mm}</span>
                        </div>
                      </Card>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========== 개인/그룹 탭 (기존) ========== */}
        {tab !== 'mileage' && (
          <>
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
                    <div key={gs.groupId} onClick={() => { setRankPopup(gs); setRankMembers(gs.allMembers || []) }} className="cursor-pointer">
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
                    </div>
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
                            {tab === 'personal' && (
                            <div>
                              <div className="flex items-center justify-between text-xs mb-1">
                                <span className="text-text-secondary">이번 달</span>
                                <span className="font-semibold">{stat.monthlyDone}/{stat.monthlyTarget} ({monthlyRate}%)</span>
                              </div>
                              <div className="h-2 bg-bg rounded-full overflow-hidden">
                                <div className={`h-full rounded-full transition-all duration-500 ${monthlyRate >= 100 ? 'bg-success' : 'bg-secondary'}`} style={{ width: `${monthlyRate}%` }} />
                              </div>
                            </div>
                            )}
                          </div>
                        </Card>
                      </Link>
                    )
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* 그룹 순위 팝업 */}
      <Modal isOpen={!!rankPopup} onClose={() => { setRankPopup(null); setRankMembers([]) }} title={rankPopup ? `${rankPopup.groupName} 순위` : ''}>
        <div className="space-y-3">
          {rankMembers.map((m, idx) => {
            const isMe = m.userId === user?.id
            const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : null
            return (
              <div key={m.userId} className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? 'bg-primary/10 border border-primary/20' : 'bg-bg'}`}>
                <span className="text-lg font-bold w-8 text-center shrink-0">
                  {medal || `${idx + 1}`}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${isMe ? 'text-primary' : ''}`}>
                    {m.nickname}{isMe ? ' (나)' : ''}
                  </p>
                  <p className="text-xs text-text-muted">{m.done}/{m.target}회 완료</p>
                </div>
                <span className={`text-sm font-bold ${m.rate >= 100 ? 'text-success' : m.rate >= 50 ? 'text-primary' : 'text-danger'}`}>
                  {m.rate}%
                </span>
              </div>
            )
          })}
          {rankPopup && (
            <Link href={`/group/${rankPopup.groupId}`}>
              <Button fullWidth variant="outline" className="mt-2">그룹 보기</Button>
            </Link>
          )}
        </div>
      </Modal>
    </>
  )
}
