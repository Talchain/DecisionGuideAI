import { Component, type ReactNode } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { captureError } from '../../lib/monitoring'

interface Props {
  children: ReactNode
  /** Label shown in the fallback UI (e.g. "Results", "Inspector") */
  panel: string
}

interface State {
  hasError: boolean
  error: Error | null
}

/**
 * Lightweight error boundary for individual panels (OutputsDock, Inspector, etc.).
 * Catches render errors so a crash in one panel doesn't take down the canvas.
 * Provides a retry button to re-mount the panel without page reload.
 */
export class PanelErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[PanelErrorBoundary] ${this.props.panel}:`, error, info.componentStack)
    captureError(error, { label: `PanelErrorBoundary:${this.props.panel}`, componentStack: info.componentStack ?? undefined })
  }

  private handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <AlertTriangle className="h-6 w-6 text-warning" />
          <p className="text-sm font-medium text-text-body">
            {this.props.panel} encountered an error
          </p>
          {import.meta.env.DEV && this.state.error && (
            <p className="max-w-sm text-xs text-text-light font-mono break-all">
              {this.state.error.message}
            </p>
          )}
          <button
            type="button"
            onClick={this.handleRetry}
            className="inline-flex items-center gap-1.5 rounded-md bg-panel px-3 py-1.5 text-xs font-medium text-text-body border border-border-emphasis/30 hover:bg-gray-100 transition-colors"
          >
            <RotateCcw className="h-3 w-3" />
            Retry
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
