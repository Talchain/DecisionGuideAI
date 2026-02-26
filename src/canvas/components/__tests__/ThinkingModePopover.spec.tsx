import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { createRef } from 'react'
import { ThinkingModePopover } from '../ThinkingModePopover'

function renderPopover(props: { isOpen?: boolean; onClose?: () => void } = {}) {
  const anchorRef = createRef<HTMLButtonElement>()
  const onClose = props.onClose ?? vi.fn()

  const { rerender } = render(
    <>
      <button ref={anchorRef}>trigger</button>
      <ThinkingModePopover
        isOpen={props.isOpen ?? true}
        onClose={onClose}
        anchorRef={anchorRef as React.RefObject<HTMLElement>}
      />
    </>
  )

  return { anchorRef, onClose, rerender }
}

describe('ThinkingModePopover', () => {
  it('renders nothing when isOpen is false', () => {
    renderPopover({ isOpen: false })
    expect(screen.queryByText('Thinking mode')).not.toBeInTheDocument()
  })

  it('renders the title and Coming soon badge when open', () => {
    renderPopover()
    expect(screen.getByText('Thinking mode')).toBeInTheDocument()
    expect(screen.getByText('Coming soon')).toBeInTheDocument()
  })

  it('renders all three mode chips', () => {
    renderPopover()
    expect(screen.getByText('Fast')).toBeInTheDocument()
    expect(screen.getByText('Normal')).toBeInTheDocument()
    expect(screen.getByText('Deep thinking')).toBeInTheDocument()
  })

  it('renders chip descriptions', () => {
    renderPopover()
    expect(screen.getByText('Quick responses for simple decisions')).toBeInTheDocument()
    expect(screen.getByText('Balanced speed and depth')).toBeInTheDocument()
    expect(screen.getByText('Thorough analysis for complex scenarios')).toBeInTheDocument()
  })

  it('all chips are marked aria-disabled', () => {
    renderPopover()
    const chips = screen.getAllByRole('generic').filter(
      (el) => el.getAttribute('aria-disabled') === 'true'
    )
    expect(chips).toHaveLength(3)
  })

  it('calls onClose when Escape is pressed', () => {
    const onClose = vi.fn()
    renderPopover({ onClose })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('calls onClose when clicking outside the popover', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    renderPopover({ onClose })
    // The listener is registered after a setTimeout(0) to avoid
    // immediate close on the triggering button click. Advance by 0ms
    // (flushes only the immediate timeout, not the 100ms interval).
    await act(async () => { vi.advanceTimersByTime(1) })
    fireEvent.mouseDown(document.body)
    expect(onClose).toHaveBeenCalledTimes(1)
    vi.useRealTimers()
  })

  it('does not call onClose when clicking inside the popover', async () => {
    vi.useFakeTimers()
    const onClose = vi.fn()
    renderPopover({ onClose })
    await act(async () => { vi.advanceTimersByTime(1) })
    const title = screen.getByText('Thinking mode')
    fireEvent.mouseDown(title)
    expect(onClose).not.toHaveBeenCalled()
    vi.useRealTimers()
  })
})
