'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import { isDevMode } from '@/lib/fetch'
import Header from '@/components/Header'
import Button from '@/components/Button'
import Card from '@/components/Card'
import ErrorRetry from '@/components/ErrorRetry'
import { VerifySkeleton } from '@/components/Skeleton'
import type { Routine } from '@/lib/types'
import { FREQUENCY_LABELS, FREQUENCY_TARGETS, VERIFICATION_TYPE_LABELS } from '@/lib/types'
import { getWeekRange } from '@/lib/utils'

type TabType = 'personal' | 'group'

interface GroupRoutineWithGroup extends Routine {
  groups?: { id: string; name: string }
}

export default function VerifyPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [activeTab, setActiveTab] = useState<TabType>('personal')
  const [personalRoutines, setPersonalRoutines] = useState<Routine[]>([])
  const [groupRoutines, setGroupRoutines] = useState<GroupRoutineWithGroup[]>([])
  const [weeklyVerifications, setWeeklyVerifications] = useState<Record<string, number>>({})
  const [todayVerified, setTodayVerified] = useState<Set<string>>(new Set())
  const [selectedRoutine, setSelectedRoutine] = useState<Routine | null>(null)
  const [photo, setPhoto] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [memo, setMemo] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState(false)
  const [celebration, setCelebration] = useState(false)
  const [streak, setStreak] = useState(0)
  const [error, setError] = useState('')

  // useAuth()에서 인증 정보 가져오기
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadData(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading])

  // 10-second loading timeout
  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setError('데이터를 불러오는데 시간이 너무 오래 걸립니다.')
    }, 10000)
    return () => clearTimeout(timer)
  }, [loading])

  const loadData = async (uid: string) => {
    setError('')
    setLoading(true)

    try {
      // 1. Fetch personal routines (type='personal', user_id matches)
      console.log('[Dalli] [Verify] PersonalRoutines 쿼리 시작')
      const { data: personalData, error: personalError } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', uid)
        .eq('type', 'personal')
        .order('created_at', { ascending: false })
      console.log('[Dalli] [Verify] PersonalRoutines 쿼리 완료', personalData?.length)

      if (personalError) {
        setError(personalError.message)
        return
      }
      setPersonalRoutines(personalData || [])

      // 2. Fetch group routines: find groups the user is a member of, then get routines with type='group' in those groups
      console.log('[Dalli] [Verify] GroupMembers 쿼리 시작')
      const { data: memberData, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', uid)
      console.log('[Dalli] [Verify] GroupMembers 쿼리 완료', memberData?.length)

      if (memberError) {
        setError(memberError.message)
        return
      }

      let groupRoutineData: GroupRoutineWithGroup[] = []
      if (memberData && memberData.length > 0) {
        const groupIds = memberData.map((m) => m.group_id)
        console.log('[Dalli] [Verify] GroupRoutines 쿼리 시작')
        const { data: grData, error: grError } = await supabase
          .from('routines')
          .select('*, groups:group_id(id, name)')
          .eq('type', 'group')
          .in('group_id', groupIds)
          .order('created_at', { ascending: false })
        console.log('[Dalli] [Verify] GroupRoutines 쿼리 완료', grData?.length)

        if (grError) {
          setError(grError.message)
          return
        }
        groupRoutineData = (grData || []) as GroupRoutineWithGroup[]
      }
      setGroupRoutines(groupRoutineData)

      // 3. Fetch weekly verifications for all routines
      const allRoutineIds = [
        ...(personalData || []).map((r) => r.id),
        ...groupRoutineData.map((r) => r.id),
      ]

      if (allRoutineIds.length > 0) {
        const { start, end } = getWeekRange()
        console.log('[Dalli] [Verify] WeeklyVerifications 쿼리 시작')
        const { data: verifications, error: vError } = await supabase
          .from('verifications')
          .select('routine_id, verified_at')
          .eq('user_id', uid)
          .in('routine_id', allRoutineIds)
          .gte('verified_at', start.toISOString())
          .lte('verified_at', end.toISOString())
        console.log('[Dalli] [Verify] WeeklyVerifications 쿼리 완료', verifications?.length)

        if (vError) {
          setError(vError.message)
          return
        }

        if (verifications) {
          const counts: Record<string, number> = {}
          const todaySet = new Set<string>()
          const today = new Date().toDateString()

          verifications.forEach((v) => {
            counts[v.routine_id] = (counts[v.routine_id] || 0) + 1
            if (new Date(v.verified_at).toDateString() === today) {
              todaySet.add(v.routine_id)
            }
          })

          setWeeklyVerifications(counts)
          setTodayVerified(todaySet)
        }
      }
    } catch (err) {
      console.error('[Dalli] [Verify] 데이터 로드 실패:', err)
      setError('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // File type validation
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
    if (!allowedTypes.includes(file.type)) {
      alert('JPG, PNG, WebP, HEIC, HEIF 형식의 이미지만 업로드할 수 있습니다.')
      return
    }

    // File size validation (10MB)
    if (file.size > 10 * 1024 * 1024) {
      alert('10MB 이하의 이미지만 업로드할 수 있습니다.')
      return
    }

    setPhoto(file)
    const reader = new FileReader()
    reader.onload = () => setPhotoPreview(reader.result as string)
    reader.readAsDataURL(file)
  }

  const calculateStreak = async (routineId: string): Promise<number> => {
    if (!user) return 0

    try {
      // Fetch recent verifications for this routine, ordered by date descending
      const { data: recentVerifications } = await supabase
        .from('verifications')
        .select('verified_at')
        .eq('routine_id', routineId)
        .eq('user_id', user.id)
        .order('verified_at', { ascending: false })
        .limit(60) // enough for 2 months of daily

      if (!recentVerifications || recentVerifications.length === 0) return 0

      // Count consecutive days
      let streakCount = 0
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      // Group verifications by day
      const verifiedDays = new Set<string>()
      recentVerifications.forEach((v) => {
        verifiedDays.add(new Date(v.verified_at).toDateString())
      })

      // Count streak backwards from today (include today since we just verified)
      for (let i = 0; i <= 60; i++) {
        const checkDate = new Date(today)
        checkDate.setDate(today.getDate() - i)
        if (verifiedDays.has(checkDate.toDateString())) {
          streakCount++
        } else {
          // If it's today and not yet in DB (we're about to submit), still count it
          if (i === 0) {
            streakCount++
            continue
          }
          break
        }
      }

      return streakCount
    } catch {
      return 0
    }
  }

  const handleVerify = async () => {
    if (!selectedRoutine || !user) return
    setSubmitting(true)

    try {
      let photoUrl: string | null = null

      // Upload photo if photo verification
      if (selectedRoutine.verification_type === 'photo' && photo) {
        const extMap: Record<string, string> = {
          'image/jpeg': 'jpg',
          'image/png': 'png',
          'image/webp': 'webp',
          'image/heic': 'heic',
          'image/heif': 'heif',
        }
        const fileExt = extMap[photo.type] || 'jpg'
        const fileName = `${user.id}/${Date.now()}.${fileExt}`

        const { error: uploadError } = await supabase.storage
          .from('verifications')
          .upload(fileName, photo)

        if (uploadError) {
          alert('사진 업로드에 실패했습니다.')
          return
        }

        const { data: urlData } = supabase.storage
          .from('verifications')
          .getPublicUrl(fileName)

        photoUrl = urlData.publicUrl
      }

      // Save verification record
      const isAlreadyVerified = todayVerified.has(selectedRoutine.id)
      const { error: verifyError } = await supabase.from('verifications').insert({
        routine_id: selectedRoutine.id,
        user_id: user.id,
        group_id: selectedRoutine.group_id,
        photo_url: photoUrl,
        memo: memo.trim() || null,
      })

      if (verifyError) {
        alert('인증 저장에 실패했습니다.')
        return
      }

      // Calculate weekly count after this verification
      const prevCount = weeklyVerifications[selectedRoutine.id] || 0
      // If already verified today and not dev mode, this doesn't count as additional
      const shouldCount = !isAlreadyVerified || isDevMode
      const newCount = shouldCount ? prevCount + 1 : prevCount
      const target = FREQUENCY_TARGETS[selectedRoutine.frequency]

      // Check if weekly goal is reached with this verification
      if (shouldCount && newCount >= target && prevCount < target) {
        // Weekly goal celebration
        const currentStreak = await calculateStreak(selectedRoutine.id)
        setStreak(currentStreak)
        setCelebration(true)
      } else {
        setSuccess(true)
      }

      // Update local state
      if (shouldCount) {
        setWeeklyVerifications((prev) => ({
          ...prev,
          [selectedRoutine.id]: newCount,
        }))
      }
      setTodayVerified((prev) => new Set(prev).add(selectedRoutine.id))
    } catch (err) {
      console.error('[Dalli] [Verify] 인증 실패:', err)
      alert('인증 중 오류가 발생했습니다.')
    } finally {
      setSubmitting(false)
    }
  }

  const resetState = () => {
    setSuccess(false)
    setCelebration(false)
    setSelectedRoutine(null)
    setPhoto(null)
    setPhotoPreview(null)
    setMemo('')
    setStreak(0)
    if (user) loadData(user.id)
  }

  // Loading state
  if (loading) {
    return (
      <>
        <Header title="인증하기" />
        <VerifySkeleton />
      </>
    )
  }

  // Error state
  if (error) {
    return (
      <>
        <Header title="인증하기" />
        <ErrorRetry
          error={error}
          onRetry={() => {
            setError('')
            setLoading(true)
            if (user) {
              loadData(user.id)
            } else {
              setLoading(false)
              setError('로그인이 필요합니다.')
            }
          }}
        />
      </>
    )
  }

  // Weekly goal celebration screen
  if (celebration) {
    return (
      <div className="min-h-[70dvh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-24 h-24 bg-success/10 rounded-full flex items-center justify-center mb-6 animate-bounce">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-14 h-14 text-success"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-2xl font-extrabold text-text mb-2">
          이번 주 미션 완료! 🎉
        </h2>
        <p className="text-base font-semibold text-primary mb-6">
          {streak <= 1 ? '첫 인증 완료! 좋은 시작이에요! 🎉' : `${streak}일 연속 달성 중! 🔥`}
        </p>
        <Button
          size="lg"
          onClick={() => {
            resetState()
            router.push('/')
          }}
        >
          계속 달려볼까요?
        </Button>
      </div>
    )
  }

  // Success screen
  if (success) {
    return (
      <div className="min-h-[70dvh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-success/10 rounded-full flex items-center justify-center mb-4">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="currentColor"
            className="w-10 h-10 text-success"
          >
            <path
              fillRule="evenodd"
              d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <h2 className="text-xl font-bold mb-1">오늘도 해냈어요! 💪</h2>
        <p className="text-sm text-text-secondary mb-6">인증이 기록되었습니다</p>
        <Button
          variant="ghost"
          onClick={resetState}
        >
          돌아가기
        </Button>
      </div>
    )
  }

  const currentRoutines = activeTab === 'personal' ? personalRoutines : groupRoutines

  // Routine selection screen (no routine selected yet)
  if (!selectedRoutine) {
    return (
      <>
        <Header title="인증하기" />
        <div className="px-4 pt-4">
          {/* Tab bar */}
          <div className="flex bg-bg rounded-xl p-1 mb-4">
            <button
              onClick={() => setActiveTab('personal')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'personal'
                  ? 'bg-bg-card text-primary shadow-sm'
                  : 'text-text-muted'
              }`}
            >
              개인 루틴
            </button>
            <button
              onClick={() => setActiveTab('group')}
              className={`flex-1 py-2 text-sm font-semibold rounded-lg transition-all ${
                activeTab === 'group'
                  ? 'bg-bg-card text-primary shadow-sm'
                  : 'text-text-muted'
              }`}
            >
              그룹 루틴
            </button>
          </div>

          {currentRoutines.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-text-muted text-sm mb-3">인증할 루틴이 없어요</p>
              <Button
                onClick={() =>
                  router.push(activeTab === 'personal' ? '/routine/new' : '/group')
                }
              >
                {activeTab === 'personal' ? '루틴 만들기' : '그룹 둘러보기'}
              </Button>
            </div>
          ) : (
            <>
              <p className="text-sm text-text-secondary mb-3">
                인증할 루틴을 선택하세요
              </p>
              <div className="space-y-2">
                {currentRoutines.map((routine) => {
                  const done = weeklyVerifications[routine.id] || 0
                  const target = FREQUENCY_TARGETS[routine.frequency]
                  const isVerifiedToday = todayVerified.has(routine.id)
                  const groupInfo = activeTab === 'group'
                    ? (routine as GroupRoutineWithGroup).groups
                    : null

                  return (
                    <Card
                      key={routine.id}
                      hover
                      onClick={() => setSelectedRoutine(routine)}
                      className={
                        isVerifiedToday ? 'border-success/30 bg-success/5' : ''
                      }
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                            isVerifiedToday
                              ? 'bg-success/10 text-success'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          {routine.verification_type === 'photo' ? (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                              className="w-5 h-5"
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
                              className="w-5 h-5"
                            >
                              <path
                                fillRule="evenodd"
                                d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z"
                                clipRule="evenodd"
                              />
                            </svg>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold truncate">
                            {routine.title}
                            {isVerifiedToday && (
                              <span className="text-success text-xs ml-1">
                                완료
                              </span>
                            )}
                          </p>
                          <p className="text-xs text-text-muted">
                            {FREQUENCY_LABELS[routine.frequency]} &middot;{' '}
                            {done}/{target}회
                            {groupInfo && (
                              <span className="ml-1 text-secondary">
                                &middot; {groupInfo.name}
                              </span>
                            )}
                          </p>
                        </div>
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          viewBox="0 0 20 20"
                          fill="currentColor"
                          className="w-5 h-5 text-text-muted"
                        >
                          <path
                            fillRule="evenodd"
                            d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                    </Card>
                  )
                })}
              </div>
            </>
          )}
        </div>
      </>
    )
  }

  // Verification UI (routine selected)
  const isAlreadyVerifiedToday = todayVerified.has(selectedRoutine.id)

  return (
    <>
      <Header
        title="인증하기"
        showBack
        rightAction={
          <button
            onClick={() => {
              setSelectedRoutine(null)
              setPhoto(null)
              setPhotoPreview(null)
              setMemo('')
            }}
            className="text-sm text-text-secondary"
          >
            취소
          </button>
        }
      />

      <div className="px-4 pt-4 space-y-4">
        {/* Selected routine info */}
        <Card className="bg-primary/5 border-primary/20">
          <p className="text-base font-bold text-primary">
            {selectedRoutine.title}
          </p>
          <p className="text-xs text-text-secondary mt-0.5">
            {FREQUENCY_LABELS[selectedRoutine.frequency]} &middot;{' '}
            {VERIFICATION_TYPE_LABELS[selectedRoutine.verification_type]}
          </p>
        </Card>

        {/* Already verified today notice */}
        {isAlreadyVerifiedToday && (
          <div className="flex items-center gap-2 p-3 bg-warning/10 border border-warning/20 rounded-xl">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              className="w-5 h-5 text-warning shrink-0"
            >
              <path
                fillRule="evenodd"
                d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm text-warning font-medium">
              오늘 이미 인증 완료! 추가 기록만 저장됩니다
            </p>
          </div>
        )}

        {/* Photo verification UI */}
        {selectedRoutine.verification_type === 'photo' ? (
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              인증 사진
            </label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              capture="environment"
              onChange={handleFileChange}
              className="hidden"
            />

            {photoPreview ? (
              <div className="relative rounded-2xl overflow-hidden">
                <img
                  src={photoPreview}
                  alt="인증 사진"
                  className="w-full h-64 object-cover"
                />
                <button
                  onClick={() => {
                    setPhoto(null)
                    setPhotoPreview(null)
                    if (fileInputRef.current) fileInputRef.current.value = ''
                  }}
                  className="absolute top-2 right-2 w-8 h-8 bg-black/50 rounded-full flex items-center justify-center text-white"
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
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.setAttribute('capture', 'environment')
                      fileInputRef.current.click()
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-2 py-8 bg-bg border-2 border-dashed border-border rounded-xl hover:border-primary/30 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-8 h-8 text-text-muted"
                  >
                    <path d="M12 9a3.75 3.75 0 100 7.5A3.75 3.75 0 0012 9z" />
                    <path
                      fillRule="evenodd"
                      d="M9.344 3.071a49.52 49.52 0 015.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 01-3 3H4.5a3 3 0 01-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 001.11-.71l.822-1.315a2.942 2.942 0 012.332-1.39zM6.75 12.75a5.25 5.25 0 1110.5 0 5.25 5.25 0 01-10.5 0zm12-1.5a.75.75 0 100-1.5.75.75 0 000 1.5z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-text-secondary font-medium">
                    카메라
                  </span>
                </button>
                <button
                  onClick={() => {
                    if (fileInputRef.current) {
                      fileInputRef.current.removeAttribute('capture')
                      fileInputRef.current.click()
                    }
                  }}
                  className="flex flex-col items-center justify-center gap-2 py-8 bg-bg border-2 border-dashed border-border rounded-xl hover:border-primary/30 transition-colors"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                    className="w-8 h-8 text-text-muted"
                  >
                    <path
                      fillRule="evenodd"
                      d="M1.5 6a2.25 2.25 0 012.25-2.25h16.5A2.25 2.25 0 0122.5 6v12a2.25 2.25 0 01-2.25 2.25H3.75A2.25 2.25 0 011.5 18V6zM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0021 18v-1.94l-2.69-2.689a1.5 1.5 0 00-2.12 0l-.88.879.97.97a.75.75 0 11-1.06 1.06l-5.16-5.159a1.5 1.5 0 00-2.12 0L3 16.061zm10.125-7.81a1.125 1.125 0 112.25 0 1.125 1.125 0 01-2.25 0z"
                      clipRule="evenodd"
                    />
                  </svg>
                  <span className="text-sm text-text-secondary font-medium">
                    갤러리
                  </span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Check verification UI */
          <Card className="text-center py-6 bg-secondary/5 border-secondary/20">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="w-12 h-12 text-secondary mx-auto mb-2"
            >
              <path
                fillRule="evenodd"
                d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z"
                clipRule="evenodd"
              />
            </svg>
            <p className="text-sm font-semibold text-secondary">체크 인증</p>
            <p className="text-xs text-text-muted mt-1">
              버튼을 누르면 인증됩니다
            </p>
          </Card>
        )}

        {/* Memo text field */}
        <div>
          <textarea
            value={memo}
            onChange={(e) => setMemo(e.target.value)}
            placeholder="오늘 어떤 운동을 했나요? (선택사항)"
            rows={3}
            className="w-full px-4 py-3 bg-bg border border-border rounded-xl text-sm text-text placeholder:text-text-muted resize-none focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
          />
        </div>

        <Button
          fullWidth
          size="lg"
          onClick={handleVerify}
          loading={submitting}
          disabled={
            selectedRoutine.verification_type === 'photo' && !photo
          }
        >
          인증 완료
        </Button>
      </div>
    </>
  )
}
