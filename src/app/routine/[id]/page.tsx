'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import Header from '@/components/Header'
import Card from '@/components/Card'
import Button from '@/components/Button'
import ErrorRetry from '@/components/ErrorRetry'
import type { Routine, Verification, Group, Profile } from '@/lib/types'
import { FREQUENCY_LABELS, FREQUENCY_TARGETS, VERIFICATION_TYPE_LABELS } from '@/lib/types'
import { getWeekRange, getMonthRange, formatDate } from '@/lib/utils'

type RoutineDetail = Routine & {
  groups?: Group
}

type MemberRanking = {
  userId: string
  nickname: string
  weeklyDone: number
  rate: number
}

export default function RoutineDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()

  const [userId, setUserId] = useState<string | null>(null)
  const [routine, setRoutine] = useState<RoutineDetail | null>(null)
  const [verifications, setVerifications] = useState<(Verification & { profiles?: Profile })[]>([])
  const [weeklyDone, setWeeklyDone] = useState(0)
  const [monthlyDone, setMonthlyDone] = useState(0)
  const [totalDone, setTotalDone] = useState(0)
  const [streak, setStreak] = useState(0)
  const [rankings, setRankings] = useState<MemberRanking[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setError('데이터를 불러오는데 시간이 너무 오래 걸립니다.')
    }, 10000)
    return () => clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    const init = async () => {
      console.log('[Dalli] [RoutineDetail] getSession 시작')
      const { data: { session }, error: authError } = await supabase.auth.getSession()
      if (authError) {
        console.error('[Dalli] [RoutineDetail] getSession 에러:', authError)
        setLoading(false)
        setError('인증 정보를 확인할 수 없습니다.')
        return
      }
      const user = session?.user ?? null
      console.log('[Dalli] [RoutineDetail] getSession 완료:', user?.email)

      if (user) {
        setUserId(user.id)
        await loadRoutineDetail(user.id)
      } else {
        setLoading(false)
      }
    }
    init()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const loadRoutineDetail = async (uid: string) => {
    setError('')
    setLoading(true)

    try {
      // 1. 루틴 정보 가져오기
      console.log('[Dalli] [RoutineDetail] 루틴 쿼리 시작')
      const { data: routineRows, error: routineError } = await supabase
        .from('routines')
        .select('*, groups:group_id(*)')
        .eq('id', id)
      console.log('[Dalli] [RoutineDetail] 루틴 쿼리 응답:', { count: routineRows?.length, routineError })

      const routineData = routineRows?.[0] || null
      if (routineError || !routineData) {
        console.error('[Dalli] [RoutineDetail] 루틴 쿼리 에러:', routineError)
        setError(routineError?.message || '루틴을 찾을 수 없습니다.')
        return
      }
      console.log('[Dalli] [RoutineDetail] 루틴 쿼리 완료:', routineData.title)

      setRoutine(routineData as unknown as RoutineDetail)

      // 2. 주간 인증 횟수
      const { start: weekStart, end: weekEnd } = getWeekRange()
      console.log('[Dalli] [RoutineDetail] 주간 인증 쿼리 시작')
      const { data: weeklyVerifs, error: weeklyError } = await supabase
        .from('verifications')
        .select('id')
        .eq('routine_id', id)
        .eq('user_id', uid)
        .gte('verified_at', weekStart.toISOString())
        .lte('verified_at', weekEnd.toISOString())

      if (weeklyError) {
        console.error('[Dalli] [RoutineDetail] 주간 인증 쿼리 에러:', weeklyError)
      } else {
        console.log('[Dalli] [RoutineDetail] 주간 인증 쿼리 완료:', weeklyVerifs?.length)
      }
      setWeeklyDone((weeklyVerifs || []).length)

      // 3. 월간 인증 횟수
      const { start: monthStart, end: monthEnd } = getMonthRange()
      console.log('[Dalli] [RoutineDetail] 월간 인증 쿼리 시작')
      const { data: monthlyVerifs, error: monthlyError } = await supabase
        .from('verifications')
        .select('id')
        .eq('routine_id', id)
        .eq('user_id', uid)
        .gte('verified_at', monthStart.toISOString())
        .lte('verified_at', monthEnd.toISOString())

      if (monthlyError) {
        console.error('[Dalli] [RoutineDetail] 월간 인증 쿼리 에러:', monthlyError)
      } else {
        console.log('[Dalli] [RoutineDetail] 월간 인증 쿼리 완료:', monthlyVerifs?.length)
      }
      setMonthlyDone((monthlyVerifs || []).length)

      // 4. 전체 인증 횟수
      console.log('[Dalli] [RoutineDetail] 전체 인증 쿼리 시작')
      const { data: allVerifs, error: allError } = await supabase
        .from('verifications')
        .select('id')
        .eq('routine_id', id)
        .eq('user_id', uid)

      if (allError) {
        console.error('[Dalli] [RoutineDetail] 전체 인증 쿼리 에러:', allError)
      } else {
        console.log('[Dalli] [RoutineDetail] 전체 인증 쿼리 완료:', allVerifs?.length)
      }
      setTotalDone((allVerifs || []).length)

      // 5. 스트릭 계산
      console.log('[Dalli] [RoutineDetail] 스트릭 쿼리 시작')
      const { data: streakVerifs, error: streakError } = await supabase
        .from('verifications')
        .select('verified_at')
        .eq('routine_id', id)
        .eq('user_id', uid)
        .order('verified_at', { ascending: false })
        .limit(90)

      if (streakError) {
        console.error('[Dalli] [RoutineDetail] 스트릭 쿼리 에러:', streakError)
      } else {
        console.log('[Dalli] [RoutineDetail] 스트릭 쿼리 완료:', streakVerifs?.length)
      }

      if (streakVerifs && streakVerifs.length > 0) {
        const verifiedDays = new Set(streakVerifs.map(v => new Date(v.verified_at).toDateString()))
        let streakCount = 0
        const today = new Date()
        for (let i = 0; i <= 90; i++) {
          const checkDate = new Date(today)
          checkDate.setDate(today.getDate() - i)
          if (verifiedDays.has(checkDate.toDateString())) {
            streakCount++
          } else if (i > 0) {
            break
          }
        }
        setStreak(streakCount)
      }

      // 6. 최근 인증 기록 (사진/메모 포함)
      console.log('[Dalli] [RoutineDetail] 최근 인증 기록 쿼리 시작')
      const { data: recentVerifs, error: recentError } = await supabase
        .from('verifications')
        .select('*, profiles(*)')
        .eq('routine_id', id)
        .order('verified_at', { ascending: false })
        .limit(20)

      if (recentError) {
        console.error('[Dalli] [RoutineDetail] 최근 인증 기록 쿼리 에러:', recentError)
      } else {
        console.log('[Dalli] [RoutineDetail] 최근 인증 기록 쿼리 완료:', recentVerifs?.length)
      }

      if (recentVerifs) {
        setVerifications(recentVerifs as unknown as (Verification & { profiles?: Profile })[])
      }

      // 7. 그룹 루틴이면 그룹 내 랭킹 계산
      const rd = routineData as unknown as RoutineDetail
      if (rd.type === 'group' && rd.group_id) {
        console.log('[Dalli] [RoutineDetail] 그룹 멤버 쿼리 시작')
        const { data: members, error: membersError } = await supabase
          .from('group_members')
          .select('user_id, profiles(*)')
          .eq('group_id', rd.group_id)

        if (membersError) {
          console.error('[Dalli] [RoutineDetail] 그룹 멤버 쿼리 에러:', membersError)
        } else {
          console.log('[Dalli] [RoutineDetail] 그룹 멤버 쿼리 완료:', members?.length)
        }

        if (members && members.length > 0) {
          console.log('[Dalli] [RoutineDetail] 그룹 주간 인증 쿼리 시작')
          const { data: groupWeeklyVerifs, error: groupVerifsError } = await supabase
            .from('verifications')
            .select('user_id')
            .eq('routine_id', id)
            .gte('verified_at', weekStart.toISOString())
            .lte('verified_at', weekEnd.toISOString())

          if (groupVerifsError) {
            console.error('[Dalli] [RoutineDetail] 그룹 주간 인증 쿼리 에러:', groupVerifsError)
          } else {
            console.log('[Dalli] [RoutineDetail] 그룹 주간 인증 쿼리 완료:', groupWeeklyVerifs?.length)
          }

          const target = FREQUENCY_TARGETS[rd.frequency]
          const rankingData: MemberRanking[] = members.map(m => {
            const memberProfile = m.profiles as unknown as Profile
            const done = (groupWeeklyVerifs || []).filter(v => v.user_id === m.user_id).length
            return {
              userId: m.user_id,
              nickname: memberProfile?.nickname || '알 수 없음',
              weeklyDone: done,
              rate: target > 0 ? Math.round((done / target) * 100) : 0,
            }
          })
          rankingData.sort((a, b) => b.rate - a.rate)
          setRankings(rankingData)
        }
      }
    } catch (err) {
      console.error('[Dalli] [RoutineDetail] 데이터 로드 실패:', err)
      setError('루틴 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Loading state
  if (loading) {
    return (
      <>
        <Header title="루틴 상세" showBack />
        <div className="px-4 pt-4 space-y-4">
          <div className="h-24 bg-border/40 rounded-xl animate-pulse" />
          <div className="grid grid-cols-2 gap-3">
            <div className="h-20 bg-border/40 rounded-xl animate-pulse" />
            <div className="h-20 bg-border/40 rounded-xl animate-pulse" />
          </div>
          <div className="h-32 bg-border/40 rounded-xl animate-pulse" />
        </div>
      </>
    )
  }

  // Error state
  if (error || !routine) {
    return (
      <>
        <Header title="루틴 상세" showBack />
        <ErrorRetry
          error={error || '루틴을 찾을 수 없습니다.'}
          onRetry={() => { setError(''); setLoading(true); if (userId) loadRoutineDetail(userId) }}
        />
      </>
    )
  }

  const weeklyTarget = FREQUENCY_TARGETS[routine.frequency]
  const weeklyRate = weeklyTarget > 0 ? Math.min(Math.round((weeklyDone / weeklyTarget) * 100), 100) : 0

  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate()
  const weeksInMonth = Math.ceil(daysInMonth / 7)
  const monthlyTarget = weeklyTarget * weeksInMonth
  const monthlyRate = monthlyTarget > 0 ? Math.min(Math.round((monthlyDone / monthlyTarget) * 100), 100) : 0

  return (
    <>
      <Header title="루틴 상세" showBack />

      <div className="px-4 pt-4 space-y-4 pb-6">
        {/* 루틴 기본 정보 */}
        <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-text">{routine.title}</h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                  {FREQUENCY_LABELS[routine.frequency]}
                </span>
                <span className="text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full font-medium">
                  {VERIFICATION_TYPE_LABELS[routine.verification_type]}
                </span>
                {routine.type === 'group' && (
                  <span className="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded-full font-medium">그룹</span>
                )}
              </div>
            </div>
            {streak > 0 && (
              <div className="text-right">
                <p className="text-2xl font-extrabold text-warning">{streak}</p>
                <p className="text-[10px] text-text-muted">연속일</p>
              </div>
            )}
          </div>
          {routine.type === 'group' && routine.groups && (
            <Link href={`/group/${routine.group_id}`}>
              <div className="mt-3 pt-3 border-t border-primary/10 flex items-center gap-2">
                <div className="w-6 h-6 bg-primary/20 rounded-lg flex items-center justify-center text-primary text-xs font-bold">
                  {routine.groups.name.charAt(0)}
                </div>
                <span className="text-xs text-primary font-medium">{routine.groups.name}</span>
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3 text-primary ml-auto">
                  <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                </svg>
              </div>
            </Link>
          )}
        </Card>

        {/* 주간/월간 진행률 */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="text-center">
            <p className="text-xs text-text-muted mb-1">이번 주</p>
            <p className={`text-2xl font-extrabold ${weeklyRate >= 100 ? 'text-success' : 'text-primary'}`}>{weeklyRate}%</p>
            <p className="text-xs text-text-secondary mt-1">{weeklyDone}/{weeklyTarget}회</p>
            <div className="h-1.5 bg-bg rounded-full overflow-hidden mt-2">
              <div className={`h-full rounded-full transition-all ${weeklyRate >= 100 ? 'bg-success' : 'bg-primary'}`} style={{ width: `${weeklyRate}%` }} />
            </div>
          </Card>
          <Card className="text-center">
            <p className="text-xs text-text-muted mb-1">이번 달</p>
            <p className={`text-2xl font-extrabold ${monthlyRate >= 100 ? 'text-success' : 'text-secondary'}`}>{monthlyRate}%</p>
            <p className="text-xs text-text-secondary mt-1">{monthlyDone}/{monthlyTarget}회</p>
            <div className="h-1.5 bg-bg rounded-full overflow-hidden mt-2">
              <div className={`h-full rounded-full transition-all ${monthlyRate >= 100 ? 'bg-success' : 'bg-secondary'}`} style={{ width: `${monthlyRate}%` }} />
            </div>
          </Card>
        </div>

        {/* 누적 통계 */}
        <Card>
          <h3 className="text-sm font-bold mb-3">누적 통계</h3>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className="text-xl font-extrabold text-text">{totalDone}</p>
              <p className="text-[10px] text-text-muted">총 인증 횟수</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold text-warning">{streak}</p>
              <p className="text-[10px] text-text-muted">현재 스트릭</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-extrabold text-primary">{weeklyRate}%</p>
              <p className="text-[10px] text-text-muted">주간 달성률</p>
            </div>
          </div>
        </Card>

        {/* 그룹 루틴: 랭킹 */}
        {routine.type === 'group' && rankings.length > 0 && (
          <Card>
            <h3 className="text-sm font-bold mb-3">그룹 내 랭킹</h3>
            <div className="space-y-2">
              {rankings.map((rank, idx) => (
                <div key={rank.userId} className={`flex items-center gap-3 p-2 rounded-lg ${rank.userId === userId ? 'bg-primary/5' : ''}`}>
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                    idx === 0 ? 'bg-warning/20 text-warning' : idx === 1 ? 'bg-text-muted/20 text-text-muted' : idx === 2 ? 'bg-warning/10 text-warning/70' : 'bg-bg text-text-muted'
                  }`}>
                    {idx + 1}
                  </span>
                  <span className={`text-sm flex-1 truncate ${rank.userId === userId ? 'font-bold text-primary' : 'font-medium'}`}>
                    {rank.nickname}
                    {rank.userId === userId && <span className="text-xs ml-1">(나)</span>}
                  </span>
                  <span className="text-xs text-text-muted">{rank.weeklyDone}/{weeklyTarget}회</span>
                  <span className={`text-sm font-bold ${rank.rate >= 100 ? 'text-success' : rank.rate >= 50 ? 'text-primary' : 'text-danger'}`}>
                    {rank.rate}%
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* 액션 버튼 */}
        <div className="flex gap-3">
          <Button
            fullWidth
            size="lg"
            onClick={() => router.push('/verify')}
            className="shadow-lg shadow-primary/20"
          >
            인증하기
          </Button>
          {routine.type === 'personal' && (
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/routine')}
              className="shrink-0"
            >
              설정 변경
            </Button>
          )}
        </div>

        {/* 인증 기록 */}
        <div>
          <h3 className="text-sm font-bold mb-3">최근 인증 기록</h3>
          {verifications.length === 0 ? (
            <Card className="text-center py-6">
              <p className="text-sm text-text-muted">아직 인증 기록이 없어요</p>
            </Card>
          ) : (
            <div className="space-y-2">
              {verifications.map((v) => (
                <Card key={v.id}>
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xs font-bold shrink-0 mt-0.5">
                      {v.profiles?.nickname?.charAt(0) || '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold">{v.profiles?.nickname || '나'}</span>
                        <span className="text-xs text-text-muted">{formatDate(v.verified_at)}</span>
                      </div>
                      {v.memo && <p className="text-sm text-text-secondary mt-1">{v.memo}</p>}
                      {v.photo_url && (
                        <div className="mt-2 rounded-xl overflow-hidden">
                          <img src={v.photo_url} alt="인증 사진" className="w-full h-32 object-cover" />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
