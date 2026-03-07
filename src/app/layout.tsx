import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import './globals.css'
import AuthProvider from '@/components/AuthProvider'
import BottomNav from '@/components/BottomNav'
import LayoutShell from '@/components/LayoutShell'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Dalli - 친구들이 보고 있는 루틴 인증',
  description: '안 하면 들킨다! 친구들과 함께하는 루틴 인증 앱',
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#6366F1',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="ko">
      <body className={`${geistSans.variable} antialiased`}>
        <AuthProvider>
          <LayoutShell>
            {children}
          </LayoutShell>
        </AuthProvider>
      </body>
    </html>
  )
}
