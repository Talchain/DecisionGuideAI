// src/lib/ErrorBoundary.tsx
// React error boundary for catching boot/render errors

import React, { Component, ReactNode } from 'react'
import { BUILD_ID } from './Build'

interface Props {
  children: ReactNode
}

interface State {
  hasError: boolean
  error: Error | null
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught:', error, errorInfo)
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const { error } = this.state
      return (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: '#fee',
            color: '#900',
            padding: '20px',
            fontFamily: 'system-ui, sans-serif',
            overflow: 'auto',
          }}
        >
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>
              Boot error
            </h1>
            <div style={{ marginBottom: '16px' }}>
              <strong>Message:</strong>
              <div style={{ marginTop: '8px', padding: '12px', background: '#fff', borderRadius: '4px' }}>
                {error.message || 'Unknown error'}
              </div>
            </div>
            <div style={{ marginBottom: '16px' }}>
              <strong>Stack:</strong>
              <pre
                style={{
                  marginTop: '8px',
                  padding: '12px',
                  background: '#fff',
                  borderRadius: '4px',
                  fontSize: '12px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}
              >
                {error.stack || 'no stack'}
              </pre>
            </div>
            <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '20px' }}>
              <div>build: {BUILD_ID}</div>
              <div style={{ marginTop: '8px' }}>Open DevTools → Console for more details</div>
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
