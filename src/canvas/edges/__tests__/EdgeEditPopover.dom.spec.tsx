/**
 * EdgeEditPopover — mounted interaction contract.
 *
 * The popover is a local strength preview. It commits once on Enter or an
 * outside click, cancels on Escape, and never exposes the unsupported legacy
 * belief writer beside canonical analysis.
 */

import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { EdgeEditPopover, type EdgeEditPopoverProps } from '../EdgeEditPopover'

describe('EdgeEditPopover DOM integration', () => {
  const onUpdate = vi.fn()
  const onClose = vi.fn()
  const props: EdgeEditPopoverProps = {
    edge: { id: 'edge-1', data: { weight: 0.6, belief: 0.8 } },
    position: { x: 400, y: 300 },
    onUpdate,
    onClose,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders one clearly named relationship-strength editor at the requested position', () => {
    render(<EdgeEditPopover {...props} />)

    const dialog = screen.getByRole('dialog', { name: 'Edit relationship strength' })
    expect(screen.getByRole('heading', { name: 'Edit relationship strength' })).toBeInTheDocument()
    expect(dialog).toHaveStyle({ left: '400px', top: '300px' })
    expect(screen.getByLabelText('Weight slider')).toHaveValue('0.6')
    expect(screen.getByText('0.60')).toBeInTheDocument()
  })

  it('keeps rapid slider changes local until one explicit Enter commit', () => {
    render(<EdgeEditPopover {...props} />)
    const slider = screen.getByLabelText('Weight slider')

    fireEvent.change(slider, { target: { value: '0.7' } })
    fireEvent.change(slider, { target: { value: '0.9' } })
    expect(onUpdate).not.toHaveBeenCalled()

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })
    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith('edge-1', { weight: 0.9 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('commits the latest preview once on an outside click', () => {
    render(
      <div>
        <EdgeEditPopover {...props} />
        <button type="button">Outside</button>
      </div>,
    )
    fireEvent.change(screen.getByLabelText('Weight slider'), { target: { value: '0.75' } })
    fireEvent.mouseDown(screen.getByRole('button', { name: 'Outside' }))

    expect(onUpdate).toHaveBeenCalledTimes(1)
    expect(onUpdate).toHaveBeenCalledWith('edge-1', { weight: 0.75 })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not write when Enter confirms an unchanged value', () => {
    render(<EdgeEditPopover {...props} />)
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Enter' })

    expect(onUpdate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('discards a local preview on Escape', () => {
    render(<EdgeEditPopover {...props} />)
    fireEvent.change(screen.getByLabelText('Weight slider'), { target: { value: '0.2' } })
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })

    expect(onUpdate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not commit when the close button is used', () => {
    render(<EdgeEditPopover {...props} />)
    fireEvent.change(screen.getByLabelText('Weight slider'), { target: { value: '0.4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))

    expect(onUpdate).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does not close or commit for unrelated keys or inside clicks', () => {
    render(<EdgeEditPopover {...props} />)
    const dialog = screen.getByRole('dialog')
    fireEvent.keyDown(dialog, { key: 'Tab' })
    fireEvent.mouseDown(screen.getByLabelText('Weight slider'))

    expect(onUpdate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('uses the canonical 0–1 scale and shows the keyboard contract', () => {
    render(<EdgeEditPopover {...props} />)
    const slider = screen.getByLabelText('Weight slider') as HTMLInputElement

    expect(slider.min).toBe('0')
    expect(slider.max).toBe('1')
    expect(slider.step).toBe('0.01')
    expect(screen.getByText(/Press Enter to save, ESC to cancel/)).toBeInTheDocument()
  })

  it('does not render or seed the unsupported belief field', () => {
    render(<EdgeEditPopover {...props} />)

    expect(screen.queryByLabelText(/belief/i)).not.toBeInTheDocument()
    expect(screen.getByText(/likelihood and uncertainty use the shared-model values/i)).toBeInTheDocument()
    expect(onUpdate).not.toHaveBeenCalled()
  })

  it('cleans up its outside-click listener on unmount', () => {
    const { unmount } = render(<EdgeEditPopover {...props} />)
    unmount()
    fireEvent.mouseDown(document.body)

    expect(onUpdate).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })
})
