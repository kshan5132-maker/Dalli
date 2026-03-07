'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { translateError } from '@/lib/errors'
import Button from '@/components/Button'
import Input from '@/components/Input'

export default function LoginPage() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (error) {
        setError(translateError(error.message))
        setLoading(false)
        return
      }

      // 전체 페이지 새로고침으로 확실한 세션 반영
      window.location.href = '/'
    } catch {
      setError('로그인 중 오류가 발생했습니다. 다시 시도해주세요.')
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
          <h1 className="text-2xl font-bold text-text">로그인</h1>
          <p className="text-sm text-text-secondary mt-1">
            다시 돌아오셨군요!
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>
            로그인
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary mt-6">
          계정이 없으신가요?{' '}
          <Link href="/signup" className="text-primary font-semibold">
            회원가입
          </Link>
        </p>
      </div>
    </div>
  )
}
