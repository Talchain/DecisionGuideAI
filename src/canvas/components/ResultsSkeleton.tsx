/**
 * ResultsSkeleton - Loading skeleton for ResultsPanel
 * Displays animated placeholder while analysis is running
 */

export function ResultsSkeleton() {
  return (
    <div className="space-y-6 p-4" role="status" aria-label="Running analysis">
      {/* Summary card skeleton */}
      <div className="animate-pulse border border-gray-200 rounded-lg p-4 space-y-4">
        {/* Title */}
        <div className="h-6 bg-gray-200 rounded w-1/2"></div>

        {/* Metric rows */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
          <div className="flex justify-between">
            <div className="h-4 bg-gray-200 rounded w-1/3"></div>
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
          </div>
        </div>

        {/* Large value */}
        <div className="h-12 bg-gray-200 rounded w-2/3 mx-auto"></div>
      </div>

      {/* Drivers section skeleton */}
      <div className="animate-pulse space-y-3">
        <div className="h-5 bg-gray-200 rounded w-1/4"></div>
        {[...Array(3)].map((_, i) => (
          <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
          </div>
        ))}
      </div>

      {/* Screen reader text */}
      <span className="sr-only">Analysing decision graph...</span>
    </div>
  )
}
