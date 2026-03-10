'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Button from '@/components/Button'
import Input from '@/components/Input'
import Card from '@/components/Card'

export default function ProfilePage() {
  const router = useRouter()
  const { user, profile, signOut, refreshProfile, loading: authLoading } = useAuth()
  const supabase = createClient()
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login')
    }
  }, [authLoading, user, router])

  const [nickname, setNickname] = useState(profile?.nickname || '')
  const [saving, setSaving] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [uploadingPhoto, setUploadingPhoto] = useState(false)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)

  useEffect(() => {
    if (profile?.nickname) setNickname(profile.nickname)
  }, [profile?.nickname])

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

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
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

    setUploadingPhoto(true)
    setError('')

    try {
      // Preview
      const reader = new FileReader()
      reader.onload = () => setPhotoPreview(reader.result as string)
      reader.readAsDataURL(file)

      // Upload to Supabase Storage
      const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg'
      const fileName = `profiles/${user.id}/avatar.${ext}`

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, file, { upsert: true })

      if (uploadError) {
        console.error('[Dalli] 프로필 사진 업로드 실패:', uploadError)
        setError('사진 업로드에 실패했습니다.')
        setUploadingPhoto(false)
        return
      }

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName)

      // Update profile with avatar_url (add cache buster)
      const avatarUrl = `${urlData.publicUrl}?t=${Date.now()}`
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: avatarUrl })
        .eq('id', user.id)

      if (updateError) {
        console.error('[Dalli] 프로필 사진 URL 업데이트 실패:', updateError)
        setError('프로필 업데이트에 실패했습니다.')
      } else {
        await refreshProfile()
      }
    } catch {
      setError('사진 업로드 중 오류가 발생했습니다.')
    } finally {
      setUploadingPhoto(false)
    }
  }

  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/login'
  }

  const displayName = profile?.nickname || user?.email?.split('@')[0] || '사용자'
  const avatarUrl = photoPreview || profile?.avatar_url

  return (
    <>
      <Header title="프로필 설정" showBack />

      <div className="px-4 pt-6 space-y-6">
        <div className="flex flex-col items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handlePhotoUpload}
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingPhoto}
            className="relative group mb-3"
          >
            <div className="w-20 h-20 rounded-full overflow-hidden">
              {avatarUrl ? (
                <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold text-2xl">
                  {displayName.charAt(0)}
                </div>
              )}
            </div>
            <div className="absolute inset-0 rounded-full bg-black/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingPhoto ? (
                <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-5 h-5 text-white">
                  <path fillRule="evenodd" d="M1 8a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 018.07 3h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0016.07 6H17a2 2 0 012 2v7a2 2 0 01-2 2H3a2 2 0 01-2-2V8zm13.5 3a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM10 14a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                </svg>
              )}
            </div>
          </button>
          <p className="text-xs text-text-muted mb-1">사진을 눌러서 변경</p>
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

        <p className="text-center text-xs text-text-muted pb-8">Dalli v1.0.6</p>
      </div>
    </>
  )
}
