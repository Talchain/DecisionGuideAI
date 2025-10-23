import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from '../../../src/canvas/components/ConfirmDialog'

describe('ConfirmDialog', () => {
  it('renders with title and message', () => {
    render(
      <ConfirmDialog
        title="Replace flow?"
        message="This will replace the existing flow."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    
    expect(screen.getByText('Replace flow?')).toBeInTheDocument()
    expect(screen.getByText('This will replace the existing flow.')).toBeInTheDocument()
  })

  it('calls onConfirm when confirm button clicked', () => {
    const onConfirm = vi.fn()
    render(
      <ConfirmDialog
        title="Replace flow?"
        message="This will replace the existing flow."
        onConfirm={onConfirm}
        onCancel={() => {}}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /replace/i }))
    
    expect(onConfirm).toHaveBeenCalled()
  })

  it('calls onCancel when cancel button clicked', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Replace flow?"
        message="This will replace the existing flow."
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )
    
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when Escape pressed', () => {
    const onCancel = vi.fn()
    render(
      <ConfirmDialog
        title="Replace flow?"
        message="This will replace the existing flow."
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )
    
    fireEvent.keyDown(window, { key: 'Escape' })
    
    expect(onCancel).toHaveBeenCalled()
  })

  it('calls onCancel when backdrop clicked', () => {
    const onCancel = vi.fn()
    const { container } = render(
      <ConfirmDialog
        title="Replace flow?"
        message="This will replace the existing flow."
        onConfirm={() => {}}
        onCancel={onCancel}
      />
    )
    
    const backdrop = container.querySelector('[role="dialog"]')
    fireEvent.click(backdrop!)
    
    expect(onCancel).toHaveBeenCalled()
  })

  it('uses custom button labels', () => {
    render(
      <ConfirmDialog
        title="Delete item?"
        message="This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Keep"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    
    expect(screen.getByRole('button', { name: /delete/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /keep/i })).toBeInTheDocument()
  })

  it('has proper dialog semantics', () => {
    render(
      <ConfirmDialog
        title="Replace flow?"
        message="This will replace the existing flow."
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    )
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-title')
  })
})
