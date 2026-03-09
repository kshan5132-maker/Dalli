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
import type { Routine } from '@/lib/types'
import { FREQUENCY_LABELS, VERIFICATION_TYPE_LABELS, FREQUENCY_TARGETS } from '@/lib/types'
import { getWeekRange } from '@/lib/utils'
import { RoutineListSkeleton } from '@/components/Skeleton'

export default function RoutineListPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()
  const [routines, setRoutines] = useState<Routine[]>([])
  const [weeklyVerifications, setWeeklyVerifications] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [editingRoutine, setEditingRoutine] = useState<Routine | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'personal' | 'group'>('personal')

  useEffect(() => {
    if (!loading) return
    const timer = setTimeout(() => {
      setLoading(false)
      setError('데이터를 불러오는데 시간이 너무 오래 걸립니다.')
    }, 10000)
    return () => clearTimeout(timer)
  }, [loading])

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadRoutines(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading])

  const loadRoutines = async (uid: string) => {
    setError('')
    try {
      console.log('[Dalli] [Routine] 루틴 쿼리 시작')
      const { data, error: fetchError } = await supabase
        .from('routines')
        .select('*')
        .eq('user_id', uid)
        .order('created_at', { ascending: false })

      if (fetchError) {
        console.error('[Dalli] [Routine] 루틴 쿼리 에러:', fetchError)
        setError('데이터를 불러오는데 실패했습니다. 다시 시도해주세요.')
        return
      }
      console.log('[Dalli] [Routine] 루틴 쿼리 완료:', data?.length)

      if (data) {
        setRoutines(data as Routine[])

        const { start, end } = getWeekRange()
        console.log('[Dalli] [Routine] 인증 쿼리 시작')
        const { data: verifications, error: verifsError } = await supabase
          .from('verifications')
          .select('routine_id')
          .eq('user_id', uid)
          .gte('verified_at', start.toISOString())
          .lte('verified_at', end.toISOString())

        if (verifsError) {
          console.error('[Dalli] [Routine] 인증 쿼리 에러:', verifsError)
        } else {
          console.log('[Dalli] [Routine] 인증 쿼리 완료:', verifications?.length)
        }

        if (verifications) {
          const counts: Record<string, number> = {}
          ;(verifications as { routine_id: string }[]).forEach((v) => {
            counts[v.routine_id] = (counts[v.routine_id] || 0) + 1
          })
          setWeeklyVerifications(counts)
        }
      }
    } catch (err) {
      console.error('[Dalli] [Routine] 데이터 로드 실패:', err)
      setError('데이터를 불러오는데 실패했습니다. 다시 시도해주세요.')
    } finally {
      setLoading(false)
    }
  }

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
        <ErrorRetry error={error} onRetry={() => { setError(''); setLoading(true); if (user) loadRoutines(user.id) }} />
      </>
    )
  }

  const personalRoutines = routines.filter((r) => r.type === 'personal')
  const groupRoutines = routines.filter((r) => r.type === 'group')
  const displayRoutines = tab === 'personal' ? personalRoutines : groupRoutines

  return (
    <>
      <Header
        title="내 루틴"
        rightAction={
          <Link href="/routine/new">
            <button className="p-1 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            </button>
          </Link>
        }
      />

      <div className="px-4 pt-4">
        {/* 탭 */}
        <div className="flex gap-1 bg-bg rounded-xl p-1 mb-4">
          <button
            onClick={() => setTab('personal')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'personal' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
          >
            개인 ({personalRoutines.length})
          </button>
          <button
            onClick={() => setTab('group')}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${tab === 'group' ? 'bg-bg-card text-text shadow-sm' : 'text-text-muted'}`}
          >
            그룹 ({groupRoutines.length})
          </button>
        </div>

        {displayRoutines.length === 0 ? (
          <EmptyState
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                <path fillRule="evenodd" d="M2.25 12c0-5.385 4.365-9.75 9.75-9.75s9.75 4.365 9.75 9.75-4.365 9.75-9.75 9.75S2.25 17.385 2.25 12zm13.36-1.814a.75.75 0 10-1.22-.872l-3.236 4.53L9.53 12.22a.75.75 0 00-1.06 1.06l2.25 2.25a.75.75 0 001.14-.094l3.75-5.25z" clipRule="evenodd" />
              </svg>
            }
            title={tab === 'personal' ? '개인 루틴이 없어요' : '그룹 루틴이 없어요'}
            description={tab === 'personal' ? '첫 번째 루틴을 만들어보세요!' : '그룹에 참여하면 그룹 루틴이 표시됩니다.'}
            action={
              tab === 'personal' ? (
                <Link href="/routine/new"><Button>루틴 만들기</Button></Link>
              ) : (
                <Link href="/group"><Button>그룹 보기</Button></Link>
              )
            }
          />
        ) : (
          <div className="space-y-3">
            {displayRoutines.map((routine) => {
              const done = weeklyVerifications[routine.id] || 0
              const target = FREQUENCY_TARGETS[routine.frequency]
              const rate = Math.min(Math.round((done / target) * 100), 100)

              return (
                <Card key={routine.id} hover onClick={() => window.location.href = `/routine/${routine.id}`}>
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
                        {routine.type === 'group' && (
                          <span className="text-xs px-2 py-0.5 bg-warning/10 text-warning rounded-full font-medium">그룹</span>
                        )}
                      </div>
                    </div>
                    {routine.type === 'personal' && (
                      <div className="flex items-center gap-1 ml-2">
                        <button onClick={(e) => { e.stopPropagation(); handleEdit(routine) }} className="p-1.5 text-text-muted hover:text-primary rounded-lg hover:bg-bg transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path d="M2.695 14.763l-1.262 3.154a.5.5 0 00.65.65l3.155-1.262a4 4 0 001.343-.885L17.5 5.5a2.121 2.121 0 00-3-3L3.58 13.42a4 4 0 00-.885 1.343z" />
                          </svg>
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete(routine.id) }} className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-bg transition-colors">
                          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                            <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                          </svg>
                        </button>
                      </div>
                    )}
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
            })}
          </div>
        )}
      </div>

      <Modal isOpen={!!editingRoutine} onClose={() => setEditingRoutine(null)} title="루틴 수정">
        <div className="space-y-4">
          <Input label="루틴 이름" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="루틴 이름을 입력하세요" />
          <Button fullWidth onClick={handleSaveEdit} loading={saving}>저장하기</Button>
        </div>
      </Modal>
    </>
  )
}
