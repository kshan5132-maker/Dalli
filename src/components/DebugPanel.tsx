'use client'

import { useAuth } from './AuthProvider'

const isDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true'

export default function DebugPanel() {
  if (!isDebugMode) return null

  return <DebugPanelInner />
}

function DebugPanelInner() {
  const { user, profile, loading } = useAuth()

  return (
    <div className="fixed bottom-16 left-0 right-0 z-50 pointer-events-none flex justify-center">
      <div className="w-full max-w-[480px] pointer-events-auto">
        <div className="mx-2 mb-1 bg-black/85 text-white text-[10px] px-3 py-1.5 rounded-lg flex items-center gap-3 overflow-x-auto">
          <span className={loading ? 'text-yellow-400' : user ? 'text-green-400' : 'text-red-400'}>
            {loading ? 'AUTH:로딩' : user ? 'AUTH:로그인' : 'AUTH:비로그인'}
          </span>
          {user && <span>ID:{user.id.slice(0, 8)}</span>}
          {user && <span>{user.email}</span>}
          {profile && <span>닉네임:{profile.nickname}</span>}
          <button
            onClick={() => window.location.reload()}
            className="ml-auto px-2 py-0.5 bg-red-600 rounded text-[10px] shrink-0"
          >
            새로고침
          </button>
        </div>
      </div>
    </div>
  )
}
