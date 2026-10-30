/**
 * P1 S2 (DL, 30 Oct): a participant's panel answer applied to a PROGRAM card must reach the wire. It failed closed: the
 * apply forces the model-scale belt, which refuses any card with a unit and no cap, and every program card has one. On a
 * program board it now goes as the verified 0–1 probability alone (no raw_value, no unit); CEE converts it to the card's
 * own unit (S1). Off a program board the belt is unchanged.
 *
 * Real path: the reveal's "Use …" button → panelApplyHandoff → usePanelApplyDrain → buildFactorValueEditEvent →
 * buildV5Payload, with the served read hydrated so the board's program state is the saved read's own.
 * belief.value is a probability (useBeliefElicitation.ts:147): "8%" → 0.08.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, cleanup } from '@testing-library/react'

vi.mock('../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))

import { RevealBody } from '../../../pages/ParticipantPacketPage'
import type { RevealView } from '../../../collab/collabService'
import { rememberPendingApply, forgetPendingApply } from '../../../collab/panelApplyHandoff'
import { usePanelApplyDrain } from '../usePanelApplyDrain'
import { buildV5Payload } from '../../../v5/buildPayload'
import { useCanvasStore } from '../../store'
import { hydrateCanvasFromServer } from '../../hydrate/serverGraphHydration'
import rate from '../../nodes/__tests__/fixtures/served-c6-european-draft-read-20261029.json'
import pct from '../../nodes/__tests__/fixtures/served-w8-european-read-20261027.json'

type Json = Record<string, any>
const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'
const GRACE_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'
let n = 0

function reveal(targetId: string): RevealView {
  return { round_id: ROUND_ID, status: 'closed', graph_version_ref: 'mv-1', per_target: [{
    target: { kind: 'factor', id: targetId }, label: 'Monthly churn', model_value_at_version: null,
    responses: [{ participant_id: GRACE_ID, display_label: 'Grace', value: 0.08, expression_raw: 'about 8%', confidence: null, kind: 'belief_submitted' }],
  }] } as unknown as RevealView
}

/** Open the board from its saved read, click Grace's answer, drain on the canvas, and return what reached the wire. */
async function drained(board: Json, targetId: string): Promise<Json | null> {
  n += 1
  const read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  const sid = board.scenario_id as string
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(read), { status: 200, headers: { 'Content-Type': 'application/json' } })))
  useCanvasStore.setState({ currentScenarioId: sid, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
  await act(async () => { await hydrateCanvasFromServer(sid) })
  forgetPendingApply(sid)
  render(<RevealBody reveal={reveal(targetId)} apply={{ onApply: (a) => rememberPendingApply({ scenarioId: sid, roundId: ROUND_ID,
    participantId: a.participantId, targetId: a.targetId, value: a.value }), applyingKey: null, appliedKey: null, applyError: null }} />)
  await act(async () => { screen.getByText('Use Grace’s 8%').click() })
  let wire: Json | null = null
  function Canvas() {
    const nodes = useCanvasStore((s) => s.nodes)
    usePanelApplyDrain({ scenarioId: sid, graphReady: true, graphRevision: nodes,
      lookupNodeData: (id) => nodes.find((x) => x.id === id)?.data,
      sendSystemEvent: async (event) => {
        const r = buildV5Payload({ turnId: '11111111-2222-4333-8444-555566667777', scenarioId: sid, stage: 'frame' as never,
          turnClass: 'system' as never, mode: 'system', systemEvent: event as never })
        if (!r.ok) throw new Error(`payload refused: ${JSON.stringify(r)}`)
        wire = (r.payload as unknown as { event: Json }).event
        return undefined
      } })
    return null
  }
  render(<Canvas />)
  // The saved-graph read answers, the program state settles, and the drain re-runs.
  await act(async () => { await new Promise((r) => setTimeout(r, 50)) })
  forgetPendingApply(sid)
  return wire
}

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('a panel answer applied to a program card reaches the wire as the verified probability', () => {
  it.each([
    ['`1/month` card', 'monthly_churn', rate],
    ['`%` card', 'base_churn', pct],
  ] as const)('%s (%s): factor_value_edit, value 0.08, applied_from, no raw_value or unit', async (_shape, id, board) => {
    const w = await drained(board as Json, id)
    expect(w, 'no turn reached the wire').not.toBeNull()
    expect(w!.kind).toBe('factor_value_edit')
    expect(w!.target_id).toBe(id)
    expect(w!.value).toBe(0.08)
    expect(w!.applied_from).toEqual({ round_id: ROUND_ID, participant_id: GRACE_ID })
    expect('raw_value' in w!).toBe(false)
    expect('unit' in w!).toBe(false)
  })

  it('CONTRAST: the same card off a program board still fails closed (the belt is unchanged)', async () => {
    const notProgram = structuredClone(rate) as Json
    delete (notProgram.body ?? notProgram).graph.living_model
    delete (notProgram.body ?? notProgram).living_model
    // Its own scenario: a scenario already read as a program stays one while a later read is pending (by design).
    notProgram.scenario_id = '7c0ffee0-0000-4000-8000-000000000001'
    const w = await drained(notProgram, 'monthly_churn')
    expect(w).toBeNull()
  })
})
