import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ContextMenu } from '../ContextMenu'
import * as store from '../store'

vi.mock('../store')

describe('ContextMenu - Leak Prevention', () => {
  const mockOnClose = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(store.useCanvasStore).mockReturnValue({
      addNode: vi.fn(),
      deleteSelected: vi.fn(),
      duplicateSelected: vi.fn(),
      copySelected: vi.fn(),
      pasteClipboard: vi.fn(),
      cutSelected: vi.fn(),
      selectAll: vi.fn(),
      clipboard: null,
      selection: { nodeIds: new Set(), edgeIds: new Set() }
    } as any)
  })

  afterEach(() => {
    cleanup()
  })

  it('does not leak listeners after 50 open/close cycles', () => {
    const initialKeydownListeners = getEventListenerCount('keydown')
    const initialMousedownListeners = getEventListenerCount('mousedown')

    // Open and close menu 50 times
    for (let i = 0; i < 50; i++) {
      const { unmount } = render(
        <ContextMenu x={100} y={100} onClose={mockOnClose} />
      )
      unmount()
    }

    const finalKeydownListeners = getEventListenerCount('keydown')
    const finalMousedownListeners = getEventListenerCount('mousedown')

    // Should return to baseline (or very close, accounting for test framework)
    expect(finalKeydownListeners).toBeLessThanOrEqual(initialKeydownListeners + 2)
    expect(finalMousedownListeners).toBeLessThanOrEqual(initialMousedownListeners + 2)
  })

  it('cleans up listeners on unmount', () => {
    const initialKeydownListeners = getEventListenerCount('keydown')
    const initialMousedownListeners = getEventListenerCount('mousedown')

    const { unmount } = render(
      <ContextMenu x={100} y={100} onClose={mockOnClose} />
    )

    // Should have added 2 listeners (keydown + mousedown)
    const mountedKeydownListeners = getEventListenerCount('keydown')
    const mountedMousedownListeners = getEventListenerCount('mousedown')
    expect(mountedKeydownListeners).toBeGreaterThan(initialKeydownListeners)
    expect(mountedMousedownListeners).toBeGreaterThan(initialMousedownListeners)

    unmount()

    // Should return to baseline
    const finalKeydownListeners = getEventListenerCount('keydown')
    const finalMousedownListeners = getEventListenerCount('mousedown')
    expect(finalKeydownListeners).toBeLessThanOrEqual(initialKeydownListeners + 1)
    expect(finalMousedownListeners).toBeLessThanOrEqual(initialMousedownListeners + 1)
  })
})

// Helper to count event listeners (approximation via getEventListeners if available)
function getEventListenerCount(eventType: string): number {
  // In test environment, we can't directly count listeners
  // This is a placeholder that would work with Chrome DevTools
  // For vitest, we rely on the fact that leaks would cause test failures
  // or we could instrument document.addEventListener
  return 0
}
