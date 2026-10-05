/**
 * INVESTOR STEP 0: "Open the example decision" (DL 5936312621 / ruling 5936446785).
 *
 * One click puts D1, a prepared, credible decision, into a FRESH guest scenario and opens it: no brief replay, no
 * model call. The graph is the Reasoning Coach's banked D1, pre-sized by RT-12 / Science 5993266380 with seven
 * example figures and the goal "Grow quarterly revenue". Its shipped hash is pinned separately from the capture.
 *
 * ⛔ WHY NOT THE STARTER PATH. Starters land on the canvas and are registered through `buildRegistrationGraph`, whose
 *   edge projection sends from/to/strength/direction only and DROPS `provenance`, losing D1's example attribution.
 *   So the graph goes to
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
 *   adopted through the store's whole-scenario reset (`adoptScenario`, whose state includes `DECISION_CONTEXT_CLEAR`,
 *   dropping the previous scenario's `serverGraphIdentity` / `lastAuthoritativeGraph`, so a re-open after delete-all
 *   is not read back as `unchanged`), never an id-only switch, and (4) "opened" means READ BACK: the result waits
 *   for the hydration read to put D1's own node ids on the canvas; a failed read is reported, never re-minted.
 * ⛔⛔ ROUND 2 (delta CR 5937527070): (a) adoption is the WHOLE scenario (`adoptScenario`: results, analysis state,
 *   freshness, fact, first-run flag, comparison, drafts, undo), never `resetCanvas`'s empty-canvas early return, so D1
 *   inherits nothing from a Run the user cleared; (b) the AUTHORITATIVE session (`getSessionIdentity`) is re-read right
 *   before adoption, because CanvasMVP's mirrored flag publishes a render later than a login resolves; (c) the minted
 *   id is kept after `not_read_back`, so the next click re-reads THAT scenario instead of writing a second one.
 */
import { registerScenarioGraph, type RegisterScenarioGraphResult } from '../../adapters/cee/registerScenarioGraph'
import { getSessionIdentity, supabase } from '../../lib/supabase'
import { isPersistenceSessionActive } from '../../lib/persistenceSession'
import { useCanvasStore } from '../store'
import { useBootGraphReadStore, type BootGraphReadState } from '../hydrate/bootGraphRead'
import { hydrateCanvasFromServer } from '../hydrate/serverGraphHydration'
import d1Brief from './d1.brief.json'

/** Where the shipped bytes came from. The spec recomputes the graph hash from the shipped file. */
export const EXAMPLE_DECISION_PROVENANCE = {
  capture: 'olumi-programme-docs@rc/reasoning-coach-20261001:output/reasoning-coach/captures/d1-sprint-1149Z-11-s5-run.json',
  captureSha256: 'eeeff8b46bc4bbcae7669ca52118b6a6880c5270f0a1010f3ee4de2159f5473f',
  extracted: '.json.draft_graph',
  /** sha256 of `JSON.stringify(graph)` for the shipped `d1.graph.json`. */
  // RT-12 / Science 5993266380: the pre-sized patch; capture fields above retain the original banked identity.
  graphSha256: 'b0abef2da7be9348f3b99cdab6b19f880ebae58db8ee345ba2e19f1d78000a8a',
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

/** The scenario a previous click created but could not read back. A retry re-reads it; it is never written twice. */
let unreadExampleId: string | null = null

/** Test teardown only. */
export function __resetExampleDecisionForTests(): void {
  unreadExampleId = null
}

const isGuest = (id: { userId: string | null; accessToken: string | null }) => id.userId === null && id.accessToken === null

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
  // CLICK time, before ANY await: a scenario boundary during the identity or graph await (e.g. "Start fresh" on the
  // empty canvas, which moves neither the id nor the emptiness) must be seen by every later check (delta CR round 4).
  const epoch = useCanvasStore.getState().scenarioEpoch
  /** Re-asked after EVERY await: no session has begun, and the click-time scenario still owns an empty canvas. */
  const stillOurs = (): OpenExampleDecisionResult | null => {
    if (isPersistenceSessionActive()) return { status: 'signed_in' }
    const st = useCanvasStore.getState()
    if (st.currentScenarioId !== origin || st.scenarioEpoch !== epoch || st.nodes.length > 0 || st.edges.length > 0) {
      return { status: 'canvas_changed' }
    }
    return null
  }
  const identity = await getSessionIdentity()
  // The RESOLVED identity, not only the session flag: a login that lands during the await is a signed-in user.
  if (!isGuest(identity)) return { status: 'signed_in' }
  const graph = await loadExampleDecisionGraph()
  const lost1 = stillOurs()
  if (lost1) return lost1
  if (unreadExampleId !== null) {
    if (unreadExampleId === origin) return rereadExample(unreadExampleId, graph, epoch)
    unreadExampleId = null // the user has moved on from it; this click is a fresh open
  }
  const scenarioId = crypto.randomUUID()
  const result = await registerScenarioGraph(scenarioId, graph, {
    expectNoGraph: true,
    initialBriefText: EXAMPLE_DECISION_BRIEF,
    userId: identity.userId,
    accessToken: identity.accessToken,
  })
  if (result.status !== 'registered') return { status: 'not_opened', reason: result.status }
  // The new scenario exists on the server either way; it is only opened over the canvas the click was made against.
  // The AUTHORITATIVE session is re-read here (the mirrored flag can lag a login), then ownership, with no await
  // between that check and the adoption.
  const late = await getSessionIdentity()
  if (!isGuest(late)) return { status: 'signed_in' }
  const lost2 = stillOurs()
  if (lost2) return lost2
  useCanvasStore.getState().adoptScenario(scenarioId)
  // The open is the read-back: the server-graph hydration re-reads on the id change, as a cold reload reads the pointer.
  const read = await waitForReadBack(scenarioId, seedNodeIds(graph), opts.readBackTimeoutMs ?? EXAMPLE_READ_BACK_TIMEOUT_MS)
  if (read === 'confirmed') return { status: 'opened', scenarioId }
  if (read === 'moved') return { status: 'canvas_changed' }
  unreadExampleId = scenarioId
  return { status: 'not_read_back', scenarioId, read }
}

/**
 * The retry after `not_read_back`: read the scenario this flow already created, through the same direct read
 * `draftRecovery` uses. No write, no mint.
 *
 * ⛔ A STRICT APPLY-TIME FENCE (#2418 delta CR, P1-2). The read is async and applies inside `hydrateCanvasFromServer`,
 *   so the fence is its `canApply`, checked after the read and before any write: the same scenario id, an EMPTY
 *   canvas, the same `scenarioEpoch` (a "Start fresh" on the empty canvas moves nothing else), and no session, read
 *   from BOTH the mirrored flag and the auth source itself (`onAuthStateChange`, which fires before CanvasMVP's
 *   passive effect publishes the flag). The authoritative identity is also re-read right before the read.
 */
async function rereadExample(
  scenarioId: string,
  graph: unknown,
  /** Captured at CLICK time by the caller, before any await. */
  epoch: number,
): Promise<OpenExampleDecisionResult> {
  const late = await getSessionIdentity()
  if (!isGuest(late)) return { status: 'signed_in' }
  let sessionSeen = false
  const { data } = supabase.auth.onAuthStateChange((_event, session) => {
    if (session) sessionSeen = true
  })
  try {
    const signedIn = () => sessionSeen || isPersistenceSessionActive()
    const fence = (): boolean => {
      const st = useCanvasStore.getState()
      return !signedIn() && st.currentScenarioId === scenarioId && st.scenarioEpoch === epoch &&
        st.nodes.length === 0 && st.edges.length === 0
    }
    if (!fence()) return signedIn() ? { status: 'signed_in' } : { status: 'canvas_changed' }
    const outcome = await hydrateCanvasFromServer(scenarioId, {
      userId: late.userId,
      accessToken: late.accessToken,
      includeConversationTurns: true,
      canApply: fence,
    })
    if (signedIn()) return { status: 'signed_in' }
    const st = useCanvasStore.getState()
    if (st.currentScenarioId !== scenarioId || st.scenarioEpoch !== epoch) return { status: 'canvas_changed' }
    const onCanvas = new Set(st.nodes.map((n) => n.id))
    const ids = seedNodeIds(graph)
    if (ids.length > 0 && ids.every((id) => onCanvas.has(id))) {
      unreadExampleId = null
      return { status: 'opened', scenarioId }
    }
    return { status: 'not_read_back', scenarioId, read: outcome }
  } finally {
    data.subscription.unsubscribe()
  }
}
