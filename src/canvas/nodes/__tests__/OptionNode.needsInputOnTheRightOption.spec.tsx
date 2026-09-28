/**
 * ⭐ "NEEDS INPUT" SITS ON THE OPTION THAT NEEDS INPUT — NEVER ON THE BASELINE
 * (canvas audit 27 Sep 2026, paul-models POM-1; all 4 of Paul's own boards).
 *
 * Pre-run, every one of Paul's baselines ("Keep current £49 price", "Carry on
 * as now") carried `needs-input-pill` / `overlay-missing-value` ("Missing
 * required input"), while CEE's own `analysis_ready` said of that option
 * `{status:'ready', is_baseline:true, interventions:{}, status_reason:'Baseline:
 * every factor holds at its observed value, so no effect values are needed'}`.
 * And on 90b8 the option CEE DID block — `blockers[]: {option_id:'146aa89d',
 * factor_id:'fac_existing_customers_grandfathered', blocker_type:'missing_value'}`
 * — showed no marker, because it had one set target.
 *
 * ⚠ IDENTITY: each card is rendered alone and bound by its own id; every
 * absence is paired with a card in the SAME store that shows the marker, so a
 * blind probe cannot pass.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})
vi.mock('../../store', () => ({ useCanvasStore: vi.fn() }))
vi.mock('../../layoutStore', () => ({
  useLayoutStore: vi.fn(((s: (x: { layoutNodeWidth: number | null }) => unknown) =>
    s({ layoutNodeWidth: null })) as unknown as (...a: never[]) => unknown),
}))
vi.mock('../../hooks/useNodeDisplayMetadata', () => ({
  useNodeDisplayMetadata: vi.fn(() => ({
    sensitivityRank: null,
    influence: null,
    confidence: null,
    inSensitivityAnalysis: false,
    achievementProbability: null,
    stabilityPercentage: null,
  })),
}))

import { useCanvasStore } from '../../store'
import { OptionNode } from '../OptionNode'

/* eslint-disable @typescript-eslint/no-explicit-any -- ReactFlow's NodeProps needs fields no assertion reads. */
const baseProps = {
  selected: false, dragging: false, zIndex: 0, isConnectable: false,
  positionAbsoluteX: 0, positionAbsoluteY: 0, type: 'option', deletable: true, selectable: true, draggable: true,
}

const BASE = { id: 'keep_current_49_price', label: 'Keep current £49 price' }
const BLOCKED = { id: '146aa89d', label: '£59 for new Pro customers; grandfather existing customers' }
const EMPTY = { id: 'opt_unvalued', label: 'Rebuild billing' }
const VALUED = { id: 'opt_valued', label: 'Raise price to £69' }

const AR_OPTIONS = [
  // CEE's served baseline shape: ready, typed baseline, no interventions.
  { id: BASE.id, label: BASE.label, status: 'ready', is_baseline: true, interventions: {},
    status_reason: 'Baseline: every factor holds at its observed value, so no effect values are needed' },
  { id: BLOCKED.id, label: BLOCKED.label, status: 'ready', is_baseline: false,
    interventions: { fac_pro_plan_price: { value: 0.59, source: 'user_specified' } } },
  { id: EMPTY.id, label: EMPTY.label, status: 'ready', is_baseline: false, interventions: {} },
  { id: VALUED.id, label: VALUED.label, status: 'ready', is_baseline: false,
    interventions: { fac_pro_plan_price: { value: 0.69 } } },
]

function renderOption(opt: { id: string; label: string }, over: { blockers?: unknown[]; nodeData?: Record<string, unknown> } = {}) {
  const nodes = [BASE, BLOCKED, EMPTY, VALUED].map((o) => ({ id: o.id, type: 'option', data: { type: 'option', label: o.label } }))
  vi.mocked(useCanvasStore).mockImplementation((selector) =>
    selector({
      hoveredOptionId: null,
      nodes,
      edges: [],
      ceeAnalysisReady: {
        options: AR_OPTIONS,
        goal_node_id: 'goal_1',
        status: 'ready',
        blockers: over.blockers ?? [
          { option_id: BLOCKED.id, factor_id: 'fac_existing_customers_grandfathered', blocker_type: 'missing_value', reason: 'Needs a value' },
        ],
      },
      results: { status: 'idle', report: null },
      highlightedNodes: new Set(),
      dimmedNodeIds: new Set(),
      lens: { _dimmedNodeIds: new Set() },
      goalThreshold: null,
      goalConstraints: [],
      setHoveredOption: vi.fn(),
      viewMode: 'expert',
    } as never),
  )
  return render(
    <ReactFlowProvider>
      <OptionNode {...(baseProps as any)} id={opt.id} data={{ label: opt.label, type: 'option', ...(over.nodeData ?? {}) }} />
    </ReactFlowProvider>,
  )
}

const marked = (c: HTMLElement) => ({
  pill: c.querySelector('[data-testid="needs-input-pill"]') !== null,
  overlay: c.querySelector('[data-testid="overlay-missing-value"]') !== null,
})

beforeEach(() => {
  vi.clearAllMocks()
})
afterEach(() => cleanup())

describe('POM-1 · the baseline is the reference, not a gap', () => {
  it('the typed baseline (analysis_ready is_baseline:true, interventions {}) carries no "Needs input"', () => {
    const { container } = renderOption(BASE)
    // Positive control: the card mounted.
    expect(container.textContent).toContain(BASE.label)
    expect(marked(container)).toEqual({ pill: false, overlay: false })
  })

  it('a baseline flagged on the NODE (no AR flag) is exempt too', () => {
    const { container } = renderOption(EMPTY, { nodeData: { is_baseline: true } })
    expect(container.textContent).toContain(EMPTY.label)
    expect(marked(container)).toEqual({ pill: false, overlay: false })
  })

  it('CONTRAST — a non-baseline option with an empty map in the SAME store is still marked', () => {
    const { container } = renderOption(EMPTY)
    expect(marked(container)).toEqual({ pill: true, overlay: true })
  })
})

describe('POM-1 · the option CEE blocked on a missing value IS marked', () => {
  it('a missing_value blocker naming this option marks it, even with one set target', () => {
    const { container } = renderOption(BLOCKED)
    expect(container.textContent).toContain(BLOCKED.label)
    expect(marked(container)).toEqual({ pill: true, overlay: true })
  })

  it('CONTRAST — the same option with no blocker is not marked', () => {
    const { container } = renderOption(BLOCKED, { blockers: [] })
    expect(container.textContent).toContain(BLOCKED.label)
    expect(marked(container)).toEqual({ pill: false, overlay: false })
  })

  it('CONTRAST — a blocker of another type, or naming another option, marks nothing here', () => {
    const { container } = renderOption(VALUED, {
      blockers: [
        { option_id: VALUED.id, factor_id: 'f', blocker_type: 'constraint_dropped', reason: 'x' },
        { option_id: BLOCKED.id, factor_id: 'f', blocker_type: 'missing_value', reason: 'x' },
      ],
    })
    expect(container.textContent).toContain(VALUED.label)
    expect(marked(container)).toEqual({ pill: false, overlay: false })
  })
})
