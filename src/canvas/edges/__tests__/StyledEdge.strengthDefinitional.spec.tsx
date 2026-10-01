/**
 * MG 0ebb952a (1 Oct 2026) — ON THE GRAPH, A LINK THAT HOLDS BY DEFINITION IS
 * NOT MARKED OR SPOKEN AS AN ESTIMATE (`cond1-readers.md` D6 + D8's live surface).
 *
 * Before this change a part → total link (CEE #2445) carried the edge label's
 * `est.` marker ("Estimate not yet confirmed — the strength of this connection
 * was filled in for you. Open the details to set or confirm it.") and its hover
 * read "Direction · Olumi’s estimate" and "Strength … · Olumi’s estimate".
 *
 * Harness: `StyledEdge.strengthSettlementDisclosure.spec.tsx` (the marker) and
 * `StyledEdge.strengthPlaceholder.spec.tsx` (the hover). Edge data is produced
 * by the real `mapDraftEdgeToCanvas` from the wire edge whose `provenance` is
 * verbatim from the MG CEE probe; the CONTROL is the same wire without
 * `definitional` (must keep the marker and say "Olumi’s estimate"), and the
 * user's own (`user_specified`) is unchanged. Bound by `data-testid`.
 *
 * jsdom limit: declared DOM only; the served witness is the browser.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, fireEvent, act } from '@testing-library/react'
import { Position } from '@xyflow/react'
import { StyledEdge } from '../StyledEdge'
import { mapDraftEdgeToCanvas } from '../../utils/applyDraftResult'
import { BY_DEFINITION } from '../../domain/strengthDefinitional'

let mockEdges: Array<Record<string, unknown>> = []

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return {
    ...actual,
    BaseEdge: ({ style }: any) => <path data-testid="base-edge" style={style} />,
    EdgeLabelRenderer: ({ children }: any) => <div>{children}</div>,
    getBezierPath: () => ['M0 0 L100 100', 50, 50],
    getSmoothStepPath: () => ['M0 0 L100 100', 50, 50],
    getStraightPath: () => ['M0 0 L100 100', 50, 50],
    useReactFlow: () => ({ getNode: () => null, getEdges: () => mockEdges, getNodes: () => [] }),
    useStore: (selector: any) => selector({ nodes: [] }),
  }
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector: any) =>
    selector({
      updateEdgeData: vi.fn(),
      runMeta: { ceeReview: null },
      results: { status: 'complete', report: null },
      viewMode: 'detailed',
      hoveredOptionId: null,
      highlightedEdges: new Set<string>(),
      dimmedEdgeIds: new Set<string>(),
      lens: {
        active: 'full',
        _dimmedEdgeIds: new Set<string>(),
        _sensitivityWeights: new Map<string, number>(),
        _sensitivityQuartiles: null,
        _fragileEdgeIds: new Set<string>(),
        _lensFragileLabels: new Map<string, string>(),
      },
    }),
  ),
}))
vi.mock('../../hooks/useModelChangedSinceRun', () => ({
  useModelChangedSinceRunLight: () => false,
  useModelChangedSinceRun: () => false,
}))
vi.mock('../../store/edgeLabelMode', () => ({
  useEdgeLabelMode: vi.fn((selector: any) => selector({ mode: 'human' })),
}))
vi.mock('../../hooks/useTheme', () => ({ useIsDark: () => false }))
vi.mock('../../hooks/useFirstTimeHints', () => ({
  useEdgeEditHint: () => ({ showHint: false, dismissHint: vi.fn() }),
}))
vi.mock('../../hooks/usePrefersReducedMotion', () => ({ usePrefersReducedMotion: () => false }))
vi.mock('../../../flags', () => ({ isGraphLensEnabled: () => false }))

type WireEdge = Record<string, unknown> & { from: string; to: string }
const NATURAL = {
  amount: 1,
  amount_unit: '% of upcoming sprint capacity',
  per_source_change: 1,
  per_source_change_unit: '% of upcoming sprint capacity',
  strength_mean: 1,
  strength_mean_frame: 'edge_strength',
}
const DEFINITIONAL: WireEdge = {
  from: 'n1',
  to: 'n2',
  strength: { mean: 1, std: 0.001 },
  exists_probability: 1,
  effect_direction: 'positive',
  provenance_display: 'ai_inferred',
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL, definitional: true },
}
const ESTIMATE: WireEdge = {
  ...DEFINITIONAL,
  provenance: { source: 'cee_hypothesis', magnitude: 'olumi_estimate', natural_effect: NATURAL },
}
const USER_STATED: WireEdge = {
  ...DEFINITIONAL,
  provenance_display: 'user_set',
  provenance: { source: 'user_specified', magnitude: 'user_stated', natural_effect: NATURAL },
}
const dataOf = (w: WireEdge) => mapDraftEdgeToCanvas({ ...w }, 0).data as Record<string, unknown>

const props = {
  id: 'e1', source: 'n1', target: 'n2',
  sourceX: 0, sourceY: 0, targetX: 100, targetY: 100,
  sourcePosition: Position.Right, targetPosition: Position.Left,
  selected: false,
}

function renderEdge(data: Record<string, unknown>) {
  mockEdges = [{ id: 'e1', source: 'n1', target: 'n2', data }]
  return render(<StyledEdge {...(props as any)} data={data} />).container
}
const marker = (c: HTMLElement) => c.querySelector('[data-testid="estimate-marker"]')
const strengthText = (c: HTMLElement) => c.querySelector('[data-testid="edge-influence-label-text"]')

beforeEach(() => {
  mockEdges = []
})

describe('D8 (live surface) — the edge label carries no `est.` marker for a definition', () => {
  it('a definitional link speaks its strength with NO unconfirmed marker', () => {
    const c = renderEdge(dataOf(DEFINITIONAL))
    expect(strengthText(c), 'the strength row did not render').not.toBeNull()
    expect(marker(c)).toBeNull()
  })

  it('CONTROL: the same wire as an Olumi estimate carries the marker', () => {
    const c = renderEdge(dataOf(ESTIMATE))
    expect(strengthText(c)).not.toBeNull()
    expect(marker(c)).not.toBeNull()
  })

  it("CONTROL: the user's own carries no marker (unchanged)", () => {
    const c = renderEdge(dataOf(USER_STATED))
    expect(strengthText(c)).not.toBeNull()
    expect(marker(c)).toBeNull()
  })
})

describe('D6 — the hover says "By definition"', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  const hover = (data: Record<string, unknown>) => {
    const c = renderEdge(data)
    const hit = c.querySelector('path[stroke="transparent"]')!
    act(() => {
      fireEvent.mouseEnter(hit)
      vi.advanceTimersByTime(400)
    })
    expect(c.querySelector('[data-testid="edge-hover-popover"]'), 'the hover did not open').not.toBeNull()
    return {
      direction: c.querySelector('[data-testid="edge-hover-direction"]')?.textContent ?? '',
      strength: c.querySelector('[data-testid="edge-hover-strength"]')?.textContent ?? '',
    }
  }

  it('a definition: both rows say "By definition", never "Olumi’s estimate" or "Confirmed by you"', () => {
    const h = hover(dataOf(DEFINITIONAL))
    expect(h.direction).toContain(BY_DEFINITION)
    expect(h.strength).toContain(BY_DEFINITION)
    expect(`${h.direction} ${h.strength}`).not.toMatch(/Olumi|Confirmed by you/)
  })

  it('CONTROL: the same wire as an Olumi estimate says "Olumi’s estimate" on both rows', () => {
    const h = hover(dataOf(ESTIMATE))
    expect(h.direction).toContain('Olumi’s estimate')
    expect(h.strength).toContain('Olumi’s estimate')
  })

  it("CONTROL: the user's own says \"Set by you\" (unchanged)", () => {
    const h = hover(dataOf(USER_STATED))
    expect(h.direction).toContain('Set by you')
    expect(h.strength).toContain('Set by you')
  })
})
