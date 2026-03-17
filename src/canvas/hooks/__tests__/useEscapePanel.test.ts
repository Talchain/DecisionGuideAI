/**
 * useEscapePanel — Escape key panel dismissal tests
 *
 * Tests that pressing Escape closes the active right panel in priority order.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useEscapePanel } from '../useEscapePanel'
import { useUIStore } from '../../../stores/uiStore'
import { useCanvasStore } from '../../store'

// Mock canvas store actions
vi.mock('../../store', () => ({
  useCanvasStore: {
    getState: vi.fn(),
  },
}))

describe('useEscapePanel', () => {
  const mockSetShowProvenanceHub = vi.fn()
  const mockSetShowAIClarifier = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    useUIStore.setState({ activeRightPanel: null })
    ;(useCanvasStore.getState as ReturnType<typeof vi.fn>).mockReturnValue({
      setShowProvenanceHub: mockSetShowProvenanceHub,
      setShowAIClarifier: mockSetShowAIClarifier,
    })
  })

  function pressEscape(target?: EventTarget) {
    const event = new KeyboardEvent('keydown', {
      key: 'Escape',
      bubbles: true,
      cancelable: true,
    })
    if (target) {
      Object.defineProperty(event, 'target', { value: target })
    }
    window.dispatchEvent(event)
  }

  it('closes provenance panel on Escape', () => {
    useUIStore.setState({ activeRightPanel: 'provenance' })
    renderHook(() => useEscapePanel())

    act(() => pressEscape())

    expect(mockSetShowProvenanceHub).toHaveBeenCalledWith(false)
  })

  it('closes clarifier panel on Escape', () => {
    useUIStore.setState({ activeRightPanel: 'clarifier' })
    renderHook(() => useEscapePanel())

    act(() => pressEscape())

    expect(mockSetShowAIClarifier).toHaveBeenCalledWith(false)
  })

  it('does nothing when no panel is active', () => {
    useUIStore.setState({ activeRightPanel: null })
    renderHook(() => useEscapePanel())

    act(() => pressEscape())

    expect(mockSetShowProvenanceHub).not.toHaveBeenCalled()
    expect(mockSetShowAIClarifier).not.toHaveBeenCalled()
  })

  it('does nothing when results panel is active (OutputsDock handles its own close)', () => {
    useUIStore.setState({ activeRightPanel: 'results' })
    renderHook(() => useEscapePanel())

    act(() => pressEscape())

    expect(mockSetShowProvenanceHub).not.toHaveBeenCalled()
    expect(mockSetShowAIClarifier).not.toHaveBeenCalled()
  })

  it('ignores Escape when focus is on an input element', () => {
    useUIStore.setState({ activeRightPanel: 'provenance' })
    renderHook(() => useEscapePanel())

    const input = document.createElement('input')
    act(() => pressEscape(input))

    expect(mockSetShowProvenanceHub).not.toHaveBeenCalled()
  })

  it('ignores Escape when focus is on a textarea', () => {
    useUIStore.setState({ activeRightPanel: 'clarifier' })
    renderHook(() => useEscapePanel())

    const textarea = document.createElement('textarea')
    act(() => pressEscape(textarea))

    expect(mockSetShowAIClarifier).not.toHaveBeenCalled()
  })
})
