import { createClient as supabaseCreateClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

console.log('[Dalli] Supabase 초기화:', {
  url: supabaseUrl ? supabaseUrl.substring(0, 30) + '...' : 'MISSING',
  key: supabaseAnonKey ? supabaseAnonKey.substring(0, 20) + '...' : 'MISSING',
})

// 싱글톤: 앱 전체에서 하나의 클라이언트만 사용
const supabase = supabaseCreateClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storageKey: 'dalli-auth',
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  }
})

export function createClient() {
  return supabase
}
