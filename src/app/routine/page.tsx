'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Button from '@/components/Button'
import Card from '@/components/Card'
import EmptyState from '@/components/EmptyState'
import Modal from '@/components/Modal'
import Input from '@/components/Input'
import ErrorRetry from '@/components/ErrorRetry'
import { RoutineListSkeleton } from '@/components/Skeleton'
import type { Routine, Verification, Profile } from '@/lib/types'
import {
  FREQUENCY_LABELS,
  VERIFICATION_TYPE_LABELS,
  FREQUENCY_TARGETS,
  EXERCISE_TYPE_LABELS,
  getExerciseList,
} from '@/lib/types'
import { getWeekRange, getWeekRangeOffset, formatDate } from '@/lib/utils'
import { isDevMode } from '@/lib/fetch'

type TabType = 'feed' | 'routines' | 'mission'

type FeedItem = Verification & { profiles: Profile; routines: Routine }

export default function RoutineListPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()

  // -- Shared state --
  const [activeTab, setActiveTab] = useState<TabType>('feed')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // -- Routines tab state --
  const [routines, setRoutines] = useState<Routine[]>([])
  const [weeklyVerifications, setWeeklyVerifications] = useState<Record<string, number>>({})
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)

  // -- Feed tab state --
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [feedLoading, setFeedLoading] = useState(false)
  const [feedLoaded, setFeedLoaded] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [editMemoText, setEditMemoText] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)
  const [viewingPhoto, setViewingPhoto] = useState<FeedItem | null>(null)
  const [shareTarget, setShareTarget] = useState<FeedItem | null>(null)
  const [shareCopied, setShareCopied] = useState(false)

  // -- Mission tab state --
  const [weekOffset, setWeekOffset] = useState(0)
  const [missionVerifs, setMissionVerifs] = useState<{ routine_id: string; verified_at: string }[]>([])
  const [missionLoading, setMissionLoading] = useState(false)
  const [showMissionDetail, setShowMissionDetail] = useState(false)

  // -- Timeout guard --
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setError('데이터를 불러오는데 시간이 너무 오래 걸립니다.')
    }, 10000)
    return () => clearTimeout(timer)
  }, [loading])

  // -- Auth guard + initial load --
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadRoutines(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading])

  // -- Load feed when switching to feed tab --
  useEffect(() => {
    if (activeTab === 'feed' && !feedLoaded && user && routines.length > 0) {
      loadFeed(user.id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, feedLoaded, user, routines])

  // -- Reload mission verifications when weekOffset changes --
  useEffect(() => {
    if (activeTab !== 'mission' || routines.length === 0 || !user) return
    if (weekOffset === 0) {
      // Current week data is already loaded alongside routines
      const { start, end } = getWeekRange()
      loadMissionVerifs(routines.map((r) => r.id), start, end)
    } else {
      const { start, end } = getWeekRangeOffset(weekOffset)
      loadMissionVerifs(routines.map((r) => r.id), start, end)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekOffset, activeTab])

  // ============================================================
  // Data loading functions
  // ============================================================

  const loadRoutines = async (uid: string) => {
    setError('')
    try {
      console.log('[Dalli] [Routine] 개인 루틴 쿼리 시작')
      const { data: personalData, error: personalError } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', uid)
        .eq('type', 'personal')
        .order('created_at', { ascending: false })

      if (personalError) {
        console.error('[Dalli] [Routine] 개인 루틴 쿼리 에러:', personalError)
        setError('데이터를 불러오는데 실패했습니다. 다시 시도해주세요.')
        return
      }
      console.log('[Dalli] [Routine] 개인 루틴 쿼리 완료:', personalData?.length)

      const personalRoutines = (personalData || []) as Routine[]
      setRoutines(personalRoutines)

      // Load this week's verifications for progress bars
      if (personalRoutines.length > 0) {
        const routineIds = personalRoutines.map((r) => r.id)
        const { start, end } = getWeekRange()
        console.log('[Dalli] [Routine] 인증 쿼리 시작')
        const { data: verifications, error: verifsError } = await supabase
          .from('verifications')
          .select('routine_id, verified_at')
          .eq('user_id', uid)
          .in('routine_id', routineIds)
          .gte('verified_at', start.toISOString())
          .lte('verified_at', end.toISOString())

        if (verifsError) {
          console.error('[Dalli] [Routine] 인증 쿼리 에러:', verifsError)
        } else {
          console.log('[Dalli] [Routine] 인증 쿼리 완료:', verifications?.length)
        }

        if (verifications) {
          const vList = verifications as { routine_id: string; verified_at: string }[]
          if (isDevMode) {
            const counts: Record<string, number> = {}
            vList.forEach((v) => { counts[v.routine_id] = (counts[v.routine_id] || 0) + 1 })
            setWeeklyVerifications(counts)
          } else {
            const routineDays: Record<string, Set<string>> = {}
            vList.forEach((v) => {
              const dayKey = new Date(v.verified_at).toDateString()
              if (!routineDays[v.routine_id]) routineDays[v.routine_id] = new Set()
              routineDays[v.routine_id].add(dayKey)
            })
            const counts: Record<string, number> = {}
            Object.entries(routineDays).forEach(([rid, days]) => { counts[rid] = days.size })
            setWeeklyVerifications(counts)
          }

          // Also set mission verifs for current week
          setMissionVerifs(vList)
        }
      }
    } catch (err) {
      console.error('[Dalli] [Routine] 데이터 로드 실패:', err)
      setError('데이터를 불러오는데 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

  const loadFeed = async (uid: string) => {
    if (feedLoading) return
    setFeedLoading(true)
    try {
      const routineIds = routines.filter((r) => r.type === 'personal').map((r) => r.id)
      if (routineIds.length === 0) {
        setFeed([])
        setFeedLoaded(true)
        return
      }

      console.log('[Dalli] [Routine] 피드 쿼리 시작')
      const { data: verifications, error: feedError } = await supabase
        .from('verifications')
        .select('*, profiles(*), routines(*)')
        .eq('user_id', uid)
        .in('routine_id', routineIds)
        .order('verified_at', { ascending: false })
        .limit(30)

      if (feedError) {
        console.error('[Dalli] [Routine] 피드 쿼리 에러:', feedError)
      } else {
        console.log('[Dalli] [Routine] 피드 쿼리 완료:', verifications?.length)
        setFeed((verifications || []) as unknown as FeedItem[])
      }
      setFeedLoaded(true)
    } catch (err) {
      console.error('[Dalli] [Routine] 피드 로드 실패:', err)
      setFeedLoaded(true)
    } finally {
      setFeedLoading(false)
    }
  }

  const loadMissionVerifs = async (routineIds: string[], start: Date, end: Date) => {
    if (!user) return
    setMissionLoading(true)
    try {
      console.log('[Dalli] [Routine] 미션 인증 쿼리 시작')
      const { data } = await supabase
        .from('verifications')
        .select('routine_id, verified_at')
        .eq('user_id', user.id)
        .in('routine_id', routineIds)
        .gte('verified_at', start.toISOString())
        .lte('verified_at', end.toISOString())
      console.log('[Dalli] [Routine] 미션 인증 쿼리 완료:', data?.length)
      setMissionVerifs((data || []) as { routine_id: string; verified_at: string }[])
    } catch (err) {
      console.error('[Dalli] [Routine] 미션 인증 로드 실패:', err)
    } finally {
      setMissionLoading(false)
    }
  }

  // ============================================================
  // Routines tab handlers
  // ============================================================

  const handleDelete = async (id: string) => {
    if (!confirm('이 루틴을 삭제하시겠습니까?')) return
    await supabase.from('routines').delete().eq('id', id)
    setRoutines(routines.filter((r) => r.id !== id))
  }

  const handleEdit = (routine: Routine) => {
    setEditingRoutine(routine)
    setEditTitle(routine.title)
  }

  const handleSaveEdit = async () => {
    if (!editingRoutine || !editTitle.trim()) return
    setSaving(true)
    await supabase.from('routines').update({ title: editTitle.trim() }).eq('id', editingRoutine.id)
    setRoutines(routines.map((r) => r.id === editingRoutine.id ? { ...r, title: editTitle.trim() } : r))
    setEditingRoutine(null)
    setSaving(false)
  }

  // ============================================================
  // Feed tab handlers
  // ============================================================

  const isToday = (dateStr: string) => new Date(dateStr).toDateString() === new Date().toDateString()

  const handleDeleteVerification = async (verificationId: string) => {
    if (!confirm('이 인증을 삭제하시겠습니까?')) return
    setDeletingId(verificationId)
    try {
      const { error: deleteError } = await supabase
        .from('verifications')
        .delete()
        .eq('id', verificationId)
      if (!deleteError) {
        setFeed((prev) => prev.filter((v) => v.id !== verificationId))
      } else {
        console.error('[Dalli] [Routine] 인증 삭제 실패:', deleteError)
      }
    } catch (err) {
      console.error('[Dalli] [Routine] 인증 삭제 예외:', err)
    } finally {
      setDeletingId(null)
    }
  }

  const handleStartEditMemo = (v: FeedItem) => {
    setEditingMemoId(v.id)
    setEditMemoText(v.memo || '')
  }

  const handleSaveMemo = async () => {
    if (!editingMemoId) return
    setSavingMemo(true)
    try {
      const { error: updateError } = await supabase
        .from('verifications')
        .update({ memo: editMemoText.trim() || null })
        .eq('id', editingMemoId)
      if (!updateError) {
        setFeed((prev) =>
          prev.map((v) => v.id === editingMemoId ? { ...v, memo: editMemoText.trim() || null } : v)
        )
      }
    } catch (err) {
      console.error('[Dalli] [Routine] 메모 수정 실패:', err)
    } finally {
      setSavingMemo(false)
      setEditingMemoId(null)
      setEditMemoText('')
    }
  }

  const getShareText = (v: FeedItem) => {
    const nickname = v.profiles?.nickname || '알 수 없음'
    const routineTitle = v.routines?.title || '루틴'
    const exerciseEntries = getExerciseList(v)
    const exerciseInfo = exerciseEntries.length > 0
      ? ` (${exerciseEntries.map((e) => `${EXERCISE_TYPE_LABELS[e.type] || e.type}${e.amount ? ` ${e.amount}` : ''}`).join(', ')})`
      : ''
    return `${nickname}님이 "${routineTitle}"${exerciseInfo}을 인증했어요!`
  }

  const handleShareCopy = async (type: 'text' | 'photo') => {
    if (!shareTarget) return
    const text = getShareText(shareTarget)
    const fullText = type === 'photo' && shareTarget.photo_url
      ? `${text}\n${shareTarget.photo_url}`
      : text
    try {
      await navigator.clipboard.writeText(fullText)
    } catch {
      const ta = document.createElement('textarea')
      ta.value = fullText
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    }
    setShareCopied(true)
    setTimeout(() => { setShareCopied(false); setShareTarget(null) }, 1500)
  }

  const handleShareNative = async () => {
    if (!shareTarget) return
    const text = getShareText(shareTarget)
    try {
      await navigator.share({ text: text + '\n\n- Dalli', url: window.location.href })
      setShareTarget(null)
    } catch {
      // 취소 시 무시
    }
  }

  // ============================================================
  // Loading / error states
  // ============================================================

  if (loading) {
    return (
      <>
        <Header title="내 루틴" />
        <RoutineListSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header title="내 루틴" />
        <ErrorRetry
          error={error}
          onRetry={() => {
            setError('')
            setLoading(true)
            if (user) loadRoutines(user.id)
          }}
        />
      </>
    )
  }

  // ============================================================
  // Tab-specific derived data
  // ============================================================

  const tabs: { key: TabType; label: string }[] = [
    { key: 'feed', label: '피드' },
    { key: 'routines', label: '루틴' },
    { key: 'mission', label: '미션현황' },
  ]

  // ============================================================
  // Render
  // ============================================================

  return (
    <>
      <Header
        title="내 루틴"
        rightAction={
          activeTab === 'routines' ? (
            <Link href="/routine/new">
              <button className="p-1 text-primary">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                  <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
                </svg>
              </button>
            </Link>
          ) : undefined
        }
      />

      <div className="px-4 pt-4">
        {/* Tabs */}
        <div className="flex gap-1 bg-bg rounded-xl p-1 mb-4">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ====== Feed Tab ====== */}
        {activeTab === 'feed' && (
          <div className="space-y-3 pb-6">
            {feedLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : feed.length === 0 ? (
              <EmptyState
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                }
                title="인증 기록이 없어요"
                description="루틴을 만들고 첫 번째 인증을 기록해보세요!"
                action={<Link href="/routine/new"><Button>루틴 만들기</Button></Link>}
              />
            ) : (
              feed.map((v) => {
                const isMine = v.user_id === user?.id
                const canEdit = isMine && isToday(v.verified_at)
                const exerciseList = getExerciseList(v)

                return (
                  <Card key={v.id}>
                    <div className="flex items-start gap-3">
                      {/* Avatar */}
                      <div className="w-9 h-9 rounded-full overflow-hidden shrink-0">
                        {v.profiles?.avatar_url ? (
                          <img src={v.profiles.avatar_url} alt={v.profiles.nickname || ''} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-sm font-bold">
                            {v.profiles?.nickname?.charAt(0) || '?'}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Header row */}
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm font-semibold truncate">
                              {v.profiles?.nickname || '알 수 없음'}
                            </span>
                            <span className="text-xs text-text-muted shrink-0">
                              {formatDate(v.verified_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1 ml-1 shrink-0">
                            {canEdit && (
                              <button
                                onClick={() => handleStartEditMemo(v)}
                                className="p-1 text-text-muted hover:text-primary transition-colors"
                                title="메모 수정"
                              >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                  <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                                </svg>
                              </button>
                            )}
                            {isMine && (
                              <button
                                onClick={() => handleDeleteVerification(v.id)}
                                disabled={deletingId === v.id}
                                className="p-1 text-text-muted hover:text-danger transition-colors disabled:opacity-50"
                                title="인증 삭제"
                              >
                                {deletingId === v.id ? (
                                  <div className="w-4 h-4 border-2 border-danger border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Routine name + exercise info */}
                        <p className="text-xs text-text-secondary mt-0.5">
                          <span className="text-primary font-medium">
                            {v.routines?.title || '루틴'}
                          </span>
                          을 인증했습니다
                          {exerciseList.length > 0 && (
                            <span className="ml-1 text-secondary">
                              · {exerciseList.map((e) => `${EXERCISE_TYPE_LABELS[e.type] || e.type}${e.amount ? ` ${e.amount}` : ''}`).join(', ')}
                            </span>
                          )}
                        </p>

                        {/* Memo */}
                        {v.memo && (
                          <p className="text-sm text-text mt-2">{v.memo}</p>
                        )}

                        {/* Photo */}
                        {v.photo_url && (
                          <div
                            className="mt-2 rounded-xl overflow-hidden cursor-pointer"
                            onClick={() => setViewingPhoto(v)}
                          >
                            <img
                              src={v.photo_url}
                              alt="인증 사진"
                              className="w-full h-40 object-cover"
                            />
                          </div>
                        )}

                        {/* Action bar */}
                        <div className="mt-2 pt-2 border-t border-border/50 flex items-center gap-2">
                          <button
                            onClick={() => setShareTarget(v)}
                            className="flex items-center gap-1 text-xs px-3 py-1.5 bg-bg rounded-full text-text-secondary hover:bg-bg-card transition-colors"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                              <path d="M13 4.5a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0zM15.5 0a4.5 4.5 0 00-3.826 6.852l-4.288 2.572a4.5 4.5 0 100 5.152l4.288 2.572a4.5 4.5 0 10.914-1.524l-4.288-2.572a4.534 4.534 0 000-2.104l4.288-2.572A4.5 4.5 0 0015.5 0zM5.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 15.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                            </svg>
                            공유
                          </button>
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* ====== Routines Tab ====== */}
        {activeTab === 'routines' && (
          <div className="space-y-3 pb-6">
            {routines.length === 0 ? (
              <EmptyState
                icon={
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                    <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                  </svg>
                }
                title="개인 루틴이 없어요"
                description="첫 번째 루틴을 만들어보세요!"
                action={<Link href="/routine/new"><Button>루틴 만들기</Button></Link>}
              />
            ) : (
              routines.map((routine) => {
                const done = weeklyVerifications[routine.id] || 0
                const target = FREQUENCY_TARGETS[routine.frequency]
                const rate = Math.min(Math.round((done / target) * 100), 100)

                return (
                  <Card key={routine.id} hover onClick={() => router.push(`/routine/${routine.id}`)}>
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold truncate">{routine.title}</h3>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                            {FREQUENCY_LABELS[routine.frequency]}
                          </span>
                          <span className="text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full font-medium">
                            {VERIFICATION_TYPE_LABELS[routine.verification_type]}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); handleEdit(routine) }}
                          className="p-1.5 text-text-muted hover:text-primary rounded-lg hover:bg-bg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                          </svg>
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(routine.id) }}
                          className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-bg transition-colors"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="flex-1 h-2 bg-bg rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${rate >= 100 ? 'bg-success' : 'bg-primary'}`}
                          style={{ width: `${rate}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-text-secondary shrink-0">{done}/{target}</span>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* ====== Mission Status Tab ====== */}
        {activeTab === 'mission' && (() => {
          const { start: weekStart } = getWeekRangeOffset(weekOffset)
          const dayLabels = ['월', '화', '수', '목', '금', '토', '일']
          const weekDates = dayLabels.map((_, idx) => {
            const d = new Date(weekStart)
            d.setDate(weekStart.getDate() + idx)
            return d
          })
          const today = new Date()
          const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1
          const daysLeft = 6 - todayIdx
          const isSunday = todayIdx === 6
          const isCurrentWeek = weekOffset === 0

          const navWeek = getWeekRangeOffset(weekOffset)
          const navStartStr = `${navWeek.start.getMonth() + 1}/${navWeek.start.getDate()}`
          const navEndStr = `${navWeek.end.getMonth() + 1}/${navWeek.end.getDate()}`

          // Compute per-routine done count from missionVerifs
          const routineDoneCounts: Record<string, number> = {}
          if (isDevMode) {
            missionVerifs.forEach((v) => {
              routineDoneCounts[v.routine_id] = (routineDoneCounts[v.routine_id] || 0) + 1
            })
          } else {
            const routineDays: Record<string, Set<string>> = {}
            missionVerifs.forEach((v) => {
              const dayKey = new Date(v.verified_at).toDateString()
              if (!routineDays[v.routine_id]) routineDays[v.routine_id] = new Set()
              routineDays[v.routine_id].add(dayKey)
            })
            Object.entries(routineDays).forEach(([rid, days]) => { routineDoneCounts[rid] = days.size })
          }

          return (
            <div className="space-y-3 pb-6">
              {/* Week navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={() => setWeekOffset((p) => p - 1)}
                  className="p-2 text-text-muted hover:text-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M12.79 5.23a.75.75 0 01-.02 1.06L8.832 10l3.938 3.71a.75.75 0 11-1.04 1.08l-4.5-4.25a.75.75 0 010-1.08l4.5-4.25a.75.75 0 011.06.02z" clipRule="evenodd" />
                  </svg>
                </button>
                <div className="text-center">
                  <p className="text-sm font-bold text-text">
                    {isCurrentWeek ? '이번 주' : weekOffset === -1 ? '지난 주' : `${navStartStr} ~ ${navEndStr}`}
                  </p>
                  {!isCurrentWeek && (
                    <p className="text-[10px] text-text-muted">{navStartStr} ~ {navEndStr}</p>
                  )}
                </div>
                <button
                  onClick={() => setWeekOffset((p) => Math.min(p + 1, 0))}
                  disabled={isCurrentWeek}
                  className={`p-2 transition-colors ${isCurrentWeek ? 'text-text-muted/30' : 'text-text-muted hover:text-primary'}`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>

              {/* Summary card */}
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-bold text-primary">{isCurrentWeek ? '이번 주 미션 달성 현황' : '주간 미션 결과'}</p>
                  {isCurrentWeek && (
                    isSunday ? (
                      <span className="px-2 py-0.5 bg-danger/10 text-danger text-[10px] font-bold rounded-full animate-pulse">
                        오늘이 마지막 날!
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 bg-primary/10 text-primary text-[10px] font-bold rounded-full">
                        남은 기간: {daysLeft}일
                      </span>
                    )
                  )}
                </div>
                <p className="text-xs text-text-secondary">
                  개인 루틴 {routines.length}개 · 루틴별 달성 현황을 확인하세요
                </p>
              </Card>

              {missionLoading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : routines.length === 0 ? (
                <EmptyState
                  icon={
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                      <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
                    </svg>
                  }
                  title="개인 루틴이 없어요"
                  description="루틴을 만들어 미션 현황을 확인해보세요!"
                  action={<Link href="/routine/new"><Button>루틴 만들기</Button></Link>}
                />
              ) : (
                <>
                  {/* Routine cards */}
                  <div className="space-y-2">
                    {routines.map((routine) => {
                      const done = routineDoneCounts[routine.id] || 0
                      const target = FREQUENCY_TARGETS[routine.frequency]
                      const rate = target > 0 ? Math.round((done / target) * 100) : 0
                      const isComplete = rate >= 100
                      const remaining = Math.max(target - done, 0)

                      const barColor = isComplete
                        ? 'bg-[#10B981]'
                        : rate >= 50
                          ? 'bg-[#F59E0B]'
                          : rate > 0
                            ? 'bg-[#F97316]'
                            : 'bg-[#EF4444]'

                      let statusMsg: string
                      let statusColor: string
                      if (done > target && target > 0) {
                        statusMsg = `초과 달성! (${done - target}회 추가) ✅`
                        statusColor = 'text-[#10B981]'
                      } else if (isComplete) {
                        statusMsg = '완료! ✅'
                        statusColor = 'text-[#10B981]'
                      } else if (rate >= 50) {
                        statusMsg = `${remaining}회 남음`
                        statusColor = 'text-[#F97316]'
                      } else if (done > 0) {
                        statusMsg = `${remaining}회 남음 🔴`
                        statusColor = 'text-[#EF4444]'
                      } else {
                        statusMsg = '아직 시작 안 함 🔴'
                        statusColor = 'text-[#EF4444]'
                      }

                      return (
                        <Card key={routine.id}>
                          <div className="flex items-center justify-between mb-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-bold truncate">{routine.title}</p>
                              <p className="text-xs text-text-muted">{FREQUENCY_LABELS[routine.frequency]}</p>
                            </div>
                            <p className={`text-sm font-bold shrink-0 ml-2 ${isComplete ? 'text-[#10B981]' : ''}`}>
                              {done}/{target}
                            </p>
                          </div>
                          <div className="flex items-center gap-2 mb-1.5">
                            <div className="flex-1 h-2.5 bg-bg rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all duration-700 ${barColor}`}
                                style={{ width: `${Math.min(rate, 100)}%` }}
                              />
                            </div>
                            <span className="text-xs font-bold text-text-secondary w-10 text-right shrink-0">
                              {rate}%
                            </span>
                          </div>
                          <p className={`text-xs font-medium ${statusColor}`}>{statusMsg}</p>
                        </Card>
                      )
                    })}
                  </div>

                  {/* Day-by-day detail toggle */}
                  <button
                    onClick={() => setShowMissionDetail(!showMissionDetail)}
                    className="w-full py-2.5 text-sm font-medium text-text-secondary flex items-center justify-center gap-1.5 bg-bg rounded-xl hover:bg-bg-card transition-colors"
                  >
                    <span>{showMissionDetail ? '📊 요일별 상세 접기' : '📊 요일별 상세보기'}</span>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 20 20"
                      fill="currentColor"
                      className={`w-4 h-4 transition-transform duration-200 ${showMissionDetail ? 'rotate-180' : ''}`}
                    >
                      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
                    </svg>
                  </button>

                  {/* Day-by-day grid */}
                  {showMissionDetail && (
                    <div className="space-y-3">
                      {routines.map((routine) => (
                        <Card key={routine.id}>
                          <p className="text-sm font-bold mb-2">{routine.title}</p>
                          {/* Day header */}
                          <div className="grid grid-cols-8 gap-1 text-center mb-1">
                            <div className="text-[10px] text-text-muted" />
                            {dayLabels.map((d, i) => (
                              <div
                                key={i}
                                className={`text-[10px] font-medium ${i === todayIdx && isCurrentWeek ? 'text-primary' : 'text-text-muted'}`}
                              >
                                {d}
                              </div>
                            ))}
                          </div>
                          {/* Single row for the user */}
                          <div className="grid grid-cols-8 gap-1 items-center">
                            <p className="text-[10px] text-text-secondary truncate pr-1">
                              {user ? (feed.find((f) => f.user_id === user.id)?.profiles?.nickname?.slice(0, 3) || '나') : '나'}
                            </p>
                            {weekDates.map((date, dayIdx) => {
                              const dayStr = date.toDateString()
                              const hasVerif = missionVerifs.some(
                                (v) => v.routine_id === routine.id && new Date(v.verified_at).toDateString() === dayStr
                              )
                              const isFuture = isCurrentWeek && dayIdx > todayIdx
                              return (
                                <div key={dayIdx} className="flex items-center justify-center h-6">
                                  {isFuture ? (
                                    <span className="text-[10px] text-text-muted/50">-</span>
                                  ) : hasVerif ? (
                                    <span className="text-sm">✅</span>
                                  ) : (
                                    <span className="text-sm">❌</span>
                                  )}
                                </div>
                              )
                            })}
                          </div>
                        </Card>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}
      </div>

      {/* ====== Modals ====== */}

      {/* Edit routine title modal */}
      <Modal isOpen={!!editingRoutine} onClose={() => setEditingRoutine(null)} title="루틴 수정">
        <div className="space-y-4">
          <Input
            label="루틴 이름"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            placeholder="루틴 이름을 입력하세요"
          />
          <Button fullWidth onClick={handleSaveEdit} loading={saving}>저장하기</Button>
        </div>
      </Modal>

      {/* Edit memo modal */}
      <Modal
        isOpen={!!editingMemoId}
        onClose={() => { setEditingMemoId(null); setEditMemoText('') }}
        title="메모 수정"
      >
        <div className="space-y-4">
          <textarea
            value={editMemoText}
            onChange={(e) => setEditMemoText(e.target.value)}
            placeholder="메모를 입력하세요"
            rows={3}
            className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm text-text placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/50 transition-colors"
          />
          <Button fullWidth onClick={handleSaveMemo} loading={savingMemo}>저장하기</Button>
        </div>
      </Modal>

      {/* Photo viewer */}
      {viewingPhoto && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80"
          onClick={() => setViewingPhoto(null)}
        >
          <button
            className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white z-10"
            onClick={() => setViewingPhoto(null)}
          >
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="w-full max-w-2xl px-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={viewingPhoto.photo_url!}
              alt="인증 사진"
              className="w-full max-h-[75vh] object-contain rounded-xl cursor-pointer"
              onClick={() => window.open(viewingPhoto.photo_url!, '_blank')}
              title="클릭하면 원본 크기로 열립니다"
            />
            <div className="mt-3 text-center text-white">
              <p className="text-sm font-semibold">{viewingPhoto.profiles?.nickname || '알 수 없음'}</p>
              <p className="text-xs text-white/70">{formatDate(viewingPhoto.verified_at)}</p>
              {viewingPhoto.memo && <p className="text-sm mt-2 text-white/90">{viewingPhoto.memo}</p>}
              <p className="text-[10px] text-white/40 mt-2">사진을 클릭하면 원본 크기로 볼 수 있습니다</p>
            </div>
          </div>
        </div>
      )}

      {/* Share modal */}
      <Modal
        isOpen={!!shareTarget}
        onClose={() => { setShareTarget(null); setShareCopied(false) }}
        title="공유하기"
      >
        {shareTarget && (
          <div className="space-y-3">
            {/* Preview */}
            <div className="bg-bg rounded-xl p-3">
              <p className="text-sm font-medium">{getShareText(shareTarget)}</p>
              {shareTarget.memo && (
                <p className="text-xs text-text-muted mt-1">{shareTarget.memo}</p>
              )}
            </div>

            {/* Share options */}
            <div className="space-y-2">
              {/* Copy text */}
              <button
                onClick={() => handleShareCopy('text')}
                className="w-full flex items-center gap-3 p-3 bg-bg rounded-xl hover:bg-bg-card transition-colors text-left"
              >
                <div className="w-10 h-10 bg-primary/10 rounded-full flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-primary">
                    <path d="M7 3.5A1.5 1.5 0 018.5 2h3.879a1.5 1.5 0 011.06.44l3.122 3.12A1.5 1.5 0 0117 6.622V12.5a1.5 1.5 0 01-1.5 1.5h-1v-3.379a3 3 0 00-.879-2.121L10.5 5.379A3 3 0 008.379 4.5H7v-1z" />
                    <path d="M4.5 6A1.5 1.5 0 003 7.5v9A1.5 1.5 0 004.5 18h7a1.5 1.5 0 001.5-1.5v-5.879a1.5 1.5 0 00-.44-1.06L9.44 6.439A1.5 1.5 0 008.378 6H4.5z" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold">텍스트 복사</p>
                  <p className="text-[10px] text-text-muted">인증 내용을 클립보드에 복사</p>
                </div>
              </button>

              {/* Copy with photo URL */}
              {shareTarget.photo_url && (
                <button
                  onClick={() => handleShareCopy('photo')}
                  className="w-full flex items-center gap-3 p-3 bg-bg rounded-xl hover:bg-bg-card transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-secondary/10 rounded-full flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-secondary">
                      <path fillRule="evenodd" d="M1 5.25A2.25 2.25 0 013.25 3h13.5A2.25 2.25 0 0119 5.25v9.5A2.25 2.25 0 0116.75 17H3.25A2.25 2.25 0 011 14.75v-9.5zm1.5 5.81v3.69c0 .414.336.75.75.75h13.5a.75.75 0 00.75-.75v-2.69l-2.22-2.219a.75.75 0 00-1.06 0l-1.91 1.909.47.47a.75.75 0 11-1.06 1.06L6.53 8.091a.75.75 0 00-1.06 0l-3.47 3.47z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">사진 포함 복사</p>
                    <p className="text-[10px] text-text-muted">인증 내용 + 사진 링크 복사</p>
                  </div>
                </button>
              )}

              {/* Native share */}
              {typeof navigator !== 'undefined' && 'share' in navigator && (
                <button
                  onClick={handleShareNative}
                  className="w-full flex items-center gap-3 p-3 bg-bg rounded-xl hover:bg-bg-card transition-colors text-left"
                >
                  <div className="w-10 h-10 bg-success/10 rounded-full flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-success">
                      <path d="M13 4.5a2.5 2.5 0 115 0 2.5 2.5 0 01-5 0zM15.5 0a4.5 4.5 0 00-3.826 6.852l-4.288 2.572a4.5 4.5 0 100 5.152l4.288 2.572a4.5 4.5 0 10.914-1.524l-4.288-2.572a4.534 4.534 0 000-2.104l4.288-2.572A4.5 4.5 0 0015.5 0zM5.5 13a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18 15.5a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">다른 앱으로 공유</p>
                    <p className="text-[10px] text-text-muted">카카오톡, 인스타 등</p>
                  </div>
                </button>
              )}
            </div>

            {/* Copied toast */}
            {shareCopied && (
              <div className="text-center py-2">
                <span className="text-sm font-semibold text-success">복사 완료!</span>
              </div>
            )}
          </div>
        )}
      </Modal>
    </>
  )
}
