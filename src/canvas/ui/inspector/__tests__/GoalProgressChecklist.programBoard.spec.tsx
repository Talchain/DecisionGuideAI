/**
 * The goal's checklist claims no threshold gap on a program board (follow-up to #2999, same cause). Its "Threshold not
 * set yet" row reads the store's goal-target scalar, which a program board never fills (`goalThreshold: null`), so the
 * goal inspector's More section said it beside the brief's stated target of 150. On a core board CEE's admission
 * decides (store `legacyValidationOff`), so that row is not shown; Title, Connected and Options stay.
 *
 * Real path: the served read (`served-program-orders-read-20261026.json`, its `_source` names the run) through the real
 * `hydrateCanvasFromServer` (only `fetch` stubbed), then the real `GoalProgressChecklist`. The contrast is the same nodes
 * where the legacy validator runs.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../../../store'
import { hydrateCanvasFromServer } from '../../../hydrate/serverGraphHydration'
import { GoalProgressChecklist } from '../GoalProgressChecklist'
import served from '../../../nodes/__tests__/fixtures/served-program-orders-read-20261026.json'

const GOAL = 'reach_order_target'

async function board(legacyValidationOff: boolean) {
  useCanvasStore.setState({ currentScenarioId: served.scenario_id } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  // A repeat read of the same saved graph answers `unchanged`; the nodes are on the store either way.
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(served.scenario_id))
  expect(useCanvasStore.getState().nodes.some((n) => n.id === GOAL)).toBe(true)
  // As read on staging for this board: the legacy scalar stays empty.
  expect(useCanvasStore.getState().goalThreshold).toBeNull()
  useCanvasStore.setState({ legacyValidationOff } as never)
}
const text = () => screen.getByTestId('goal-progress-checklist').textContent ?? ''

afterEach(() => { cleanup(); vi.unstubAllGlobals() })

describe('the goal checklist on a program board', () => {
  it('says no "Threshold not set yet"; Title, Connected and Options stay', async () => {
    await board(true)
    render(<GoalProgressChecklist nodeId={GOAL} />)
    expect(text()).not.toContain('Threshold')
    expect(text()).toContain('Title set')
    expect(text()).toContain('Connected to factors')
    expect(text()).toContain('Options defined')
  })

  it('CONTRAST: where the legacy validator runs, the same nodes keep "Threshold not set yet"', async () => {
    await board(false)
    render(<GoalProgressChecklist nodeId={GOAL} />)
    expect(text()).toContain('Threshold not set yet')
  })
})
