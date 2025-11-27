import { Component, ReactNode } from 'react'
import { captureError } from '../lib/monitoring'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
  showDetails: boolean
  dismissed: boolean
}

// GitHub issues URL for reporting
const GITHUB_ISSUES_URL = 'https://github.com/Talchain/DecisionGuideAI/issues/new'

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null, showDetails: false, dismissed: false }
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error, showDetails: false, dismissed: false }
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[CANVAS ERROR]:', error, errorInfo)
    
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
        // Show temporary success message
        const msg = document.createElement('div')
        msg.textContent = '✓ Canvas state copied to clipboard!'
        msg.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--semantic-success);color:var(--text-on-info);padding:12px 20px;border-radius:8px;z-index:10000;font-size:14px;box-shadow:0 4px 6px rgba(0,0,0,0.1)'
        document.body.appendChild(msg)
        setTimeout(() => msg.remove(), 3000)
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
      this.showToast('✓ Debug info copied to clipboard!')
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
    msg.style.cssText = 'position:fixed;top:20px;right:20px;background:var(--semantic-success);color:white;padding:12px 20px;border-radius:8px;z-index:10000;font-size:14px;box-shadow:0 4px 6px rgba(0,0,0,0.1)'
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
    // If error was dismissed, render children but show a warning banner
    if (this.state.hasError && this.state.dismissed) {
      return (
        <>
          <div className="fixed top-0 left-0 right-0 z-[9998] bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <span>Running in degraded mode after error. Some features may not work.</span>
            </div>
            <button
              onClick={this.handleRecover}
              className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-xs font-medium transition-colors"
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
          <div className="bg-white rounded-2xl shadow-panel p-8 max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
                <p className="text-sm text-gray-600">The canvas encountered an unexpected error</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <p className="text-sm font-mono text-gray-700 break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>

            {/* Show/Hide Details Toggle */}
            <button
              onClick={this.handleToggleDetails}
              className="w-full text-left text-sm text-gray-500 hover:text-gray-700 mb-4 flex items-center gap-1"
            >
              <svg
                className={`w-4 h-4 transition-transform ${this.state.showDetails ? 'rotate-90' : ''}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
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
                className="w-full px-4 py-3 bg-primary text-white rounded-lg hover:bg-primary-hover transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Reload Editor
              </button>

              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={this.handleCopyDebugInfo}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Debug Info
                </button>

                <button
                  onClick={this.handleReportIssue}
                  className="px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2 text-sm"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Report Issue
                </button>
              </div>

              <button
                onClick={this.handleDismiss}
                className="w-full px-4 py-2 text-gray-500 hover:text-gray-700 text-sm transition-colors flex items-center justify-center gap-1"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
                Dismiss and continue (not recommended)
              </button>
            </div>

            <p className="text-xs text-gray-500 text-center mt-6">
              Your work is auto-saved. Reloading will restore the last snapshot.
            </p>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
