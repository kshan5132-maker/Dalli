'use client'

import { useEffect, useState, useRef, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Modal from '@/components/Modal'
import ErrorRetry from '@/components/ErrorRetry'
import { GroupDetailSkeleton } from '@/components/Skeleton'
import type { Group, GroupMember, Profile, Routine, RoutineFrequency, VerificationType } from '@/lib/types'
import { FREQUENCY_LABELS, VERIFICATION_TYPE_LABELS } from '@/lib/types'

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

const frequencies: RoutineFrequency[] = ['daily', 'weekly_3', 'weekly_5', 'weekdays', 'weekends']
const verificationTypes: VerificationType[] = ['photo', 'check']

export default function GroupSettingsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()

  // Data state
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<(GroupMember & { profiles: Profile })[]>([])
  const [routines, setRoutines] = useState<Routine[]>([])
  const [myRole, setMyRole] = useState<'admin' | 'member' | null>(null)

  // Edit state
  const [editName, setEditName] = useState('')
  const [editDescription, setEditDescription] = useState('')
  const [editPenalty, setEditPenalty] = useState('10000')
  const [editSettlementCycle, setEditSettlementCycle] = useState<'weekly' | 'monthly'>('weekly')
  const [editSettlementDay, setEditSettlementDay] = useState('monday')

  // UI state
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  // Delete group modal
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)

  // Kick member modal
  const [kickTarget, setKickTarget] = useState<(GroupMember & { profiles: Profile }) | null>(null)
  const [kicking, setKicking] = useState(false)

  // Invite code
  const [copied, setCopied] = useState(false)

  // New routine
  const [showAddRoutine, setShowAddRoutine] = useState(false)
  const [newRoutineTitle, setNewRoutineTitle] = useState('')
  const [newRoutineFrequency, setNewRoutineFrequency] = useState<RoutineFrequency>('daily')
  const [newRoutineVerification, setNewRoutineVerification] = useState<VerificationType>('photo')
  const [addingRoutine, setAddingRoutine] = useState(false)

  // Delete routine
  const [deletingRoutineId, setDeletingRoutineId] = useState<string | null>(null)

  // Group photo
  const groupPhotoRef = useRef<HTMLInputElement>(null)
  const [uploadingGroupPhoto, setUploadingGroupPhoto] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadData(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, id])

  const loadData = async (uid: string) => {
    setError('')
    setLoading(true)

    try {
      const [groupRes, membersRes, routinesRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', id),
        supabase.from('group_members').select('*, profiles(*)').eq('group_id', id),
        supabase.from('routines').select('*').eq('group_id', id).eq('type', 'group').order('created_at', { ascending: true }),
      ])

      const groupData = groupRes.data?.[0] || null
      if (groupRes.error || !groupData) {
        setError('그룹을 찾을 수 없습니다.')
        return
      }

      const memberList = (membersRes.data || []) as unknown as (GroupMember & { profiles: Profile })[]
      const myMembership = memberList.find((m) => m.user_id === uid)

      if (myMembership?.role !== 'admin') {
        router.replace(`/group/${id}`)
        return
      }

      setGroup(groupData as Group)
      setMembers(memberList)
      setMyRole(myMembership.role)
      setRoutines((routinesRes.data || []) as Routine[])

      // Set edit state
      setEditName(groupData.name)
      setEditDescription(groupData.description || '')
      setEditPenalty(String(groupData.penalty_amount))
      setEditSettlementCycle(groupData.settlement_cycle || 'weekly')
      setEditSettlementDay(groupData.settlement_day || 'monday')
    } catch (err) {
      console.error('[Dalli] [GroupSettings] 데이터 로드 실패:', err)
      setError('데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // -- Save group info --
  const handleSave = async () => {
    if (!editName.trim() || !group) return
    setSaving(true)
    setSaveSuccess(false)

    try {
      const { error: updateError } = await supabase
        .from('groups')
        .update({
          name: editName.trim(),
          description: editDescription.trim() || null,
          penalty_amount: parseInt(editPenalty) || 10000,
          settlement_cycle: editSettlementCycle,
          settlement_day: editSettlementDay,
        })
        .eq('id', id)

      if (updateError) {
        setError('저장에 실패했습니다. 다시 시도해주세요.')
      } else {
        setGroup({
          ...group,
          name: editName.trim(),
          description: editDescription.trim() || null,
          penalty_amount: parseInt(editPenalty) || 10000,
          settlement_cycle: editSettlementCycle,
          settlement_day: editSettlementDay,
        })
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 2000)
      }
    } catch {
      setError('예기치 않은 오류가 발생했습니다.')
    } finally {
      setSaving(false)
    }
  }

  // -- Delete group --
  const handleDeleteGroup = async () => {
    if (!group || deleteConfirmText !== group.name) return
    setDeleting(true)

    try {
      const { error: deleteError } = await supabase
        .from('groups')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('[Dalli] [GroupSettings] 그룹 삭제 실패:', deleteError)
        setError('그룹 삭제에 실패했습니다.')
        setDeleting(false)
      } else {
        router.replace('/group')
      }
    } catch (err) {
      console.error('[Dalli] [GroupSettings] 그룹 삭제 예외:', err)
      setError('그룹 삭제에 실패했습니다.')
      setDeleting(false)
    }
  }

  // -- Kick member --
  const handleKickMember = async () => {
    if (!kickTarget) return
    setKicking(true)

    try {
      // Delete group_members row
      const { error: kickError } = await supabase
        .from('group_members')
        .delete()
        .eq('group_id', id)
        .eq('user_id', kickTarget.user_id)

      if (kickError) {
        console.error('[Dalli] [GroupSettings] 멤버 강퇴 실패:', kickError)
        setError('멤버 강퇴에 실패했습니다.')
      } else {
        // Also delete their group routines
        await supabase
          .from('routines')
          .delete()
          .eq('group_id', id)
          .eq('user_id', kickTarget.user_id)
          .eq('type', 'group')

        setMembers((prev) => prev.filter((m) => m.user_id !== kickTarget.user_id))
        setRoutines((prev) => prev.filter((r) => r.user_id !== kickTarget.user_id))
      }
    } catch (err) {
      console.error('[Dalli] [GroupSettings] 멤버 강퇴 예외:', err)
      setError('멤버 강퇴에 실패했습니다.')
    } finally {
      setKicking(false)
      setKickTarget(null)
    }
  }

  // -- Copy invite code --
  const handleCopyCode = async () => {
    if (!group) return
    try {
      await navigator.clipboard.writeText(group.invite_code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      const textArea = document.createElement('textarea')
      textArea.value = group.invite_code
      document.body.appendChild(textArea)
      textArea.select()
      document.execCommand('copy')
      document.body.removeChild(textArea)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  // -- Add routine --
  const handleAddRoutine = async () => {
    if (!newRoutineTitle.trim() || !user) return
    setAddingRoutine(true)

    try {
      const { data: rows, error: insertError } = await supabase
        .from('routines')
        .insert({
          user_id: user.id,
          title: newRoutineTitle.trim(),
          frequency: newRoutineFrequency,
          verification_type: newRoutineVerification,
          type: 'group',
          group_id: id,
        })
        .select('*')

      if (insertError) {
        setError('루틴 추가에 실패했습니다.')
      } else if (rows?.[0]) {
        setRoutines((prev) => [...prev, rows[0] as Routine])
        setNewRoutineTitle('')
        setNewRoutineFrequency('daily')
        setNewRoutineVerification('photo')
        setShowAddRoutine(false)
      }
    } catch {
      setError('루틴 추가에 실패했습니다.')
    } finally {
      setAddingRoutine(false)
    }
  }

  // -- Delete routine --
  const handleDeleteRoutine = async (routineId: string) => {
    setDeletingRoutineId(routineId)

    try {
      const { error: deleteError } = await supabase
        .from('routines')
        .delete()
        .eq('id', routineId)

      if (!deleteError) {
        setRoutines((prev) => prev.filter((r) => r.id !== routineId))
      } else {
        setError('루틴 삭제에 실패했습니다.')
      }
    } catch {
      setError('루틴 삭제에 실패했습니다.')
    } finally {
      setDeletingRoutineId(null)
    }
  }

  // -- Upload group photo --
  const handleGroupPhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !user) return

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type)) {
      setError('JPG, PNG, WebP 형식의 이미지만 업로드할 수 있습니다.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('5MB 이하의 이미지만 업로드할 수 있습니다.')
      return
    }

    setUploadingGroupPhoto(true)
    setError('')

    try {
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const fileName = `groups/${id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        setError('사진 업로드에 실패했습니다.')
        setUploadingGroupPhoto(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase
        .from('groups')
        .update({ avatar_url: avatarUrl })
        .eq('id', id)

      if (updateError) {
        setError('그룹 정보 업데이트에 실패했습니다.')
      } else {
        setGroup(prev => prev ? { ...prev, avatar_url: avatarUrl } : prev)
      }
    } catch {
      setError('사진 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingGroupPhoto(false)
    }
  }

  // -- Loading --
  if (loading) {
    return (
      <>
        <Header title="그룹 설정" showBack />
        <GroupDetailSkeleton />
      </>
    )
  }

  // -- Error --
  if (error && !group) {
    return (
      <>
        <Header title="그룹 설정" showBack />
        <ErrorRetry
          error={error}
          onRetry={() => { if (user) loadData(user.id) }}
        />
      </>
    )
  }

  if (!group || myRole !== 'admin') return null

  return (
    <>
      <Header title="그룹 설정" showBack />

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

        {/* ====== Group Info Section ====== */}
        <section>
          <h2 className="text-sm font-bold text-text mb-3">그룹 정보</h2>
          <Card className="space-y-4">
            {/* 그룹 프로필 사진 */}
            <div className="flex flex-col items-center">
              <input ref={groupPhotoRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleGroupPhotoUpload} className="hidden" />
              <button onClick={() => groupPhotoRef.current?.click()} disabled={uploadingGroupPhoto} className="relative group">
                <div className="w-16 h-16 rounded-xl overflow-hidden">
                  {group.avatar_url ? (
                    <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-xl">
                      {group.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div className="absolute inset-0 rounded-xl bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  {uploadingGroupPhoto ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-white">
                      <path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                  )}
                </div>
              </button>
              <p className="text-xs text-text-muted mt-1">사진을 눌러서 변경</p>
            </div>

            <Input
              label="그룹 이름"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="그룹 이름을 입력하세요"
              maxLength={30}
            />

            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                그룹 설명 <span className="text-text-muted">(선택)</span>
              </label>
              <textarea
                className="w-full px-4 py-2.5 text-sm bg-bg border border-border rounded-xl outline-none focus:border-primary transition-colors placeholder:text-text-muted resize-none"
                rows={3}
                placeholder="그룹의 규칙이나 목표를 적어주세요"
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                maxLength={200}
              />
            </div>

            {/* Penalty */}
            <div>
              <label className="block text-sm font-medium text-text mb-1.5">
                미달성 벌금 (원)
              </label>
              <div className="grid grid-cols-3 gap-2 mb-2">
                {PENALTY_PRESETS.map((amount) => (
                  <button
                    key={amount}
                    type="button"
                    onClick={() => setEditPenalty(amount)}
                    className={`py-2 rounded-xl text-sm font-medium transition-all ${
                      editPenalty === amount
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
                value={editPenalty}
                onChange={(e) => setEditPenalty(e.target.value)}
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
                  onClick={() => setEditSettlementCycle('weekly')}
                  className={`py-3 rounded-xl text-sm font-medium transition-all ${
                    editSettlementCycle === 'weekly'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                  }`}
                >
                  주간
                </button>
                <button
                  type="button"
                  onClick={() => setEditSettlementCycle('monthly')}
                  className={`py-3 rounded-xl text-sm font-medium transition-all ${
                    editSettlementCycle === 'monthly'
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                  }`}
                >
                  월간
                </button>
              </div>
            </div>

            {/* Settlement Day */}
            {editSettlementCycle === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-text mb-2">
                  정산 시작 요일
                </label>
                <div className="grid grid-cols-7 gap-1.5">
                  {SETTLEMENT_DAYS.map((day) => (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => setEditSettlementDay(day.value)}
                      className={`py-2.5 rounded-xl text-sm font-medium transition-all ${
                        editSettlementDay === day.value
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

            <Button fullWidth onClick={handleSave} loading={saving}>
              {saveSuccess ? '저장 완료!' : '변경사항 저장'}
            </Button>
          </Card>
        </section>

        {/* ====== Invite Code Section ====== */}
        <section>
          <h2 className="text-sm font-bold text-text mb-3">초대 코드</h2>
          <Card>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold tracking-[0.2em] text-primary">
                  {group.invite_code}
                </p>
                <p className="text-xs text-text-muted mt-1">
                  이 코드를 친구에게 공유하세요
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={handleCopyCode}>
                {copied ? '복사됨!' : '복사'}
              </Button>
            </div>
          </Card>
        </section>

        {/* ====== Routines Section ====== */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold text-text">
              그룹 루틴 ({routines.length})
            </h2>
            <button
              onClick={() => setShowAddRoutine(true)}
              className="text-xs text-primary font-medium"
            >
              + 추가
            </button>
          </div>

          {routines.length === 0 ? (
            <Card>
              <div className="text-center py-4">
                <p className="text-sm text-text-muted">등록된 그룹 루틴이 없습니다</p>
                <button
                  onClick={() => setShowAddRoutine(true)}
                  className="mt-2 text-sm text-primary font-medium"
                >
                  루틴 추가하기
                </button>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              {routines.map((routine) => (
                <Card key={routine.id} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate">{routine.title}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                        {FREQUENCY_LABELS[routine.frequency]}
                      </span>
                      <span className="text-xs px-2 py-0.5 bg-secondary/10 text-secondary rounded-full font-medium">
                        {VERIFICATION_TYPE_LABELS[routine.verification_type]}
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => handleDeleteRoutine(routine.id)}
                    disabled={deletingRoutineId === routine.id}
                    className="p-1.5 text-text-muted hover:text-danger rounded-lg hover:bg-bg transition-colors ml-2 disabled:opacity-50"
                  >
                    {deletingRoutineId === routine.id ? (
                      <div className="w-4 h-4 border-2 border-danger border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                        <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.52.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                      </svg>
                    )}
                  </button>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* ====== Members Section ====== */}
        <section>
          <h2 className="text-sm font-bold text-text mb-3">
            멤버 관리 ({members.length}명)
          </h2>
          <div className="space-y-2">
            {members.map((member) => {
              const isAdmin = member.role === 'admin'
              const isMe = member.user_id === user?.id

              return (
                <Card key={member.user_id} className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-sm font-bold shrink-0">
                    {member.profiles?.nickname?.charAt(0) || '?'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold truncate">
                        {member.profiles?.nickname || '알 수 없음'}
                      </p>
                      {isAdmin && (
                        <span className="px-1.5 py-0.5 bg-primary/10 text-primary text-[10px] font-semibold rounded-full shrink-0">
                          관리자
                        </span>
                      )}
                      {isMe && (
                        <span className="px-1.5 py-0.5 bg-bg text-text-muted text-[10px] font-medium rounded-full shrink-0">
                          나
                        </span>
                      )}
                    </div>
                  </div>
                  {!isAdmin && !isMe && (
                    <button
                      onClick={() => setKickTarget(member)}
                      className="px-3 py-1.5 text-xs font-medium text-danger bg-danger/10 rounded-lg hover:bg-danger/20 transition-colors shrink-0"
                    >
                      강퇴
                    </button>
                  )}
                </Card>
              )
            })}
          </div>
        </section>

        {/* ====== Danger Zone ====== */}
        <section>
          <h2 className="text-sm font-bold text-danger mb-3">위험 구역</h2>
          <Card className="border-danger/20">
            <p className="text-sm text-text-secondary mb-3">
              그룹을 삭제하면 모든 멤버, 루틴, 인증 기록, 채팅이 영구적으로 삭제됩니다.
              이 작업은 되돌릴 수 없습니다.
            </p>
            <Button
              variant="danger"
              fullWidth
              onClick={() => setShowDeleteModal(true)}
            >
              그룹 삭제하기
            </Button>
          </Card>
        </section>
      </div>

      {/* ====== Delete Group Modal ====== */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => { setShowDeleteModal(false); setDeleteConfirmText('') }}
        title="그룹 삭제"
      >
        <div className="space-y-4">
          <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
            <p className="text-sm text-danger font-medium">
              이 작업은 되돌릴 수 없습니다!
            </p>
            <p className="text-xs text-danger/80 mt-1">
              모든 멤버, 루틴, 인증 기록, 채팅 메시지가 영구적으로 삭제됩니다.
            </p>
          </div>
          <div>
            <p className="text-sm text-text-secondary mb-2">
              확인을 위해 그룹 이름 <span className="font-bold text-text">{group.name}</span>을 입력하세요.
            </p>
            <Input
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder={group.name}
            />
          </div>
          <Button
            variant="danger"
            fullWidth
            onClick={handleDeleteGroup}
            loading={deleting}
            disabled={deleteConfirmText !== group.name}
          >
            영구 삭제
          </Button>
        </div>
      </Modal>

      {/* ====== Kick Member Modal ====== */}
      <Modal
        isOpen={!!kickTarget}
        onClose={() => setKickTarget(null)}
        title="멤버 강퇴"
      >
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            <span className="font-bold text-text">
              {kickTarget?.profiles?.nickname || '알 수 없음'}
            </span>
            님을 그룹에서 강퇴하시겠습니까?
          </p>
          <p className="text-xs text-text-muted">
            해당 멤버의 그룹 루틴도 함께 삭제됩니다.
          </p>
          <div className="flex gap-2">
            <Button
              variant="ghost"
              fullWidth
              onClick={() => setKickTarget(null)}
            >
              취소
            </Button>
            <Button
              variant="danger"
              fullWidth
              onClick={handleKickMember}
              loading={kicking}
            >
              강퇴하기
            </Button>
          </div>
        </div>
      </Modal>

      {/* ====== Add Routine Modal ====== */}
      <Modal
        isOpen={showAddRoutine}
        onClose={() => { setShowAddRoutine(false); setNewRoutineTitle('') }}
        title="그룹 루틴 추가"
      >
        <div className="space-y-4">
          <Input
            label="루틴 이름"
            value={newRoutineTitle}
            onChange={(e) => setNewRoutineTitle(e.target.value)}
            placeholder="예: 운동 30분, 독서 1시간"
            maxLength={30}
          />

          {/* Frequency */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              인증 주기
            </label>
            <div className="flex flex-wrap gap-1.5">
              {frequencies.map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setNewRoutineFrequency(f)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    newRoutineFrequency === f
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
            <label className="block text-xs font-medium text-text-secondary mb-1.5">
              인증 방식
            </label>
            <div className="flex gap-1.5">
              {verificationTypes.map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => setNewRoutineVerification(v)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    newRoutineVerification === v
                      ? 'bg-primary text-white shadow-sm shadow-primary/20'
                      : 'bg-bg text-text-secondary border border-border hover:border-primary/30'
                  }`}
                >
                  {VERIFICATION_TYPE_LABELS[v]}
                </button>
              ))}
            </div>
          </div>

          <Button
            fullWidth
            onClick={handleAddRoutine}
            loading={addingRoutine}
            disabled={!newRoutineTitle.trim()}
          >
            추가하기
          </Button>
        </div>
      </Modal>
    </>
  )
}
