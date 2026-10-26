/**
 * A program board never claims a gap the program does not have (vision assessment, 26 Oct). Served on staging: a board
 * whose goal holds the brief's target (150 orders a week) and whose program had computed every option's chance still
 * said "Top gap: set a success target" on the question and "Needs input" on the goal. Both came from the legacy
 * readiness, which reads the store's goal-target scalar; a program board never fills it (`goalThreshold: null`,
 * results `idle`). On a core board CEE's admission decides (store `legacyValidationOff`), so the legacy arms are silent.
 *
 * Real path: the real store and the real `DecisionNode` / `GoalNode`, with the served read's nodes
 * (`served-program-orders-read-20261026.json`, its `_source` names the run). The contrast is the same nodes on a board
 * where the legacy validator runs (`legacyValidationOff: false`), which keeps today's behaviour.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ReactFlowProvider } from '@xyflow/react'

vi.mock('@xyflow/react', async () => ({ ...(await vi.importActual('@xyflow/react')), Handle: () => null }))
vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import { DecisionNode } from '../DecisionNode'
import { GoalNode } from '../GoalNode'
import served from './fixtures/served-program-orders-read-20261026.json'

const QUESTION = 'mp:decision'
const GOAL = 'reach_order_target'

/** The served read hydrated through the app's own path (only `fetch` stubbed), then the board's validator flag. */
async function board(legacyValidationOff: boolean) {
  useCanvasStore.setState({ currentScenarioId: served.scenario_id, nodes: [], edges: [] } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  expect(await hydrateCanvasFromServer(served.scenario_id)).toBe('merged')
  // As read on staging for this board: the legacy scalar stays empty. The flag is what `useLegacyValidationOff`
  // decides for a read with a living model (its own spec, `legacyValidationOff.spec.tsx`); set here directly.
  expect(useCanvasStore.getState().goalThreshold).toBeNull()
  useCanvasStore.setState({ legacyValidationOff } as never)
}

const props = (id: string) => {
  const node = useCanvasStore.getState().nodes.find((n) => n.id === id)!
  return { id, type: node.type, data: node.data, position: { x: 0, y: 0 }, selected: false, isConnectable: true,
    positionAbsoluteX: 0, positionAbsoluteY: 0, dragging: false, zIndex: 0 } as never
}
const mount = (el: JSX.Element) => render(<ReactFlowProvider>{el}</ReactFlowProvider>)
const topGap = () => screen.queryByTestId('decision-node-top-gap')

beforeEach(() => { window.history.replaceState(null, '', '/') })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('a program board: the question and the goal claim no gap the program does not have', () => {
  it('the question card carries no "Top gap" line', async () => {
    await board(true)
    mount(<DecisionNode {...props(QUESTION)} />)
    expect(topGap()).toBeNull()
    expect(document.body.textContent).not.toContain('Top gap')
  })

  it('the goal card carries no "Needs input" pill', async () => {
    await board(true)
    mount(<GoalNode {...props(GOAL)} />)
    expect(screen.queryByTestId('needs-input-pill')).toBeNull()
  })
})

describe('CONTRAST: where the legacy validator runs, the same nodes keep today’s gap', () => {
  it('the question card says "Top gap: set a success target"', async () => {
    await board(false)
    mount(<DecisionNode {...props(QUESTION)} />)
    expect(document.body.textContent).toContain('Top gap: set a success target')
  })

  it('the goal card shows the "Needs input" pill', async () => {
    await board(false)
    mount(<GoalNode {...props(GOAL)} />)
    expect(screen.getByTestId('needs-input-pill')).toBeTruthy()
  })
})
