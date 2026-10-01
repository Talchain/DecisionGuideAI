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
 *
 * ⛔⛔ THE ASYNC WINDOW (overflow CR 5937208012, 4 P1s): every await between the click and the switch can change who
 *   owns the canvas. So (1) the RESOLVED identity is checked before the mint, (2) after every await the click-time
 *   scenario must still own an empty canvas and no session may have begun, else nothing switches, (3) the new id is
 *   adopted through the existing scenario reset (`resetCanvas` on an empty canvas = `DECISION_CONTEXT_CLEAR`, which
 *   drops the previous scenario's `serverGraphIdentity` / `lastAuthoritativeGraph`, so a re-open after delete-all
 *   is not read back as `unchanged`), never an id-only switch, and (4) "opened" means READ BACK: the result waits
 *   for the hydration read to put D1's own node ids on the canvas; a failed read is reported, never re-minted.
 */
import { registerScenarioGraph, type RegisterScenarioGraphResult } from '../../adapters/cee/registerScenarioGraph'
import { getSessionIdentity } from '../../lib/supabase'
import { isPersistenceSessionActive } from '../../lib/persistenceSession'
import { useCanvasStore } from '../store'
import { setCurrentScenarioId } from '../store/scenarios'
import { useBootGraphReadStore, type BootGraphReadState } from '../hydrate/bootGraphRead'
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

/** How long "Opening…" waits for the read-back before saying it did not load. */
export const EXAMPLE_READ_BACK_TIMEOUT_MS = 20000

export type OpenExampleDecisionResult =
  /** Registered AND read back: D1's own node ids are on the canvas under the new id. */
  | { readonly status: 'opened'; readonly scenarioId: string }
  /** A signed-in session, before or during the open: guest mints are refused, as at the other mint sites. */
  | { readonly status: 'signed_in' }
  /** The click-time scenario no longer owns an empty canvas (content arrived, or the user moved): nothing switched. */
  | { readonly status: 'canvas_changed' }
  | { readonly status: 'not_opened'; readonly reason: Exclude<RegisterScenarioGraphResult['status'], 'registered'> }
  /** Registered, switched, but the read did not put D1 on the canvas. The server holds it; a reload reads it. Not re-minted. */
  | { readonly status: 'not_read_back'; readonly scenarioId: string; readonly read: BootGraphReadState | 'timeout' }

/** A read that SETTLED without putting the graph on the canvas. `absent` is retried by the hook, so it keeps waiting. */
const READ_FAILED: ReadonlySet<BootGraphReadState> = new Set<BootGraphReadState>([
  'unchanged', 'mergeRefused', 'notReadable', 'unavailable', 'signInRequired', 'refused', 'unusable', 'skipped',
])

function seedNodeIds(graph: unknown): string[] {
  const nodes = (graph as { nodes?: Array<{ id?: unknown }> }).nodes ?? []
  return nodes.flatMap((n) => (typeof n.id === 'string' ? [n.id] : []))
}

function waitForReadBack(
  scenarioId: string,
  ids: readonly string[],
  timeoutMs: number,
): Promise<'confirmed' | 'moved' | BootGraphReadState | 'timeout'> {
  return new Promise((resolve) => {
    let done = false
    const unsubs: Array<() => void> = []
    const finish = (v: 'confirmed' | 'moved' | BootGraphReadState | 'timeout') => {
      if (done) return
      done = true
      clearTimeout(timer)
      for (const u of unsubs) u()
      resolve(v)
    }
    const check = () => {
      const st = useCanvasStore.getState()
      if (st.currentScenarioId !== scenarioId) return finish('moved')
      const onCanvas = new Set(st.nodes.map((n) => n.id))
      if (ids.length > 0 && ids.every((id) => onCanvas.has(id))) return finish('confirmed')
      const read = useBootGraphReadStore.getState().byScenario[scenarioId]?.state
      if (read !== undefined && READ_FAILED.has(read)) finish(read)
    }
    const timer = setTimeout(() => finish('timeout'), timeoutMs)
    unsubs.push(useCanvasStore.subscribe(check), useBootGraphReadStore.subscribe(check))
    check()
  })
}

export async function openExampleDecision(
  opts: { readonly readBackTimeoutMs?: number } = {},
): Promise<OpenExampleDecisionResult> {
  if (isPersistenceSessionActive()) return { status: 'signed_in' }
  const origin = useCanvasStore.getState().currentScenarioId
  /** Re-asked after EVERY await: no session has begun, and the click-time scenario still owns an empty canvas. */
  const stillOurs = (): OpenExampleDecisionResult | null => {
    if (isPersistenceSessionActive()) return { status: 'signed_in' }
    const st = useCanvasStore.getState()
    if (st.currentScenarioId !== origin || st.nodes.length > 0 || st.edges.length > 0) return { status: 'canvas_changed' }
    return null
  }
  const identity = await getSessionIdentity()
  // The RESOLVED identity, not only the session flag: a login that lands during the await is a signed-in user.
  if (identity.userId !== null || identity.accessToken !== null) return { status: 'signed_in' }
  const graph = await loadExampleDecisionGraph()
  const lost1 = stillOurs()
  if (lost1) return lost1
  const scenarioId = crypto.randomUUID()
  const result = await registerScenarioGraph(scenarioId, graph, {
    expectNoGraph: true,
    initialBriefText: EXAMPLE_DECISION_BRIEF,
    userId: identity.userId,
    accessToken: identity.accessToken,
  })
  if (result.status !== 'registered') return { status: 'not_opened', reason: result.status }
  // The new scenario exists on the server either way; it is only opened over the canvas the click was made against.
  const lost2 = stillOurs()
  if (lost2) return lost2
  // Adopt through the existing scenario reset (DECISION_CONTEXT_CLEAR), never an id-only switch.
  useCanvasStore.getState().resetCanvas()
  useCanvasStore.setState({ currentScenarioId: scenarioId })
  setCurrentScenarioId(scenarioId)
  // The open is the read-back: the server-graph hydration re-reads on the id change, as a cold reload reads the pointer.
  const read = await waitForReadBack(scenarioId, seedNodeIds(graph), opts.readBackTimeoutMs ?? EXAMPLE_READ_BACK_TIMEOUT_MS)
  if (read === 'confirmed') return { status: 'opened', scenarioId }
  if (read === 'moved') return { status: 'canvas_changed' }
  return { status: 'not_read_back', scenarioId, read }
}
