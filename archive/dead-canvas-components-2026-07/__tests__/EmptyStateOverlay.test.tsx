import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EmptyStateOverlay } from '../../../src/canvas/components/EmptyStateOverlay'

vi.mock('../../../src/canvas/store', () => ({
  useCanvasStore: vi.fn(() => ({
    nodes: [],
    addNode: vi.fn()
  }))
}))

describe('EmptyStateOverlay', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  it('renders welcome overlay when no nodes', () => {
    render(<EmptyStateOverlay onDismiss={() => {}} />)
    
    expect(screen.getByText('Welcome to Canvas')).toBeInTheDocument()
  })

  it('closes when X button clicked', () => {
    const onDismiss = vi.fn()
    render(<EmptyStateOverlay onDismiss={onDismiss} />)
    
    const closeButton = screen.getByRole('button', { name: /close welcome overlay/i })
    fireEvent.click(closeButton)
    
    expect(onDismiss).toHaveBeenCalled()
  })

  it('closes when Escape key pressed', () => {
    const onDismiss = vi.fn()
    render(<EmptyStateOverlay onDismiss={onDismiss} />)
    
    fireEvent.keyDown(window, { key: 'Escape' })
    
    expect(onDismiss).toHaveBeenCalled()
  })

  it('persists dismissal when "Don\'t show this again" clicked', () => {
    const onDismiss = vi.fn()
    render(<EmptyStateOverlay onDismiss={onDismiss} />)
    
    const dontShowButton = screen.getByText(/don't show this again/i)
    fireEvent.click(dontShowButton)
    
    expect(localStorage.getItem('canvas.welcome.dismissed')).toBe('true')
    expect(onDismiss).toHaveBeenCalled()
  })

  it('does not render when previously dismissed', () => {
    localStorage.setItem('canvas.welcome.dismissed', 'true')
    
    const { container } = render(<EmptyStateOverlay onDismiss={() => {}} />)
    
    expect(container.firstChild).toBeNull()
  })

  it('has proper dialog semantics', () => {
    render(<EmptyStateOverlay onDismiss={() => {}} />)
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'welcome-title')
  })
})
