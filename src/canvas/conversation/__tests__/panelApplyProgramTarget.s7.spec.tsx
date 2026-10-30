/**
 * P1 S7 (DL, 30 Oct): on a program board a panel answer's target is a canonical QUANTITY, and the board draws a quantity as
 * a card, as a link's coefficient ("+0.035 (0.015–0.08) per month"), or not at all. The drain looked the target up as a
 * canvas NODE and deferred forever on a miss, so an answer for a coefficient never reached the wire (served P1 witness,
 * 30 Oct 06:13Z: `german_churn` was an edge coefficient; reveal-applied showed, no turn followed). On a program board the
 * drain now finds the target in the saved model the board reads; a legacy board keeps its canvas-node lookup.
 *
 * Real path, as `panelApplyProgramWire.p1s2.spec.tsx`: the reveal's "Use …" button → panelApplyHandoff →
 * usePanelApplyDrain → buildFactorValueEditEvent → buildV5Payload, with the served read hydrated so the board's program
 * state is the saved read's own. belief.value is a probability: "8%" → 0.08.
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
import served from '../../nodes/__tests__/fixtures/served-c6-european-draft-read-20261029.json'

type Json = Record<string, any>
const ROUND_ID = 'c3d4e5f6-a7b8-4901-9234-56789abcdef0'
const SAM_ID = '9f1c7d2e-4b3a-4c11-8e6f-0a2b5c8d7e10'
/** A coefficient the board draws on a link (the served witness's `german_churn` shape): one edge names it. */
const EDGE_COEFFICIENT = 'european_expansion__monthly_churn'
/** A quantity the board does not draw at all (asked, 1/month). */
const UNDRAWN = 'single_country_pilot__monthly_churn'
let n = 0

function reveal(targetId: string): RevealView {
  return { round_id: ROUND_ID, status: 'closed', graph_version_ref: 'mv-1', per_target: [{
    target: { kind: 'factor', id: targetId }, label: 'Monthly churn', model_value_at_version: null,
    responses: [{ participant_id: SAM_ID, display_label: 'Sam', value: 0.08, expression_raw: 'about 8%', confidence: null, kind: 'belief_submitted' }],
  }] } as unknown as RevealView
}

/** The served read with one edge carrying a coefficient, as tonight's served board drew `german_churn`. */
function withEdgeCoefficient(): Json {
  const read = structuredClone(served) as Json
  const graph = (read.body ?? read).graph as Json
  graph.edges[0] = { ...graph.edges[0], coefficient_id: EDGE_COEFFICIENT }
  return read
}

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

/** Hydrate the board from its saved read, then click Sam's answer on the reveal (the handoff records the apply intent). */
async function openBoardAndClick(read: Json, targetId: string): Promise<string> {
  const sid = read.scenario_id as string
  window.history.replaceState(null, '', '/?ai=core-route')
  vi.stubGlobal('fetch', vi.fn(async () => json(read)))
  useCanvasStore.setState({ currentScenarioId: sid, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
  await act(async () => { await hydrateCanvasFromServer(sid) })
  forgetPendingApply(sid)
  render(<RevealBody reveal={reveal(targetId)} apply={{ onApply: (a) => rememberPendingApply({ scenarioId: sid, roundId: ROUND_ID,
    participantId: a.participantId, targetId: a.targetId, value: a.value }), applyingKey: null, appliedKey: null, applyError: null }} />)
  await act(async () => { screen.getByText('Use Sam’s 8%').click() })
  return sid
}

/**
 * The canvas, as `PanelApplyDrainHost` mounts the drain: a STABLE canvas-node lookup that reads the store and a stable
 * sender, so the drain re-runs only on its own dependencies (an inline lookup would re-run it on every render and hide a
 * missing one). Every event that reaches the wire is kept.
 */
function mountCanvas(sid: string, wire: Json[]) {
  const lookupNodeData = (id: string): unknown => useCanvasStore.getState().nodes.find((x) => x.id === id)?.data
  const sendSystemEvent = async (event: unknown) => {
    const r = buildV5Payload({ turnId: '11111111-2222-4333-8444-555566667777', scenarioId: sid, stage: 'frame' as never,
      turnClass: 'system' as never, mode: 'system', systemEvent: event as never })
    if (!r.ok) throw new Error(`payload refused: ${JSON.stringify(r)}`)
    wire.push((r.payload as unknown as { event: Json }).event)
    return undefined
  }
  function Canvas() {
    const nodes = useCanvasStore((s) => s.nodes)
    usePanelApplyDrain({ scenarioId: sid, graphReady: true, graphRevision: nodes, lookupNodeData, sendSystemEvent })
    return null
  }
  render(<Canvas />)
}

const settle = (ms = 50) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })

/** Open, click, mount the canvas and let the saved-graph read answer: what reached the wire. */
async function drained(board: Json, targetId: string): Promise<Json[]> {
  n += 1
  const read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  const sid = await openBoardAndClick(read, targetId)
  const wire: Json[] = []
  mountCanvas(sid, wire)
  await settle()
  forgetPendingApply(sid)
  return wire
}

function expectVerifiedApply(wire: Json[], targetId: string) {
  expect(wire, 'exactly one turn reaches the wire').toHaveLength(1)
  const w = wire[0]!
  expect(w.kind).toBe('factor_value_edit')
  expect(w.target_id).toBe(targetId)
  expect(w.value).toBe(0.08)
  expect(w.applied_from).toEqual({ round_id: ROUND_ID, participant_id: SAM_ID })
  expect('raw_value' in w).toBe(false)
  expect('unit' in w).toBe(false)
}

beforeEach(() => { vi.restoreAllMocks() })
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState(null, '', '/') })

describe('S7: a panel answer for a program quantity the board does not draw as a card reaches the wire', () => {
  it('(a) a coefficient drawn on a link: one factor_value_edit, value 0.08, applied_from, no raw_value or unit', async () => {
    const read = withEdgeCoefficient()
    const nodes = ((read.body ?? read).graph.nodes as Json[]).map((x) => x.id)
    expect(nodes).not.toContain(EDGE_COEFFICIENT)
    expectVerifiedApply(await drained(read, EDGE_COEFFICIENT), EDGE_COEFFICIENT)
  })

  it('(b) a quantity the board does not draw at all: the same verified apply', async () => {
    expectVerifiedApply(await drained(served as Json, UNDRAWN), UNDRAWN)
  })

  it('(c) CONTRAST: a legacy board keeps its canvas-node lookup: a target with no node waits, nothing is sent', async () => {
    const notProgram = structuredClone(served) as Json
    delete (notProgram.body ?? notProgram).graph.living_model
    delete (notProgram.body ?? notProgram).living_model
    // Its own scenario: a scenario already read as a program stays one while a later read is pending (by design).
    notProgram.scenario_id = '7c0ffee0-0000-4000-8000-000000000007'
    expect(await drained(notProgram, UNDRAWN)).toEqual([])
  })

  it('(d) CONTRAST: a program target the saved model does not hold waits, nothing is sent', async () => {
    expect(await drained(served as Json, 'no_such_quantity')).toEqual([])
  })

  it('(e) on a program board whose saved model is being read again, the apply waits for that read, then goes once', async () => {
    n += 1
    const first: Json = { ...withEdgeCoefficient(), graph_hash: `${served.graph_hash}${n}` }
    const sid = first.scenario_id as string
    window.history.replaceState(null, '', '/?ai=core-route')
    vi.stubGlobal('fetch', vi.fn(async () => json(first)))
    useCanvasStore.setState({ currentScenarioId: sid, serverGraphIdentity: null, nodes: [], edges: [], lastServerGraphHash: null, lastAuthoritativeGraph: null } as never)
    await act(async () => { await hydrateCanvasFromServer(sid) })
    forgetPendingApply(sid)
    const wire: Json[] = []
    mountCanvas(sid, wire)
    await settle() // the board's saved read answers: a program
    expect(wire).toEqual([])

    // The owner applies Sam's answer; meanwhile the model is saved again, so its saved read is pending.
    let answer!: (r: Response) => void
    const again = `${served.graph_hash}${n}-again`
    vi.stubGlobal('fetch', vi.fn(() => new Promise<Response>((resolve) => { answer = resolve })))
    render(<RevealBody reveal={reveal(EDGE_COEFFICIENT)} apply={{ onApply: (a) => rememberPendingApply({ scenarioId: sid, roundId: ROUND_ID,
      participantId: a.participantId, targetId: a.targetId, value: a.value }), applyingKey: null, appliedKey: null, applyError: null }} />)
    await act(async () => { screen.getByText('Use Sam’s 8%').click() })
    await act(async () => { useCanvasStore.setState({ lastServerGraphHash: again } as never) })
    await settle()
    expect(wire, 'nothing goes while the saved read is pending').toEqual([])

    await act(async () => { answer(json({ ...first, graph_hash: again })) })
    await settle()
    expectVerifiedApply(wire, EDGE_COEFFICIENT)
    forgetPendingApply(sid)
  })
})
