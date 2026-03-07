import { type NextRequest, NextResponse } from 'next/server'

// supabase 서버 호출 제거: 미들웨어에서 getUser() 호출이 매 요청마다 Supabase 서버에 요청을 보내 hang 발생 가능
// 라우트 보호는 각 페이지에서 getSession()으로 클라이언트에서 처리
export function middleware(request: NextRequest) {
  return NextResponse.next()
}

export const config = {
  matcher: [],
}
