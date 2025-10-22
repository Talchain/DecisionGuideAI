/**
 * Empty State - Shows when no templates are available
 */
import { FileQuestion, RefreshCw } from 'lucide-react'

interface EmptyStateProps {
  onRetry?: () => void
  isRetrying?: boolean
}

export function EmptyState({ onRetry, isRetrying }: EmptyStateProps) {
  return (
    <div 
      className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center"
      role="status"
      aria-live="polite"
    >
      <FileQuestion className="h-12 w-12 text-gray-400 mx-auto mb-4" />
      <h3 className="text-lg font-semibold text-gray-700 mb-2">
        No templates available
      </h3>
      <p className="text-sm text-gray-600 mb-4 max-w-md mx-auto">
        We couldn't load any decision templates. This might be a temporary issue.
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          disabled={isRetrying}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center gap-2"
          aria-label="Retry loading templates"
        >
          <RefreshCw className={`h-4 w-4 ${isRetrying ? 'animate-spin' : ''}`} />
          {isRetrying ? 'Retrying...' : 'Try Again'}
        </button>
      )}
    </div>
  )
}
