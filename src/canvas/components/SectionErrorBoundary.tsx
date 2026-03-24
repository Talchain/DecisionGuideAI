import { Component, type ReactNode, useState } from 'react'
import { AlertTriangle, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react'
import { captureError } from '../../lib/monitoring'

interface Props {
  children: ReactNode
  /** Section label shown in the fallback UI */
  section: string
}

interface State {
  hasError: boolean
  error: Error | null
  componentStack: string | null
}

/** Check ?diag query param (supports HashRouter) or global debug flag. */
function isDiagMode(): boolean {
  try {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.has('diag')) return true

    const hashParts = window.location.hash.split('?')
    if (hashParts.length > 1) {
      const hashParams = new URLSearchParams(hashParts[1])
      if (hashParams.has('diag')) return true
    }

    if ((window as any).__OLUMI_DEBUG === true) return true
  } catch {
    // SSR or restricted environment
  }
  return false
}

/**
 * Lightweight error boundary for individual sections within a panel.
 * Catches render errors so a single section crash doesn't take down the
 * entire OutputsDock tab. Provides a retry button to re-mount the section.
 *
 * In diag mode (?diag=1), shows expandable technical details.
 */
export class SectionErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, componentStack: null }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    this.setState({ componentStack: info.componentStack ?? null })
    console.error(`[SectionErrorBoundary] ${this.props.section}:`, error, info.componentStack)
    captureError(error, {
      label: `SectionErrorBoundary:${this.props.section}`,
      componentStack: info.componentStack ?? undefined,
    })
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null, componentStack: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <SectionErrorFallback
          section={this.props.section}
          error={this.state.error}
          componentStack={this.state.componentStack}
          onRetry={this.handleRetry}
        />
      )
    }
    return this.props.children
  }
}

/** Functional fallback component — allows useState for the expandable details. */
function SectionErrorFallback({
  section,
  error,
  componentStack,
  onRetry,
}: {
  section: string
  error: Error | null
  componentStack: string | null
  onRetry: () => void
}) {
  const [showDetails, setShowDetails] = useState(false)
  const diagMode = isDiagMode()

  return (
    <div className="rounded-lg border border-warning/30 bg-panel p-4">
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-4 w-4 shrink-0 text-warning" />
        <p className="text-sm text-text-body">
          This section couldn&apos;t load
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="ml-auto inline-flex items-center gap-1 rounded-md bg-panel px-2 py-1 text-xs font-medium text-text-body border border-border-emphasis/30 hover:bg-gray-100 transition-colors"
        >
          <RotateCcw className="h-3 w-3" />
          Retry
        </button>
      </div>

      {diagMode && error && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setShowDetails(prev => !prev)}
            className="inline-flex items-center gap-1 text-xs text-text-light hover:text-text-body transition-colors"
          >
            {showDetails ? (
              <ChevronDown className="h-3 w-3" />
            ) : (
              <ChevronRight className="h-3 w-3" />
            )}
            Show technical details
          </button>

          {showDetails && (
            <div className="mt-1 rounded bg-black/5 p-2 text-xs font-mono text-text-light max-h-40 overflow-y-auto">
              <p className="font-semibold text-danger">{error.message}</p>
              {componentStack && (
                <pre className="mt-1 whitespace-pre-wrap break-all text-[10px] leading-tight">
                  {componentStack}
                </pre>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
