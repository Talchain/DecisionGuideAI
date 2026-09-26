/**
 * ⛔ THE ANALYSIS TAB STATED THE 110% LIMIT AS "≥ 1.1%" (design audit §2 #5).
 *
 * ── SERVED EVIDENCE (853feeb7, pricing starter, one Run, no chat turns) ─────
 * The brief bar on the Analysis tab (`brief-bar-stated-limits`) read
 *
 *     net revenue retention floor ≥ 1.1%
 *
 * while, on the same screen, the goal card read "Target: 110%" and its limit
 * pill “net revenue retention above 110%”, and the Reasoning tab "Success:
 * 110%". The fixture is the served row byte-for-byte (see its `_provenance`).
 *
 * ── WHERE THE UNITS DIVERGE ─────────────────────────────────────────────────
 * The producer sends the limit as `value: 1.1, unit: '%'` with the reader's own
 * words in `source_quote`, and no `provenance_unit_normalised` audit. `1.1`
 * with `%` is ambiguous on its own (110% as a fraction, or 1.1%). The canvas
 * already has ONE authority for exactly this — `goalConstraintText.ts`, which
 * never infers scale from magnitude and reads the reader's own figure (audit)
 * or words (quote) first. `statedLimits.ts` bypassed it and appended "%" to the
 * ratio. The fix routes those rungs through the authority; it does not multiply,
 * divide or guess.
 *
 * Assertions bind by IDENTITY: the exact text on the exact test id, and the
 * limit's own constraint id.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { DecisionOverviewCard } from '../DecisionOverviewCard'
import { selectStatedLimits } from '../statedLimits'
import { goalConstraintShortText } from '../../../../canvas/utils/goalConstraintText'
import { useCanvasStore } from '../../../../canvas/store'
import { useGuidanceStore } from '../../../../canvas/stores/guidanceStore'
import { useAskOlumiStore } from '../../coaching/askOlumiStore'
import type { CEEGoalConstraint } from '../../../../adapters/cee/types'
import SERVED from './fixtures/served-853feeb7-pricing-nrr-limit.json'

const SERVED_LIMIT = SERVED.goal_constraint as unknown as CEEGoalConstraint
const READER_WORDS = '“net revenue retention above 110%”'

function seed(goalConstraints: unknown) {
  localStorage.clear()
  localStorage.setItem('feature.decisionOverview', '1')
  useGuidanceStore.setState({ guidanceItems: [], _sendMessage: null } as never)
  useAskOlumiStore.setState({
    isOpen: false, context: '', draft: '', label: '', targetId: null, parameters: undefined, source: 'chip',
  })
  useCanvasStore.setState({
    ceeAnalysisReady: {
      status: 'ready',
      options: [{ id: 'opt_full_switch' }],
      goal_node_id: SERVED.analysis_ready_goal.goal_node_id,
    },
    goalThreshold: SERVED.analysis_ready_goal.goal_threshold_raw,
    nodes: [{
      id: SERVED.analysis_ready_goal.goal_node_id,
      type: 'goal',
      position: { x: 0, y: 0 },
      data: { label: 'Achieve NRR Above 110% While Enabling Bottom-Up Adoption', threshold_source: 'user', success_threshold: 110 },
    }],
    goalConstraints,
    currentBriefText: null,
    graphHealth: null,
    results: { status: 'complete', report: { summary: 'Ran analysis on your current scenario.' } },
  } as never)
}

describe('served pricing limit — the Analysis tab states the reader\'s 110%, never "1.1%"', () => {
  beforeEach(() => seed(null))

  it('fixture sanity: the served row is the ambiguous shape (1.1 with "%") and the goal is 110%', () => {
    expect(SERVED_LIMIT.value).toBe(1.1)
    expect(SERVED_LIMIT.unit).toBe('%')
    expect(SERVED_LIMIT.source_quote).toBe('net revenue retention above 110%')
    expect(SERVED.analysis_ready_goal.goal_threshold_raw).toBe(110)
  })

  it('the COLLAPSED brief bar (post-Run, no click) reads the reader\'s own words, exactly', () => {
    seed([SERVED_LIMIT])
    render(<DecisionOverviewCard title="Pricing Model Transition Strategy" />)
    const note = screen.getByTestId('brief-bar-stated-limits')
    expect(note.textContent).toBe(READER_WORDS)
    expect(note).toHaveAttribute('title', READER_WORDS)
    expect(note.textContent).not.toContain('1.1%')
  })

  it('the EXPANDED limits list binds the same text to constraint_out_nrr_min', () => {
    seed([SERVED_LIMIT])
    render(<DecisionOverviewCard title="Pricing Model Transition Strategy" />)
    fireEvent.click(screen.getByTestId('brief-bar'))
    expect(screen.getByTestId('stated-limit-constraint_out_nrr_min').textContent).toBe(READER_WORDS)
  })

  it('ONE authority: the Analysis tab\'s limit text IS the goal card pill\'s text for the served row', () => {
    const [limit] = selectStatedLimits([SERVED_LIMIT])
    expect(limit.id).toBe('constraint_out_nrr_min')
    expect(limit.text).toBe(goalConstraintShortText(SERVED_LIMIT))
  })

  it('an AUDITED percent limit shows the reader\'s own figure, not the rewritten ratio', () => {
    const audited = {
      ...SERVED_LIMIT,
      source_quote: undefined,
      provenance_unit_normalised: { original_value: 110, original_unit: '%' },
    } as unknown as CEEGoalConstraint
    const [limit] = selectStatedLimits([audited])
    expect(limit.text).toBe('net revenue retention floor ≥110%')
  })

  it('CONTRAST: a percent limit with NO quote and NO audit keeps the unchanged reconstruction', () => {
    // Nothing on the wire says the scale was rewritten, so nothing changes:
    // the existing statedLimits spec pins "Gross margin ≥ 78%" for this shape.
    const [limit] = selectStatedLimits([{
      constraint_id: 'constraint_margin_min', label: 'Gross margin', operator: '>=', value: 78, unit: '%',
    } as unknown as CEEGoalConstraint])
    expect(limit.text).toBe('Gross margin ≥ 78%')
  })
})
