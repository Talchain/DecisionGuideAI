import { Component, ReactNode } from 'react'
import { captureError } from '../lib/monitoring'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
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
    const subject = encodeURIComponent('Canvas Error Report')
    const body = encodeURIComponent(`Error: ${this.state.error?.message}\n\nStack: ${this.state.error?.stack}`)
    window.open(`mailto:support@example.com?subject=${subject}&body=${body}`, '_blank')
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
    if (this.state.hasError) {
      return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-gray-900/95 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-panel p-8 max-w-lg mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">Something went wrong</h2>
                <p className="text-sm text-gray-600">The canvas encountered an unexpected error</p>
              </div>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-mono text-gray-700 break-all">
                {this.state.error?.message || 'Unknown error'}
              </p>
            </div>

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

              <button
                onClick={this.handleCopyState}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Copy Current State JSON
              </button>

              <button
                onClick={this.handleReportIssue}
                className="w-full px-4 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                </svg>
                Report Issue
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
