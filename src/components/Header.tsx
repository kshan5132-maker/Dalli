'use client'

import { useRouter } from 'next/navigation'

interface HeaderProps {
  title: string
  showBack?: boolean
  rightAction?: React.ReactNode
}

export default function Header({ title, showBack = false, rightAction }: HeaderProps) {
  const router = useRouter()

  return (
    <header className="sticky top-0 z-40 bg-bg-card/80 backdrop-blur-md border-b border-border">
      <div className="flex items-center justify-between h-14 px-4">
        <div className="flex items-center gap-2 min-w-[40px]">
          {showBack && (
            <button
              onClick={() => router.back()}
              className="p-1 -ml-1 rounded-lg hover:bg-bg transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>
          )}
        </div>
        <h1 className="text-lg font-bold text-text absolute left-1/2 -translate-x-1/2">
          {title}
        </h1>
        <div className="min-w-[40px] flex justify-end">
          {rightAction}
        </div>
      </div>
    </header>
  )
}
