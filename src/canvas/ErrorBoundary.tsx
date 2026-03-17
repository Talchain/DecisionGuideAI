import { Component, ReactNode } from 'react'
import { XCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { captureError } from '../lib/monitoring'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  showDetails: boolean
  dismissed: boolean
  errorCount: number
  lastErrorTime: number
}

// GitHub issues URL for reporting
const GITHUB_ISSUES_URL = 'https://github.com/Talchain/DecisionGuideAI/issues/new'

// If more than this many errors in the time window, consider it a recurring error
const RECURRING_ERROR_THRESHOLD = 3
const RECURRING_ERROR_WINDOW_MS = 5000

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = {
      hasError: false,
      error: null,
      showDetails: false,
      dismissed: false,
      errorCount: 0,
      lastErrorTime: 0,
    }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    const now = Date.now()
    return {
      hasError: true,
      error,
      showDetails: false,
      // Don't reset dismissed - we'll handle it in componentDidCatch
      lastErrorTime: now,
    }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[CANVAS ERROR]:', error, errorInfo)

    // Track error count for recurring error detection
    const now = Date.now()
    const isWithinWindow = now - this.state.lastErrorTime < RECURRING_ERROR_WINDOW_MS
    const newErrorCount = isWithinWindow ? this.state.errorCount + 1 : 1

    // If errors keep recurring after dismiss, mark as recurring
    const isRecurring = newErrorCount >= RECURRING_ERROR_THRESHOLD

    this.setState({
      errorCount: newErrorCount,
      // If user dismissed but errors keep recurring, un-dismiss to show error panel
      // but with the recurring flag they'll see a different message
      dismissed: isRecurring ? false : this.state.dismissed,
    })

    // Mirror canvas errors into the same SAFE_DEBUG structure used by main.tsx
    // so we can inspect stacks and component stacks from production.
    try {
      if (typeof window !== 'undefined') {
        // Ensure global debug container exists
        ;(window as any).__SAFE_DEBUG__ ||= { logs: [] }
        const debug = (window as any).__SAFE_DEBUG__
        debug.fatal = String(error?.stack || error)
        if (Array.isArray(debug.logs)) {
          debug.logs.push({
            t: Date.now(),
            m: 'canvas-error-boundary:caught',
            data: {
              error: error.message,
              stack: error.stack,
              componentStack: errorInfo?.componentStack?.slice(0, 600),
              errorCount: newErrorCount,
              isRecurring,
            },
          })
        }
      }
    } catch {
      // Swallow debug logging errors to avoid impacting user experience
    }

    // Capture to Sentry with context
    captureError(error, {
      component: 'Canvas',
      errorInfo: errorInfo.componentStack?.slice(0, 500), // Truncate for PII safety
      isRecurring,
      errorCount: newErrorCount,
    })
  }

  handleReload = () => {
    window.location.reload()
  }

  handleCopyState = async () => {
    try {
      const state = localStorage.getItem('canvas-state-v1')
      if (state) {
        await navigator.clipboard.writeText(state)
        this.showToast('Canvas state copied to clipboard.')
      }
    } catch (e) {
      console.error('Failed to copy state:', e)
    }
  }

  handleReportIssue = () => {
    const errorMsg = this.state.error?.message || 'Unknown error'
    const title = encodeURIComponent(`[Bug] Canvas Error: ${errorMsg.slice(0, 60)}`)
    const debugLogs = this.getDebugLogs()
    const body = encodeURIComponent(
      `## Error\n\`\`\`\n${errorMsg}\n\`\`\`\n\n` +
      `## Stack Trace\n\`\`\`\n${this.state.error?.stack || 'No stack'}\n\`\`\`\n\n` +
      `## Debug Logs\n\`\`\`json\n${debugLogs}\n\`\`\`\n\n` +
      `## Environment\n- URL: ${window.location.href}\n- User Agent: ${navigator.userAgent}\n- Time: ${new Date().toISOString()}`
    )
    window.open(`${GITHUB_ISSUES_URL}?title=${title}&body=${body}`, '_blank')
  }

  handleDismiss = () => {
    this.setState({ dismissed: true })
  }

  handleToggleDetails = () => {
    this.setState(prev => ({ showDetails: !prev.showDetails }))
  }

  handleCopyDebugInfo = async () => {
    try {
      const debugInfo = {
        error: this.state.error?.message,
        stack: this.state.error?.stack,
        debugLogs: this.getDebugLogs(),
        url: window.location.href,
        userAgent: navigator.userAgent,
        timestamp: new Date().toISOString(),
        canvasState: localStorage.getItem('canvas-state-v1'),
      }
      await navigator.clipboard.writeText(JSON.stringify(debugInfo, null, 2))
      this.showToast('Debug info copied to clipboard.')
    } catch (e) {
      console.error('Failed to copy debug info:', e)
    }
  }

  getDebugLogs = (): string => {
    try {
      const debug = (window as any).__SAFE_DEBUG__
      if (debug && Array.isArray(debug.logs)) {
        return JSON.stringify(debug.logs.slice(-20), null, 2)
      }
    } catch {}
    return 'No debug logs available'
  }

  showToast = (message: string) => {
    const msg = document.createElement('div')
    msg.textContent = message
    // Match ToastContext visual spec: bg-panel + 3px left border in severity colour + shadow-2
    msg.style.cssText =
      'position:fixed;top:24px;right:24px;background:var(--bg-panel);color:var(--text-body);' +
      'border-left:3px solid var(--success);border-radius:12px;max-width:360px;' +
      'padding:12px 16px;z-index:10000;font-size:14px;font-weight:500;box-shadow:var(--shadow-2)'
    document.body.appendChild(msg)
    setTimeout(() => msg.remove(), 3000)
  }

  handleRecover = () => {
    // Try to recover from last snapshot
    try {
      const snapshots = Object.keys(localStorage)
        .filter(k => k.startsWith('canvas-snapshot-'))
        .sort()
        .reverse()

      if (snapshots.length > 0) {
        const lastSnapshot = localStorage.getItem(snapshots[0])
        if (lastSnapshot) {
          localStorage.setItem('canvas-state-v1', lastSnapshot)
          window.location.reload()
          return
        }
      }
    } catch (e) {
      console.error('Recovery failed:', e)
    }

    // Fallback: just reload
    this.handleReload()
  }

  render() {
    const isRecurring = this.state.errorCount >= RECURRING_ERROR_THRESHOLD

    // If error was dismissed, render children but show a warning banner
    if (this.state.hasError && this.state.dismissed) {
      return (
        <>
          <div className="fixed top-0 left-0 right-0 z-[9998] bg-panel border-b border-warning/30 text-warning px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" aria-hidden="true" />
              <span>Running in degraded mode after an error. Some features may not work.</span>
            </div>
            <button
              onClick={this.handleRecover}
              className="px-3 py-1 bg-warning/10 hover:bg-warning/20 rounded text-xs font-medium transition-colors"
            >
              Reload
            </button>
          </div>
          <div className="pt-10">
            {this.props.children}
          </div>
        </>
      )
    }

    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/95 backdrop-blur-sm">
          <div className="bg-panel rounded-lg shadow-panel p-8 max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-panel rounded-full flex items-center justify-center flex-shrink-0">
                <XCircle className="w-6 h-6 text-danger" aria-hidden="true" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-text-header">Something went wrong</h2>
                <p className="text-sm text-text-body">
                  {isRecurring
                    ? 'A critical error keeps occurring. Please reload the page.'
                    : 'The canvas encountered an unexpected error'}
                </p>
              </div>
            </div>

            {/* Recurring error warning */}
            {isRecurring && (
              <div className="bg-panel border border-warning/30 rounded-lg p-3 mb-4">
                <p className="text-sm text-warning">
                  This error is recurring and cannot be dismissed. The page needs to be reloaded to recover.
                </p>
              </div>
            )}

            <div className="bg-panel-hover rounded-lg p-4 mb-4">
              <p className="text-sm font-mono text-text-body break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>

            {/* Show/Hide Details Toggle */}
            <button
              onClick={this.handleToggleDetails}
              className="w-full text-left text-sm text-text-light hover:text-text-body mb-4 flex items-center gap-1"
            >
              <ChevronRight
                className={`w-4 h-4 transition-transform ${this.state.showDetails ? 'rotate-90' : ''}`}
                aria-hidden="true"
              />
              {this.state.showDetails ? 'Hide technical details' : 'Show technical details'}
            </button>

            {/* Expandable Technical Details */}
            {this.state.showDetails && (
              <div className="bg-gray-900 rounded-lg p-4 mb-4 overflow-x-auto">
                <pre className="text-xs text-gray-300 whitespace-pre-wrap break-all">
                  {this.state.error?.stack || 'No stack trace available'}
                </pre>
                <div className="mt-4 pt-4 border-t border-gray-700">
                  <p className="text-xs text-gray-400 mb-2">Debug Logs:</p>
                  <pre className="text-xs text-gray-400 whitespace-pre-wrap break-all max-h-40 overflow-y-auto">
                    {this.getDebugLogs()}
                  </pre>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={this.handleRecover}
                className="w-full px-4 py-3 bg-primary text-text-on-color rounded-lg hover:bg-primary-hover transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload editor
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={this.handleCopyDebugInfo}
                  className="px-4 py-3 bg-panel-hover text-text-body rounded-lg hover:bg-panel-border transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy debug info
                </button>

                <button
                  onClick={this.handleReportIssue}
                  className="px-4 py-3 bg-panel-hover text-text-body rounded-lg hover:bg-panel-border transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Report issue
                </button>
              </div>

              {/* Only show dismiss for non-recurring errors */}
              {!isRecurring && (
                <button
                  onClick={this.handleDismiss}
                  className="w-full px-4 py-2 text-text-light hover:text-text-body text-sm transition-colors flex items-center justify-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                  Dismiss and continue (not recommended)
                </button>
              )}
            </div>

            <p className="text-xs text-text-light text-center mt-6">
              Your work is auto-saved. Reloading will restore the last snapshot.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
