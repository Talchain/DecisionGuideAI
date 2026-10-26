/**
 * The goal's checklist claims no threshold gap on a program board (follow-up to #2999, same cause). Its "Threshold not
 * set yet" row reads the store's goal-target scalar, which a program board never fills (`goalThreshold: null`), so the
 * goal inspector's More section said it beside the brief's stated target of 150. On a core board CEE's admission
 * decides (store `legacyValidationOff`), so that row is not shown; Title, Connected and Options stay.
 *
 * Real path: the served read (`served-program-orders-read-20261026.json`, its `_source` names the run) through the real
 * `hydrateCanvasFromServer` (only `fetch` stubbed); the flag is classified by the real `useLegacyValidationOff` from that
 * same read (Codex on #3002: never set by hand), written as CanvasMVP writes it; then the real `GoalProgressChecklist`.
 * The contrast is the same read answered without a living model (a legacy board), classified the same way.
 */
import { useEffect } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'

vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { useCanvasStore } from '../../../store'
import { hydrateCanvasFromServer } from '../../../hydrate/serverGraphHydration'
import { GoalProgressChecklist } from '../GoalProgressChecklist'
import { useLegacyValidationOff } from '../../../nodes/shared/savedModelIsCore'
import served from '../../../nodes/__tests__/fixtures/served-program-orders-read-20261026.json'

const GOAL = 'reach_order_target'

/**
 * SYNTHETIC, labelled: the served board as a legacy one, the same read with no living model, under its own scenario id
 * and hash (the classifier keeps each scenario's answered verdict, and a read is never reused across scenarios).
 */
const LEGACY_ID = '0b4c2d7e-1111-4222-8333-94445555a001'
const legacy = (() => {
  const graph = Object.fromEntries(Object.entries(served.graph).filter(([k]) => k !== 'living_model'))
  return { ...served, scenario_id: LEGACY_ID, graph_hash: `${served.graph_hash}-legacy`, graph }
})()

async function board(read: { scenario_id: string }) {
  useCanvasStore.setState({ currentScenarioId: read.scenario_id, legacyValidationOff: false } as never)
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  // A repeat read of the same saved graph answers `unchanged`; the nodes are on the store either way.
  expect(['merged', 'unchanged']).toContain(await hydrateCanvasFromServer(read.scenario_id))
  expect(useCanvasStore.getState().nodes.some((n) => n.id === GOAL)).toBe(true)
  // As read on staging for this board: the legacy scalar stays empty.
  expect(useCanvasStore.getState().goalThreshold).toBeNull()
}
/** CanvasMVP's own two lines: the board's classification, written to the store. */
function LegacyValidationOffProducer() {
  const off = useLegacyValidationOff()
  useEffect(() => { useCanvasStore.getState().setLegacyValidationOff(off) }, [off])
  return null
}
async function mountChecklist(expectOff: boolean) {
  render(<><LegacyValidationOffProducer /><GoalProgressChecklist nodeId={GOAL} /></>)
  // The read answers (or the lane default holds) before the row is asserted.
  await waitFor(() => expect(screen.getByTestId('goal-progress-checklist')).toBeTruthy())
  await new Promise((r) => setTimeout(r, 50))
  expect(useCanvasStore.getState().legacyValidationOff).toBe(expectOff)
}
const text = () => screen.getByTestId('goal-progress-checklist').textContent ?? ''

beforeEach(() => { window.history.replaceState(null, '', '/?ai=core-route') })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('the goal checklist on a program board', () => {
  it('says no "Threshold not set yet"; Title, Connected and Options stay', async () => {
    await board(served)
    await mountChecklist(true)
    expect(text()).not.toContain('Threshold')
    expect(text()).toContain('Title set')
    expect(text()).toContain('Connected to factors')
    expect(text()).toContain('Options defined')
  })

  it('CONTRAST: the same read answered without a living model (a legacy board) keeps "Threshold not set yet"', async () => {
    await board(legacy)
    await mountChecklist(false)
    expect(text()).toContain('Threshold not set yet')
  })
})
