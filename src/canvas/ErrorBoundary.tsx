import { Component, ReactNode } from 'react'
import { XCircle, AlertTriangle, ChevronRight } from 'lucide-react'
import { captureError } from '../lib/monitoring'
import { flushWorkToAutosave } from './persist/crashFlush'

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

// Stale-chunk auto-recovery: a failed dynamic import after a mid-session deploy
// is fixed by exactly one reload (the new index.html references the new chunks).
// One automatic reload, rate-limited via sessionStorage so a genuinely broken
// deploy cannot produce a reload loop — within the window the user gets the
// normal error panel with the manual "Reload editor" button instead.
const CHUNK_RELOAD_GUARD_KEY = 'olumi-chunk-reload-at'
const CHUNK_RELOAD_GUARD_WINDOW_MS = 5 * 60 * 1000

/**
 * Detect a failed-lazy-chunk error (deploy race / stale index.html). Message
 * shapes across browsers: Chrome "Failed to fetch dynamically imported module",
 * Firefox "error loading dynamically imported module", Safari "Importing a
 * module script failed", plus webpack-era "Loading chunk N failed" kept for
 * safety.
 */
export function isChunkLoadError(error: Error | null): boolean {
  if (!error) return false
  const message = `${error.name ?? ''} ${error.message ?? ''}`
  return /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Failed to load module script|Loading chunk [\w-]+ failed|ChunkLoadError/i.test(
    message
  )
}

/**
 * HashRouter guard: reload must land back on the SAME route. location.reload()
 * preserves the hash, but the recorded replaceState-desync gotcha means the
 * visible hash can have been dropped by earlier history writes — and a guest
 * reloading WITHOUT a route hash lands on the sign-in gate, which reads as
 * total data loss. If the hash is not a route, pin it to the canvas before
 * reloading.
 */
function ensureRouteHash(): void {
  try {
    if (!window.location.hash || !window.location.hash.startsWith('#/')) {
      window.location.hash = '#/canvas'
    }
  } catch {
    // Fail-soft: reloading with the current URL is still better than nothing.
  }
}

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

    // Crash-moment flush: persist the CURRENT in-memory graph into the
    // autosave slot the boot path restores from, BEFORE any reload can happen.
    // The periodic 30s autosave leaves the newest work unpersisted exactly
    // when a crash strikes; this is what makes the panel's "Your work is
    // auto-saved" promise true at the moment it is shown. Fail-soft: an empty
    // or unreadable store flushes nothing and never clobbers a good autosave.
    const flushed = flushWorkToAutosave()

    // Stale-chunk auto-recovery: one reload fixes a deploy race. Rate-limited
    // so a broken deploy shows the error panel instead of reload-looping.
    if (isChunkLoadError(error) && typeof window !== 'undefined') {
      let lastAttempt = 0
      try {
        lastAttempt = Number(sessionStorage.getItem(CHUNK_RELOAD_GUARD_KEY)) || 0
      } catch {
        // sessionStorage unavailable → treat as recently attempted (no auto
        // reload) rather than risking an unguarded loop.
        lastAttempt = Date.now()
      }
      if (Date.now() - lastAttempt > CHUNK_RELOAD_GUARD_WINDOW_MS) {
        try {
          sessionStorage.setItem(CHUNK_RELOAD_GUARD_KEY, String(Date.now()))
          ensureRouteHash()
          // Defer past the commit phase — never reload mid-render.
          setTimeout(() => window.location.reload(), 0)
        } catch {
          // Fall through to the normal error panel.
        }
      }
    }

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
              flushedWorkToAutosave: flushed,
              isChunkLoadError: isChunkLoadError(error),
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
        // The autosave slot the boot path restores from — the live persistence
        // mechanism (the old 'canvas-state-v1' key had no reader or writer).
        canvasAutosave: localStorage.getItem('olumi-canvas-autosave'),
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
    // Flush the current in-memory graph into the autosave slot that the
    // production boot path actually restores from (olumi-canvas-autosave →
    // ReactFlowGraph's init effect). The previous implementation here copied
    // `canvas-snapshot-*` (written only by the manual ⌘S snapshot feature)
    // into `canvas-state-v1` (read by NOTHING on boot) — a restore promise
    // wired to two dead keys, which is how the 2026-07-20 rehearsal lost a
    // whole session to a reassuring "Reload editor" button. The store is a
    // module singleton and still holds the graph while this panel is shown,
    // so the flush captures work right up to the crash.
    flushWorkToAutosave()

    // Reload must reconnect to the SAME route (and thereby the same scenario:
    // identity is persisted in olumi-canvas-current-scenario-id and the graph
    // in the autosave slot keyed alongside it).
    ensureRouteHash()
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
              Your work is auto-saved. Reloading will restore your latest work.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
