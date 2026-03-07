'use client'

import { usePathname } from 'next/navigation'
import BottomNav from './BottomNav'
import DebugPanel from './DebugPanel'

const hideNavPaths = ['/login', '/signup']

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const showNav = !hideNavPaths.includes(pathname)

  return (
    <div className="mobile-container">
      <main className={showNav ? 'page-content' : ''}>
        {children}
      </main>
      {showNav && <BottomNav />}
      <DebugPanel />
    </div>
  )
}
