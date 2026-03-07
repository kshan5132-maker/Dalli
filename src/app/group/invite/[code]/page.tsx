'use client'

import { useEffect, useState, use } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Button from '@/components/Button'
import Card from '@/components/Card'
import type { Group } from '@/lib/types'

export default function InvitePage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params)
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const supabase = createClient()
  const [group, setGroup] = useState<Group | null>(null)
  const [memberCount, setMemberCount] = useState(0)
  const [loading, setLoading] = useState(true)
  const [joining, setJoining] = useState(false)
  const [error, setError] = useState('')
  const [alreadyMember, setAlreadyMember] = useState(false)

  useEffect(() => {
    loadGroup()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, user])

  const loadGroup = async () => {
    try {
      console.log('[Dalli] [Invite] 그룹 조회 시작:', code)
      const { data: groupData, error: groupError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', code.toUpperCase())
        .maybeSingle()
      console.log('[Dalli] [Invite] 그룹 조회 완료:', { groupData: !!groupData, groupError })

      if (!groupData) {
        setError('유효하지 않은 초대 링크입니다.')
        setLoading(false)
        return
      }

      setGroup(groupData)

      const { count } = await supabase
        .from('group_members')
        .select('*', { count: 'exact', head: true })
        .eq('group_id', groupData.id)

      setMemberCount(count || 0)

      if (user) {
        const { data: existing } = await supabase
          .from('group_members')
          .select('*')
          .eq('group_id', groupData.id)
          .eq('user_id', user.id)
          .maybeSingle()

        if (existing) {
          setAlreadyMember(true)
        }
      }
    } catch (err) {
      console.error('[Dalli] [Invite] 데이터 로드 실패:', err)
      setError('초대 정보를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleJoin = async () => {
    if (!user || !group) return

    setJoining(true)

    const { error: joinError } = await supabase.from('group_members').insert({
      group_id: group.id,
      user_id: user.id,
    })

    if (joinError) {
      setError('그룹 참여에 실패했습니다.')
      setJoining(false)
      return
    }

    router.push(`/group/${group.id}`)
  }

  if (loading || authLoading) {
    return (
      <div className="min-h-dvh flex items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !group) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-danger/10 rounded-full flex items-center justify-center mb-4">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-danger">
            <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25zm-1.72 6.97a.75.75 0 10-1.06 1.06L10.94 12l-1.72 1.72a.75.75 0 101.06 1.06L12 13.06l1.72 1.72a.75.75 0 101.06-1.06L13.06 12l1.72-1.72a.75.75 0 10-1.06-1.06L12 10.94l-1.72-1.72z" clipRule="evenodd" />
          </svg>
        </div>
        <h1 className="text-xl font-bold mb-2">초대 링크 오류</h1>
        <p className="text-sm text-text-secondary mb-6">{error}</p>
        <Button onClick={() => router.push('/')}>홈으로</Button>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-dvh flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-primary/30">
          <span className="text-2xl text-white font-bold">D</span>
        </div>
        <h1 className="text-xl font-bold mb-2">
          &lsquo;{group?.name}&rsquo; 그룹에 초대받았어요!
        </h1>
        <p className="text-sm text-text-secondary mb-6">
          로그인하고 그룹에 참여하세요
        </p>
        <div className="w-full max-w-[280px] space-y-3">
          <Button fullWidth onClick={() => router.push('/signup')}>
            회원가입
          </Button>
          <Button variant="outline" fullWidth onClick={() => router.push('/login')}>
            로그인
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <Card className="w-full max-w-[360px] text-center">
        <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-dark rounded-2xl flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold">
          {group?.name.charAt(0)}
        </div>
        <h1 className="text-xl font-bold mb-1">{group?.name}</h1>
        {group?.description && (
          <p className="text-sm text-text-secondary mb-3">{group.description}</p>
        )}
        <div className="flex items-center justify-center gap-4 mb-6 text-sm text-text-muted">
          <span>{memberCount}명 참여 중</span>
          <span>&middot;</span>
          <span>벌금 {group?.penalty_amount.toLocaleString()}원</span>
        </div>

        {alreadyMember ? (
          <div className="space-y-3">
            <p className="text-sm text-success font-medium">이미 참여 중인 그룹이에요</p>
            <Button fullWidth onClick={() => router.push(`/group/${group?.id}`)}>
              그룹으로 이동
            </Button>
          </div>
        ) : (
          <Button fullWidth size="lg" onClick={handleJoin} loading={joining}>
            그룹 참여하기
          </Button>
        )}
      </Card>
    </div>
  )
}
