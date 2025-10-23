import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBanner } from '../../../../src/routes/templates/components/ErrorBanner'
import type { ErrorV1 } from '../../../../src/adapters/plot'

describe('ErrorBanner', () => {
  it('renders BAD_INPUT error with guidance', () => {
    const error: ErrorV1 = {
      schema: 'error.v1',
      code: 'BAD_INPUT',
      error: 'Please set a goal node'
    }
    
    render(<ErrorBanner error={error} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Please set a goal node')
  })

  it('renders LIMIT_EXCEEDED with field info', () => {
    const error: ErrorV1 = {
      schema: 'error.v1',
      code: 'LIMIT_EXCEEDED',
      error: 'Too many nodes',
      fields: { field: 'graph.nodes', max: 12 }
    }
    
    render(<ErrorBanner error={error} />)
    expect(screen.getByRole('alert')).toHaveTextContent('Too many nodes for this plan. Please keep it to 12 nodes.')
  })

  it('calls onRetry when retry button clicked', () => {
    const onRetry = vi.fn()
    const error: ErrorV1 = {
      schema: 'error.v1',
      code: 'SERVER_ERROR',
      error: 'Server error'
    }
    
    render(<ErrorBanner error={error} onRetry={onRetry} />)
    fireEvent.click(screen.getByRole('button', { name: /retry/i }))
    expect(onRetry).toHaveBeenCalled()
  })
})
