/**
 * Risk and outcome cards keep a reduced line below the legibility floor.
 *
 * ⭐⭐ WHY THIS FILE EXISTS, AND IT IS THE MOST USEFUL THING IN IT.
 *
 * `shared/lodMetricLine.ts` shipped in #1069 to stop cards going blank when the
 * user zooms out. It was tested — 13 unit tests, 4 biting mutants, a
 * discriminating pair — and it was **half wrong on the deployed build**.
 * Measured on `30bd7f8c` by opening staging and counting:
 *
 *     factor  6/6 lines      option  4/4 lines
 *     risk    0/3            outcome 0/3
 *
 * The resolver asked a risk for `probability` + `impact` and an outcome for
 * `achievementProbability`. **A real guest model carries none of them.** Both
 * card types render exactly one figure — `strength · N% · est.`, the bridge
 * strength aggregated from the store's EDGES — and the resolver never looked
 * there, because a central function reading `data` cannot see an edge.
 *
 * ⛔ SO THIS IS THE SAME DEFECT #1069 WAS WRITTEN TO FIX, REPRODUCED ONE TYPE
 * ALONG: asking for the datum the node LACKS instead of the one it HAS. Writing
 * the rule down did not stop me repeating it two node types later.
 *
 * ⚠ AND WHY NO TEST CAUGHT IT — the part worth carrying forward. Every fixture
 * in the resolver's own spec supplied `probability`/`impact` and
 * `achievementProbability`, **because I wrote those fixtures from the type
 * definition rather than from the wire.** The corpus and the code shared one
 * blind spot, so the corpus certified the blind spot. jsdom did not fail me;
 * my choice of inputs did.
 *
 * The fixtures below are therefore built from the MEASURED shape: a bridge edge
 * carrying a weight, and a node carrying NO probability, NO impact and NO
 * achievement probability — which is what staging actually sends.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { RiskNode } from '../RiskNode'
import { OutcomeNode } from '../OutcomeNode'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const makeStoreState = (overrides: Record<string, unknown> = {}) => ({
  results: { status: 'idle', report: null },
  highlightedNodes: new Set(),
  dimmedNodeIds: new Set(),
  editedSinceRunNodeIds: new Set(),
  analysisHighlight: { source: null, edgeIds: new Set(), nodeIds: new Set() },
  lens: { _dimmedNodeIds: new Set(), _hiddenNodeIds: new Set(), active: 'full' },
  goalThreshold: null,
  goalConstraints: [],
  hoveredOptionId: null,
  ceeAnalysisReady: null,
  edges: [],
  nodes: [],
  viewMode: 'standard',
  lodActive: false,
  ...overrides,
})

vi.mock('../../store', () => ({
  useCanvasStore: vi.fn((selector) => selector(makeStoreState())),
}))

vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    influenceProvenance: null,
    confidence: null,
    inSensitivityAnalysis: false,
    // ⚠ NULL ON PURPOSE. This is the field the first cut asked an outcome for,
    // and the field a real model does not carry. Supplying it here would
    // rebuild the exact fixture that certified the defect.
    achievementProbability: null,
    achievementProbabilityIsModelledBasis: null,
    stabilityPercentage: null,
    winRate: null,
    isResultsMode: false,
  })),
}))

import { useCanvasStore } from '../../store'

const baseProps = {
  type: 'risk',
  position: { x: 0, y: 0 },
  selected: false,
  isConnectable: true,
  positionAbsoluteX: 0,
  positionAbsoluteY: 0,
  dragging: false,
  zIndex: 0,
}

/**
 * The bridge edge, in the shape a PRODUCER actually sends.
 *
 * ⚠ `strength_mean`, NOT a bare `weight` — and getting this wrong was the third
 * fixture I wrote tonight from a type definition instead of from the wire.
 * `resolveEdgeSignedStrengthDisplay` is provenance-gated: a bare `weight` with
 * no source stamp returns `{ show: false }`, deliberately, because
 * `DEFAULT_EDGE_DATA` and `USER_EDGE_DEFAULTS` always define `weight` and an
 * ungated read would print the 0.3 default as a measurement. So a fixture built
 * from `weight` alone renders NO strength at all, and every assertion about the
 * reduced line passes vacuously against a card that shows nothing.
 *
 * Derived rather than assumed: the deployed cards render `est.`, which requires
 * `show === true` AND `weightSource !== 'user'`. The only route to that without
 * an explicit stamp is the documented producer-only fallback — `strength_mean`
 * present implies source `'cee'`. That is what this builds.
 */
const modelWithBridge = (nodeId: string, kind: string, strength: number, userStated?: boolean) => ({
  lodActive: true,
  nodes: [
    { id: nodeId, type: kind, data: { type: kind } },
    { id: 'goal-1', data: { type: 'goal' } },
  ],
  edges: [
    {
      id: 'e1',
      source: nodeId,
      target: 'goal-1',
      data: userStated
        ? { weight: strength, direction: 'negative', beliefExists: null, weightSource: 'user' }
        : { strength_mean: strength, direction: 'negative', beliefExists: null },
    },
  ],
})

const lodLine = () => screen.queryByTestId('node-lod-line')?.textContent ?? null

describe('the deployed defect: risk and outcome cards went blank when zoomed out', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('a risk states its bridge strength — the one figure its card reliably has', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState(modelWithBridge('risk-1', 'risk', 0.5)) as any),
    )
    render(
      <ReactFlowProvider>
        {/* NO probability, NO impact — exactly what staging sends */}
        <RiskNode {...(baseProps as any)} id="risk-1" data={{ label: 'Budget Overrun', type: 'risk' }} />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toBe('Strength 50% est.')
  })

  it('an outcome does the same, from the same seam', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState(modelWithBridge('outcome-1', 'outcome', 0.7)) as any),
    )
    render(
      <ReactFlowProvider>
        <OutcomeNode
          {...(baseProps as any)}
          type="outcome"
          id="outcome-1"
          data={{ label: 'Support Team Satisfaction', type: 'outcome' }}
        />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toBe('Strength 70% est.')
  })
})

describe('⛔ `est.` is part of the figure, not decoration', () => {
  /*
   * THE DISCRIMINATING PAIR. Same node, same weight, two provenances. If the
   * marker were hardcoded both would carry it; if it were dropped neither
   * would. One of each is the only result that shows the provenance is being
   * read — and it is the same rule as the caveat gate one level up: a figure
   * may not appear at low zoom stripped of the disclosure the full card is
   * required to show beside it.
   */
  beforeEach(() => { vi.clearAllMocks() })

  it('carries `est.` when nobody stated the weight', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState(modelWithBridge('risk-1', 'risk', 0.5)) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as any)} id="risk-1" data={{ label: 'Budget Overrun', type: 'risk' }} />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toContain('est.')
  })

  it('and drops it when the user set the weight themselves', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState(modelWithBridge('risk-1', 'risk', 0.5, true)) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as any)} id="risk-1" data={{ label: 'Budget Overrun', type: 'risk' }} />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toBe('Strength 50%')
  })
})

describe('CONTRAST CONTROL — the line is the bridge strength, not a default', () => {
  beforeEach(() => { vi.clearAllMocks() })

  it('a risk with no bridge edge states nothing rather than inventing a figure', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState({ lodActive: true, nodes: [{ id: 'risk-1', type: 'risk', data: { type: 'risk' } }], edges: [] }) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as any)} id="risk-1" data={{ label: 'Budget Overrun', type: 'risk' }} />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toBeNull()
  })

  it('and above the floor there is no reduced line at all — this is a zoom behaviour', () => {
    vi.mocked(useCanvasStore).mockImplementation(sel =>
      sel(makeStoreState({ ...modelWithBridge('risk-1', 'risk', 0.5), lodActive: false }) as any),
    )
    render(
      <ReactFlowProvider>
        <RiskNode {...(baseProps as any)} id="risk-1" data={{ label: 'Budget Overrun', type: 'risk' }} />
      </ReactFlowProvider>,
    )
    expect(lodLine()).toBeNull()
  })
})
