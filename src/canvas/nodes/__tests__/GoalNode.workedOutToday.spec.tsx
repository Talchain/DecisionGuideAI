/**
 * The goal says where it stands today when CEE works that level out (DL, 27 Oct: CEE items (a) and (d), the UI half). Served on
 * staging (26 Oct), the weekly-orders goal showed no today, though the brief's 125 orders a week sits on "Current orders per
 * week" and the model works "Orders per week" out from it. CEE now projects, on the goal, the engine's exact initial figure
 * in the goal's unit with no source (`observed_state`) and the measured quantity's basis (`value_basis: worked_out`), and
 * a stated fixed window as `goal_horizon` / `goal_horizon_months`.
 *
 * The UI admits that level as "worked out", never as anyone's figure: only a finite `raw_value` in the goal's own unit, and
 * it is not typed over (changing a part changes it).
 *
 * Real path: the served read (`served-program-orders-read-20261026.json`, its `_source` names the run) through the real
 * `hydrateCanvasFromServer` (only `fetch` stubbed) on the core lane, then the real `GoalNode`. SYNTHETIC, labelled: the goal and
 * its measured quantity patched exactly as CEE's projection at bede2d1d draws them for this board
 * (`project-goal-current.test.ts`: `observed_state: { value: 125, raw_value: 125, unit: 'order/week' }`, the metric's
 * `value_basis`, `goal_horizon: { months: 3 }`, `goal_horizon_months: 3`).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { GoalNode } from '../GoalNode'
import served from './fixtures/served-program-orders-read-20261026.json'

const GOAL = 'reach_order_target'
const METRIC = 'weekly_orders'
type Rec = Record<string, unknown>

/** The served read with the goal (and its measured quantity) as CEE projects them at bede2d1d; `goal` overrides one field. */
function wire(goal: Rec = {}) {
  const read = JSON.parse(JSON.stringify(served)) as { graph: { nodes: Rec[] } }
  const metric = read.graph.nodes.find((n) => n.id === METRIC)!
  const observed = { value: 125, raw_value: 125, unit: 'order/week' }
  Object.assign(metric, { observed_state: observed })
  Object.assign(read.graph.nodes.find((n) => n.id === GOAL)!, {
    observed_state: observed, value_basis: metric.value_basis, goal_horizon: { months: 3 }, goal_horizon_months: 3, ...goal,
  })
  return read
}

async function mountGoal(read: object) {
  useCanvasStore.setState({ currentScenarioId: served.scenario_id, nodes: [], edges: [], lastServerGraphHash: null } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  expect(await hydrateCanvasFromServer(served.scenario_id)).toBe('merged')
  const node = useCanvasStore.getState().nodes.find((n) => n.id === GOAL)!
  // ReactFlow's NodeProps needs fields no assertion here reads; the sibling node specs cast the same way.
  const props = { id: GOAL, type: node.type, data: node.data, position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as any
  render(<ReactFlowProvider><GoalNode {...props} /></ReactFlowProvider>)
  // The saved read answers (the core lane's editable path is live, so its refusal is the code's, not the lane's).
  await new Promise((r) => setTimeout(r, 50))
}
const today = () => screen.queryByTestId(`goal-today-level-${GOAL}-visible`)

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a goal whose level CEE works out', () => {
  it('says "today 125 order/week" as worked out, never anyone\'s, and is not typed over', async () => {
    await mountGoal(wire())
    expect(today()?.textContent).toContain('today')
    expect(today()?.textContent).toContain('125')
    expect(document.querySelector(`[data-today-basis]`)?.getAttribute('data-today-basis')).toBe('from_parts')
    expect(screen.getByTestId(`goal-today-level-${GOAL}-sentence`).getAttribute('aria-label')).toMatch(/^Today: 125 .* — worked out from its parts$/)
    expect(screen.queryByTestId(`goal-today-level-editor-${GOAL}`)).toBeNull()
  })

  it('shows its stated window: "within 3 months"', async () => {
    await mountGoal(wire())
    expect(screen.getByTestId(`goal-period-horizon-${GOAL}`).textContent).toContain('within 3 months')
  })
})

describe('NEGATIVES: a worked-out level that is not this goal\'s figure today says nothing', () => {
  it('a raw_value that is not a finite number', async () => {
    await mountGoal(wire({ observed_state: { value: null, raw_value: null, unit: 'order/week' } }))
    expect(today()).toBeNull()
  })

  it('a unit that is not the goal\'s', async () => {
    await mountGoal(wire({ observed_state: { value: 125, raw_value: 125, unit: 'order/month' } }))
    expect(today()).toBeNull()
  })

  it('CONTRAST: the served goal as it is (no observed level) says nothing', async () => {
    await mountGoal(served)
    expect(today()).toBeNull()
  })
})
