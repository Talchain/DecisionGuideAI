/**
 * BEAT 1 — THE GOAL CARD SAYS THE USER'S OWN CURRENT LEVEL (Canvas lane, 4 Oct 2026; DL 0df0e1 ruling on Paul's
 * standing "user-entered business quantities remain visible").
 *
 * Journey 4's brief said "MRR now £120,000/month"; the served goal node stores it as `observed_state.raw_value`
 * 120000 in `£/month` with `source: brief_extraction`, on a LEVEL goal. The card said nothing, because the "Today" line
 * (#2328, AIQ 5902409861) was built for change goals. AIQ's ruling named this as its follow-up ("an r1-shape goal
 * (`source: brief_extraction`, no reading) could show '— from your brief'") and kept two guards, both pinned here: the
 * figure is the raw value in the goal's own unit, never the normalised `value` (0.64 here), and a goal with neither
 * carrier says nothing.
 *
 * CORPUS: the SERVED goal node (fixture = wire capture 09, verbatim) through the real node mapper.
 */
import { describe, it, expect } from 'vitest'
import served from '../../edges/__tests__/fixtures/journey4ServedGraph.d4e6a8ba.json'
import { mapDraftNodeToCanvas } from '../../utils/applyDraftResult'
import { goalTodayLevel } from '../../domain/goalTarget'
import { goalTodayLevelCopy } from '../shared/goalTodayLevelCopy'

type WireNode = Record<string, unknown> & { id: string }
const SERVED_GOAL = (served as { graph: { nodes: WireNode[] } }).graph.nodes.find((n) => n.id === 'monthly_recurring_revenue')!

const today = (wire: WireNode) => {
  const t = goalTodayLevel(mapDraftNodeToCanvas(wire as never).data as Parameters<typeof goalTodayLevel>[0])
  return t === null ? null : goalTodayLevelCopy(t)
}
const withObserved = (patch: Record<string, unknown>) =>
  ({ ...SERVED_GOAL, observed_state: { ...(SERVED_GOAL.observed_state as object), ...patch } })

describe("the goal card's Today line on journey 4's served goal", () => {
  it('PRECONDITION — the served goal is a LEVEL goal holding the brief\'s £120,000 in its own unit', () => {
    expect(SERVED_GOAL.goal_threshold_frame).toBe('level')
    expect(SERVED_GOAL.goal_threshold_unit).toBe('£/month')
    expect(SERVED_GOAL.observed_state).toMatchObject({ raw_value: 120000, unit: '£/month', source: 'brief_extraction', value: 0.64 })
  })

  it('⭐ says the user\'s level from their brief, as AIQ worded it', () => {
    const line = today(SERVED_GOAL)
    expect(line).toMatch(/^Today: £120,000 ?\/ ?month — from your brief$/)
    expect(line).not.toMatch(/0\.64|Olumi/)
  })

  it('CONTROL — the same level typed by the user still says "you said"', () => {
    expect(today(withObserved({ source: 'user_edited' }))).toMatch(/— you said$/)
  })

  it('CONTROL — an Olumi-estimated level stays SILENT (AIQ: nothing Olumi inferred speaks as the user\'s)', () => {
    expect(today(withObserved({ source: 'cee_inference' }))).toBeNull()
    expect(today(withObserved({ source: 'cee_hypothesis' }))).toBeNull()
  })

  it('CONTROL — a level in another unit, or with no unit, stays silent (the false-figure guard)', () => {
    expect(today(withObserved({ unit: '%' }))).toBeNull()
    expect(today(withObserved({ unit: undefined }))).toBeNull()
  })

  it('CONTROL — no raw figure stays silent; the normalised value is never said instead', () => {
    expect(today(withObserved({ raw_value: undefined }))).toBeNull()
  })

  it('CONTROL — an unread goal frame stays silent (AIQ 5880974047: its figure\'s meaning is unknown)', () => {
    expect(today({ ...SERVED_GOAL, goal_threshold_frame: 'per_capita_ratio' })).toBeNull()
  })
})
