/**
 * ⭐ ON A PROGRAM BOARD "ESTIMATE NOT YET CONFIRMED" IS THE CANONICAL RECORD'S ANSWER (panel-data, Paul 27 Oct: "making
 * sure that the data being used is the new model").
 *
 * Served on UI fd3da3fd: Reasoning's "Review the thinking" listed "Additional specialists 0 specialist — Estimate not yet
 * confirmed" (capacity bffa49b0) and "Whole percentage 100 %" (european 7e3ba3e4). Both are fixed parts of the model's
 * structure (canonical `author: structure`), and on Paul's board every record was approved. The check read the legacy
 * `observed_state.source` stamp, which a program never writes for structure and never updates on approval.
 *
 * Real path: the real `hydrateCanvasFromServer` and saved-graph read (only `fetch` stubbed), then the real
 * `ModelReviewTool`, read through its own `onQueueTargets` (the node ids its queue holds). Fixtures: the 26 Oct acceptance
 * run's served reads.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, cleanup, act } from '@testing-library/react'
import capacity from '../../../../canvas/nodes/__tests__/fixtures/served-acceptance-capacity-read-20261026.json'
import european from '../../../../canvas/nodes/__tests__/fixtures/served-acceptance-european-read-20261026.json'
import { useCanvasStore } from '../../../../canvas/store'
import { hydrateCanvasFromServer } from '../../../../canvas/hydrate/serverGraphHydration'
import { ModelReviewTool } from '../sections/ModelReviewTool'

vi.mock('../../../../v5/streamedTurnTransport', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../v5/streamedTurnTransport')>()),
  openV5TurnStream: async () => { throw new TypeError('Failed to fetch') },
}))
vi.mock('../../../../v5/eligibility', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../v5/eligibility')>()),
  isV5Eligible: () => ({ eligible: true }),
  isV5CanonicalRunPath: () => false,
}))
vi.mock('../../../../flags', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../../../flags')>()),
  isOrchestratorV2Enabled: () => true,
  isOrchestratorStreamingEnabled: () => false,
}))
vi.mock('../../../../lib/supabase', () => ({ getUserId: async () => null, getSessionIdentity: async () => ({ userId: null, accessToken: null }) }))
vi.mock('../../../../services/scenarioService', () => ({ loadScenario: async () => null, storeAnalysis: async () => undefined }))
vi.mock('../../../../lib/posthog', () => ({ trackEvent: () => undefined }))

type Json = Record<string, any>
let read: Json = {}
// The saved-graph read is cached per scenario and hash, so each opening reads its own hash.
let n = 0
/** Opens a served board and returns the node ids the review queue holds an item about. */
async function queueOf(board: Json): Promise<readonly string[]> {
  n += 1
  read = { ...board, graph_hash: `${board.graph_hash}${n}` }
  useCanvasStore.setState({
    nodes: [], edges: [], currentScenarioId: board.scenario_id, results: { status: 'idle' } as never,
    lastServerGraphHash: null, serverGraphIdentity: null, lastAuthoritativeGraph: null, analysisFreshness: null, analysisStateV1: null,
    selection: { nodeIds: new Set(), edgeIds: new Set(), anchorPosition: null },
  } as never)
  vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => (
    /\/scenarios\/[^/]+\/graph/.test(String(input))
      ? new Response(JSON.stringify(read), { status: 200, headers: { 'content-type': 'application/json' } })
      : new Response(JSON.stringify({ assistant_text: '', cards: [], notes: [], run: null, model: null }), { status: 200, headers: { 'content-type': 'application/json' } })
  )))
  await act(async () => { await hydrateCanvasFromServer(board.scenario_id) })
  let targets: readonly string[] = []
  render(<ModelReviewTool interventions={[]} onAsk={() => undefined} onQueueTargets={(ids) => { targets = ids }} />)
  // The saved-graph read has answered before anything asserts.
  await act(async () => { await new Promise((r) => setTimeout(r, 30)) })
  return targets
}
/** The served read with one canonical quantity's record changed. */
const withQuantity = (board: Json, id: string, patch: Json): Json => ({
  ...board,
  graph: { ...board.graph, living_model: { ...board.graph.living_model, canonical: { ...board.graph.living_model.canonical,
    quantities: (board.graph.living_model.canonical.quantities as Json[]).map((q) => (q.id === id ? { ...q, ...patch } : q)) } } },
})

beforeEach(() => {
  window.history.replaceState({}, '', '/#/canvas?ai=core-route')
  Element.prototype.scrollIntoView = vi.fn()
})
afterEach(() => { cleanup(); vi.unstubAllGlobals(); window.history.replaceState({}, '', '/') })

describe('a fixed part of the structure, or an approved figure, is not an estimate to confirm', () => {
  it('capacity "Additional specialists" (canonical author structure) is not in the review queue', async () => {
    expect(await queueOf(capacity)).not.toContain('additional_specialists')
  })

  it('european: the structure settings and the person\'s approved range are not in the review queue', async () => {
    const targets = await queueOf(european)
    for (const id of ['percentage_scale', 'expansion_scale', 'pilot_active', 'full_acquisition_active', 'pilot_acquisition_active', 'expansion_timing']) {
      expect(targets).not.toContain(id)
    }
  })
})

describe('POSITIVE CONTROL: Olumi\'s figure the person has not approved is still offered for their check', () => {
  it('european "expansion_timing" as Olumi\'s, proposed: in the review queue', async () => {
    expect(await queueOf(withQuantity(european, 'expansion_timing', { author: 'olumi', approval: 'proposed' }))).toContain('expansion_timing')
  })
})
