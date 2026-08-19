/**
 * ONE PLACEMENT AUTHORITY — the two halves of UI #800 that no gate could see.
 *
 * #800 fixed two defects in `FloatingOlumiPanel`. The first (the fit-then-place
 * rule itself) is pinned by `FloatingOlumiPanel.graphAwarePlacement.spec.ts`.
 * The second was NOT pinned anywhere: an adversarial reviewer ran three mutants
 * against the entire 26-spec / 287-test floating-panel neighbourhood and ALL
 * THREE SURVIVED — 287 passed, every time.
 *
 *   M1  revert the layout effect's deps to the pre-#800 list                SURVIVED
 *   M2  delete the re-clamp handler's `!el.style.left` guard                SURVIVED
 *   M3  revert the settle guard to a bare `if (position === null)`          SURVIVED
 *
 * A `react-hooks/exhaustive-deps` autofix — or anyone tidying that deps array —
 * would therefore reintroduce the measured `[52, 73]`-at-every-viewport defect
 * under a fully green required check. The only instrument that catches it today
 * is `e2e/geometry/decisionNodeHittest.measure.ts`, a `*.measure.ts` that is
 * provably OUTSIDE the vitest gate (`vitest.config.ts` collects `src/**` and
 * `tests/**` only) and is run deliberately, by hand.
 *
 * ⚠ WHY jsdom IS SUFFICIENT AND THIS IS NOT A TRAP-3 VIOLATION. Every claim
 * below is about STRING AGREEMENT between two authorities for one fact — the
 * store's `position` and the panel's inline `style.left`/`style.top` — plus the
 * absence of a write. Nothing here asserts that anything is VISIBLE, laid out,
 * or clear of the model; those are the browser instrument's job and stay there.
 *
 * Mock layout mirrors `FloatingOlumiPanel.dockInset.spec.tsx`, with ONE
 * difference: the canvas store mock is a REAL zustand store rather than a frozen
 * object, because the defect only exists on the transition `nodeCount 0 -> 1`
 * and a non-subscribable mock cannot produce it.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, render } from '@testing-library/react'
import type { ReactNode } from 'react'

vi.mock('../../../lib/supabase', () => ({
  supabase: { from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null }) }) }) }) },
  isSupabaseAvailable: () => false,
}))
vi.mock('dompurify', () => ({ default: { sanitize: (s: string) => s } }))
vi.mock('../../utils/markdown', () => ({
  renderMarkdown: (s: string) => s,
  sanitiseMarkdown: (s: string) => s,
}))

interface CanvasMockNode { id: string; type?: string }
interface CanvasMockState {
  nodes: CanvasMockNode[]
  edges: unknown[]
  results: { status: string }
  _internal: Record<string, unknown>
  selection: unknown
  ceeAnalysisReady: unknown
  graphHealth: unknown
  runMeta: unknown
  pendingLayout: boolean
  layoutInProgress: boolean
  layoutVersion: number
}

vi.mock('../../store', async () => {
  const { create } = await import('zustand')
  const useCanvasStore = create<CanvasMockState>(() => ({
    nodes: [],
    edges: [],
    results: { status: 'idle' },
    _internal: {},
    selection: null,
    ceeAnalysisReady: null,
    graphHealth: null,
    runMeta: {},
    pendingLayout: false,
    layoutInProgress: false,
    layoutVersion: 0,
  }))
  return {
    useCanvasStore,
    selectResultsStatus: (s: CanvasMockState) => s.results?.status,
    selectReport: (s: { results?: { report?: unknown } }) => s.results?.report,
    selectError: (s: { results?: { error?: unknown } }) => s.results?.error,
    selectResultsSource: (s: { results?: { source?: unknown } }) => s.results?.source,
  }
})

vi.mock('../../conversation/ConversationPanel', () => ({ ConversationPanel: () => null }))
vi.mock('../../hooks/useStageAwarePlaceholder', () => ({ useStageAwarePlaceholder: () => 'Ask' }))
vi.mock('../../conversation/useConversation', async () => {
  const { useState } = await import('react')
  return {
    useConversation: () => {
      const [sendMessage] = useState(() => vi.fn())
      return {
        messages: [],
        isThinking: false,
        longRunningHint: null,
        sendMessage,
        sendSystemEvent: vi.fn(),
        sendChip: vi.fn(),
        retryLast: vi.fn(),
        patchBlockStates: new Map(),
        setPatchBlockState: vi.fn(),
        patchRejections: new Map(),
        setPatchRejection: vi.fn(),
      }
    },
    isNonConversationalContent: () => false,
  }
})

import { ConversationProvider } from '../../conversation/ConversationContext'
import { FloatingOlumiPanel } from '../FloatingOlumiPanel'
import { useFloatingPanelState } from '../../hooks/useFloatingPanelState'
import { useCanvasStore as realCanvasStore } from '../../store'

/**
 * `vi.mock` is a RUNTIME substitution — TypeScript still resolves this import to
 * the real canvas store, whose `Node` type this fixture deliberately does not
 * satisfy (the placement rule reads only `id` and `type`). Narrow the handle to
 * the mock's own shape rather than widening the fixture to a full `Node`, which
 * would be a lie about what the rule actually consumes.
 */
const canvasStore = realCanvasStore as unknown as {
  setState: (patch: Partial<CanvasMockState>) => void
  getState: () => CanvasMockState
}

function Wrapper({ children }: { children: ReactNode }) {
  return <ConversationProvider>{children}</ConversationProvider>
}

const VIEWPORT_W = 1440
const VIEWPORT_H = 900

interface StubBox { left: number; top: number; width: number; height: number }

/** Mount a React Flow node stub the placement rule can measure.
 *  `readModelBoxes` looks nodes up by `.react-flow__node[data-id]` and drops
 *  zero-size rects, so the rect has to be mocked — jsdom runs no layout. */
function mountGraphNode(id: string, box: StubBox): (next: StubBox) => void {
  const el = document.createElement('div')
  el.className = 'react-flow__node'
  el.setAttribute('data-id', id)
  document.body.appendChild(el)
  let b = box
  el.getBoundingClientRect = () =>
    ({
      left: b.left,
      top: b.top,
      right: b.left + b.width,
      bottom: b.top + b.height,
      width: b.width,
      height: b.height,
      x: b.left,
      y: b.top,
      toJSON: () => ({}),
    }) as DOMRect
  return (next: StubBox) => {
    b = next
  }
}

const panelEl = () => document.querySelector('[data-testid="floating-olumi-panel"]') as HTMLElement | null

beforeEach(() => {
  Object.defineProperty(window, 'innerWidth', { value: VIEWPORT_W, configurable: true })
  Object.defineProperty(window, 'innerHeight', { value: VIEWPORT_H, configurable: true })
  useFloatingPanelState.getState().reset()
  document.body.querySelectorAll('.react-flow__node').forEach((el) => el.remove())
  canvasStore.setState({ nodes: [], layoutVersion: 0, pendingLayout: false, layoutInProgress: false })
})

describe('FloatingOlumiPanel — the store and the DOM agree about where the panel is', () => {
  /**
   * M1. THE HERO-YIELD BOUNDARY, which is the path every seeded user reaches.
   *
   * The component returns `null` for exactly `!isOpen || yieldToFirstUse ||
   * yieldToDockedOlumi`, so `containerRef` is null and the layout effect
   * early-returns. Pre-#800 only `isOpen` was in that effect's deps, so when the
   * first graph landed and `yieldToFirstUse` flipped false, the container
   * MOUNTED WITHOUT THE EFFECT EVER RE-RUNNING: the panel kept its JSX defaults,
   * `setInitialPosition` was never called, and the store still said
   * `position: null` while the DOM had been pinned to the clamp floor.
   */
  it('commits a placement when the first graph lands and the hero stops yielding', () => {
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'system-first-use',
      userRepositioned: false,
      isMinimised: false,
      position: null,
      size: { width: 400, height: 500 },
    } as never)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })

    // PRECONDITION, PINNED IN-TEST: we really are on the yielding side of the
    // boundary. Without this the transition below could be a no-op and every
    // assertion after it would pass by measuring nothing.
    expect(panelEl(), 'PRECONDITION: the hero must be yielding, so no panel is mounted yet').toBeNull()
    expect(useFloatingPanelState.getState().position, 'PRECONDITION: nothing is committed yet').toBeNull()

    // The first graph lands: store nodes appear, React Flow renders them, the
    // canvas store reports quiescence. `yieldToFirstUse` flips false and the
    // container mounts.
    act(() => {
      mountGraphNode('dec-1', { left: 300, top: 200, width: 220, height: 90 })
      mountGraphNode('fac-1', { left: 640, top: 430, width: 200, height: 80 })
      canvasStore.setState({
        nodes: [{ id: 'dec-1', type: 'decision' }, { id: 'fac-1', type: 'factor' }],
        layoutVersion: 1,
      })
    })

    const panel = panelEl()
    expect(panel, 'the container must mount once the hero stops yielding').not.toBeNull()

    const committed = useFloatingPanelState.getState().position
    expect(committed, 'the store must know where the panel is: expected null not to be null').not.toBeNull()
    expect(panel!.style.left, 'store and DOM must agree on the panel position (x)').toBe(`${committed!.x}px`)
    expect(panel!.style.top, 'store and DOM must agree on the panel position (y)').toBe(`${committed!.y}px`)
    // Not the untouched JSX default, and not the clamp floor the defect produced.
    expect(panel!.style.left, 'the placement must be COMPUTED, not the JSX default').not.toBe('0px')
  })

  /**
   * M1, second face. The measured symptom was a placement BYTE-IDENTICAL from
   * 1024 to 1920 — a fixed-origin window standing in for a computed one. A
   * committed placement is viewport-derived, so two different viewports must not
   * produce the same x. This discriminates a real computation from any constant.
   */
  it('derives the committed placement from the live viewport, not a constant', () => {
    const commitAt = (vw: number): number => {
      Object.defineProperty(window, 'innerWidth', { value: vw, configurable: true })
      useFloatingPanelState.getState().reset()
      canvasStore.setState({ nodes: [], layoutVersion: 0 })
      document.body.querySelectorAll('.react-flow__node').forEach((el) => el.remove())
      useFloatingPanelState.setState({
        isOpen: true,
        source: 'system-first-use',
        userRepositioned: false,
        isMinimised: false,
        position: null,
        size: { width: 400, height: 500 },
      } as never)
      const { unmount } = render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
      act(() => {
        mountGraphNode('dec-1', { left: 120, top: 180, width: 220, height: 90 })
        canvasStore.setState({ nodes: [{ id: 'dec-1', type: 'decision' }], layoutVersion: 1 })
      })
      const pos = useFloatingPanelState.getState().position
      expect(pos, `the store must know where the panel is at ${vw}px`).not.toBeNull()
      unmount()
      return pos!.x
    }

    const narrow = commitAt(1200)
    const wide = commitAt(1800)
    expect(wide, 'the committed x must move with the viewport, not sit at a fixed origin').not.toBe(narrow)
  })

  /**
   * M3. THE SETTLE GUARD. `setInitialPosition` is a ONE-SHOT (it writes only
   * while `position` is null), so committing a placement measured against
   * half-laid-out node rects freezes the panel at a position derived from
   * geometry that no longer exists. Until the canvas store reports quiescence
   * AND something is rendered, the placement is applied to the DOM but left
   * UNCOMMITTED so the effect can re-derive it.
   */
  it('does not commit a placement measured against a model that is still settling', () => {
    // Nodes exist in the store, React Flow has rendered them at their
    // pre-layout rects, and the canvas store has NOT reported quiescence.
    const movePre = mountGraphNode('dec-1', { left: 20, top: 20, width: 220, height: 90 })
    const moveFac = mountGraphNode('fac-1', { left: 30, top: 130, width: 200, height: 80 })
    canvasStore.setState({
      nodes: [{ id: 'dec-1', type: 'decision' }, { id: 'fac-1', type: 'factor' }],
      layoutVersion: 0,
      layoutInProgress: true,
    })
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: false,
      isMinimised: false,
      position: null,
      size: { width: 400, height: 500 },
    } as never)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })

    const panel = panelEl()
    expect(panel, 'PRECONDITION: the panel is mounted while the model settles').not.toBeNull()
    // PRECONDITION: the placement IS applied to the DOM — the claim is about the
    // COMMIT, not about the panel being unplaced.
    expect(panel!.style.left, 'PRECONDITION: the DOM is placed even while settling').not.toBe('')
    const whileSettling = panel!.style.left

    expect(
      useFloatingPanelState.getState().position,
      'a placement measured against a settling model must NOT be committed — setInitialPosition is a one-shot',
    ).toBeNull()

    // Layout commits: the nodes move to their laid-out rects and the store
    // reports quiescence. NOW the placement is committed.
    act(() => {
      movePre({ left: 700, top: 520, width: 220, height: 90 })
      moveFac({ left: 980, top: 640, width: 200, height: 80 })
      canvasStore.setState({ layoutVersion: 1, layoutInProgress: false })
    })

    const committed = useFloatingPanelState.getState().position
    expect(committed, 'once the model has settled the placement must be committed').not.toBeNull()
    expect(panel!.style.left, 'store and DOM must agree on the committed placement').toBe(`${committed!.x}px`)
    // NON-VACUITY: the two geometries must actually disagree, or "committed the
    // settled one" would hold trivially for the settling one too.
    expect(panel!.style.left, 'the committed placement must be the SETTLED geometry, not the settling one').not.toBe(
      whileSettling,
    )
  })

  /**
   * M2. ONE PLACEMENT AUTHORITY. The viewport/dock re-clamp handler RE-CLAMPS a
   * panel the layout effect has already placed; it must never INVENT one.
   * Without its guard it read an unset `el.style.left` as `parseFloat('') || 0`
   * -> 0 -> clamped to the floor, which is how the panel came to sit at a
   * byte-identical (52, 73) at every viewport while the store held `null`.
   */
  it('the re-clamp handler refuses to invent a position for an unplaced panel', () => {
    mountGraphNode('dec-1', { left: 300, top: 200, width: 220, height: 90 })
    canvasStore.setState({ nodes: [{ id: 'dec-1', type: 'decision' }], layoutVersion: 1 })
    useFloatingPanelState.setState({
      isOpen: true,
      source: 'user',
      userRepositioned: true,
      isMinimised: false,
      position: { x: 300, y: 120 },
      size: { width: 400, height: 500 },
    } as never)
    render(<FloatingOlumiPanel onDock={() => {}} onCogClick={() => {}} />, { wrapper: Wrapper })
    const panel = panelEl()!
    expect(panel.style.left, 'PRECONDITION: the layout effect has placed the panel').not.toBe('')

    // Reproduce the one state the guard exists for: the container is mounted but
    // the layout effect has not written to it, so the inline style is unset. The
    // handler's only honest answer is to wait for the effect, not to guess.
    panel.style.left = ''
    panel.style.top = ''
    expect(panel.style.left, 'PRECONDITION: the panel is unplaced when the handler runs').toBe('')

    act(() => {
      window.dispatchEvent(new Event('resize'))
      window.dispatchEvent(new Event('outputs-dock-opened'))
    })

    expect(panel.style.left, 'the re-clamp handler must not invent an x for an unplaced panel').toBe('')
    expect(panel.style.top, 'the re-clamp handler must not invent a y for an unplaced panel').toBe('')
  })
})
