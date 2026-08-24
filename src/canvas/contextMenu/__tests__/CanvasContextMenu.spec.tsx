import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CanvasContextMenu } from '../CanvasContextMenu'
import type { PaneTarget, NodeTarget, EdgeTarget, MultiTarget } from '../types'
import type { Node, Edge } from '@xyflow/react'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import type { EdgeData } from '../../domain/edges'

const storeSpies = vi.hoisted(() => ({
  undo: vi.fn(),
  redo: vi.fn(),
  setViewMode: vi.fn(),
  applyLayout: vi.fn(),
}))

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
    canUndo: () => false,
    canRedo: () => false,
    undo: storeSpies.undo,
    redo: storeSpies.redo,
    viewMode: 'standard' as const,
    setViewMode: storeSpies.setViewMode,
    applyLayout: storeSpies.applyLayout,
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

const onClose = vi.fn()
const screenToFlowPosition = vi.fn((pos: any) => pos)

const RETIRED_LOCAL_ACTIONS = [
  'Add node',
  'Paste',
  'Undo',
  'Redo',
  'Set value',
  'Add connected factor',
  'Add outcome from this',
  'Add risk from this',
  'Mark as assumption',
  'Cut',
  'Duplicate',
  'Reverse direction',
  'Insert factor between',
] as const

function expectLocalSemanticActionsAbsent(): void {
  for (const label of RETIRED_LOCAL_ACTIONS) {
    expect(screen.queryByText(label), `${label} mounted without shared-model authority`).toBeNull()
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('CanvasContextMenu — shared-model authority', () => {
  const paneTarget: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 200 } }

  it('keeps the readable pane tools and withholds every local semantic edit', () => {
    render(
      <CanvasContextMenu
        target={paneTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )

    expect(screen.getByRole('menu', { name: 'Canvas context menu' })).toBeInTheDocument()
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Auto-arrange')).toBeInTheDocument()
    expect(screen.getByText('Switch to Detailed')).toBeInTheDocument()
    expectLocalSemanticActionsAbsent()
    expect(storeSpies.undo).not.toHaveBeenCalled()
    expect(storeSpies.redo).not.toHaveBeenCalled()
    expect(storeSpies.applyLayout).not.toHaveBeenCalled()
  })

  it('retains an accessible disabled presentation action without reviving Paste', () => {
    render(
      <CanvasContextMenu
        target={paneTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    const arrange = screen.getByText('Auto-arrange').closest('button')
    expect(arrange).toHaveAttribute('aria-disabled', 'true')
    expect(arrange).not.toBeDisabled()
    expect(screen.queryByText('Paste')).toBeNull()
  })

  it('opens the read-only Ask AI submenu with current DS and accessibility semantics', () => {
    render(
      <CanvasContextMenu
        target={paneTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    const askAi = screen.getByText('Ask AI').closest('button')!
    fireEvent.click(askAi)

    const submenu = screen.getAllByRole('menu').find(menu => menu.classList.contains('z-[101]'))
    expect(submenu).toBeDefined()
    expect(submenu).toHaveTextContent("What's missing from this model?")
    expect(submenu!.className).toContain('border-panel-border')
    const question = screen.getByText("What's missing from this model?").closest('button')!
    expect(question).not.toHaveAttribute('aria-disabled')
    expect(askAi.className).toContain('focus-visible:ring-primary/50')
  })

  it('keeps tooltip identity coherent on an available presentation control', () => {
    vi.useFakeTimers()
    try {
      const { container } = render(
        <CanvasContextMenu
          target={paneTarget}
          onClose={onClose}
          screenToFlowPosition={screenToFlowPosition}
        />,
      )
      const toggle = screen.getByText('Switch to Detailed').closest('button')!
      fireEvent.mouseEnter(toggle)
      act(() => { vi.advanceTimersByTime(350) })
      const tooltip = container.querySelector('[role="tooltip"]')
      expect(tooltip).not.toBeNull()
      expect(tooltip!.id).toBe('tooltip-toggle-view-mode')
      expect(toggle).toHaveAttribute('aria-describedby', 'tooltip-toggle-view-mode')
    } finally {
      vi.useRealTimers()
    }
  })

  it('uses icon components rather than emoji and keeps structural separators', () => {
    const { container } = render(
      <CanvasContextMenu
        target={paneTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    expect(container.innerHTML).not.toMatch(/[\u{1F300}-\u{1F9FF}]/u)
    expect(screen.getAllByRole('separator').length).toBeGreaterThan(0)
  })

  it('closes on Escape', () => {
    render(
      <CanvasContextMenu
        target={paneTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('CanvasContextMenu — target-specific read and inspect tools', () => {
  const factorNode = {
    id: 'f1',
    type: 'factor',
    position: { x: 0, y: 0 },
    data: { label: 'Revenue', kind: 'factor' },
  } as Node
  const factorTarget: NodeTarget = {
    kind: 'node',
    nodeId: 'f1',
    nodeType: 'factor',
    node: factorNode,
    screenPos: { x: 100, y: 100 },
  }

  it('keeps factor explanation, exploration, copy and durable delete routes only', () => {
    render(
      <CanvasContextMenu
        target={factorTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Explore')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expectLocalSemanticActionsAbsent()
  })

  it('keeps organisational nodes readable without fabricating factor tools', () => {
    const node = {
      id: 'd1',
      type: 'decision',
      position: { x: 0, y: 0 },
      data: { label: 'Strategy', kind: 'decision' },
    } as Node
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'd1',
      nodeType: 'decision',
      node,
      screenPos: { x: 100, y: 100 },
    }
    render(
      <CanvasContextMenu
        target={target}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Explore')).toBeNull()
    expectLocalSemanticActionsAbsent()
  })

  it('keeps causal edges explainable and durably deletable without local edge edits', () => {
    const edge = {
      id: 'e1',
      source: 'f1',
      target: 'g1',
      type: 'styled',
      data: { ...DEFAULT_EDGE_DATA },
    } as Edge<EdgeData>
    const target: EdgeTarget = {
      kind: 'edge',
      edgeId: 'e1',
      edge,
      isStructural: false,
      screenPos: { x: 100, y: 100 },
    }
    render(
      <CanvasContextMenu
        target={target}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expectLocalSemanticActionsAbsent()
  })

  it('keeps multi-selection explainable and copyable without batch local mutation', () => {
    const target: MultiTarget = {
      kind: 'multi',
      nodeIds: ['f1', 'g1'],
      edgeIds: ['e1'],
      screenPos: { x: 100, y: 100 },
    }
    render(
      <CanvasContextMenu
        target={target}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    expect(screen.getByText('Ask AI')).toBeInTheDocument()
    expect(screen.getByText('Copy')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expectLocalSemanticActionsAbsent()
  })
})
