/**
 * THE UNCERTAINTY RIBBON REACHES THE BOARD — and refuses the fabricated default.
 *
 * ⭐ WHY THIS SPEC EXISTS AT THE MOUNT AND NOT ONLY AT THE FUNCTION. A pure
 * geometry test proves the ribbon WOULD be the right width if anyone asked for
 * one. This estate's chronic failure #1 is building things nobody asks for:
 * `strengthStd` arrived on 30/30 edges of the committed capture, was stored,
 * was editable by a user, was printed in the inspector — and no component on
 * the graph ever read it. So the load-bearing assertion here is that
 * `StyledEdge` ITSELF emits the ribbon, bound to the rendered DOM.
 *
 * CLAIM TYPES — nothing here claims more than one of these:
 *   1. Pure-function return values (`mapDraftEdgeToCanvas`, the resolvers).
 *   2. Attribute values read off the rendered DOM.
 * jsdom cannot prove VISIBILITY or layout (platform trap 3). That `opacity` is
 * 0.2 and that the ribbon paints BEHIND the line are claims about paint order
 * and compositing which only a browser can settle; they are deliberately not
 * asserted here, and are carried by the live witness instead.
 */
import { describe, it, expect, vi } from 'vitest'
import { render } from '@testing-library/react'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { USER_EDGE_DEFAULTS } from '../../domain/edges'
import { resolveEdgeValueDisplay } from '../../domain/edgeValueProvenance'
import { uncertaintyBandHalfWidth } from '../../utils/graphDisplayCalculations'

const nodeKinds: Record<string, string> = {}

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => (
      <path data-testid="base-edge" data-stroke-width={String(style?.strokeWidth)} />
    ),
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({
      getNode: (id: string) =>
        nodeKinds[id]
          ? { id, type: nodeKinds[id], data: { label: id }, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 } }
          : null,
      getEdges: () => [],
      getNodes: () => Object.entries(nodeKinds).map(([id, kind]) => ({
        id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
      })),
    }),
    useStore: (selector: any) => selector({
      nodes: Object.entries(nodeKinds).map(([id, kind]) => ({
        id, type: kind, data: {}, position: { x: 0, y: 0 }, measured: { width: 200, height: 80 },
      })),
    }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) => selector({
    updateEdgeData: vi.fn(),
    runMeta: { ceeReview: null },
    results: { status: 'complete', report: null },
    hoveredOptionId: null,
    highlightedEdges: new Set<string>(),
    dimmedEdgeIds: new Set<string>(),
    viewMode: 'detailed',
    lens: {
      active: 'none',
      _dimmedEdgeIds: new Set<string>(),
      _sensitivityWeights: new Map<string, number>(),
      _sensitivityQuartiles: null,
      _fragileEdgeIds: new Set<string>(),
      _lensFragileLabels: new Map<string, string>(),
      _hiddenNodeIds: new Set<string>(),
      _hiddenEdgeIds: new Set<string>(),
      _causalEdgeParams: new Map(),
      _evidenceNodeClass: new Map(),
      _evidenceEdgeClass: new Map(),
    },
  })),
}))
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../utils/fragileEdgeMatch', () => ({
  isEdgeFragile: () => false,
  getFragileEdgeSwitchProbability: () => null,
  isTopFragileEdge: () => false,
}))
// ⛔ importOriginal-SPREAD, never a hand-listed replacement (trap 12). The
// geometry under test stays REAL — a mocked `uncertaintyBandHalfWidth` would
// make every width assertion below a statement about the mock.
vi.mock('../../utils/graphDisplayCalculations', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../utils/graphDisplayCalculations')>()),
  existenceCertaintyToLineStyle: () => undefined,
  calculateEdgeImportance: () => 0.5,
}))
vi.mock('../../theme/edges', () => ({ applyEdgeVisualProps: (_: any, props: any) => props }))

const baseProps = {
  id: 'e-under-test', source: 'src', target: 'tgt',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: false,
}

type WireEdge = Record<string, unknown>

function findEdge(from: string, to: string): WireEdge {
  const p = resolve(__dirname, '../../starters/data', 'pricing-model.draft.json')
  const j = JSON.parse(readFileSync(p, 'utf8'))
  const edges = (j.edges ?? j.graph?.edges ?? []) as WireEdge[]
  const hit = edges.find(e => e.from === from && e.to === to)
  expect(hit, `capture no longer carries ${from} → ${to}`).toBeDefined()
  return hit as WireEdge
}

/** THE PRODUCER. Whatever real ingestion writes is what the edge sees. */
const ingest = (w: WireEdge) => mapDraftEdgeToCanvas(w, 0).data as Record<string, unknown>

/** A real causal edge: mean −0.3504, std 0.109 — both stated by the producer. */
const CAUSAL_WIRE = findEdge('fac_adoption_friction', 'out_bottom_up_growth')
const CAUSAL_DATA = ingest(CAUSAL_WIRE)

/** The same edge with the producer's std deleted — nothing else changed. */
const NO_STD_DATA = ingest((() => {
  const { strength, ...rest } = CAUSAL_WIRE as Record<string, unknown> & { strength?: Record<string, unknown> }
  const strengthRest = { ...((strength ?? {}) as Record<string, unknown>) }
  delete strengthRest.std
  return { ...rest, strength: strengthRest }
})())

function renderEdge(data: Record<string, unknown>, kinds: Record<string, string>) {
  for (const k of Object.keys(nodeKinds)) delete nodeKinds[k]
  Object.assign(nodeKinds, kinds)
  return render(<svg><StyledEdge {...(baseProps as any)} data={data as any} /></svg>)
}

const CAUSAL_KINDS = { src: 'factor', tgt: 'outcome' }
const band = (c: HTMLElement) => c.querySelector('[data-testid="edge-uncertainty-band-e-under-test"]')

describe('the ribbon reaches the board', () => {
  it('renders for a producer-stated uncertainty on a real capture edge', () => {
    const { container } = renderEdge(CAUSAL_DATA, CAUSAL_KINDS)
    expect(band(container)).not.toBeNull()
  })

  /**
   * ⭐ BOUND TO THE GEOMETRY BY DERIVATION, NOT BY A LITERAL. The expected
   * width is computed from the SAME resolver + function the component uses, so
   * this asserts the component ROUTES the right quantity — it cannot be
   * satisfied by a ribbon of some other edge's width, and it does not go stale
   * when the scale constant moves.
   */
  it('draws it at the width the capture\'s own std earns', () => {
    const expected = uncertaintyBandHalfWidth(resolveEdgeValueDisplay(CAUSAL_DATA, 'strengthStd'))
    expect(expected).not.toBeNull()
    const { container } = renderEdge(CAUSAL_DATA, CAUSAL_KINDS)
    expect(band(container)!.getAttribute('data-uncertainty-half-width')).toBe(String(expected))
    expect(band(container)!.getAttribute('stroke-width')).toBe(String(expected! * 2))
  })

  it('draws nothing when the producer stated no uncertainty', () => {
    const { container } = renderEdge(NO_STD_DATA, CAUSAL_KINDS)
    expect(band(container)).toBeNull()
  })

  /**
   * ⛔ THE FABRICATION REFUSAL, AT THE MOUNT. `USER_EDGE_DEFAULTS` carries
   * `strengthStd: 0.15` unstamped. A raw read would paint a confident-looking
   * ribbon along every hand-drawn edge announcing an uncertainty nobody ever
   * stated — the defect `KeyRelationships` already shipped once on a quieter
   * channel. The contrast case below proves this zero is real and not the test
   * simply failing to find anything.
   */
  it('refuses the unstamped UI default on a user-drawn edge', () => {
    const { container } = renderEdge({ ...USER_EDGE_DEFAULTS } as Record<string, unknown>, CAUSAL_KINDS)
    expect(band(container)).toBeNull()
  })

  it('CONTRAST: the same user edge draws once a source stamps that value', () => {
    const { container } = renderEdge(
      { ...USER_EDGE_DEFAULTS, strengthStdSource: 'user' } as Record<string, unknown>,
      CAUSAL_KINDS,
    )
    expect(band(container)).not.toBeNull()
  })

  /** Scaffolding, not a causal claim — decision→option has no strength to be
   *  uncertain about, and the capture gives those edges a token std of 0.01. */
  it('does not draw on a structural edge', () => {
    const structural = ingest(findEdge('dec_pricing', 'opt_hybrid'))
    expect(resolveEdgeValueDisplay(structural, 'strengthStd').show).toBe(true)
    const { container } = renderEdge(structural, { src: 'decision', tgt: 'option' })
    expect(band(container)).toBeNull()
  })
})
