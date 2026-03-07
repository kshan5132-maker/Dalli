'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { translateError } from '@/lib/errors'
import Button from '@/components/Button'
import Input from '@/components/Input'

export default function SignupPage() {
  const supabase = createClient()
  const [nickname, setNickname] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('비밀번호가 일치하지 않습니다.')
      return
    }

    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 합니다.')
      return
    }

    if (!nickname.trim()) {
      setError('닉네임을 입력해주세요.')
      return
    }

    setLoading(true)

    try {
      const { data: signUpData, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            nickname: nickname.trim(),
          },
        },
      })

      if (error) {
        setError(translateError(error.message))
        setLoading(false)
        return
      }

      // 회원가입 성공 후 자동 로그인 시도
      if (signUpData.user && !signUpData.session) {
        // 이메일 인증이 필요한 경우 → 자동 로그인 시도
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInError) {
          // 이메일 확인이 필요하면 안내 메시지
          console.log('[Dalli] 자동 로그인 실패, 직접 로그인 필요:', signInError.message)
        }
      }

      // 세션이 이미 생성된 경우(이메일 확인 비활성화) 또는 자동 로그인 성공
      window.location.href = '/'
    } catch {
      setError('회원가입 중 오류가 발생했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-primary rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg shadow-primary/30">
            <span className="text-2xl text-white font-bold">D</span>
          </div>
          <h1 className="text-2xl font-bold text-text">회원가입</h1>
          <p className="text-sm text-text-secondary mt-1">
            함께 성장할 준비 되셨나요?
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="닉네임"
            type="text"
            placeholder="친구들에게 보일 이름"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
          />
          <Input
            label="이메일"
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <Input
            label="비밀번호"
            type="password"
            placeholder="6자 이상 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Input
            label="비밀번호 확인"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
          />

          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            가입하기
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          이미 계정이 있으신가요?{' '}
          <Link href="/login" className="text-primary font-semibold">
            로그인
          </Link>
        </p>
      </div>
    </div>
  )
}
