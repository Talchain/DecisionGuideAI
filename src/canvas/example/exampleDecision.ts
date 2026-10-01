/**
 * INVESTOR STEP 0: "Open the example decision" (DL 5936312621 / ruling 5936446785).
 *
 * One click puts D1, a prepared, credible decision, into a FRESH guest scenario and opens it: no brief replay, no
 * model call. The graph is the Reasoning Coach's banked D1 capture, UNMODIFIED (`d1.graph.json` is that capture's
 * `.json.draft_graph`, pinned by hash in the spec), because RC's M1/M3 cases are bound to it.
 *
 * ⛔ WHY NOT THE STARTER PATH. Starters land on the canvas and are registered through `buildRegistrationGraph`, whose
 *   edge projection sends from/to/strength/direction only and DROPS `provenance`. D1's two `olumi_placeholder` links
 *   would reach CEE unsized, and M1's one-click and RC's S1 would never fire (RC invariant 1). So the graph goes to
 *   CEE verbatim through the existing register door, and the canvas then reads it back exactly as a cold reload does
 *   (`useServerGraphHydration` re-reads when `currentScenarioId` changes). The canvas never re-projects it.
 *
 * ⛔ NEVER ON TOP OF A MODEL. The id is minted here, and the write asserts `expected_graph_identity_hash: null`, which
 *   CEE adjudicates against its own stored bytes (409 → `conflict` if any graph is there). A failure leaves the
 *   current scenario exactly as it was. Signed-in users get no guest mint (the same refusal as the other two mints).
 */
import { registerScenarioGraph, type RegisterScenarioGraphResult } from '../../adapters/cee/registerScenarioGraph'
import { getSessionIdentity } from '../../lib/supabase'
import { isPersistenceSessionActive } from '../../lib/persistenceSession'
import { useCanvasStore } from '../store'
import { setCurrentScenarioId } from '../store/scenarios'
import { recordRegistrationAcknowledged } from '../hydrate/bootGraphRead'
import d1Brief from './d1.brief.json'

/** Where the shipped bytes came from. The spec recomputes the graph hash from the shipped file. */
export const EXAMPLE_DECISION_PROVENANCE = {
  capture: 'olumi-programme-docs@rc/reasoning-coach-20261001:output/reasoning-coach/captures/d1-sprint-1149Z-11-s5-run.json',
  captureSha256: 'eeeff8b46bc4bbcae7669ca52118b6a6880c5270f0a1010f3ee4de2159f5473f',
  extracted: '.json.draft_graph',
  /** sha256 of `JSON.stringify(graph)` for the shipped `d1.graph.json`. */
  graphSha256: '6d009d819a42f90a33901f79cd00377e9bd52ab8b0ad9a096f21d1b782149a70',
  /** The brief R3 registered with this graph on c77d9373 (read back 13 nodes / 19 edges, 2 placeholders). */
  brief: 'olumi-programme-docs@r3/science-notes:r3-science/f5-20261001/rc-d1-seed/01-cold-brief.json .json.brief_text',
} as const

export const EXAMPLE_DECISION_BRIEF: string = (d1Brief as { brief_text: string }).brief_text

export async function loadExampleDecisionGraph(): Promise<unknown> {
  const mod = await import('./d1.graph.json')
  return (mod as { default?: unknown }).default ?? mod
}

export type OpenExampleDecisionResult =
  | { readonly status: 'opened'; readonly scenarioId: string }
  /** A signed-in session: guest mints are refused, as at the other mint sites. */
  | { readonly status: 'signed_in' }
  /** Content arrived on the canvas while the write was in flight: the click was made against an empty canvas. */
  | { readonly status: 'canvas_changed' }
  | { readonly status: 'not_opened'; readonly reason: Exclude<RegisterScenarioGraphResult['status'], 'registered'> }

export async function openExampleDecision(): Promise<OpenExampleDecisionResult> {
  if (isPersistenceSessionActive()) return { status: 'signed_in' }
  const graph = await loadExampleDecisionGraph()
  const scenarioId = crypto.randomUUID()
  const identity = await getSessionIdentity()
  const result = await registerScenarioGraph(scenarioId, graph, {
    expectNoGraph: true,
    initialBriefText: EXAMPLE_DECISION_BRIEF,
    userId: identity.userId,
    accessToken: identity.accessToken,
  })
  if (result.status !== 'registered') return { status: 'not_opened', reason: result.status }
  // The new scenario exists on the server either way; only open it over the empty canvas the click was made against.
  const now = useCanvasStore.getState()
  if (now.nodes.length > 0 || now.edges.length > 0) return { status: 'canvas_changed' }
  recordRegistrationAcknowledged(scenarioId)
  // Switching the id is the open: the server-graph hydration re-reads on an id change, as a cold reload reads the pointer.
  useCanvasStore.setState({ currentScenarioId: scenarioId })
  setCurrentScenarioId(scenarioId)
  return { status: 'opened', scenarioId }
}
