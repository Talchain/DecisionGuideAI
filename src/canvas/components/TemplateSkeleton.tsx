/**
 * TemplateSkeleton - Loading skeleton for TemplatesPanel
 * Displays animated placeholder cards while templates are being fetched
 */

export function TemplateSkeleton() {
  return (
    <div className="space-y-3 p-4" role="status" aria-label="Loading templates">
      {[...Array(4)].map((_, i) => (
        <div
          key={i}
          className="animate-pulse border border-gray-200 rounded-lg p-4 space-y-3"
        >
          {/* Title skeleton */}
          <div className="h-5 bg-gray-200 rounded w-3/4"></div>

          {/* Description skeleton - 2 lines */}
          <div className="space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full"></div>
            <div className="h-3 bg-gray-200 rounded w-5/6"></div>
          </div>

          {/* Tags/metadata skeleton */}
          <div className="flex gap-2">
            <div className="h-6 w-16 bg-gray-200 rounded-full"></div>
            <div className="h-6 w-20 bg-gray-200 rounded-full"></div>
          </div>
        </div>
      ))}

      {/* Screen reader text */}
      <span className="sr-only">Loading templates...</span>
    </div>
  )
}
