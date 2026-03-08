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
import type { Group } from '@/lib/types'
import ErrorRetry from '@/components/ErrorRetry'
import { GroupListSkeleton } from '@/components/Skeleton'

export default function GroupListPage() {
  const router = useRouter()
  const supabase = createClient()
  const { user, loading: authLoading } = useAuth()
  const [groups, setGroups] = useState<(Group & { memberCount: number })[]>([])
  const [loading, setLoading] = useState(true)
  const [showJoinModal, setShowJoinModal] = useState(false)
  const [inviteCode, setInviteCode] = useState('')
  const [joinError, setJoinError] = useState('')
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      setLoading(false)
      return
    }
    loadGroups(user.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading])

  const loadGroups = async (uid: string) => {
    setError('')
    setLoading(true)
    try {
      console.log('[Dalli] [Group] memberships 쿼리 시작')
      const { data: memberships, error: memberError } = await supabase
        .from('group_members')
        .select('group_id')
        .eq('user_id', uid)
      console.log('[Dalli] [Group] memberships 쿼리 완료', memberships?.length)

      if (memberError) {
        setError('그룹 멤버십 데이터를 불러오는데 실패했습니다.')
        return
      }

      if (memberships && memberships.length > 0) {
        const groupIds = memberships.map((m) => m.group_id)

        console.log('[Dalli] [Group] groups 쿼리 시작')
        const { data: groupData } = await supabase
          .from('groups')
          .select('*')
          .in('id', groupIds)
          .order('created_at', { ascending: false })
        console.log('[Dalli] [Group] groups 쿼리 완료', groupData?.length)

        if (groupData) {
          const groupsWithCount = await Promise.all(
            (groupData as Group[]).map(async (group) => {
              console.log('[Dalli] [Group] memberCount 쿼리 시작:', group.id)
              const { count } = await supabase
                .from('group_members')
                .select('*', { count: 'exact', head: true })
                .eq('group_id', group.id)
              console.log('[Dalli] [Group] memberCount 쿼리 완료:', group.id, count)
              return { ...group, memberCount: count || 0 }
            })
          )
          setGroups(groupsWithCount)
        }
      }
    } catch (err) {
      console.error('[Dalli] [Group] 데이터 로드 실패:', err)
      setError('그룹 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoinByCode = async () => {
    if (!inviteCode.trim() || !user) return
    setJoining(true)
    setJoinError('')

    try {
      const { data: groupRows, error: groupError } = await supabase
        .from('groups')
        .select('id')
        .eq('invite_code', inviteCode.trim().toUpperCase())
      console.log('[Dalli] [Group] 초대코드 조회:', { count: groupRows?.length, groupError })
      const group = groupRows?.[0] || null

      if (!group) {
        setJoinError('유효하지 않은 초대 코드입니다.')
        setJoining(false)
        return
      }

      const { data: existingRows } = await supabase
        .from('group_members')
        .select('*')
        .eq('group_id', group.id)
        .eq('user_id', user.id)
      const existing = existingRows?.[0] || null

      if (existing) {
        setJoinError('이미 참여 중인 그룹입니다.')
        setJoining(false)
        return
      }

      const { error } = await supabase.from('group_members').insert({
        group_id: group.id,
        user_id: user.id,
        role: 'member',
      })

      if (error) {
        setJoinError('그룹 참여에 실패했습니다.')
        setJoining(false)
        return
      }

      setShowJoinModal(false)
      setInviteCode('')
      router.push(`/group/${group.id}`)
    } catch {
      setJoinError('오류가 발생했습니다. 다시 시도해주세요.')
      setJoining(false)
    }
  }

  if (loading) {
    return (
      <>
        <Header title="내 그룹" />
        <GroupListSkeleton />
      </>
    )
  }

  if (error) {
    return (
      <>
        <Header title="내 그룹" />
        <ErrorRetry error={error} onRetry={() => { if (user) loadGroups(user.id) }} />
      </>
    )
  }

  return (
    <>
      <Header
        title="내 그룹"
        rightAction={
          <Link href="/group/new">
            <button className="p-1 text-primary">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
                <path fillRule="evenodd" d="M12 3.75a.75.75 0 01.75.75v6.75h6.75a.75.75 0 010 1.5h-6.75v6.75a.75.75 0 01-1.5 0v-6.75H4.5a.75.75 0 010-1.5h6.75V4.5a.75.75 0 01.75-.75z" clipRule="evenodd" />
              </svg>
            </button>
          </Link>
        }
      />

      <div className="px-4 pt-4">
        <button
          onClick={() => setShowJoinModal(true)}
          className="w-full mb-4 p-3 border-2 border-dashed border-primary/30 rounded-xl text-sm text-primary font-medium hover:bg-primary/5 transition-colors flex items-center justify-center gap-2"
        >
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
            <path d="M10 1a.75.75 0 01.75.75v1.5a.75.75 0 01-1.5 0v-1.5A.75.75 0 0110 1zM5.05 3.05a.75.75 0 011.06 0l1.062 1.06A.75.75 0 116.11 5.173L5.05 4.11a.75.75 0 010-1.06zm9.9 0a.75.75 0 010 1.06l-1.06 1.062a.75.75 0 01-1.062-1.061l1.061-1.06a.75.75 0 011.06 0zM3 8a7 7 0 1114 0A7 7 0 013 8zm4 0a.75.75 0 01.75-.75h4.5a.75.75 0 010 1.5h-4.5A.75.75 0 017 8z" />
          </svg>
          초대 코드로 참여하기
        </button>

        {groups.length === 0 ? (
          <EmptyState
            icon={
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-12 h-12">
                <path d="M8.25 6.75a3.75 3.75 0 117.5 0 3.75 3.75 0 01-7.5 0zM15.75 9.75a3 3 0 116 0 3 3 0 01-6 0zM2.25 9.75a3 3 0 116 0 3 3 0 01-6 0zM6.31 15.117A6.745 6.745 0 0112 12a6.745 6.745 0 016.709 7.498.75.75 0 01-.372.568A12.696 12.696 0 0112 21.75c-2.305 0-4.47-.612-6.337-1.684a.75.75 0 01-.372-.568 6.787 6.787 0 011.019-4.38z" />
                <path d="M5.082 14.254a8.287 8.287 0 00-1.308 5.135 9.687 9.687 0 01-1.764-.44l-.115-.04a.563.563 0 01-.373-.487l-.01-.121a3.75 3.75 0 013.57-4.047zM20.226 19.389a8.287 8.287 0 00-1.308-5.135 3.75 3.75 0 013.57 4.047l-.01.121a.563.563 0 01-.373.486l-.115.04c-.567.2-1.156.349-1.764.441z" />
              </svg>
            }
            title="참여 중인 그룹이 없어요"
            description="그룹을 만들고 친구들을 초대하거나, 초대 코드로 참여하세요!"
            action={<Link href="/group/new"><Button>그룹 만들기</Button></Link>}
          />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <Card key={group.id} hover onClick={() => router.push(`/group/${group.id}`)}>
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0">
                    {group.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-base font-bold truncate">{group.name}</h3>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-text-muted">{group.memberCount}명 참여 중</span>
                      <span className="text-xs text-text-muted">&middot;</span>
                      <span className="text-xs text-warning font-medium">벌금 {group.penalty_amount.toLocaleString()}원</span>
                    </div>
                  </div>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-text-muted shrink-0">
                    <path fillRule="evenodd" d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z" clipRule="evenodd" />
                  </svg>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <Modal
        isOpen={showJoinModal}
        onClose={() => { setShowJoinModal(false); setInviteCode(''); setJoinError('') }}
        title="초대 코드로 참여"
      >
        <div className="space-y-4">
          <Input label="초대 코드" placeholder="6자리 코드를 입력하세요" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase())} maxLength={6} error={joinError} />
          <Button fullWidth onClick={handleJoinByCode} loading={joining}>참여하기</Button>
        </div>
      </Modal>
    </>
  )
}
