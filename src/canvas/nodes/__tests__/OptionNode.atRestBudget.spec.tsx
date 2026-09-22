/**
 * ⭐ THE OPTION CARD'S AT-REST BUDGET — DRAFT for Paul's design critique.
 * The rule and its reasons live in `shared/optionCardAtRest.ts`; this spec pins
 * what the CARD renders under it, and what it must keep.
 *
 * FIXTURE: the canonical `pricing-model` starter's option layer, values copied
 * from `src/canvas/starters/data/pricing-model.draft.json` rather than invented
 * — three non-baseline options, each setting the same three factors, and the
 * declared baseline "Keep Per-Seat Pricing (Status Quo)". Every non-baseline
 * card therefore has THREE delta rows today, which is the tall, ragged card.
 *
 * ⭐ THE DISCRIMINATING CARD IS `opt_new_logos`. Its list order (by |target|)
 * is friction 0.6, usage 0.3, risk 0.1 — but its differentiator is RISK
 * (0.1 against the others' 0.8/0.4, the widest gap). So "keep the first row"
 * and "keep the most distinctive row" give DIFFERENT answers on this card, and
 * only one of them passes.
 *
 * CLAIM SCOPE (trap 3): jsdom has no geometry. This pins which rows are in the
 * card's DOM and that the preview carries the rest — never a pixel height. The
 * height is CI's `Canvas Browser Gate` and the `e2e/geometry` measures.
 *
 * Rows are bound by IDENTITY (`data-delta-factor` = the factor id), never by a
 * value string another row could also render.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'
import { OptionNode } from '../OptionNode'
import { useCanvasStore } from '../../store'
import {
  OPTION_CARD_AT_REST_ROWS,
  planOptionCardAtRest,
} from '../shared/optionCardAtRest'

vi.mock('@xyflow/react', async () => {
  const actual = await vi.importActual('@xyflow/react')
  return { ...actual, Handle: () => null }
})

const USAGE = 'fac_usage_exposure'
const FRICTION = 'fac_adoption_friction'
const RISK = 'fac_enterprise_revenue_risk'
const ALL = [USAGE, FRICTION, RISK]

const factor = (id: string, label: string, value: number) => ({
  id, type: 'factor', position: { x: 0, y: 0 },
  data: { label, type: 'factor', observedState: { value, factor_type: 'other' } },
})
const option = (id: string, label: string, interventions: Record<string, number>, isBaseline = false) => ({
  id, type: 'option', position: { x: 0, y: 0 },
  data: { label, type: 'option', is_baseline: isBaseline, interventions },
})

const NODES = [
  factor(USAGE, 'Usage-Based Pricing Exposure', 0),
  factor(FRICTION, 'Bottom-Up Adoption Friction', 0.8),
  factor(RISK, 'Enterprise Revenue Cannibalization Risk', 0),
  option('opt_full_switch', 'Full Switch to Usage-Based at Renewal', { [USAGE]: 1, [FRICTION]: 0.1, [RISK]: 0.8 }),
  option('opt_hybrid', 'Hybrid Platform Fee Plus Usage', { [USAGE]: 0.5, [FRICTION]: 0.4, [RISK]: 0.4 }),
  option('opt_new_logos', 'Usage-Based for New Logos Only', { [USAGE]: 0.3, [FRICTION]: 0.6, [RISK]: 0.1 }),
  option('opt_status_quo', 'Keep Per-Seat Pricing (Status Quo)', { [USAGE]: 0, [FRICTION]: 0.8, [RISK]: 0 }, true),
]

const ID = 'opt_new_logos'

function seed(viewMode: 'standard' | 'expert') {
  useCanvasStore.setState({
    nodes: NODES, edges: [], ceeAnalysisReady: null, viewMode,
    results: { status: 'idle', report: null },
  } as never)
}

function mount(id: string, selected: boolean) {
  const node = NODES.find(n => n.id === id)!
  return render(
    <ReactFlowProvider>
      <OptionNode
        id={id} type="option" data={node.data} selected={selected}
        isConnectable positionAbsoluteX={0} positionAbsoluteY={0}
        dragging={false} zIndex={0} deletable selectable draggable
      />
    </ReactFlowProvider>,
  )
}

/** Rows IN THE CARD — the render container, which a portalled preview is not in. */
const cardRows = (container: HTMLElement) =>
  Array.from(container.querySelectorAll<HTMLElement>('[data-delta-factor]')).map(el => el.dataset.deltaFactor)

/** Rows in the card's preview, which `NodePopover` portals to `document.body`. */
const previewRows = (id: string) => {
  const list = document.body.querySelector<HTMLElement>(`[data-testid="option-deltas-full-${id}"]`)
  return list === null
    ? null
    : Array.from(list.querySelectorAll<HTMLElement>('[data-delta-factor]')).map(el => el.dataset.deltaFactor)
}

afterEach(cleanup)

describe('Standard view, at rest — the card carries ONE change, the count, and its route', () => {
  beforeEach(() => seed('standard'))

  it('renders exactly the budgeted number of delta rows, not all three', () => {
    const { container } = mount(ID, false)
    expect(cardRows(container)).toHaveLength(OPTION_CARD_AT_REST_ROWS)
  })

  it('the row it keeps is the MOST DISTINCTIVE change (risk), not the first in the list (friction)', () => {
    const { container } = mount(ID, false)
    expect(cardRows(container)).toEqual([RISK])
    // The same card's differentiator names the same factor — so the row states
    // the change and the sentence states the reason (Paul 10 Sep, "both stay").
    expect(container.querySelector(`[data-testid="option-differentiator-${ID}"]`)?.textContent ?? '')
      .toMatch(/^Enterprise revenue/)
  })

  it('still names the reference the kept row is measured against', () => {
    const { container } = mount(ID, false)
    expect(container.querySelector(`[data-testid="option-deltas-${ID}"]`)?.textContent ?? '')
      .toContain('Reference: Keep Per-Seat Pricing (Status Quo)')
  })

  it('keeps #1873\'s route line at rest — the count of what it changes, and how users find editing', () => {
    const { container } = mount(ID, false)
    const route = container.querySelector(`[data-testid="option-change-count-${ID}"]`)
    expect(route?.tagName.toLowerCase()).toBe('button')
    expect(route?.querySelector('[aria-hidden="true"]')?.textContent).toBe('3 factor targets')
  })

  it('keeps its one next step — the question chip', () => {
    const { container } = mount(ID, false)
    expect(container.querySelector('[data-testid="option-card-question"]')).not.toBeNull()
  })

  it('does not hold the preview open at rest', () => {
    mount(ID, false)
    expect(previewRows(ID)).toBeNull()
  })

  it('the baseline card is untouched — it has no delta block to budget', () => {
    const { container } = mount('opt_status_quo', false)
    expect(cardRows(container)).toEqual([])
    expect(container.textContent).toContain('Baseline option')
  })
})

describe('Standard view, SELECTED — the full list appears, and the card does not grow', () => {
  beforeEach(() => seed('standard'))

  it('the preview is held open and carries EVERY delta row', () => {
    mount(ID, true)
    const rows = previewRows(ID)
    expect(rows, 'selecting the card must open the full list').not.toBeNull()
    expect([...(rows ?? [])].sort()).toEqual([...ALL].sort())
  })

  it('the preview names the reference too — a from→to with no named baseline is not a comparison', () => {
    mount(ID, true)
    expect(document.body.querySelector(`[data-testid="option-deltas-full-${ID}"]`)?.textContent ?? '')
      .toContain('Reference: Keep Per-Seat Pricing (Status Quo)')
  })

  it('the CARD still renders one row — growing it on select would re-lay out the whole board', () => {
    const { container } = mount(ID, true)
    expect(cardRows(container)).toEqual([RISK])
  })
})

describe('Detailed view — unchanged: every row stays on the card', () => {
  beforeEach(() => seed('expert'))

  it('renders all three rows at rest', () => {
    const { container } = mount(ID, false)
    expect([...cardRows(container)].sort()).toEqual([...ALL].sort())
  })

  it('does not pin a preview on select — nothing was compacted', () => {
    mount(ID, true)
    expect(previewRows(ID)).toBeNull()
  })
})

describe('planOptionCardAtRest — the rule, executed on both sides of every branch', () => {
  const base = { deltaFactorIds: ['a', 'b', 'c'], distinctiveFactorId: 'b', isDetailed: false, selected: false }

  it('keeps the distinctive row and reports the compaction', () => {
    expect(planOptionCardAtRest(base)).toEqual({ cardRowIds: ['b'], compacted: true, previewPinned: false })
  })

  it('pins the preview only when selected AND compacted', () => {
    expect(planOptionCardAtRest({ ...base, selected: true }).previewPinned).toBe(true)
    expect(planOptionCardAtRest({ ...base, deltaFactorIds: ['a'], selected: true }).previewPinned).toBe(false)
  })

  it('falls back to the list\'s first row when the differentiator has no row, or there is none', () => {
    expect(planOptionCardAtRest({ ...base, distinctiveFactorId: 'z' }).cardRowIds).toEqual(['a'])
    expect(planOptionCardAtRest({ ...base, distinctiveFactorId: null }).cardRowIds).toEqual(['a'])
  })

  it('Detailed keeps every row and never pins', () => {
    expect(planOptionCardAtRest({ ...base, isDetailed: true, selected: true }))
      .toEqual({ cardRowIds: ['a', 'b', 'c'], compacted: false, previewPinned: false })
  })

  it('nothing to budget renders nothing', () => {
    expect(planOptionCardAtRest({ ...base, deltaFactorIds: [] }))
      .toEqual({ cardRowIds: [], compacted: false, previewPinned: false })
  })
})
