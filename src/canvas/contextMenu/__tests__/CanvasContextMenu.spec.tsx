import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CanvasContextMenu } from '../CanvasContextMenu'
import type { PaneTarget, NodeTarget, EdgeTarget, MultiTarget } from '../types'
import type { Node, Edge } from '@xyflow/react'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import type { EdgeData } from '../../domain/edges'

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

vi.mock('../../ToastContext', () => ({
  useShowToast: () => vi.fn(),
}))

vi.mock('../../store', () => {
  const mockState = {
    clipboard: null,
    nodes: [],
    edges: [],
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
    results: { status: 'idle', report: null },
  }
  const mockStore = vi.fn((selector: any) => selector(mockState))
  mockStore.getState = () => mockState
  mockStore.setState = (_partial: any) => {}
  return {
    useCanvasStore: mockStore,
    selectResultsStatus: (state: any) => state.results.status,
    selectReport: (state: any) => state.results.report,
  }
})

vi.mock('../../stores/guidanceStore', () => ({
  useGuidanceStore: {
    getState: () => ({ _sendMessage: null }),
  },
}))

vi.mock('../../mutations/commitValidatedMutation', () => ({
  commitValidatedMutation: vi.fn(async (_ops: any, localApply: () => void) => {
    localApply()
    return { success: true }
  }),
}))

const onClose = vi.fn()
const screenToFlowPosition = vi.fn((pos: any) => pos)

beforeEach(() => {
  vi.clearAllMocks()
})

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CanvasContextMenu', () => {
  describe('pane target', () => {
    const target: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 200 } }

    it('renders menu with role="menu"', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.getByRole('menu')).toBeInTheDocument()
    })

    it('renders Add node and Paste items', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.getByText('Add node')).toBeInTheDocument()
      expect(screen.getByText('Paste')).toBeInTheDocument()
    })

    it('renders Ask AI item', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.getByText('Ask AI')).toBeInTheDocument()
    })

    it('uses DS v4 tokens — no emoji icons', () => {
      const { container } = render(
        <CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
      )
      const html = container.innerHTML
      // Ensure no emoji characters used as icons
      expect(html).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u)
    })

    it('has separator elements with role="separator"', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      const separators = screen.getAllByRole('separator')
      expect(separators.length).toBeGreaterThan(0)
    })
  })

  describe('node target (factor)', () => {
    const node = {
      id: 'f1', type: 'factor', position: { x: 0, y: 0 },
      data: { label: 'Revenue', kind: 'factor' },
    } as Node
    const target: NodeTarget = {
      kind: 'node', nodeId: 'f1', nodeType: 'factor', node, screenPos: { x: 100, y: 100 },
    }

    it('renders full menu with Ask AI, Explore, Set value', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.getByText('Ask AI')).toBeInTheDocument()
      expect(screen.getByText('Explore')).toBeInTheDocument()
      expect(screen.getByText('Set value')).toBeInTheDocument()
    })

    it('renders Mark as assumption', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.getByText('Mark as assumption')).toBeInTheDocument()
    })

    it('renders clipboard actions', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.getByText('Cut')).toBeInTheDocument()
      expect(screen.getByText('Copy')).toBeInTheDocument()
      expect(screen.getByText('Duplicate')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  describe('node target (decision — reduced)', () => {
    const node = {
      id: 'd1', type: 'decision', position: { x: 0, y: 0 },
      data: { label: 'Strategy', kind: 'decision' },
    } as Node
    const target: NodeTarget = {
      kind: 'node', nodeId: 'd1', nodeType: 'decision', node, screenPos: { x: 100, y: 100 },
    }

    it('does NOT show Explore or Set value', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.queryByText('Explore')).not.toBeInTheDocument()
      expect(screen.queryByText('Set value')).not.toBeInTheDocument()
    })
  })

  describe('edge target (causal)', () => {
    const edge = { id: 'e1', source: 'f1', target: 'g1', type: 'styled', data: { ...DEFAULT_EDGE_DATA } } as Edge<EdgeData>
    const target: EdgeTarget = {
      kind: 'edge', edgeId: 'e1', edge, isStructural: false, screenPos: { x: 100, y: 100 },
    }

    it('renders edge menu with Ask AI, Mark as assumption, Delete', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.getByText('Ask AI')).toBeInTheDocument()
      expect(screen.getByText('Mark as assumption')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  describe('edge target (structural)', () => {
    const edge = { id: 'e2', source: 'd1', target: 'o1', type: 'styled', data: { ...DEFAULT_EDGE_DATA } } as Edge<EdgeData>
    const target: EdgeTarget = {
      kind: 'edge', edgeId: 'e2', edge, isStructural: true, screenPos: { x: 100, y: 100 },
    }

    it('does NOT show Mark as assumption', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.queryByText('Mark as assumption')).not.toBeInTheDocument()
    })
  })

  describe('multi-select target', () => {
    const target: MultiTarget = {
      kind: 'multi', nodeIds: ['f1', 'g1'], edgeIds: ['e1'], screenPos: { x: 100, y: 100 },
    }

    it('renders multi-select menu with clipboard actions', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.getByText('Ask AI')).toBeInTheDocument()
      expect(screen.getByText('Cut')).toBeInTheDocument()
      expect(screen.getByText('Copy')).toBeInTheDocument()
      expect(screen.getByText('Delete')).toBeInTheDocument()
    })
  })

  describe('keyboard navigation', () => {
    const target: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 200 } }

    it('closes on Escape', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      fireEvent.keyDown(document, { key: 'Escape' })
      expect(onClose).toHaveBeenCalled()
    })
  })

  describe('disabled items', () => {
    const target: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 200 } }

    it('Paste has aria-disabled when clipboard is empty', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      const paste = screen.getByText('Paste').closest('button')
      expect(paste).toHaveAttribute('aria-disabled', 'true')
    })

    it('disabled items are NOT natively disabled (remain focusable)', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      const paste = screen.getByText('Paste').closest('button')
      expect(paste).not.toBeDisabled()
    })
  })

  describe('decision node does NOT show Mark as assumption', () => {
    const node = {
      id: 'd1', type: 'decision', position: { x: 0, y: 0 },
      data: { label: 'Strategy', kind: 'decision' },
    } as Node
    const target: NodeTarget = {
      kind: 'node', nodeId: 'd1', nodeType: 'decision', node, screenPos: { x: 100, y: 100 },
    }

    it('does NOT render Mark as assumption for decision nodes', () => {
      render(<CanvasContextMenu target={target} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />)
      expect(screen.queryByText('Mark as assumption')).not.toBeInTheDocument()
    })
  })

  // -------------------------------------------------------------------------
  // Regression tests for visual fixes (P0.1, P0.2, P1.1)
  // -------------------------------------------------------------------------

  describe('visual fix regressions', () => {
    const paneTarget: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 200 } }

    it('Decision glyph renders \u2B22 text (not a Lucide icon)', () => {
      render(
        <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
      )
      // Open Add node submenu by clicking
      fireEvent.click(screen.getByText('Add node'))

      // The Decision item should render the solid hexagon glyph as text, not an SVG icon
      const decisionBtn = screen.getByText('Decision').closest('button')!
      // Should contain the solid hexagon glyph character
      expect(decisionBtn.textContent).toContain('\u2B22')
      // Should NOT have an SVG element (Lucide icons render as SVG)
      expect(decisionBtn.querySelector('svg')).toBeNull()
    })

    it('glyph spans use symbol font fallback stack', () => {
      render(
        <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
      )
      // Open Add node submenu
      fireEvent.click(screen.getByText('Add node'))

      // All glyph spans in the submenu should have fontFamily set
      const decisionBtn = screen.getByText('Decision').closest('button')!
      const glyphSpan = decisionBtn.querySelector('span[style]')
      expect(glyphSpan).not.toBeNull()
      expect(glyphSpan!.style.fontFamily).toContain('Apple Symbols')
    })

    it('submenu container has border-panel-border class', () => {
      render(
        <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
      )
      // Open Add node submenu
      fireEvent.click(screen.getByText('Add node'))

      // The submenu should have the border class (second role="menu" element)
      const menus = screen.getAllByRole('menu')
      const submenu = menus.find((m) => m.classList.contains('z-[101]'))
      expect(submenu).toBeDefined()
      expect(submenu!.classList.toString()).toContain('border-panel-border')
    })

    it('menu buttons use focus-visible ring (not browser default)', () => {
      render(
        <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
      )
      const addNodeBtn = screen.getByText('Add node').closest('button')!
      expect(addNodeBtn.className).toContain('outline-none')
      expect(addNodeBtn.className).toContain('focus-visible:ring-primary/50')
    })

    it('MenuTooltip id matches aria-describedby pattern (fake timers)', () => {
      vi.useFakeTimers()
      try {
        const { container } = render(
          <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
        )
        // Hover over Paste (non-submenu item) to start tooltip timer
        const pasteBtn = screen.getByText('Paste').closest('button')!
        fireEvent.mouseEnter(pasteBtn)

        // Advance past the 300ms tooltip delay — wrap in act() to flush React state updates
        act(() => { vi.advanceTimersByTime(350) })

        const tooltip = container.querySelector('[role="tooltip"]')
        expect(tooltip).not.toBeNull()
        // Tooltip must have an id matching tooltip-{itemId} pattern
        expect(tooltip!.id).toBe('tooltip-paste')
        // The button's aria-describedby must match
        expect(pasteBtn.getAttribute('aria-describedby')).toBe('tooltip-paste')
      } finally {
        vi.useRealTimers()
      }
    })

    it('submenu content never contains parent tooltip text', () => {
      render(
        <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
      )
      // The "Add node" parent has tooltip "Create a new element on the canvas"
      const parentTooltipText = 'Create a new element on the canvas'

      // Open Add node submenu
      fireEvent.click(screen.getByText('Add node'))

      // Get the submenu container (z-[101])
      const menus = screen.getAllByRole('menu')
      const submenu = menus.find((m) => m.classList.contains('z-[101]'))
      expect(submenu).toBeDefined()

      // Submenu must NOT contain the parent's tooltip text
      expect(submenu!.textContent).not.toContain(parentTooltipText)
      // Submenu must contain only its own items (Factor, Risk, etc.)
      expect(submenu!.textContent).toContain('Factor')
      expect(submenu!.textContent).toContain('Decision')
    })

    it('enabled submenu items do NOT have aria-disabled attribute', () => {
      render(
        <CanvasContextMenu target={paneTarget} onClose={onClose} screenToFlowPosition={screenToFlowPosition} />,
      )
      // Open Add node submenu
      fireEvent.click(screen.getByText('Add node'))

      // All submenu items are enabled — none should have aria-disabled
      const factorBtn = screen.getByText('Factor').closest('button')!
      expect(factorBtn.hasAttribute('aria-disabled')).toBe(false)
    })
  })
})
