'use client'

import { useEffect, useState, useRef, useCallback, use } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Card from '@/components/Card'
import Button from '@/components/Button'
import Modal from '@/components/Modal'
import ErrorRetry from '@/components/ErrorRetry'
import { GroupDetailSkeleton } from '@/components/Skeleton'
import Input from '@/components/Input'
import type { Group, GroupMember, Routine, Verification, Message, Profile } from '@/lib/types'
import { FREQUENCY_TARGETS } from '@/lib/types'
import { getWeekRange, formatDate } from '@/lib/utils'

type TabType = 'feed' | 'members' | 'mission' | 'chat'

type MemberStats = {
  profile: Profile
  userId: string
  weeklyDone: number
  weeklyTarget: number
  rate: number
  penalty: boolean
}

export default function GroupDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()

  // -- State --
  const [group, setGroup] = useState<Group | null>(null)
  const [members, setMembers] = useState<(GroupMember & { profiles: Profile })[]>([])
  const [memberStats, setMemberStats] = useState<MemberStats[]>([])
  const [feed, setFeed] = useState<(Verification & { profiles: Profile; routines: Routine })[]>([])
  const [messages, setMessages] = useState<(Message & { profiles: Profile })[]>([])
  const [myRole, setMyRole] = useState<'admin' | 'member' | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>('feed')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showInvite, setShowInvite] = useState(false)
  const [copied, setCopied] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [sendingChat, setSendingChat] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Memo edit state
  const [editingMemoId, setEditingMemoId] = useState<string | null>(null)
  const [editMemoText, setEditMemoText] = useState('')
  const [savingMemo, setSavingMemo] = useState(false)

  // Photo viewer state
  const [viewingPhoto, setViewingPhoto] = useState<(Verification & { profiles: Profile; routines: Routine }) | null>(null)

  // Description expand state
  const [descExpanded, setDescExpanded] = useState(false)

  // Group routines for mission matrix
  const [groupRoutines, setGroupRoutines] = useState<Routine[]>([])

  // Weekly verifications with day info for mission matrix
  const [weeklyVerifMatrix, setWeeklyVerifMatrix] = useState<{ user_id: string; routine_id: string; verified_at: string }[]>([])

  const chatContainerRef = useRef<HTMLDivElement>(null)
  const chatBottomRef = useRef<HTMLDivElement>(null)

  // -- Initialize: useAuth()에서 인증 정보 가져오기 --
  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.replace('/login')
      return
    }
    loadGroupData(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, id])

  const loadGroupData = async (uid: string) => {
    setError('')
    setLoading(true)

    try {
      console.log('[Dalli] [GroupDetail] group + members 쿼리 시작')
      const [groupRes, membersRes] = await Promise.all([
        supabase.from('groups').select('*').eq('id', id),
        supabase.from('group_members').select('*, profiles(*)').eq('group_id', id),
      ])
      console.log('[Dalli] [GroupDetail] group + members 쿼리 완료:', { groupCount: groupRes.data?.length, membersCount: membersRes.data?.length })

      const groupData = groupRes.data?.[0] || null
      if (groupRes.error || !groupData) {
        setError('그룹을 찾을 수 없습니다.')
        return
      }
      setGroup(groupData)

      const memberList = (membersRes.data || []) as unknown as (GroupMember & { profiles: Profile })[]
      setMembers(memberList)

      // Determine current user's role
      const myMembership = memberList.find((m) => m.user_id === uid)
      setMyRole(myMembership?.role || null)

      // Load feed (verifications)
      console.log('[Dalli] [GroupDetail] verifications 쿼리 시작')
      const { data: verifications } = await supabase
        .from('verifications')
        .select('*, profiles(*), routines(*)')
        .eq('group_id', id)
        .order('verified_at', { ascending: false })
        .limit(50)
      console.log('[Dalli] [GroupDetail] verifications 쿼리 완료', verifications?.length)

      if (verifications) {
        setFeed(verifications as unknown as (Verification & { profiles: Profile; routines: Routine })[])
      }

      // Compute weekly member stats
      const { start, end } = getWeekRange()

      // Get group routines (type='group', group_id = this group)
      console.log('[Dalli] [GroupDetail] groupRoutines 쿼리 시작')
      const { data: groupRoutines } = await supabase
        .from('routines')
        .select('*')
        .eq('type', 'group')
        .eq('group_id', id)
      console.log('[Dalli] [GroupDetail] groupRoutines 쿼리 완료', groupRoutines?.length)

      // Weekly verifications for this group
      console.log('[Dalli] [GroupDetail] weeklyVerifications 쿼리 시작')
      const { data: weeklyVerifications } = await supabase
        .from('verifications')
        .select('user_id, routine_id, verified_at')
        .eq('group_id', id)
        .gte('verified_at', start.toISOString())
        .lte('verified_at', end.toISOString())
      console.log('[Dalli] [GroupDetail] weeklyVerifications 쿼리 완료', weeklyVerifications?.length)

      // 그룹 루틴은 모든 멤버에게 공유됨 → 목표 횟수는 전체 그룹 루틴의 frequency 합산
      const allGroupRoutines = groupRoutines || []
      setGroupRoutines(allGroupRoutines as Routine[])
      setWeeklyVerifMatrix((weeklyVerifications || []) as { user_id: string; routine_id: string; verified_at: string }[])
      const sharedWeeklyTarget = allGroupRoutines.reduce(
        (sum, r) => sum + (FREQUENCY_TARGETS[r.frequency as keyof typeof FREQUENCY_TARGETS] || 0),
        0
      )

      const stats: MemberStats[] = memberList.map((member) => {
        const profile = member.profiles!
        const weeklyDone = (weeklyVerifications || []).filter(
          (v) => v.user_id === member.user_id
        ).length
        const rate = sharedWeeklyTarget > 0 ? Math.round((weeklyDone / sharedWeeklyTarget) * 100) : 0

        return {
          profile,
          userId: member.user_id,
          weeklyDone,
          weeklyTarget: sharedWeeklyTarget,
          rate,
          penalty: sharedWeeklyTarget > 0 && rate < 100,
        }
      })

      stats.sort((a, b) => b.rate - a.rate)
      setMemberStats(stats)
    } catch (err) {
      console.error('[Dalli] [GroupDetail] 데이터 로드 실패:', err)
      setError('그룹 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // -- Load chat messages --
  const loadMessages = useCallback(async () => {
    if (!user) return
    try {
      console.log('[Dalli] [GroupDetail] messages 쿼리 시작')
      const { data } = await supabase
        .from('messages')
        .select('*, profiles(*)')
        .eq('group_id', id)
        .order('created_at', { ascending: true })
        .limit(100)
      console.log('[Dalli] [GroupDetail] messages 쿼리 완료', data?.length)

      if (data) {
        setMessages(data as unknown as (Message & { profiles: Profile })[])
      }
    } catch (err) {
      console.error('[Dalli] [GroupDetail] 메시지 로드 실패:', err)
    }
  }, [id, user, supabase])

  // -- Load messages when chat tab is selected --
  useEffect(() => {
    if (activeTab === 'chat' && user) {
      loadMessages()
    }
  }, [activeTab, user, loadMessages])

  // -- Supabase Realtime subscription for chat --
  useEffect(() => {
    if (activeTab !== 'chat' || !user) return

    const channel = supabase
      .channel(`group-chat-${id}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `group_id=eq.${id}`,
        },
        async (payload) => {
          // Fetch the full message with profile
          const { data: msgRows } = await supabase
            .from('messages')
            .select('*, profiles(*)')
            .eq('id', payload.new.id)
          const data = msgRows?.[0] || null

          if (data) {
            setMessages((prev) => {
              // Avoid duplicates
              if (prev.some((m) => m.id === data.id)) return prev
              return [...prev, data as unknown as Message & { profiles: Profile }]
            })
          }
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [activeTab, id, user, supabase])

  // -- Auto-scroll to bottom on new messages --
  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages])

  // -- Send chat message --
  const handleSendMessage = async () => {
    if (!chatInput.trim() || !user || sendingChat) return
    setSendingChat(true)
    const content = chatInput.trim()
    setChatInput('')

    try {
      const { error: sendError } = await supabase
        .from('messages')
        .insert({ group_id: id, user_id: user.id, content })

      if (sendError) {
        console.error('[Dalli] [GroupDetail] 메시지 전송 실패:', sendError)
        setChatInput(content) // Restore input on failure
      }
    } catch (err) {
      console.error('[Dalli] [GroupDetail] 메시지 전송 예외:', err)
      setChatInput(content)
    } finally {
      setSendingChat(false)
    }
  }

  // -- Handle key press in chat input --
  const handleChatKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.nativeEvent.isComposing) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // -- Delete verification (admin only) --
  const handleDeleteVerification = async (verificationId: string) => {
    if (myRole !== 'admin') return
    setDeletingId(verificationId)
    try {
      const { error: deleteError } = await supabase
        .from('verifications')
        .delete()
        .eq('id', verificationId)

      if (!deleteError) {
        setFeed((prev) => prev.filter((v) => v.id !== verificationId))
      } else {
        console.error('[Dalli] [GroupDetail] 인증 삭제 실패:', deleteError)
      }
    } catch (err) {
      console.error('[Dalli] [GroupDetail] 인증 삭제 예외:', err)
    } finally {
      setDeletingId(null)
    }
  }

  // -- Edit verification memo (own, same day only) --
  const handleStartEditMemo = (v: Verification & { profiles: Profile; routines: Routine }) => {
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
          prev.map((v) =>
            v.id === editingMemoId ? { ...v, memo: editMemoText.trim() || null } : v
          )
        )
      }
    } catch (err) {
      console.error('[Dalli] [GroupDetail] 메모 수정 실패:', err)
    } finally {
      setSavingMemo(false)
      setEditingMemoId(null)
      setEditMemoText('')
    }
  }

  const isToday = (dateStr: string) => {
    return new Date(dateStr).toDateString() === new Date().toDateString()
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

  // -- Format chat time --
  const formatChatTime = (dateStr: string) => {
    const date = new Date(dateStr)
    const hours = date.getHours()
    const minutes = date.getMinutes().toString().padStart(2, '0')
    const ampm = hours < 12 ? '오전' : '오후'
    const displayHour = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours
    return `${ampm} ${displayHour}:${minutes}`
  }

  // -- Loading state --
  if (loading) {
    return (
      <>
        <Header title="그룹" showBack />
        <GroupDetailSkeleton />
      </>
    )
  }

  // -- Error state --
  if (error || !group) {
    return (
      <>
        <Header title="그룹" showBack />
        <ErrorRetry
          error={error || '그룹을 찾을 수 없습니다.'}
          onRetry={() => {
            if (user) loadGroupData(user.id)
          }}
        />
      </>
    )
  }

  const tabs: { key: TabType; label: string }[] = [
    { key: 'feed', label: '피드' },
    { key: 'members', label: '멤버' },
    { key: 'mission', label: '미션현황' },
    { key: 'chat', label: '채팅' },
  ]

  return (
    <>
      <Header
        title={group.name}
        showBack
        rightAction={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowInvite(true)}
              className="p-1 text-primary"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                <path d="M13 4.5a2.5 2.5 0 11.702 1.737L6.97 9.604a2.518 2.518 0 010 .799l6.733 3.366a2.5 2.5 0 11-.671 1.341l-6.733-3.366a2.5 2.5 0 110-3.482l6.733-3.366A2.52 2.52 0 0113 4.5z" />
              </svg>
            </button>
            {myRole === 'admin' && (
              <Link href={`/group/${id}/settings`} className="p-1 text-text-secondary hover:text-primary transition-colors">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                  <path fillRule="evenodd" d="M7.84 1.804A1 1 0 018.82 1h2.36a1 1 0 01.98.804l.331 1.652a6.993 6.993 0 011.929 1.115l1.598-.54a1 1 0 011.186.447l1.18 2.044a1 1 0 01-.205 1.251l-1.267 1.113a7.047 7.047 0 010 2.228l1.267 1.113a1 1 0 01.206 1.25l-1.18 2.045a1 1 0 01-1.187.447l-1.598-.54a6.993 6.993 0 01-1.929 1.115l-.33 1.652a1 1 0 01-.98.804H8.82a1 1 0 01-.98-.804l-.331-1.652a6.993 6.993 0 01-1.929-1.115l-1.598.54a1 1 0 01-1.186-.447l-1.18-2.044a1 1 0 01.205-1.251l1.267-1.114a7.05 7.05 0 010-2.227L1.821 7.773a1 1 0 01-.206-1.25l1.18-2.045a1 1 0 011.187-.447l1.598.54A6.993 6.993 0 017.51 3.456l.33-1.652zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              </Link>
            )}
          </div>
        }
      />

      <div className={`px-4 pt-4 ${activeTab === 'chat' ? 'flex flex-col h-[calc(100dvh-56px)]' : ''}`}>
        {/* Group info card */}
        <Card className="mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl overflow-hidden shrink-0">
              {group.avatar_url ? (
                <img src={group.avatar_url} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-lg">
                  {group.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-text-muted">멤버 {members.length}명</p>
              <p className="text-xs text-warning font-medium mt-0.5">
                벌금 {group.penalty_amount.toLocaleString()}원
              </p>
            </div>
            {myRole === 'admin' && (
              <span className="px-2 py-0.5 bg-primary/10 text-primary text-xs font-semibold rounded-full shrink-0">
                관리자
              </span>
            )}
          </div>
          {group.description && (
            <div className="mt-2">
              <p className={`text-xs text-text-secondary whitespace-pre-wrap ${!descExpanded ? 'line-clamp-2' : ''}`}>
                {group.description}
              </p>
              {group.description.length > 60 && (
                <button
                  onClick={() => setDescExpanded(!descExpanded)}
                  className="text-xs text-primary font-medium mt-1"
                >
                  {descExpanded ? '접기' : '더보기'}
                </button>
              )}
            </div>
          )}
        </Card>

        {/* Tabs */}
        <div className="flex gap-1 bg-bg rounded-xl p-1 mb-4 shrink-0">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-bg-card text-text shadow-sm'
                  : 'text-text-muted'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ====== Feed Tab ====== */}
        {activeTab === 'feed' && (
          <div className="space-y-3 pb-6">
            {feed.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">
                아직 인증 기록이 없어요
              </div>
            ) : (
              feed.map((v) => {
                const isMine = v.user_id === user?.id
                const canEdit = isMine && isToday(v.verified_at)

                return (
                  <Card key={v.id}>
                    <div className="flex items-start gap-3">
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
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-semibold">
                              {v.profiles?.nickname || '알 수 없음'}
                            </span>
                            <span className="text-xs text-text-muted">
                              {formatDate(v.verified_at)}
                            </span>
                          </div>
                          <div className="flex items-center gap-1">
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
                            {myRole === 'admin' && (
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
                                    <path fillRule="evenodd" d="M8.75 1A2.75 2.75 0 006 3.75v.443c-.795.077-1.584.176-2.365.298a.75.75 0 10.23 1.482l.149-.022.841 10.518A2.75 2.75 0 007.596 19h4.807a2.75 2.75 0 002.742-2.53l.841-10.519.149.023a.75.75 0 00.23-1.482A41.03 41.03 0 0014 4.193V3.75A2.75 2.75 0 0011.25 1h-2.5zM10 4c.84 0 1.673.025 2.5.075V3.75c0-.69-.56-1.25-1.25-1.25h-2.5c-.69 0-1.25.56-1.25 1.25v.325C8.327 4.025 9.16 4 10 4zM8.58 7.72a.75.75 0 00-1.5.06l.3 7.5a.75.75 0 101.5-.06l-.3-7.5zm4.34.06a.75.75 0 10-1.5-.06l-.3 7.5a.75.75 0 101.5.06l.3-7.5z" clipRule="evenodd" />
                                  </svg>
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-text-secondary mt-0.5">
                          <span className="text-primary font-medium">
                            {v.routines?.title || '루틴'}
                          </span>
                          을 인증했습니다
                        </p>
                        {v.memo && (
                          <p className="text-sm text-text mt-2">{v.memo}</p>
                        )}
                        {v.photo_url && (
                          <div className="mt-2 rounded-xl overflow-hidden cursor-pointer" onClick={() => setViewingPhoto(v)}>
                            <img
                              src={v.photo_url}
                              alt="인증 사진"
                              className="w-full h-40 object-cover"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* ====== Members Tab ====== */}
        {activeTab === 'members' && (
          <div className="space-y-2 pb-6">
            {members.length === 0 ? (
              <div className="text-center py-8 text-text-muted text-sm">
                멤버가 없습니다
              </div>
            ) : (
              members.map((member) => {
                const isAdmin = member.role === 'admin'
                return (
                  <Card key={member.user_id} className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0">
                      {member.profiles?.avatar_url ? (
                        <img src={member.profiles.avatar_url} alt={member.profiles.nickname || ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-sm font-bold">
                          {member.profiles?.nickname?.charAt(0) || '?'}
                        </div>
                      )}
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
                        {!isAdmin && (
                          <span className="px-1.5 py-0.5 bg-bg text-text-muted text-[10px] font-medium rounded-full shrink-0">
                            멤버
                          </span>
                        )}
                      </div>
                    </div>
                    {member.user_id === user?.id && (
                      <span className="text-xs text-primary font-medium shrink-0">나</span>
                    )}
                  </Card>
                )
              })
            )}
          </div>
        )}

        {/* ====== Mission Status Tab ====== */}
        {activeTab === 'mission' && (() => {
          const { start: weekStart } = getWeekRange()
          const dayLabels = ['월', '화', '수', '목', '금', '토', '일']
          // 요일별 날짜 계산
          const weekDates = dayLabels.map((_, idx) => {
            const d = new Date(weekStart)
            d.setDate(weekStart.getDate() + idx)
            return d
          })
          const today = new Date()
          const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1

          return (
            <div className="space-y-3 pb-6">
              <Card className="bg-gradient-to-br from-warning/10 to-warning/5 border-warning/20">
                <p className="text-sm font-bold text-warning mb-1">이번 주 미션 달성 현황</p>
                <p className="text-xs text-text-secondary">
                  주간 목표 미달성 시 벌금 {group.penalty_amount.toLocaleString()}원
                </p>
              </Card>

              {groupRoutines.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm">
                  그룹에 연결된 루틴이 없습니다
                </div>
              ) : (
                <>
                  {/* 루틴별 달성 매트릭스 */}
                  {groupRoutines.map((routine) => (
                    <Card key={routine.id}>
                      <p className="text-sm font-bold mb-2">{routine.title}</p>
                      {/* 요일 헤더 */}
                      <div className="grid grid-cols-8 gap-1 text-center mb-1">
                        <div className="text-[10px] text-text-muted"></div>
                        {dayLabels.map((d, i) => (
                          <div key={i} className={`text-[10px] font-medium ${i === todayIdx ? 'text-primary' : 'text-text-muted'}`}>{d}</div>
                        ))}
                      </div>
                      {/* 멤버별 행 */}
                      {members.map((member) => (
                        <div key={member.user_id} className="grid grid-cols-8 gap-1 items-center mb-0.5">
                          <p className="text-[10px] text-text-secondary truncate pr-1">{member.profiles?.nickname?.slice(0, 3) || '?'}</p>
                          {weekDates.map((date, dayIdx) => {
                            const dayStr = date.toDateString()
                            const hasVerif = weeklyVerifMatrix.some(
                              (v) => v.user_id === member.user_id && v.routine_id === routine.id && new Date(v.verified_at).toDateString() === dayStr
                            )
                            const isFuture = dayIdx > todayIdx
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
                      ))}
                    </Card>
                  ))}

                  {/* 벌금 대상자 요약 */}
                  <Card className="border-danger/20">
                    <p className="text-sm font-bold text-danger mb-2">벌금 대상자</p>
                    {memberStats.filter(s => s.penalty && s.weeklyTarget > 0).length === 0 ? (
                      <p className="text-xs text-text-muted">현재 벌금 대상자가 없습니다</p>
                    ) : (
                      <div className="space-y-1">
                        {memberStats.filter(s => s.penalty && s.weeklyTarget > 0).map((stat) => (
                          <div key={stat.userId} className="flex items-center justify-between py-1.5">
                            <div className="flex items-center gap-2">
                              <span className="text-sm">{stat.profile.nickname || '알 수 없음'}</span>
                              <span className="text-xs text-text-muted">{stat.weeklyDone}/{stat.weeklyTarget}회</span>
                            </div>
                            <span className="text-xs font-bold text-danger">
                              벌금 {group.penalty_amount.toLocaleString()}원
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </Card>
                </>
              )}
            </div>
          )
        })()}

        {/* ====== Chat Tab ====== */}
        {activeTab === 'chat' && (
          <>
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto space-y-3 pb-2 min-h-0"
            >
              {messages.length === 0 ? (
                <div className="text-center py-8 text-text-muted text-sm">
                  아직 대화가 없어요. 첫 메시지를 보내보세요!
                </div>
              ) : (
                messages.map((msg) => {
                  const isMine = msg.user_id === user?.id
                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`flex gap-2 max-w-[80%] ${isMine ? 'flex-row-reverse' : ''}`}>
                        {/* Avatar (others only) */}
                        {!isMine && (
                          <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 mt-0.5">
                            {msg.profiles?.avatar_url ? (
                              <img src={msg.profiles.avatar_url} alt={msg.profiles.nickname || ''} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white text-xs font-bold">
                                {msg.profiles?.nickname?.charAt(0) || '?'}
                              </div>
                            )}
                          </div>
                        )}
                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                          {/* Nickname (others only) */}
                          {!isMine && (
                            <span className="text-xs text-text-muted mb-1 ml-1">
                              {msg.profiles?.nickname || '알 수 없음'}
                            </span>
                          )}
                          {/* Bubble */}
                          <div
                            className={`px-3 py-2 rounded-2xl text-sm break-words ${
                              isMine
                                ? 'bg-primary text-white rounded-br-md'
                                : 'bg-bg-card border border-border text-text rounded-bl-md'
                            }`}
                          >
                            {msg.content}
                          </div>
                          {/* Time */}
                          <span className={`text-[10px] text-text-muted mt-0.5 ${isMine ? 'mr-1' : 'ml-1'}`}>
                            {formatChatTime(msg.created_at)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatBottomRef} />
            </div>

            {/* Chat input */}
            <div className="shrink-0 pt-2 pb-4 border-t border-border bg-bg-card -mx-4 px-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={handleChatKeyDown}
                  placeholder="메시지를 입력하세요..."
                  className="flex-1 px-4 py-2.5 text-sm bg-bg border border-border rounded-full outline-none focus:border-primary transition-colors placeholder:text-text-muted"
                  disabled={sendingChat}
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!chatInput.trim() || sendingChat}
                  className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center shrink-0 disabled:opacity-50 transition-opacity active:scale-95"
                >
                  {sendingChat ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5">
                      <path d="M3.105 2.289a.75.75 0 00-.826.95l1.414 4.925A1.5 1.5 0 005.135 9.25h6.115a.75.75 0 010 1.5H5.135a1.5 1.5 0 00-1.442 1.086l-1.414 4.926a.75.75 0 00.826.95 28.896 28.896 0 0015.293-7.154.75.75 0 000-1.115A28.897 28.897 0 003.105 2.289z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Memo edit modal */}
      <Modal isOpen={!!editingMemoId} onClose={() => { setEditingMemoId(null); setEditMemoText('') }} title="메모 수정">
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

      {/* Photo viewer modal */}
      {viewingPhoto && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80" onClick={() => setViewingPhoto(null)}>
          <button className="absolute top-4 right-4 w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white z-10" onClick={() => setViewingPhoto(null)}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-6 h-6">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="w-full max-w-lg px-4" onClick={(e) => e.stopPropagation()}>
            <img src={viewingPhoto.photo_url!} alt="인증 사진" className="w-full rounded-xl" />
            <div className="mt-3 text-center text-white">
              <p className="text-sm font-semibold">{viewingPhoto.profiles?.nickname || '알 수 없음'}</p>
              <p className="text-xs text-white/70">{formatDate(viewingPhoto.verified_at)}</p>
              {viewingPhoto.memo && <p className="text-sm mt-2 text-white/90">{viewingPhoto.memo}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Invite modal */}
      <Modal isOpen={showInvite} onClose={() => setShowInvite(false)} title="친구 초대">
        <div className="text-center space-y-4">
          <p className="text-sm text-text-secondary">
            아래 초대 코드를 친구에게 공유하세요
          </p>
          <div className="bg-bg rounded-xl p-4">
            <p className="text-3xl font-bold tracking-[0.3em] text-primary">
              {group.invite_code}
            </p>
          </div>
          <Button fullWidth onClick={handleCopyCode}>
            {copied ? '복사됨!' : '코드 복사하기'}
          </Button>
          <p className="text-xs text-text-muted">
            또는 이 링크를 공유하세요:<br />
            <span className="text-primary">
              {typeof window !== 'undefined' ? window.location.origin : ''}/group/invite/{group.invite_code}
            </span>
          </p>
        </div>
      </Modal>
    </>
  )
}
