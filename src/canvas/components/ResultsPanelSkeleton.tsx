/**
 * P0.7 — Loading States with Skeletons
 *
 * Skeleton placeholders matching final layout for:
 * - Headline result card
 * - Trust/Readiness section
 * - Drivers/Key Insight area
 * - Next steps section
 *
 * Rule: No blank white blocks while awaiting results.
 */

interface SkeletonLineProps {
  width?: string
  height?: string
  className?: string
}

function SkeletonLine({ width = 'w-full', height = 'h-4', className = '' }: SkeletonLineProps) {
  return (
    <div
      className={`${width} ${height} bg-sand-200 rounded animate-pulse ${className}`}
      aria-hidden="true"
    />
  )
}

interface SkeletonBlockProps {
  lines?: number
  className?: string
}

function SkeletonBlock({ lines = 3, className = '' }: SkeletonBlockProps) {
  return (
    <div className={`space-y-2 ${className}`} aria-hidden="true">
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={i === lines - 1 ? 'w-3/4' : 'w-full'}
        />
      ))}
    </div>
  )
}

/**
 * Skeleton for the headline result card (DecisionSummary)
 */
export function HeadlineResultSkeleton() {
  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden animate-pulse"
      data-testid="headline-skeleton"
      role="status"
      aria-label="Loading decision summary"
    >
      {/* Main outcome area */}
      <div className="px-4 py-4 border-b border-sand-100">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-4 h-4 bg-sand-200 rounded" />
          <SkeletonLine width="w-24" height="h-3" />
        </div>

        {/* Large percentage */}
        <div className="flex items-baseline gap-3 mb-2">
          <SkeletonLine width="w-20" height="h-8" />
          <SkeletonLine width="w-32" height="h-4" />
        </div>

        {/* Secondary info */}
        <SkeletonLine width="w-48" height="h-3" className="mb-2" />
      </div>

      {/* Confidence section */}
      <div className="px-4 py-3 bg-sand-50 border-b border-sand-100">
        <div className="flex items-start gap-3">
          <div className="w-5 h-5 bg-sand-200 rounded flex-shrink-0" />
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <SkeletonLine width="w-28" height="h-4" />
              <SkeletonLine width="w-36" height="h-3" />
            </div>
            <SkeletonLine width="w-full" height="h-3" />
          </div>
        </div>
      </div>

      {/* Top driver */}
      <div className="px-4 py-3">
        <div className="flex items-start gap-2">
          <div className="w-4 h-4 bg-sand-200 rounded flex-shrink-0" />
          <div className="flex-1">
            <SkeletonLine width="w-40" height="h-4" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for Trust/Readiness section
 */
export function TrustReadinessSkeleton() {
  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl p-4 animate-pulse"
      data-testid="trust-skeleton"
      role="status"
      aria-label="Loading trust indicators"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 bg-sand-200 rounded" />
        <SkeletonLine width="w-28" height="h-4" />
      </div>

      {/* Quality indicators */}
      <div className="grid grid-cols-3 gap-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="text-center">
            <SkeletonLine width="w-8" height="h-8" className="mx-auto mb-1" />
            <SkeletonLine width="w-16" height="h-3" className="mx-auto" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for Drivers/Key Insight area
 */
export function DriversInsightSkeleton() {
  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl overflow-hidden animate-pulse"
      data-testid="drivers-skeleton"
      role="status"
      aria-label="Loading drivers"
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-sand-100">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4 bg-sand-200 rounded" />
            <SkeletonLine width="w-24" height="h-4" />
          </div>
          <SkeletonLine width="w-16" height="h-3" />
        </div>
      </div>

      {/* Driver items */}
      <div className="divide-y divide-sand-100">
        {[1, 2, 3].map((i) => (
          <div key={i} className="px-4 py-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-sand-200 rounded flex-shrink-0" />
              <div className="flex-1">
                <div className="flex items-center justify-between mb-1">
                  <SkeletonLine width="w-32" height="h-4" />
                  <SkeletonLine width="w-8" height="h-4" />
                </div>
                <div className="h-1.5 bg-sand-200 rounded-full w-1/2" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Skeleton for Key Insight panel
 */
export function KeyInsightSkeleton() {
  return (
    <div
      className="rounded-lg border border-sky-200 bg-sky-50/50 px-3 py-3 animate-pulse"
      data-testid="insight-skeleton"
      role="status"
      aria-label="Loading insight"
    >
      <div className="flex items-start gap-2">
        <div className="w-5 h-5 bg-sky-200 rounded flex-shrink-0" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-2">
            <SkeletonLine width="w-20" height="h-3" className="bg-sky-200" />
          </div>
          <SkeletonBlock lines={2} className="[&_div]:bg-sky-100" />
        </div>
      </div>
    </div>
  )
}

/**
 * Skeleton for Next Steps section
 */
export function NextStepsSkeleton() {
  return (
    <div
      className="bg-paper-50 border border-sand-200 rounded-xl p-4 animate-pulse"
      data-testid="next-steps-skeleton"
      role="status"
      aria-label="Loading next steps"
    >
      <div className="flex items-center gap-2 mb-3">
        <div className="w-4 h-4 bg-sand-200 rounded" />
        <SkeletonLine width="w-24" height="h-4" />
      </div>

      <div className="space-y-2">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-start gap-2">
            <div className="w-4 h-4 bg-sand-200 rounded flex-shrink-0 mt-0.5" />
            <SkeletonLine width={i === 1 ? 'w-48' : 'w-40'} height="h-4" />
          </div>
        ))}
      </div>
    </div>
  )
}

/**
 * Complete Results Panel skeleton
 */
export function ResultsPanelSkeleton() {
  return (
    <div className="space-y-4 p-4" role="status" aria-label="Loading results">
      <HeadlineResultSkeleton />
      <KeyInsightSkeleton />
      <DriversInsightSkeleton />
      <NextStepsSkeleton />

      {/* Screen reader announcement */}
      <span className="sr-only">Loading analysis results, please wait...</span>
    </div>
  )
}

/**
 * Compact skeleton for inline loading states
 */
export function CompactResultSkeleton() {
  return (
    <div className="flex items-center gap-3 p-3 animate-pulse">
      <div className="w-10 h-10 bg-sand-200 rounded-full" />
      <div className="flex-1">
        <SkeletonLine width="w-24" height="h-4" className="mb-1" />
        <SkeletonLine width="w-16" height="h-3" />
      </div>
    </div>
  )
}

export default ResultsPanelSkeleton
