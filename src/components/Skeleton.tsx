'use client'

/**
 * 스켈레톤 UI 컴포넌트
 * - 데이터 로딩 중 레이아웃 유지
 * - 페이지별 프리셋 제공
 */

function SkeletonBox({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-border/40 rounded-xl animate-pulse ${className}`} />
  )
}

function SkeletonText({ className = '', width = 'w-full' }: { className?: string; width?: string }) {
  return (
    <div className={`h-3 bg-border/40 rounded animate-pulse ${width} ${className}`} />
  )
}

/** 홈 페이지 스켈레톤 */
export function HomeSkeleton() {
  return (
    <div className="px-4 pt-6">
      {/* 인사 영역 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <SkeletonText width="w-16" className="mb-2" />
          <SkeletonBox className="h-7 w-32" />
        </div>
        <SkeletonBox className="w-10 h-10 rounded-full" />
      </div>

      {/* 달성률 카드 */}
      <SkeletonBox className="h-32 mb-6" />

      {/* 개인 루틴 헤더 */}
      <div className="flex items-center justify-between mb-3">
        <SkeletonText width="w-20" className="h-4" />
        <SkeletonText width="w-12" className="h-3" />
      </div>

      {/* 루틴 카드들 */}
      <div className="space-y-2 mb-4">
        {[1, 2, 3].map((i) => (
          <SkeletonBox key={i} className="h-16" />
        ))}
      </div>

      {/* 인증 버튼 */}
      <SkeletonBox className="h-12 mt-4" />
    </div>
  )
}

/** 루틴 리스트 스켈레톤 */
export function RoutineListSkeleton() {
  return (
    <div className="px-4 pt-4">
      {/* 탭 */}
      <SkeletonBox className="h-10 mb-4" />

      {/* 루틴 카드들 */}
      <div className="space-y-3">
        {[1, 2, 3, 4].map((i) => (
          <SkeletonBox key={i} className="h-24" />
        ))}
      </div>
    </div>
  )
}

/** 인증 페이지 스켈레톤 */
export function VerifySkeleton() {
  return (
    <div className="px-4 pt-4">
      {/* 탭 */}
      <SkeletonBox className="h-10 mb-4" />

      {/* 안내 문구 */}
      <SkeletonText width="w-40" className="mb-3 h-4" />

      {/* 루틴 카드들 */}
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <SkeletonBox key={i} className="h-16" />
        ))}
      </div>
    </div>
  )
}

/** 대시보드 스켈레톤 */
export function DashboardSkeleton() {
  return (
    <div className="px-4 pt-4 space-y-4">
      {/* 탭 */}
      <SkeletonBox className="h-10" />

      {/* 주간 요약 3카드 */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <SkeletonBox key={i} className="h-20" />
        ))}
      </div>

      {/* 차트 */}
      <SkeletonBox className="h-44" />

      {/* 루틴별 카드 */}
      <SkeletonText width="w-32" className="h-4" />
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <SkeletonBox key={i} className="h-28" />
        ))}
      </div>
    </div>
  )
}

/** 그룹 리스트 스켈레톤 */
export function GroupListSkeleton() {
  return (
    <div className="px-4 pt-4">
      {/* 참여하기 버튼 */}
      <SkeletonBox className="h-12 mb-4" />

      {/* 그룹 카드들 */}
      <div className="space-y-3">
        {[1, 2].map((i) => (
          <SkeletonBox key={i} className="h-20" />
        ))}
      </div>
    </div>
  )
}

/** 그룹 상세 스켈레톤 */
export function GroupDetailSkeleton() {
  return (
    <div className="px-4 pt-4">
      {/* 그룹 정보 카드 */}
      <SkeletonBox className="h-20 mb-4" />

      {/* 탭 */}
      <SkeletonBox className="h-10 mb-4" />

      {/* 피드 카드들 */}
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <SkeletonBox key={i} className="h-24" />
        ))}
      </div>
    </div>
  )
}

/** 범용 스켈레톤 */
export default function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="px-4 pt-4 space-y-3">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox key={i} className="h-16" />
      ))}
    </div>
  )
}
