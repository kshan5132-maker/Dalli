'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Button from '@/components/Button'
import Card from '@/components/Card'
import Input from '@/components/Input'
import Modal from '@/components/Modal'
import ErrorRetry from '@/components/ErrorRetry'
import { RoutineListSkeleton } from '@/components/Skeleton'
import type { Routine, RoutineFrequency, VerificationType } from '@/lib/types'
import { FREQUENCY_LABELS, VERIFICATION_TYPE_LABELS } from '@/lib/types'

const frequencies: RoutineFrequency[] = ['daily', 'weekly_3', 'weekly_5', 'weekdays', 'weekends']
const verificationTypes: VerificationType[] = ['photo', 'check']

export default function RoutineSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()

  // Data state
  const [routine, setRoutine] = useState<Routine | null>(null)

  // Edit state
  const [title, setTitle] = useState('')
  const [frequency, setFrequency] = useState<RoutineFrequency>('daily')
  const [verificationType, setVerificationType] = useState<VerificationType>('photo')

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [error, setError] = useState('')

  // Delete modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadRoutine(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, id])

  const loadRoutine = async (uid: string) => {
    setError('')
    setLoading(true)

    try {
      const { data, error: fetchError } = await supabase
        .from('routines')
        .select('*')
        .eq('id', id)

      const routineData = data?.[0] || null

      if (fetchError || !routineData) {
        setError('루틴을 찾을 수 없습니다.')
        return
      }

      if (routineData.user_id !== uid || routineData.type !== 'personal') {
        router.replace('/routine')
        return
      }

      setRoutine(routineData as Routine)
      setTitle(routineData.title)
      setFrequency(routineData.frequency)
      setVerificationType(routineData.verification_type)
    } catch (err) {
      console.error('[Dalli] [RoutineSettings] 데이터 로드 실패:', err)
      setError('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // -- Save --
  const handleSave = async () => {
    if (!title.trim() || !routine) return
    setSaving(true)
    setSaveSuccess(false)
    setError('')

    try {
      const { error: updateError } = await supabase
        .from('routines')
        .update({
          title: title.trim(),
          frequency,
          verification_type: verificationType,
        })
        .eq('id', id)

      if (updateError) {
        setError('저장에 실패했습니다. 다시 시도해주세요.')
      } else {
        setRoutine({ ...routine, title: title.trim(), frequency, verification_type: verificationType })
        setSaveSuccess(true)
        setTimeout(() => {
          setSaveSuccess(false)
          router.push(`/routine/${id}`)
        }, 1200)
      }
    } catch {
      setError('예기치 않은 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // -- Delete --
  const handleDelete = async () => {
    setDeleting(true)

    try {
      const { error: deleteError } = await supabase
        .from('routines')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('[Dalli] [RoutineSettings] 루틴 삭제 실패:', deleteError)
        setError('루틴 삭제에 실패했습니다.')
        setDeleting(false)
        setShowDeleteModal(false)
      } else {
        router.replace('/routine')
      }
    } catch (err) {
      console.error('[Dalli] [RoutineSettings] 루틴 삭제 예외:', err)
      setError('루틴 삭제에 실패했습니다.')
      setDeleting(false)
      setShowDeleteModal(false)
    }
  }

  // -- Loading --
  if (loading) {
    return (
      <>
        <Header title="루틴 설정" showBack />
        <RoutineListSkeleton />
      </>
    )
  }

  // -- Fatal error (no routine loaded) --
  if (error && !routine) {
    return (
      <>
        <Header title="루틴 설정" showBack />
        <ErrorRetry
          error={error}
          onRetry={() => { if (user) loadRoutine(user.id) }}
        />
      </>
    )
  }

  if (!routine) return null

  return (
    <>
      <Header title="루틴 설정" showBack />

      <div className="px-4 pt-4 pb-10 space-y-6">
        {/* Error banner */}
        {error && (
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
            <p className="text-sm text-danger">{error}</p>
          </div>
        )}

        {/* Success banner */}
        {saveSuccess && (
          <div className="p-3 bg-success/10 border border-success/20 rounded-xl">
            <p className="text-sm text-success">저장되었습니다!</p>
          </div>
        )}

        {/* ====== Routine Info Section ====== */}
        <section>
          <h2 className="text-sm font-bold text-text mb-3">루틴 정보</h2>
          <Card className="space-y-5">
            {/* Title */}
            <Input
              label="루틴 이름"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 아침 운동, 물 2L 마시기"
              maxLength={30}
            />

            {/* Frequency */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">인증 주기</label>
              <div className="grid grid-cols-2 gap-2">
                {frequencies.map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFrequency(f)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all ${
                      frequency === f
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                    }`}
                  >
                    {FREQUENCY_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            {/* Verification Type */}
            <div>
              <label className="block text-sm font-medium text-text mb-2">인증 방식</label>
              <div className="grid grid-cols-2 gap-2">
                {verificationTypes.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVerificationType(v)}
                    className={`px-4 py-3 rounded-xl text-sm font-medium transition-all flex items-center justify-center gap-2 ${
                      verificationType === v
                        ? 'bg-primary text-white shadow-sm shadow-primary/20'
                        : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                    }`}
                  >
                    {v === 'photo' ? (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                      </svg>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                      </svg>
                    )}
                    {VERIFICATION_TYPE_LABELS[v]}
                  </button>
                ))}
              </div>
            </div>

            <Button fullWidth onClick={handleSave} loading={saving} disabled={!title.trim()}>
              {saveSuccess ? '저장 완료!' : '변경사항 저장'}
            </Button>
          </Card>
        </section>

        {/* ====== Danger Zone ====== */}
        <section>
          <h2 className="text-sm font-bold text-danger mb-3">위험 구역</h2>
          <Card className="border-danger/30 bg-danger/5">
            <p className="text-sm text-text-secondary mb-3">
              루틴을 삭제하면 모든 인증 기록이 영구적으로 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </p>
            <Button
              variant="danger"
              fullWidth
              onClick={() => setShowDeleteModal(true)}
            >
              루틴 삭제
            </Button>
          </Card>
        </section>
      </div>

      {/* ====== Delete Confirm Modal ====== */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="루틴 삭제"
      >
        <div className="space-y-4">
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
            <p className="text-sm text-danger font-medium">
              이 작업은 되돌릴 수 없습니다!
            </p>
            <p className="text-xs text-danger/80 mt-1">
              루틴과 관련된 모든 인증 기록이 영구적으로 삭제됩니다.
            </p>
          </div>
          <p className="text-sm text-text-secondary">
            <span className="font-bold text-text">{routine.title}</span> 루틴을 정말 삭제하시겠습니까?
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setShowDeleteModal(false)}
              disabled={deleting}
            >
              취소
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleDelete}
              loading={deleting}
            >
              삭제하기
            </Button>
          </div>
        </div>
      </Modal>
    </>
  )
}
