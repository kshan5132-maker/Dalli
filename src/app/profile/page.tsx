'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Card from '@/components/Card'

export default function ProfilePage() {
  const { user, profile, signOut, refreshProfile } = useAuth()
  const supabase = createClient()
  const [nickname, setNickname] = useState(profile?.nickname || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.')
      return
    }
    if (!user) return

    setSaving(true)
    setError('')
    setSuccess(false)

    try {
      const { error: updateError } = await supabase
        .from('profiles')
        .upsert({ id: user.id, nickname: nickname.trim() })

      if (updateError) {
        console.error('[Dalli] 프로필 저장 실패:', updateError)
        setError(`프로필 업데이트에 실패했습니다: ${updateError.message}`)
        setSaving(false)
        return
      }

      await refreshProfile()
      setSuccess(true)
      setSaving(false)
      setTimeout(() => setSuccess(false), 2000)
    } catch {
      setError('프로필 저장에 실패했습니다. 다시 시도해주세요.')
      setSaving(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const displayName = profile?.nickname || user?.email?.split('@')[0] || '사용자'

  return (
    <>
      <Header title="프로필 설정" showBack />

      <div className="px-4 pt-6 space-y-6">
        <div className="flex flex-col items-center">
          <div className="w-20 h-20 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-2xl mb-3">
            {displayName.charAt(0)}
          </div>
          <p className="text-lg font-bold text-text">{displayName}</p>
          <p className="text-sm text-text-muted">{user?.email}</p>
        </div>

        <Card>
          <h3 className="text-sm font-bold mb-3">닉네임 변경</h3>
          <div className="space-y-3">
            <Input label="닉네임" value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="새 닉네임을 입력하세요" />
            {error && <p className="text-sm text-danger">{error}</p>}
            {success && <p className="text-sm text-success">닉네임이 변경되었습니다!</p>}
            <Button fullWidth onClick={handleSave} loading={saving}>저장하기</Button>
          </div>
        </Card>

        <Card>
          <h3 className="text-sm font-bold mb-3">계정 정보</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">이메일</span>
              <span className="text-sm font-medium text-text">{user?.email}</span>
            </div>
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-text-secondary">가입일</span>
              <span className="text-sm font-medium text-text">
                {user?.created_at ? new Date(user.created_at).toLocaleDateString('ko-KR') : '-'}
              </span>
            </div>
          </div>
        </Card>

        <Button variant="outline" fullWidth onClick={handleSignOut} className="text-danger border-danger/30 hover:bg-danger/5">로그아웃</Button>

        <p className="text-center text-xs text-text-muted pb-8">Dalli v1.0.4</p>
      </div>
    </>
  )
}
