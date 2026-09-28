/**
 * ⛔ A LINK THE SERVER HOLDS IS NEVER "NOT SAVED" (review r06 blocker 2,
 * 28 Sep 2026; follows canvas audit edit-structure/F2 + F3).
 *
 * F3 painted "Not saved · set strength" on any edge whose capture had stood
 * down (`structuralAddStandDown: 'strength_not_stated'`), and F2 named such a
 * link as the hold. The receipt was the whole predicate, and nothing cleared it
 * when the server came to hold the SAME PAIR: `overlayEdge` kept the canvas
 * data on the chat-turn receipt (`reconcileAppliedGraph`) and on the boot
 * readback (`mergeServerGraphOnHydrate`). Reachable path: draw a link with no
 * strength, then add it through the chat (the route the old toast named). The
 * link is then in CEE, but the canvas said "Not saved" on it for good (autosave
 * kept the receipt), F2 blamed it for the hold, and its add-control would send
 * a second `structural_add_edge` for a pair CEE already held.
 *
 * What this pins, per path, for the edge BY ID:
 *   · the receipt is gone from the edge (the root fix, `overlayEdge`);
 *   · no on-link word (`StyledEdge`, rendered from the store's edge);
 *   · no add-control (`InspectorRouter` → `EdgePanel`, by test id), and no
 *     "on your canvas only" note in the panel's footer (`InspectorRouter`);
 *   · F2 does not name it (`heldReason(...).kind`);
 *   · a stated strength queues NO `structural_add_edge` (the store retry).
 * Each path first proves every probe SEES the canvas-only state (the same
 * fixture before the server holds the pair), so a pass cannot be a blind probe.
 *
 * §C is the second guard alone: the receipt is still on the edge (no overlay
 * has visited it — e.g. a registration CEE acknowledged), but
 * `lastAuthoritativeGraph` records the pair as held.
 *
 * §D pins that dropping the receipt is a correction, not an edit: on both paths
 * it keeps every value, pushes no undo entry and counts no update.
 */
import '@testing-library/jest-dom/vitest'
import type { ComponentProps } from 'react'
import { cleanup, render, screen } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@xyflow/react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@xyflow/react')>()),
  useViewport: () => ({ x: 0, y: 0, zoom: 1 }),
  BaseEdge: () => <path data-testid="base-edge" />,
  EdgeLabelRenderer: ({ children }: { children: unknown }) => <div>{children as never}</div>,
  useReactFlow: () => ({ getNode: () => null, getEdges: () => [], getNodes: () => [] }),
  useStore: (selector: (s: unknown) => unknown) => selector({ nodes: [] }),
}))
vi.mock('../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))

import { useCanvasStore } from '../store'
import { StyledEdge } from '../edges/StyledEdge'
import { InspectorRouter } from '../ui/inspector-v2/InspectorRouter'
import { INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON } from '../ui/inspector-v2/useInspectorMutations'
import { heldReason } from '../utils/analysisHeldOnInjectedModel'
import { reconcileAppliedGraph } from '../utils/mergeAppliedGraph'
import { mergeServerGraphOnHydrate } from '../utils/mergeServerGraph'
import { edgePairKey } from '../utils/graphIdentity'
import {
  clearImportRegistrationMarkers,
  markGraphServerAcknowledged,
} from '../store/importRegistrationMarker'

const SCENARIO = 'scn-canvas-only-held'
/** Canonical 8-hex endpoint ids: the capture refuses anything else, so the contrast can queue. */
const FAC = 'fa0c7e11'
const OUT = '0c7e11fa'
const GOAL = 'a0a0a0a0'
const DRAWN = 'e_drawn'
const STAMP = { starterId: 'market-entry' }

const NODES = [
  { id: FAC, type: 'factor', position: { x: 0, y: 0 }, data: { kind: 'factor', label: 'Usage exposure', ...STAMP } },
  { id: OUT, type: 'outcome', position: { x: 0, y: 0 }, data: { kind: 'outcome', label: 'Churn', ...STAMP } },
  { id: GOAL, type: 'goal', position: { x: 0, y: 0 }, data: { kind: 'goal', label: 'Revenue', ...STAMP } },
]
const SAVED_LINK = { id: 'e_saved', source: FAC, target: GOAL, type: 'styled', data: { weight: 0.5, direction: 'positive' } }
/** Exactly what `addEdge` leaves for a drawn link: the default weight, no provenance, the receipt. */
const DRAWN_LINK = {
  id: DRAWN,
  source: FAC,
  target: OUT,
  type: 'styled',
  data: { weight: 0.3, direction: 'positive', structuralAddStandDown: 'strength_not_stated' },
}
/** The server's graph once the chat has added the same pair, with a strength. */
const SERVER_GRAPH = {
  nodes: [
    { id: FAC, kind: 'factor', label: 'Usage exposure' },
    { id: OUT, kind: 'outcome', label: 'Churn' },
    { id: GOAL, kind: 'goal', label: 'Revenue' },
  ],
  edges: [
    { from: FAC, to: GOAL, strength: { mean: 0.5 }, effect_direction: 'positive' },
    { from: FAC, to: OUT, strength: { mean: 0.6 }, effect_direction: 'positive' },
  ],
}
/** What EdgePanel's add-control writes when a person states a strength. */
const STATED = { weight: 0.4, weightSource: 'user', direction: 'positive', directionSource: 'user' }

/**
 * The saved example plus one drawn link: the base graph ACKNOWLEDGED, then the
 * link drawn — the state F2 names (see `aHoldNamesACanvasOnlyLink.spec.tsx`).
 */
function seed(extra: Record<string, unknown> = {}) {
  useCanvasStore.setState({
    currentScenarioId: SCENARIO,
    nodes: structuredClone(NODES) as never,
    edges: structuredClone([SAVED_LINK]) as never,
    importPendingServerRegistration: false,
    lastAuthoritativeGraph: null,
    serverGraphIdentity: null,
    lastServerGraphHash: 'srv-hash-1',
    history: { past: [], future: [] },
    pendingEmittedEdits: 0,
    pendingStructuralDeletes: [],
    pendingStructuralRenames: [],
    pendingStructuralAdds: [],
    pendingStructuralAddEdges: [],
    structuralRenameLifecycle: [],
    structuralAddLifecycle: [],
    _externalMutationActive: 0,
    results: { status: 'idle', report: null },
    selection: { nodeIds: new Set<string>(), edgeIds: new Set<string>(), anchorPosition: null },
  } as never)
  const s = useCanvasStore.getState()
  markGraphServerAcknowledged(SCENARIO, s.nodes as never, s.edges as never)
  useCanvasStore.setState({ edges: [...s.edges, structuredClone(DRAWN_LINK)] as never, ...extra } as never)
}

const theEdge = () => {
  const e = useCanvasStore.getState().edges.find((x) => x.id === DRAWN)
  expect(e, `${DRAWN} must still be on the canvas, bound by id`).toBeTruthy()
  return e!
}

function wordShown(): boolean {
  const e = theEdge()
  const props = {
    id: e.id, source: e.source, target: e.target,
    sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
    sourcePosition: Position.Bottom, targetPosition: Position.Top,
    selected: false, data: e.data,
  } as unknown as ComponentProps<typeof StyledEdge>
  render(<svg><StyledEdge {...props} /></svg>)
  const shown = screen.queryByTestId(`edge-canvas-only-${DRAWN}`) !== null
  cleanup()
  return shown
}

function addControlShown(): boolean {
  render(<InspectorRouter nodeId={null} edgeId={DRAWN} onClose={vi.fn()} />)
  const shown = screen.queryByTestId('edge-state-strength-for-save') !== null
  cleanup()
  return shown
}

/** The panel footer's drawn-link sentence (`InspectorRouter`), bound by its exact text. */
function canvasOnlyNoteShown(): boolean {
  render(<InspectorRouter nodeId={null} edgeId={DRAWN} onClose={vi.fn()} />)
  const shown = screen.queryByText(INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON) !== null
  cleanup()
  return shown
}

const holdKind = () => heldReason(useCanvasStore.getState() as never)?.kind ?? null

/** Stating a strength on the link: how many `structural_add_edge` intents it queues. */
function intentsQueuedByStatingAStrength(): number {
  const before = useCanvasStore.getState().pendingStructuralAddEdges.length
  useCanvasStore.getState().updateEdgeData(DRAWN, STATED as never)
  return useCanvasStore.getState().pendingStructuralAddEdges.length - before
}

beforeEach(() => {
  try { localStorage.setItem('feature.v5CanonicalAnalysis', '1') } catch { /* jsdom quirk */ }
  vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  clearImportRegistrationMarkers()
})

afterEach(() => {
  cleanup()
  clearImportRegistrationMarkers()
  vi.unstubAllEnvs()
  try { localStorage.removeItem('feature.v5CanonicalAnalysis') } catch { /* jsdom quirk */ }
})

describe('CONTROL: before the server holds the pair, every probe sees the canvas-only link', () => {
  it('receipt on the edge, word shown, add-control shown, F2 names it, a stated strength queues ONE add', () => {
    seed()
    expect(theEdge().data?.structuralAddStandDown).toBe('strength_not_stated')
    expect(wordShown()).toBe(true)
    expect(addControlShown()).toBe(true)
    expect(canvasOnlyNoteShown()).toBe(true)
    expect(holdKind()).toBe('canvas_only_link')
    expect(intentsQueuedByStatingAStrength()).toBe(1)
  })
})

describe.each([
  ['§A the chat-turn receipt (reconcileAppliedGraph)', () => reconcileAppliedGraph(SERVER_GRAPH as never)],
  ['§B the boot readback (mergeServerGraphOnHydrate)', () => {
    const res = mergeServerGraphOnHydrate(SERVER_GRAPH)
    expect(res.accepted, 'the readback must be applied, not refused').toBe(true)
  }],
] as const)('%s: once the server holds the pair', (_path, serverHolds) => {
  beforeEach(() => {
    seed()
    serverHolds()
    // Precondition: the server's graph was recorded as what it holds, pair included.
    expect(useCanvasStore.getState().lastAuthoritativeGraph?.edgePairs).toContain(edgePairKey(FAC, OUT))
  })

  it('ROOT: the receipt is dropped from the edge, so autosave cannot carry it forward', () => {
    expect(theEdge().data).not.toHaveProperty('structuralAddStandDown')
  })

  it('no "Not saved" word on the link', () => {
    expect(wordShown()).toBe(false)
  })

  it('no add-control in its panel, and no "on your canvas only" note', () => {
    expect(addControlShown()).toBe(false)
    expect(canvasOnlyNoteShown()).toBe(false)
  })

  it('F2 does not name it as the hold', () => {
    expect(holdKind()).not.toBe('canvas_only_link')
  })

  it('a stated strength queues NO second structural_add_edge for the pair', () => {
    expect(intentsQueuedByStatingAStrength()).toBe(0)
  })
})

describe('§C the second guard alone: the receipt is still on the edge, but the server is recorded as holding the pair', () => {
  beforeEach(() => {
    // No overlay ran (e.g. a registration CEE acknowledged carried the link).
    seed({
      lastAuthoritativeGraph: {
        nodeIds: [FAC, OUT, GOAL],
        edgePairs: [edgePairKey(FAC, GOAL), edgePairKey(FAC, OUT)],
      },
    })
    // Precondition: the receipt really is still there, so only the guard can hide it.
    expect(theEdge().data?.structuralAddStandDown).toBe('strength_not_stated')
  })

  it('no word, no add-control, no canvas-only note, F2 does not name it, and a stated strength queues nothing', () => {
    expect(wordShown()).toBe(false)
    expect(addControlShown()).toBe(false)
    expect(canvasOnlyNoteShown()).toBe(false)
    expect(holdKind()).not.toBe('canvas_only_link')
    expect(intentsQueuedByStatingAStrength()).toBe(0)
  })

  it('CONTRAST: a record holding only the OTHER pair leaves the link canvas-only', () => {
    useCanvasStore.setState({
      lastAuthoritativeGraph: { nodeIds: [FAC, OUT, GOAL], edgePairs: [edgePairKey(FAC, GOAL)] },
    } as never)
    expect(wordShown()).toBe(true)
    expect(addControlShown()).toBe(true)
    expect(canvasOnlyNoteShown()).toBe(true)
    expect(holdKind()).toBe('canvas_only_link')
    expect(intentsQueuedByStatingAStrength()).toBe(1)
  })
})

describe('§D dropping the receipt is a correction, never an edit (no undo entry, no counted update)', () => {
  /** The server holds both pairs and states nothing else about them: only the receipt can move. */
  const BARE = {
    nodes: SERVER_GRAPH.nodes,
    edges: [{ from: FAC, to: GOAL }, { from: FAC, to: OUT }],
  }

  it('receipt path: receipt dropped, zero counted updates, history untouched, every value kept', () => {
    seed()
    const before = { ...theEdge().data } as Record<string, unknown>
    const history = useCanvasStore.getState().history
    const result = reconcileAppliedGraph(BARE as never)
    expect(theEdge().data).not.toHaveProperty('structuralAddStandDown')
    const { structuralAddStandDown: _dropped, ...kept } = before
    expect(theEdge().data).toEqual(kept)
    expect(result.updatedEdgeCount).toBe(0)
    expect(useCanvasStore.getState().history).toBe(history)
  })

  it('boot path: receipt dropped, no undo snapshot, every value kept', () => {
    seed()
    const before = { ...theEdge().data } as Record<string, unknown>
    const pastLength = useCanvasStore.getState().history.past.length
    const res = mergeServerGraphOnHydrate(BARE)
    expect(res.accepted).toBe(true)
    expect(theEdge().data).not.toHaveProperty('structuralAddStandDown')
    const { structuralAddStandDown: _dropped, ...kept } = before
    expect(theEdge().data).toEqual(kept)
    expect(useCanvasStore.getState().history.past.length).toBe(pastLength)
  })
})
