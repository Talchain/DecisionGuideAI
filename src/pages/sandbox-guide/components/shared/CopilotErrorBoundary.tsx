/**
 * Guide Error Boundary
 *
 * Catches rendering errors in guide components and displays a fallback UI.
 * Prevents entire app from crashing if panel state has issues.
 */

import React from 'react'
import { Button } from './Button'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class GuideErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to console in development
    console.error('Guide Error Boundary caught an error:', error, errorInfo)

    // In production, you might want to log to an error tracking service
    // e.g., Sentry.captureException(error, { extra: errorInfo })
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided, otherwise use default
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="p-6 space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">⚠️</span>
            <h2 className="text-xl font-semibold text-charcoal-900">Something went wrong</h2>
          </div>

          <div className="text-sm text-storm-700">
            The guide panel encountered an error. This might be due to unexpected data or a temporary issue.
          </div>

          {/* Show error details in development */}
          {process.env.NODE_ENV === 'development' && this.state.error && (
            <details className="mt-4 p-3 bg-storm-50 rounded border border-storm-200">
              <summary className="text-sm font-medium text-critical-700 cursor-pointer">
                Error details (development only)
              </summary>
              <pre className="mt-2 text-xs text-storm-700 overflow-auto">
                {this.state.error.toString()}
                {'\n\n'}
                {this.state.error.stack}
              </pre>
            </details>
          )}

          <div className="flex gap-2">
            <Button variant="primary" size="sm" onClick={this.handleReset}>
              Try again
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
              Reload page
            </Button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
