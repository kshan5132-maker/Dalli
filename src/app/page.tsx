'use client'

import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import Button from '@/components/Button'
import Card from '@/components/Card'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Routine } from '@/lib/types'
import { FREQUENCY_LABELS, FREQUENCY_TARGETS } from '@/lib/types'
import { getWeekRange } from '@/lib/utils'
import { HomeSkeleton } from '@/components/Skeleton'

function LandingPage() {
  return (
    <div className="min-h-dvh flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="mb-8">
          <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
            <span className="text-3xl text-white font-bold">D</span>
          </div>
          <h1 className="text-3xl font-extrabold text-text mb-2">Dalli</h1>
          <p className="text-lg text-primary font-semibold mb-1">함께하면 더 쉬워요</p>
          <p className="text-sm text-text-secondary leading-relaxed">
            친구들과 함께하는 루틴 인증 앱<br />
            서로 응원하며 꾸준히 성장하세요
          </p>
        </div>

        <div className="w-full max-w-[320px] space-y-3 mb-8">
          <div className="flex items-center gap-3 text-left p-3 bg-primary/5 rounded-xl">
            <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-primary">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">루틴 설정</p>
              <p className="text-xs text-text-secondary">운동, 다이어트, 독서 등 나만의 목표 설정</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-left p-3 bg-secondary/5 rounded-xl">
            <div className="w-10 h-10 bg-secondary/10 rounded-xl flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-secondary">
                <path d="M4.5 6.375a4.125 4.125 0 118.25 0 4.125 4.125 0 01-8.25 0zM14.25 8.625a3.375 3.375 0 116.75 0 3.375 3.375 0 01-6.75 0zM1.5 19.125a7.125 7.125 0 0114.25 0v.003l-.001.119a.75.75 0 01-.363.63 13.067 13.067 0 01-6.761 1.873c-2.472 0-4.786-.684-6.76-1.873a.75.75 0 01-.364-.63l-.001-.122zM17.25 19.128l-.001.144a2.25 2.25 0 01-.233.96 10.088 10.088 0 005.06-1.01.75.75 0 00.42-.643 4.875 4.875 0 00-6.957-4.611 8.586 8.586 0 011.71 5.157v.003z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">그룹 참여</p>
              <p className="text-xs text-text-secondary">함께 인증하고 서로 동기부여</p>
            </div>
          </div>
          <div className="flex items-center gap-3 text-left p-3 bg-warning/5 rounded-xl">
            <div className="w-10 h-10 bg-warning/10 rounded-xl flex items-center justify-center shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-warning">
                <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-semibold text-text">미션 달성 현황</p>
              <p className="text-xs text-text-secondary">주간 달성률과 스트릭으로 성장 확인</p>
            </div>
          </div>
        </div>

        <div className="w-full max-w-[320px] space-y-3">
          <Link href="/signup"><Button fullWidth size="lg">시작하기</Button></Link>
          <Link href="/login"><Button variant="ghost" fullWidth size="lg">이미 계정이 있어요</Button></Link>
        </div>
      </div>
    </div>
  )
}

function HomePage({ userId }: { userId: string }) {
  const { profile } = useAuth()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [weeklyVerifications, setWeeklyVerifications] = useState<Record<string, number>>({})
  const [todayVerified, setTodayVerified] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const supabase = createClient()

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => setLoading(false), 10000)
    return () => clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    const loadData = async () => {
      try {
        console.log('[Dalli] [Home] 루틴 쿼리 시작')
        const { data: allRoutines, error: routinesError } = await supabase
          .from('routines')
          .select('*')
          .eq('user_id', userId)
          .order('created_at', { ascending: false })

        if (routinesError) {
          console.error('[Dalli] [Home] 루틴 쿼리 에러:', routinesError)
          return
        }
        console.log('[Dalli] [Home] 루틴 쿼리 완료:', allRoutines?.length)

        if (allRoutines) {
          setRoutines(allRoutines as Routine[])

          const { start, end } = getWeekRange()
          console.log('[Dalli] [Home] 인증 쿼리 시작')
          const { data: verifications, error: verifsError } = await supabase
            .from('verifications')
            .select('routine_id, verified_at')
            .eq('user_id', userId)
            .gte('verified_at', start.toISOString())
            .lte('verified_at', end.toISOString())

          if (verifsError) {
            console.error('[Dalli] [Home] 인증 쿼리 에러:', verifsError)
          } else {
            console.log('[Dalli] [Home] 인증 쿼리 완료:', verifications?.length)
          }

          if (verifications) {
            const counts: Record<string, number> = {}
            const todaySet = new Set<string>()
            const today = new Date().toDateString()
            ;(verifications as { routine_id: string; verified_at: string }[]).forEach((v) => {
              counts[v.routine_id] = (counts[v.routine_id] || 0) + 1
              if (new Date(v.verified_at).toDateString() === today) todaySet.add(v.routine_id)
            })
            setWeeklyVerifications(counts)
            setTodayVerified(todaySet)
          }
        }
      } catch (err) {
        console.error('[Dalli] [Home] 데이터 로드 실패:', err)
      } finally {
        setLoading(false)
      }
    }

    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const personalRoutines = routines.filter((r) => r.type === 'personal')
  const groupRoutines = routines.filter((r) => r.type === 'group')
  const totalTarget = routines.reduce((sum, r) => sum + FREQUENCY_TARGETS[r.frequency], 0)
  const totalDone = routines.reduce((sum, r) => sum + (weeklyVerifications[r.id] || 0), 0)
  const overallRate = totalTarget > 0 ? Math.round((totalDone / totalTarget) * 100) : 0
  const displayName = profile?.nickname || '사용자'

  if (loading) {
    return <HomeSkeleton />
  }

  const renderRoutineCard = (routine: Routine, isGroup = false) => {
    const done = weeklyVerifications[routine.id] || 0
    const target = FREQUENCY_TARGETS[routine.frequency]
    const isVerifiedToday = todayVerified.has(routine.id)
    const rate = Math.round((done / target) * 100)
    return (
      <Link key={routine.id} href={`/routine/${routine.id}`}>
        <Card className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${isVerifiedToday ? 'bg-success/10 text-success' : isGroup ? 'bg-secondary/10 text-secondary' : 'bg-bg text-text-muted'}`}>
            {isVerifiedToday ? (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" /></svg>
            ) : (
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} className="w-5 h-5"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold truncate">{routine.title}</p>
            <p className="text-xs text-text-muted">{isGroup ? '그룹 · ' : ''}{FREQUENCY_LABELS[routine.frequency]} &middot; {done}/{target}회</p>
          </div>
          <p className={`text-sm font-bold shrink-0 ${rate >= 100 ? 'text-success' : rate > 0 ? 'text-primary' : 'text-text-muted'}`}>{rate}%</p>
        </Card>
      </Link>
    )
  }

  return (
    <div className="px-4 pt-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <p className="text-sm text-text-secondary">안녕하세요,</p>
          <h1 className="text-2xl font-bold">{displayName} <span className="text-lg">님</span></h1>
        </div>
        <Link href="/profile" className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-sm">
          {displayName.charAt(0)}
        </Link>
      </div>

      <Card className="mb-6 bg-gradient-to-br from-primary to-primary-dark text-white border-0">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-white/70 text-xs font-medium mb-1">이번 주 달성률</p>
            <p className="text-4xl font-extrabold">{overallRate}%</p>
            <p className="text-white/70 text-xs mt-1">{totalDone}/{totalTarget} 완료</p>
          </div>
          <div className="w-20 h-20 relative">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 36 36">
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="3" />
              <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="white" strokeWidth="3" strokeDasharray={`${overallRate}, 100`} strokeLinecap="round" />
            </svg>
          </div>
        </div>
      </Card>

      {/* 개인 루틴 */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold">개인 루틴</h2>
        <Link href="/routine" className="text-xs text-primary font-medium">전체보기</Link>
      </div>
      {personalRoutines.length === 0 ? (
        <Card className="text-center py-6 mb-4">
          <p className="text-text-muted text-sm mb-3">아직 등록된 개인 루틴이 없어요</p>
          <Link href="/routine/new"><Button size="sm">루틴 만들기</Button></Link>
        </Card>
      ) : (
        <div className="space-y-2 mb-4">
          {personalRoutines.slice(0, 3).map((r) => renderRoutineCard(r))}
        </div>
      )}

      {/* 그룹 루틴 */}
      {groupRoutines.length > 0 && (
        <>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-bold">그룹 루틴</h2>
            <Link href="/group" className="text-xs text-primary font-medium">그룹 보기</Link>
          </div>
          <div className="space-y-2 mb-4">
            {groupRoutines.slice(0, 3).map((r) => renderRoutineCard(r, true))}
          </div>
        </>
      )}

      <div className="mt-4 mb-4">
        <Link href="/verify">
          <Button fullWidth size="lg" className="shadow-lg shadow-primary/20">오늘 인증하기</Button>
        </Link>
      </div>
    </div>
  )
}

export default function Page() {
  const [authChecked, setAuthChecked] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      console.log('[Dalli] [Page] getSession 시작')
      const { data: { session }, error } = await supabase.auth.getSession()
      if (error) {
        console.error('[Dalli] [Page] getSession 에러:', error)
      } else {
        console.log('[Dalli] [Page] getSession 완료:', session?.user?.email)
      }
      const user = session?.user ?? null
      setUserId(user?.id ?? null)
      setAuthChecked(true)
    }
    checkAuth()
  }, [])

  if (!authChecked) {
    return <HomeSkeleton />
  }

  return userId ? <HomePage userId={userId} /> : <LandingPage />
}
