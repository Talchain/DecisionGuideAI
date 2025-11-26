import { useLayoutProgressStore } from '../layoutProgressStore'
import { typography } from '../../styles/typography'

export function LayoutProgressBanner() {
  const { status, message, canRetry, retry, cancel } = useLayoutProgressStore()

  if (status === 'idle') return null

  const isError = status === 'error'
  const text = message || (isError ? 'Layout failed. Please try again.' : 'Loading layout engine and applying layout...')

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[3000]">
      <div
        className="inline-flex items-center gap-3 rounded-lg bg-gray-900 text-white px-4 py-2 shadow-panel"
        role="status"
        aria-live="polite"
      >
        {status === 'loading' && (
          <div
            className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin motion-reduce:animate-none"
            aria-hidden="true"
          />
        )}
        <span className={typography.body}>{text}</span>
        <div className="flex gap-2 ml-2">
          {isError && canRetry && retry && (
            <button
              type="button"
              onClick={retry}
              className={`${typography.caption} px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors`}
            >
              Retry
            </button>
          )}
          <button
            type="button"
            onClick={cancel}
            className={`${typography.caption} px-2 py-1 rounded bg-white/10 hover:bg-white/20 transition-colors`}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
