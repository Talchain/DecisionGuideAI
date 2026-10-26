/**
 * ⭐ A PROGRAM GOAL SAYS WHAT ITS CHANGE IS MEASURED FROM, AND ITS WINDOW IN THE MODEL'S OWN PERIOD (W3b UI reader 1; CEE
 * #3799). The goal card said every change "from today" (`formatGoalTarget.ts` :119, :246), though a change can be measured
 * against an option ("carry on as now") or a stated value; and a weekly model's window, which is not a whole number of
 * months, gave no horizon at all. The card now reads the goal node's `goal_reference` and `goal_window`.
 *
 * Real path: the served program read (`served-program-orders-full-read-20261026.json`) through the real
 * `hydrateCanvasFromServer` (only `fetch` stubbed), then the card's own owners of the target and the period line
 * (`goalTargetDisplay`, `goalPeriodHorizonLine`, which GoalNode renders) on the stored goal node. The served goal is a level;
 * CEE sends a reference only for a change, so the goal is reshaped to CEE #3799's own change row (project-truth "a change
 * from ‘Carry on as now’": `change_rel` 0.05, `goal_reference` option, `goal_window` max over 3 periods): SYNTHETIC, labelled.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {}, isSupabaseAvailable: () => false, getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../store'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import { goalTargetDisplay } from '../domain/goalTargetLine'
import { goalPeriodHorizonLine } from '../domain/goalPeriodHorizon'
import type { GoalTargetSource } from '../domain/goalTarget'
import served from '../nodes/__tests__/fixtures/served-program-orders-full-read-20261026.json'

type Rec = Record<string, unknown>
const GOAL = 'reach_order_target'
const OPTION_REFERENCE = { kind: 'option', option_id: 'carry_on', label: 'Carry on as now' }
const WEEKS = { aggregation: 'max', start: 0, periods: 12, period_unit: 'week', origin_event: null }

/** The served read with its goal as CEE #3799 projects a change goal (SYNTHETIC, labelled), plus `extra` on the goal. */
function read(extra: Rec, i: number) {
  const r = JSON.parse(JSON.stringify(served)) as Rec & { graph: { nodes: Rec[] }; scenario_id: string; graph_hash: string }
  r.scenario_id = `${served.scenario_id.slice(0, -3)}${String(100 + i)}`
  r.graph_hash = `${served.graph_hash}-${i}`
  const goal = r.graph.nodes.find((n) => n.id === GOAL)!
  const { goal_threshold_cap: _c, goal_threshold_cap_provenance: _p, ...rest } = goal
  Object.assign(goal, Object.fromEntries(Object.keys(goal).map((k) => [k, undefined])), rest,
    { goal_threshold_frame: 'change_rel', goal_threshold_raw: 0.05, goal_threshold_unit: 'order/week', goal_direction: '>=' }, extra)
  return r
}
let n = 0
async function goalData(extra: Rec): Promise<GoalTargetSource & Rec> {
  const r = read(extra, n++)
  // A fresh board each time: the merge keeps a node's acquired fields across reads of one board.
  useCanvasStore.setState({ currentScenarioId: r.scenario_id, nodes: [], edges: [], lastServerGraphHash: null, serverGraphIdentity: null } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(r), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(r.scenario_id))
  return useCanvasStore.getState().nodes.find((x) => x.id === GOAL)!.data as GoalTargetSource & Rec
}

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('what a program goal\'s change is measured from (`goal_reference`)', () => {
  it('an option: "compared with ‘Carry on as now’", by the option\'s own label, never "from today"', async () => {
    expect(goalTargetDisplay(await goalData({ goal_reference: OPTION_REFERENCE }))).toBe('up 5% compared with ‘Carry on as now’')
  })

  it('CONTRAST: today ("kind: now"), or no reference, still says "from today", as before', async () => {
    expect(goalTargetDisplay(await goalData({ goal_reference: { kind: 'now' } }))).toBe('up 5% from today')
    expect(goalTargetDisplay(await goalData({}))).toBe('up 5% from today')
  })

  it('a stated value: "compared with" its own label (Paul, 26 Oct: "using the reference\'s label")', async () => {
    const value = { kind: 'value', quantity_id: 'base_orders', label: 'Orders last quarter' }
    expect(goalTargetDisplay(await goalData({ goal_reference: value }))).toBe('up 5% compared with ‘Orders last quarter’')
  })

  it('a stated value with no label to name it: the change alone, never "from today"', async () => {
    expect(goalTargetDisplay(await goalData({ goal_reference: { kind: 'value', quantity_id: 'base_orders', label: null } }))).toBe('up 5%')
  })
})

describe('a program goal\'s window in the model\'s own period (`goal_window`)', () => {
  it('a weekly model, which sends no `goal_horizon`: "within 12 weeks", the horizon\'s own wording', async () => {
    expect(goalPeriodHorizonLine(await goalData({ goal_window: WEEKS }))).toBe('within 12 weeks')
  })

  it('CONTRAST: a monthly model also sends `goal_horizon`, which still speaks, once: "within 3 months"', async () => {
    const monthly = { goal_window: { ...WEEKS, periods: 3, period_unit: 'month' }, goal_horizon: { months: 3 }, goal_horizon_months: 3 }
    expect(goalPeriodHorizonLine(await goalData(monthly))).toBe('within 3 months')
  })

  it('a window still asked (`periods: null`), or one that starts later, says nothing rather than a horizon it does not have', async () => {
    expect(goalPeriodHorizonLine(await goalData({ goal_window: { ...WEEKS, periods: null } }))).toBeNull()
    expect(goalPeriodHorizonLine(await goalData({ goal_window: { ...WEEKS, start: 2 } }))).toBeNull()
  })
})
