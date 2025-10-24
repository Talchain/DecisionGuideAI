import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ConfirmDialog } from '../../../src/canvas/components/ConfirmDialog'

describe('Replace Flow Policy', () => {
  it('shows confirm dialog with correct message', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    
    render(
      <ConfirmDialog
        title="Replace existing flow?"
        message="This will replace the existing 'Pricing Strategy' flow on the canvas."
        confirmLabel="Replace"
        cancelLabel="Cancel"
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    
    expect(screen.getByText('Replace existing flow?')).toBeInTheDocument()
    expect(screen.getByText(/Pricing Strategy/)).toBeInTheDocument()
    expect(screen.getByText('Replace')).toBeInTheDocument()
    expect(screen.getByText('Cancel')).toBeInTheDocument()
  })

  it('calls onConfirm when Replace is clicked', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    
    render(
      <ConfirmDialog
        title="Replace existing flow?"
        message="This will replace the existing flow."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    
    fireEvent.click(screen.getByText('Replace'))
    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(onCancel).not.toHaveBeenCalled()
  })

  it('calls onCancel when Cancel is clicked', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    
    render(
      <ConfirmDialog
        title="Replace existing flow?"
        message="This will replace the existing flow."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    
    fireEvent.click(screen.getByText('Cancel'))
    expect(onCancel).toHaveBeenCalledTimes(1)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('calls onCancel when Escape is pressed', () => {
    const onConfirm = vi.fn()
    const onCancel = vi.fn()
    
    render(
      <ConfirmDialog
        title="Replace existing flow?"
        message="This will replace the existing flow."
        onConfirm={onConfirm}
        onCancel={onCancel}
      />
    )
    
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('has proper accessibility attributes', () => {
    render(
      <ConfirmDialog
        title="Replace existing flow?"
        message="This will replace the existing flow."
        onConfirm={vi.fn()}
        onCancel={vi.fn()}
      />
    )
    
    const dialog = screen.getByRole('dialog')
    expect(dialog).toHaveAttribute('aria-modal', 'true')
    expect(dialog).toHaveAttribute('aria-labelledby', 'confirm-title')
  })
})
