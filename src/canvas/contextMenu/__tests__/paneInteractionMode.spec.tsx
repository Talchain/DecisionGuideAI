/**
 * The pointer mode is switchable from the canvas's own right-click menu.
 *
 * ⚠ WHY A SECOND CONTROL FOR SOMETHING THE TOOLBAR ALREADY DOES. Measured in a
 * real browser on 21 Sep 2026, with focus in the Olumi composer: `H` and `V` do
 * nothing, and Escape does NOT restore them — focus stayed on the textarea.
 * Only a pointer-down on the graph pane releases it. So the keyboard route is
 * inert precisely when a user working in the panel reaches for it, and the only
 * live route was a trip to the toolbar. Right-click is already under the hand.
 *
 * (The toolbar BUTTON was measured working in every state, from a clean canvas
 * and from a focused composer. This adds reach; it does not fix a broken
 * button, and the tests below must not be read as pinning one.)
 *
 * ⚠ THE ROW TOGGLES OFF THE MODE IT DISPLAYS. The host passes `effectiveMode`,
 * not the raw stored value — the same rule the toolbar's A-1 note records,
 * applied here rather than rediscovered here. During a spacebar hold the label
 * and the action therefore agree.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CanvasContextMenu } from '../CanvasContextMenu'
import type { PaneTarget } from '../types'

vi.mock('../../ToastContext', () => ({ useShowToast: () => vi.fn() }))

vi.mock('../../store', () => {
  const mockState = {
    clipboard: null,
    nodes: [],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle', report: null },
    canUndo: () => false,
    canRedo: () => false,
    undo: vi.fn(),
    redo: vi.fn(),
    viewMode: 'standard' as const,
    setViewMode: vi.fn(),
    applyLayout: vi.fn(),
  }
  const mockStore = vi.fn((selector: any) => selector(mockState))
  ;(mockStore as any).getState = () => mockState
  ;(mockStore as any).setState = () => {}
  return {
    useCanvasStore: mockStore,
    selectResultsStatus: (s: any) => s.results.status,
    selectReport: (s: any) => s.results.report,
  }
})

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: { getState: () => ({ _sendMessage: null }) },
}))

const paneTarget: PaneTarget = { kind: 'pane', screenPos: { x: 10, y: 10 } }
const screenToFlowPosition = vi.fn((pos: any) => pos)

function renderMenu(opts: {
  interactionMode?: 'select' | 'hand'
  onSetInteractionMode?: (m: 'select' | 'hand') => void
}) {
  return render(
    <CanvasContextMenu
      target={paneTarget}
      onClose={vi.fn()}
      screenToFlowPosition={screenToFlowPosition}
      interactionMode={opts.interactionMode}
      onSetInteractionMode={opts.onSetInteractionMode}
    />,
  )
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('pointer mode on the pane context menu', () => {
  it('offers Hand when the canvas is in Select, and switches to hand', () => {
    const setMode = vi.fn()
    renderMenu({ interactionMode: 'select', onSetInteractionMode: setMode })
    const row = screen.getByText('Hand (pan) mode')
    expect(row).toBeInTheDocument()
    fireEvent.click(row)
    expect(setMode).toHaveBeenCalledWith('hand')
  })

  it('offers Select when the canvas is in Hand, and switches to select', () => {
    const setMode = vi.fn()
    renderMenu({ interactionMode: 'hand', onSetInteractionMode: setMode })
    const row = screen.getByText('Select mode')
    expect(row).toBeInTheDocument()
    fireEvent.click(row)
    expect(setMode).toHaveBeenCalledWith('select')
  })

  /**
   * The label names the mode you are GOING TO, never the one you are in. A row
   * reading "Select mode" while the canvas is already in Select is a click that
   * appears to do nothing — the L-01 complaint this lane exists to keep away
   * from a second control.
   */
  it('names the destination, not the current state', () => {
    const { unmount } = renderMenu({ interactionMode: 'select', onSetInteractionMode: vi.fn() })
    expect(screen.queryByText('Select mode')).not.toBeInTheDocument()
    unmount()
    renderMenu({ interactionMode: 'hand', onSetInteractionMode: vi.fn() })
    expect(screen.queryByText('Hand (pan) mode')).not.toBeInTheDocument()
  })

  /**
   * Fail closed: a host with no mode to switch gets no row at all. A disabled
   * or inert row is worse than an absent one — the standing rule is that an
   * offered affordance must work.
   */
  it('is ABSENT when the host passes no setter', () => {
    renderMenu({ interactionMode: 'select' })
    expect(screen.queryByText('Hand (pan) mode')).not.toBeInTheDocument()
    expect(screen.queryByText('Select mode')).not.toBeInTheDocument()
  })

  it('is ABSENT when the host passes no mode', () => {
    renderMenu({ onSetInteractionMode: vi.fn() })
    expect(screen.queryByText('Hand (pan) mode')).not.toBeInTheDocument()
    expect(screen.queryByText('Select mode')).not.toBeInTheDocument()
  })

  /**
   * Positive control — the absence assertions above can fail. If they were
   * vacuous (a selector that never matches anything), this would pass too.
   */
  it('positive control — the row IS found when both props are supplied', () => {
    renderMenu({ interactionMode: 'select', onSetInteractionMode: vi.fn() })
    expect(screen.getAllByText('Hand (pan) mode')).toHaveLength(1)
  })

  it('leaves the rest of the pane menu intact', () => {
    renderMenu({ interactionMode: 'select', onSetInteractionMode: vi.fn() })
    expect(screen.getByText('Add node')).toBeInTheDocument()
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
  })
})
