'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/components/AuthProvider'
import Header from '@/components/Header'
import Button from '@/components/Button'
import Input from '@/components/Input'
import type { RoutineFrequency, VerificationType } from '@/lib/types'
import { FREQUENCY_LABELS, VERIFICATION_TYPE_LABELS } from '@/lib/types'
import { translateError } from '@/lib/errors'

const frequencies: RoutineFrequency[] = ['daily', 'weekly_3', 'weekly_5', 'weekdays', 'weekends']
const verificationTypes: VerificationType[] = ['photo', 'check']

export default function NewRoutinePage() {
  const router = useRouter()
  const { user } = useAuth()
  const supabase = createClient()
  const [title, setTitle] = useState('')
  const [frequency, setFrequency] = useState<RoutineFrequency>('daily')
  const [verificationType, setVerificationType] = useState<VerificationType>('photo')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      setError('루틴 이름을 입력해주세요.')
      return
    }
    if (!user) return

    setLoading(true)
    setError('')

    try {
      const { error: insertError } = await supabase.from('routines').insert({
        user_id: user.id,
        title: title.trim(),
        frequency,
        verification_type: verificationType,
        type: 'personal',
        group_id: null,
      })

      if (insertError) {
        setError(translateError(insertError.message))
        setLoading(false)
        return
      }

      router.push('/routine')
    } catch {
      setError('루틴 생성에 실패했습니다. 다시 시도해주세요.')
      setLoading(false)
    }
  }

  return (
    <>
      <Header title="루틴 만들기" showBack />

      <div className="px-4 pt-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Input
            label="루틴 이름"
            placeholder="예: 아침 운동, 물 2L 마시기, 금주"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

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

          {error && (
            <div className="p-3 bg-danger/10 border border-danger/20 rounded-xl">
              <p className="text-sm text-danger">{error}</p>
            </div>
          )}

          <Button type="submit" fullWidth size="lg" loading={loading}>루틴 생성하기</Button>
        </form>
      </div>
    </>
  )
}
