/**
 * ⭐⭐ A GOAL TARGET'S SOURCE COMES ONLY FROM A CARRIED FIELD — one authority on
 * every surface (DESIGN-GAP-v31 #22, A2; and #23, the resting limit pill).
 *
 * MEASURED BEFORE (served `eec722ab`, 25 Sep): the market-entry goal card read
 * "Target: 11 £M ARR · no source", while the dock's model strip and the goal
 * inspector (both `SuccessTargetLine`) read "From brief" — three surfaces, two
 * answers. The market-entry brief never states 11 (it says £8M); the node
 * carries `goal_threshold_raw: 11` and NO `threshold_source`. "From brief" was a
 * UI-asserted origin: `resolveGoalTarget` stamped ANY `goal_threshold_raw` as
 * `brief`.
 *
 * The carried vocabulary, derived from CEE staging `85ce874c`
 * (`src/schemas/cee-v3.ts:258`: `threshold_source: z.string().max(64)`; its
 * only writer, `add-constraint.ts:1350`, writes `'user'`): a target is the
 * user's exactly when `threshold_source === 'user'` attests a stated
 * `success_threshold`. Nothing on the node records a brief origin for
 * `goal_threshold_raw`, so it is "Source not recorded" on every surface.
 *
 * PINNED BY IDENTITY: the resolver's `source`, the strip's `-source` element
 * text and `data-source`, and the card mark's label — for the SAME node data.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

let state: Record<string, unknown> = {}
vi.mock('../../store', () => {
  const useCanvasStore = (select: (s: Record<string, unknown>) => unknown) => select(state)
  ;(useCanvasStore as unknown as { getState: () => unknown }).getState = () => state
  return { useCanvasStore }
})
vi.mock('../../hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable: false,
    captureScenarioId: () => 'scenario-1',
    proposeGoalTarget: vi.fn(() => 'dispatched' as const),
  }),
}))

import { resolveGoalTarget } from '../goalTarget'
import { goalTargetSourceMark, VALUE_SOURCE_MARK_LABEL } from '../../nodes/shared/valueSourceMark'
import { SuccessTargetLine } from '../../../components/results/analysisNew/sections/SuccessTargetLine'
import { goalLimitPills } from '../../nodes/GoalNode'
import type { CEEGoalConstraint } from '../../../adapters/cee/types'

const TID = 'target'

/** `market-entry.draft.json` `goal_arr_growth`, verbatim target fields. */
const MARKET_ENTRY_GOAL = {
  label: 'Grow Total ARR Materially Within 12 Months',
  goal_threshold: 0.7333333333333333,
  goal_threshold_raw: 11,
  goal_threshold_unit: '£M ARR',
  goal_threshold_cap: 15,
  provenance: 'ai_inferred',
}
/** The contrast: a target the user set, attested by the carried stamp. */
const USER_GOAL = { ...MARKET_ENTRY_GOAL, threshold_source: 'user', success_threshold: 9 }

const renderStrip = (data: Record<string, unknown>) => {
  state = {
    nodes: [{ id: 'g1', type: 'goal', data }],
    goalThreshold: null,
    goalThresholdRepresentation: null,
    setGoalThresholdAndUpdateNode: vi.fn(),
  }
  return render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={() => {}} testId={TID} />)
}

beforeEach(() => { state = {} })
afterEach(() => cleanup())

describe('#22 — the goal target source is read from carried fields only', () => {
  it('the resolver: a goal_threshold_raw with no carried source is NOT "brief"', () => {
    const t = resolveGoalTarget(MARKET_ENTRY_GOAL)
    expect(t?.raw).toBe(11)
    expect(t?.source).toBe('unrecorded')
  })

  it('contrast — the resolver: threshold_source "user" + success_threshold is the user\'s', () => {
    expect(resolveGoalTarget(USER_GOAL)).toEqual({ raw: 9, unit: '£M ARR', source: 'user' })
  })

  it('the strip / goal inspector (SuccessTargetLine) never reads "From brief" for the market-entry shape', () => {
    renderStrip(MARKET_ENTRY_GOAL)
    const source = screen.getByTestId(`${TID}-source`)
    expect(source).toHaveTextContent(VALUE_SOURCE_MARK_LABEL.unknown)
    expect(source.textContent).not.toMatch(/brief/i)
    expect(source).toHaveAttribute('data-source', 'unrecorded')
  })

  it('card and strip give ONE answer for the same node: the card mark\'s label IS the strip\'s words', () => {
    renderStrip(MARKET_ENTRY_GOAL)
    expect(goalTargetSourceMark(MARKET_ENTRY_GOAL).label).toBe(screen.getByTestId(`${TID}-source`).textContent)
  })

  it('contrast — a user-set target reads "Set by you" on the strip and on the card', () => {
    renderStrip(USER_GOAL)
    const source = screen.getByTestId(`${TID}-source`)
    expect(source).toHaveTextContent(VALUE_SOURCE_MARK_LABEL.you)
    expect(source).toHaveAttribute('data-source', 'user')
    expect(goalTargetSourceMark(USER_GOAL).label).toBe(source.textContent)
  })
})

describe('#23 — the goal limit pill is the short form, from structured fields', () => {
  const nodes = [{ id: 'out_nrr', data: { label: 'Net Revenue Retention' } }]

  it('an audited percent limit reads "Churn <4%" — the reader\'s own figure, operator hard against it', () => {
    const c = {
      constraint_id: 'c1', label: 'Churn', operator: '<', value: 0.04, unit: '%',
      provenance: 'explicit',
      provenance_unit_normalised: { original_value: 4, original_unit: '%' },
    } as unknown as CEEGoalConstraint
    expect(goalLimitPills([c], nodes)[0].text).toBe('Churn <4%')
  })

  it('pricing: a percent limit with no audit shows the reader\'s own words only — no label prefix, no "·"', () => {
    const c = {
      constraint_id: 'constraint_out_nrr_min', node_id: 'out_nrr', operator: '>=', value: 1.1,
      label: 'net revenue retention floor', unit: '%',
      source_quote: 'net revenue retention above 110%', provenance: 'explicit',
    } as unknown as CEEGoalConstraint
    const [pill] = goalLimitPills([c], nodes)
    expect(pill.text).toBe('“net revenue retention above 110%”')
    // Nothing is lost: the accessible name keeps the full sentence.
    expect(pill.name).toContain('net revenue retention floor')
  })

  it('⛔ an inferred limit KEEPS its origin on the pill — a short form drops words, never provenance', () => {
    const c = {
      constraint_id: 'constraint_goal_arr_max', node_id: 'goal_arr', operator: '<=', value: 2,
      label: 'Delivery deadline', unit: 'months', source_quote: 'by Q3', provenance: 'inferred',
    } as unknown as CEEGoalConstraint
    const [pill] = goalLimitPills([c], nodes)
    expect(pill.text).toBe('Delivery deadline ≤2 months · Inferred limit')
    expect(pill.name).toContain('Inferred limit')
    // CONTRAST — the reader's own limit carries no suffix.
    const [own] = goalLimitPills([{ ...c, provenance: 'explicit' } as unknown as CEEGoalConstraint], nodes)
    expect(own.text).toBe('Delivery deadline ≤2 months')
  })
})
