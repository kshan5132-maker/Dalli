'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

type AuthState = 'loading' | 'authenticated' | 'unauthenticated'

interface AuthContextType {
  user: User | null
  profile: Profile | null
  authState: AuthState
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  authState: 'loading',
  loading: true,
  signOut: async () => {},
  refreshProfile: async () => {},
})

export function useAuth() {
  return useContext(AuthContext)
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [authState, setAuthState] = useState<AuthState>('loading')
  const supabase = createClient()

  const fetchProfile = useCallback(async (userId: string, userEmail?: string) => {
    try {
      console.log('[Dalli] 프로필 쿼리 실행 직전:', userId)

      const response = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)

      console.log('[Dalli] 프로필 쿼리 RAW 응답:', {
        data: response.data,
        error: response.error,
        status: response.status,
        count: response.data?.length,
      })

      if (response.error) {
        console.error('[Dalli] 프로필 쿼리 에러:', response.error.message, response.error.code)
        // 에러가 나도 앱은 동작해야 함 → 기본 프로필 사용
        setProfile({ id: userId, nickname: userEmail?.split('@')[0] || '사용자' } as Profile)
        return
      }

      const existingProfile = response.data?.[0] || null

      if (existingProfile) {
        setProfile(existingProfile)
        console.log('[Dalli] 프로필 로드 완료:', existingProfile.nickname)
        return
      }

      // 프로필이 없으면 새로 생성
      console.log('[Dalli] 프로필 없음 → 새로 생성 시도')
      const nickname = userEmail ? userEmail.split('@')[0] : '사용자'
      const insertResponse = await supabase
        .from('profiles')
        .insert({ id: userId, nickname })
        .select('*')

      console.log('[Dalli] 프로필 생성 결과:', {
        data: insertResponse.data,
        error: insertResponse.error,
      })

      if (insertResponse.error) {
        console.error('[Dalli] 프로필 생성 에러:', insertResponse.error.message)
        // 생성 실패해도 기본 프로필 사용
        setProfile({ id: userId, nickname } as Profile)
        return
      }

      setProfile(insertResponse.data?.[0] || { id: userId, nickname } as Profile)
    } catch (err) {
      console.error('[Dalli] 프로필 로드 실패 (catch):', err)
      // 예외가 발생해도 기본 프로필 사용 → 앱 멈추지 않음
      setProfile({ id: userId, nickname: userEmail?.split('@')[0] || '사용자' } as Profile)
    }
  }, [supabase])

  const refreshProfile = useCallback(async () => {
    if (user) {
      await fetchProfile(user.id, user.email)
    }
  }, [user, fetchProfile])

  useEffect(() => {
    let mounted = true

    const initialize = async () => {
      try {
        console.log('[Dalli] Auth 초기화 시작 (getSession)')
        const { data: { session }, error } = await supabase.auth.getSession()
        if (!mounted) return

        if (error || !session?.user) {
          console.log('[Dalli] 인증되지 않은 사용자')
          setAuthState('unauthenticated')
          return
        }

        const currentUser = session.user
        console.log('[Dalli] 인증된 사용자:', currentUser.email)
        setUser(currentUser)
        setAuthState('authenticated')
        await fetchProfile(currentUser.id, currentUser.email)
      } catch (err) {
        console.error('[Dalli] Auth 초기화 에러:', err)
        if (mounted) setAuthState('unauthenticated')
      }
    }

    initialize()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return
        console.log('[Dalli] Auth 상태 변경:', event)
        const currentUser = session?.user ?? null
        setUser(currentUser)

        if (event === 'SIGNED_OUT') {
          setProfile(null)
          setUser(null)
          setAuthState('unauthenticated')
          return
        }

        if (currentUser) {
          setAuthState('authenticated')
          await fetchProfile(currentUser.id, currentUser.email)
        } else {
          setAuthState('unauthenticated')
          setProfile(null)
        }
      }
    )

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [supabase, fetchProfile])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    setUser(null)
    setProfile(null)
    setAuthState('unauthenticated')
  }, [supabase])

  // 비블로킹: 항상 children 렌더링
  return (
    <AuthContext.Provider value={{
      user,
      profile,
      authState,
      loading: authState === 'loading',
      signOut,
      refreshProfile,
    }}>
      {children}
    </AuthContext.Provider>
  )
}
