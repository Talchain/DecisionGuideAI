import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ContextMenu } from '../ContextMenu'
import { ToastProvider } from '../ToastContext'

function renderWithProviders(ui: React.ReactElement) {
  return render(<ToastProvider>{ui}</ToastProvider>)
}

describe('ContextMenu', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    cleanup()
  })

  it('does not leak event listeners on mount/unmount cycles', () => {
    const onClose = vi.fn()
    
    // Spy on addEventListener and removeEventListener
    const addSpy = vi.spyOn(document, 'addEventListener')
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    
    const initialAddCount = addSpy.mock.calls.length
    const initialRemoveCount = removeSpy.mock.calls.length
    
    // Mount and unmount 50 times
    for (let i = 0; i < 50; i++) {
      const { unmount } = renderWithProviders(
        <ContextMenu x={100} y={100} onClose={onClose} />
      )
      unmount()
    }
    
    const finalAddCount = addSpy.mock.calls.length
    const finalRemoveCount = removeSpy.mock.calls.length
    
    // Each mount should add 2 listeners (mousedown, keydown)
    // Each unmount should remove 2 listeners
    // Net should be zero (all cleaned up)
    const addedListeners = finalAddCount - initialAddCount
    const removedListeners = finalRemoveCount - initialRemoveCount
    
    // Critical assertion: verify no significant listener leaks
    // Allow tolerance of 1-2 listeners for test framework noise/timing
    // If we were leaking 2 listeners per cycle, we'd see ~100 listener difference
    const leakedListeners = addedListeners - removedListeners
    expect(Math.abs(leakedListeners)).toBeLessThanOrEqual(2)
    // Sanity check: verify we're actually testing something (at least 2 listeners per cycle)
    expect(addedListeners).toBeGreaterThan(50)
    
    addSpy.mockRestore()
    removeSpy.mockRestore()
  })

  it('closes on Escape key', () => {
    const onClose = vi.fn()
    renderWithProviders(<ContextMenu x={100} y={100} onClose={onClose} />)
    
    const escEvent = new KeyboardEvent('keydown', { key: 'Escape' })
    document.dispatchEvent(escEvent)
    
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('closes on outside click', () => {
    const onClose = vi.fn()
    renderWithProviders(<ContextMenu x={100} y={100} onClose={onClose} />)
    
    // Click on document (outside menu)
    const clickEvent = new MouseEvent('mousedown', { bubbles: true })
    document.dispatchEvent(clickEvent)
    
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})
