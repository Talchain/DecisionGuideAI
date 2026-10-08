import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import { CanvasContextMenu } from '../CanvasContextMenu'
import type { PaneTarget, NodeTarget, EdgeTarget, MultiTarget } from '../types'
import type { Node, Edge } from '@xyflow/react'
import { DEFAULT_EDGE_DATA } from '../../domain/edges'
import type { EdgeData } from '../../domain/edges'
import { CANVAS_LAYER_CLASS } from '../../layers'

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

/**
 * ⚠ 'Add node' LEFT THIS LIST ON 13 Sep 2026 and is asserted PRESENT instead.
 * Every label that remains reaches a writer capturing no `structural_add`;
 * `Add node` reaches `store.addNode`, which does. Rationale and the full
 * replacement corpus: `paneAddNodeDurableDoor.spec.tsx`.
 *
 * ⚠⚠ AND THE THREE "Add connected …" LABELS LEFT IT ON 18 Sep 2026, BY THE
 * SAME MOVE AND FOR THE SAME REASON — `store.addNodeWithEdge` now captures a
 * `structural_add` for its node and a `structural_add_edge` intent for its link,
 * so they no longer reach a writer that captures nothing. CEE #1443 shipped the
 * edge writer on 13 Sep.
 *
 * ⚠⚠⚠ THIS LIST IS NOT WHAT IT LOOKS LIKE, AND THE NEXT READER MUST KNOW.
 * `expectLocalSemanticActionsInert`'s message says "without shared-model
 * authority", which reads as though a fixture had withheld it. **There is no
 * such fixture**: this file mocks the store, the toast context and the guidance
 * store, and NOT `mutationAuthority` — so every assertion here runs against the
 * REAL, deployed authority table. That is a stronger guarantee than a fixture
 * would give, and it is also why this list must be re-derived whenever a key in
 * that table moves, rather than left to drift.
 *
 * ⭐ WHAT REPLACED THE THREE, so nothing was merely deleted: the carrier-level
 * guarantee now lives in `connectedAddDurableDoor.spec.tsx`, which mocks the two
 * governing keys and asserts the items are WITHHELD when EITHER
 * `canvasNodeAddWithServerHash` or `canvasEdgeAddWithServerHash` is not
 * `server_graph`. That is the property this list used to carry for them, pinned
 * where it can actually be varied — here it could only ever observe one state.
 */
// ⚠ `Undo` / `Redo` LEFT THIS LIST at Undo S5 (30 Sep 2026): they are saved changes with a server writer now
// (`undo/undoCommand.ts`), so they are neither retired nor local — see the ACTIONABLE case below.
const RETIRED_LOCAL_ACTIONS = [
  'Paste',
  'Set value',
  'Mark as assumption',
  'Cut',
  'Duplicate',
  'Reverse direction',
  'Insert factor between',
] as const

/**
 * The DOM witness that a human has the door — the positive twin of the list
 * above, and the same shape `Add node` got when it left it.
 *
 * ⚠ NODE MENUS ONLY. `buildNodeMenu` pushes these three; `buildPaneMenu`,
 * `buildEdgeMenu` and `buildMultiMenu` never do, so asserting them on those
 * surfaces would assert a structural fact about the builder and not an authority
 * one — a case that passes for a reason other than the one it names. They are
 * therefore witnessed at the node cases and nowhere else: PRESENT on the factor
 * and option cards, WITHHELD on the Question (canvas audit edit-structure/F7,
 * 28 Sep 2026 — see the decision case below).
 */
const DURABLE_CONNECTED_ADD_LABELS = [
  'Add connected factor',
  'Add outcome from this',
  'Add risk from this',
] as const

/**
 * The negative twin, for the Question card (edit-structure/F7). Bound by the
 * exact label text, so a renamed item cannot pass as "withheld"; the caller
 * asserts the menu did render (its `Ask Olumi` row) so an empty menu cannot either.
 */
function expectConnectedAddsWithheld(): void {
  for (const label of DURABLE_CONNECTED_ADD_LABELS) {
    expect(screen.queryByText(label), `${label} must not be offered on the Question`).toBeNull()
  }
}

function expectConnectedAddsOffered(): void {
  for (const label of DURABLE_CONNECTED_ADD_LABELS) {
    const node = screen.queryByText(label)
    expect(node, `${label} should be offered on a node menu`).not.toBeNull()
    // PRESENT is not enough: an unauthorised keyboard-reachable gesture renders
    // as a disabled row, so both halves are asserted.
    expect(
      node!.closest('button'),
      `${label} is mounted but inert`,
    ).not.toHaveAttribute('aria-disabled', 'true')
  }
}

/**
 * The gestures a user can also reach by KEY. They are rendered as disabled
 * rows carrying a reason rather than deleted, so silence cannot be mistaken
 * for breakage — see `menuSaysWhyUnavailable.spec.ts` for the density
 * measurement behind that split.
 *
 * ⚠ `Paste` LEFT THIS SET (A20, 25 Sep 2026): it is no longer rendered at
 * all, surfaced-disabled or otherwise — Copy, its only producer, writes to a
 * clipboard Paste had no durable way to consume, so both are hidden from
 * every menu that showed them. `Paste` stays in `RETIRED_LOCAL_ACTIONS`
 * above; the check below now expects it ABSENT like every other id not in
 * this set.
 */
const SURFACED_DISABLED_LABELS = new Set(['Cut', 'Duplicate'])

/**
 * ⚠ SHAPE CHANGED 7 Sep 2026. This used to demand every retired label be
 * ABSENT from the DOM. Absence was the defect, not the guarantee: the
 * guarantee is that none of them is ACTIONABLE. A surfaced row must therefore
 * be present AND `aria-disabled`; a hidden one must stay absent.
 */
function expectLocalSemanticActionsInert(): void {
  for (const label of RETIRED_LOCAL_ACTIONS) {
    const node = screen.queryByText(label)
    if (SURFACED_DISABLED_LABELS.has(label)) {
      if (node) {
        expect(
          node.closest('button'),
          `${label} is actionable without shared-model authority`,
        ).toHaveAttribute('aria-disabled', 'true')
      }
      continue
    }
    expect(node, `${label} mounted without shared-model authority`).toBeNull()
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
    expect(screen.getByText('Ask Olumi')).toBeInTheDocument()
    expect(screen.getByText('Auto-arrange')).toBeInTheDocument()
    expect(screen.getByText('Switch to Detailed')).toBeInTheDocument()
    // ⭐⭐ BOTH FIXES KEPT (rebase, 13 Sep 2026). #1538's DOM witness that a human
    // has a door, AND #1304's assertion that the still-unauthorised gestures are
    // INERT-with-a-reason rather than absent.
    expect(screen.getByText('Add node')).toBeInTheDocument()
    expectLocalSemanticActionsInert()
    expect(storeSpies.undo).not.toHaveBeenCalled()
    expect(storeSpies.redo).not.toHaveBeenCalled()
    expect(storeSpies.applyLayout).not.toHaveBeenCalled()
  })

  it('retains an accessible disabled presentation action, and hides Paste (A20)', () => {
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

    // A20 — Paste was always disabled with no server authority, and its only
    // producer (Copy) writes to a clipboard it had no durable way to consume:
    // a control that could never work is hidden, not left present and inert.
    expect(screen.queryByText('Paste')).toBeNull()
  })

  it('renders the REASON beside a disabled row, not just the grey', () => {
    // ⚠ THE TOP-LEVEL MENU NEVER RENDERED `disabledReason` BEFORE THIS LANE,
    // while `Submenu.tsx` always did — so "Nothing to undo" was computed,
    // attached to the row and never shown. A greyed row with no reason is the
    // same defect one level down, and it is on the path this fix depends on.
    //
    // jsdom proves TEXT PRESENCE only, never visibility (trap 3).
    render(
      <CanvasContextMenu
        target={paneTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    // ⚠ RE-PINNED at Undo S5: Undo was this case's example of a disabled row. It is ACTIONABLE now (a saved-change
    // restore), so it carries no "not available" reason; the reason-rendering property stays pinned on Auto-arrange.
    const undoRow = screen.getByText('Undo').closest('button')
    expect(undoRow).not.toHaveAttribute('aria-disabled', 'true')
    expect(undoRow?.textContent).not.toContain('not available here')

    // And the pre-existing reason that was being computed and swallowed.
    const arrangeRow = screen.getByText('Auto-arrange').closest('button')
    expect(arrangeRow?.textContent).toContain('No nodes to arrange')
  })

  it('opens the read-only Ask Olumi submenu with current DS and accessibility semantics', () => {
    render(
      <CanvasContextMenu
        target={paneTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    const askAi = screen.getByText('Ask Olumi').closest('button')!
    fireEvent.click(askAi)

    // A9 — the submenu's z-index moved from 101 to 952 (above OutputsDock's
    // 900); slice D-3 (27 Sep 2026) moved it into the ONE stacking order
    // (`layers.ts`), above the floating inspector.
    const submenu = screen.getAllByRole('menu').find(menu => menu.classList.contains(CANVAS_LAYER_CLASS.submenu))
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
      render(
        <CanvasContextMenu
          target={paneTarget}
          onClose={onClose}
          screenToFlowPosition={screenToFlowPosition}
        />,
      )
      const toggle = screen.getByText('Switch to Detailed').closest('button')!
      fireEvent.mouseEnter(toggle)
      act(() => { vi.advanceTimersByTime(350) })
      // A9 — the whole menu (and this tooltip within it) is now portalled to
      // `document.body`, outside RTL's own `container` wrapper, so the query
      // is scoped to the document rather than to `container`.
      const tooltip = document.querySelector('[role="tooltip"]')
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

  it('renders Ask Olumi and never Ask AI anywhere in node, edge, pane and multi menus', () => {
    const edge = {
      id: 'e1',
      source: 'f1',
      target: 'g1',
      type: 'styled',
      data: { ...DEFAULT_EDGE_DATA },
    } as Edge<EdgeData>
    const edgeTarget: EdgeTarget = {
      kind: 'edge',
      edgeId: 'e1',
      edge,
      isStructural: false,
      screenPos: { x: 100, y: 100 },
    }
    const paneTarget: PaneTarget = { kind: 'pane', screenPos: { x: 100, y: 100 } }
    const multiTarget: MultiTarget = {
      kind: 'multi',
      nodeIds: ['f1', 'g1'],
      edgeIds: ['e1'],
      screenPos: { x: 100, y: 100 },
    }

    for (const target of [factorTarget, edgeTarget, paneTarget, multiTarget]) {
      const { unmount } = render(
        <CanvasContextMenu
          target={target}
          onClose={onClose}
          screenToFlowPosition={screenToFlowPosition}
        />,
      )
      // The current label is the contrast control: an empty menu cannot pass.
      expect(document.body).not.toHaveTextContent('Ask AI')
      const askOlumi = screen.getByText('Ask Olumi')
      expect(askOlumi).toBeInTheDocument()

      fireEvent.click(askOlumi.closest('button')!)
      expect(screen.getAllByRole('menu')).toHaveLength(2)
      expect(screen.getByText('Ask Olumi')).toBeInTheDocument()
      expect(document.body).not.toHaveTextContent('Ask AI')
      unmount()
    }
  })

  it('keeps factor explanation, exploration, copy and durable delete routes only', () => {
    render(
      <CanvasContextMenu
        target={factorTarget}
        onClose={onClose}
        screenToFlowPosition={screenToFlowPosition}
      />,
    )
    expect(screen.getByText('Ask Olumi')).toBeInTheDocument()
    expect(screen.getByText('Explore')).toBeInTheDocument()
    expect(screen.queryByText('Copy')).toBeNull() // A20 — Copy is hidden
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expectConnectedAddsOffered()
    expectLocalSemanticActionsInert()
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
    expect(screen.getByText('Ask Olumi')).toBeInTheDocument()
    expect(screen.queryByText('Copy')).toBeNull() // A20 — Copy is hidden
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expect(screen.queryByText('Explore')).toBeNull()
    // ⛔ RE-PINNED 28 Sep 2026 (canvas audit edit-structure/F7). This case used
    // to assert "A DECISION NODE GETS THEM TOO", because the builder then
    // guarded the block with `kind !== 'constraint'` only. That pinned the
    // defect: each item made the Question one end of a new causal link
    // (decision → factor / outcome / risk), and CEE's `ALLOWED_EDGES` admits
    // exactly one link at a decision, decision → option. The builder now also
    // excludes `decision`, so the Question offers none of the three; options
    // are added from its own panel. Contrast: the factor case above and the
    // option case below still offer all three.
    expectConnectedAddsWithheld()
    expectLocalSemanticActionsInert()
  })

  it('CONTRAST: an option card still offers the three connected adds (the Question alone loses them)', () => {
    const node = {
      id: 'o1',
      type: 'option',
      position: { x: 0, y: 0 },
      data: { label: 'Raise price', kind: 'option' },
    } as Node
    const target: NodeTarget = {
      kind: 'node',
      nodeId: 'o1',
      nodeType: 'option',
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
    expect(screen.getByText('Ask Olumi')).toBeInTheDocument()
    expectConnectedAddsOffered()
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
    expect(screen.getByText('Ask Olumi')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expectLocalSemanticActionsInert()
  })

  it('keeps multi-selection explainable without batch local mutation, and hides Copy (A20)', () => {
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
    expect(screen.getByText('Ask Olumi')).toBeInTheDocument()
    // A20 — Copy wrote only to an in-memory clipboard Paste could never
    // consume (Paste was always disabled with no server authority), so both
    // are hidden entirely rather than shown as a dead end.
    expect(screen.queryByText('Copy')).toBeNull()
    expect(screen.getByText('Delete')).toBeInTheDocument()
    expectLocalSemanticActionsInert()
  })
})
