import React from 'react'

interface ErrorBoundaryProps {
  onRetry?: () => void
  onUseMock?: () => void
  children?: React.ReactNode
}

interface ErrorBoundaryState {
  error: unknown | null
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null }

  static getDerivedStateFromError(error: unknown) {
    return { error }
  }

  handleRetry = () => {
    this.setState({ error: null })
    this.props.onRetry?.()
  }

  handleUseMock = () => {
    this.setState({ error: null })
    this.props.onUseMock?.()
  }

  render() {
    if (this.state.error) {
      return (
        <div className="p-4 border rounded bg-amber-50 text-amber-900" data-testid="sandbox-fallback">
          <div className="font-semibold mb-2">Whiteboard failed to load.</div>
          <div className="flex gap-2">
            <button onClick={this.handleRetry} className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50">Retry</button>
            <button onClick={this.handleUseMock} className="px-2 py-1 text-sm rounded border bg-white hover:bg-gray-50">Use mock instead</button>
          </div>
        </div>
      )
    }

    return this.props.children as React.ReactElement
  }
}
