/**
 * stopTurn — telling the SERVER that the user pressed Stop.
 *
 * Until this existed, Stop aborted our own `AbortController` and nothing else.
 * CEE deliberately does not cancel a turn when the client hangs up (the
 * deliberate no-cancel-on-disconnect block in CEE's `streamed-turn-sse.ts`),
 * so the turn ran to completion and COMMITTED.
 * Reproduced end-to-end on staging (`PHASE0-EVIDENCE-2026-07-28/fix-stop-fence.md`):
 * a draft stopped at +4.0s ran its full 52.7s, committed, and overwrote the graph
 * of a different turn the user had sent at +5.0s. The user saw an empty composer,
 * assumed nothing had happened, and their canvas was replaced by the work they
 * had cancelled.
 *
 * ── THE ENDPOINT IS DERIVED, NOT MIRRORED ───────────────────────────────────
 * `<buffered endpoint> + '/stop'`, from `v5Adapter`'s resolver — the same rule
 * `streamedTurnTransport` uses for `/stream`. A second copy of the env ladder
 * would be trap 12 with a 404 for a failure mode. Both rungs exist server-side:
 *
 *   VITE_V5_ENDPOINT=…/proxy/v5/turn → …/proxy/v5/turn/stop   (what staging bakes)
 *   /bff/orchestrate/v2/turn         → /bff/orchestrate/v2/turn/stop
 *
 * ── WHAT THE ANSWER IS FOR ──────────────────────────────────────────────────
 * NOT to decide whether to stop — the local abort has already happened. It is
 * what lets the terminal notice describe the PAST instead of predicting a
 * commit:
 *
 *   'not_saved'     — the tombstone is recorded and the turn had not committed
 *                     when it landed, so the fence will refuse its write.
 *   'already_saved' — the turn had ALREADY committed (server-derived from
 *                     v5_conversation_turns). No tombstone can unsave it, and
 *                     telling the user "nothing was saved" here would be a lie.
 *   'unconfirmed'   — we could not reach the server, it answered non-2xx, we ran
 *                     out of patience, OR the body did not carry a RECOGNISABLE
 *                     answer. We do not know, and the copy says so.
 *
 * ⚠ EVERY UNRECOGNISED SHAPE RESOLVES TO 'unconfirmed', INCLUDING FOR
 *   `already_committed`. Neither of the other two kinds is ever the fallback,
 *   because both are positive claims about the user's data: `not_saved` says
 *   their canvas is unchanged and `already_saved` says it changed. A fallback
 *   that asserts either one on an unreadable signal is a fabrication, and the
 *   shape table in `stopTurn.spec.ts` pins all of them.
 *
 * A single boolean would have collapsed 'already_saved' and 'unconfirmed' into
 * the same silence, which is exactly the state this whole lane is about.
 */
import { recordRequestPayload, recordResponsePayload } from '../lib/payload-trace-store'
import { __internals as adapterInternals } from './v5Adapter'

export type TurnStopOutcomeKind = 'not_saved' | 'already_saved' | 'unconfirmed'

export interface TurnStopResult {
  readonly kind: TurnStopOutcomeKind
  /** Present for `unconfirmed` — why we could not tell. Diagnostics only. */
  readonly reason?: string
}

/**
 * How long we wait for the stop acknowledgement before showing the honest
 * "could not confirm" notice.
 *
 * The user has already stopped; this budget only decides how long the terminal
 * notice is delayed. Short on purpose — a notice that arrives after the user has
 * moved on is worse than one that admits uncertainty.
 */
export const STOP_ACK_BUDGET_MS = 5_000

export function getV5StopEndpoint(): string {
  return `${adapterInternals.resolveEndpoint().replace(/\/+$/, '')}/stop`
}

export interface StopTurnOptions {
  fetchImpl?: typeof fetch
  timeoutMs?: number
  /**
   * Extra headers, merged after Content-Type — the auth seam (R-9, fence rider
   * on #534). Mirrors `V5CallOptions.headers` on `callV5Turn`. No production
   * caller passes any today; when CEE's JWT half lands (LOGIN-CEE-HALF-SPEC),
   * the stop call carries the same `buildTurnAuthHeaders(...)` output as the
   * turn it stops.
   */
  headers?: Record<string, string>
}

/**
 * POST the stop and classify the answer. NEVER throws — every failure path is
 * an `unconfirmed` outcome, because a thrown error here would have to be
 * swallowed by the caller anyway and the caller would then have nothing true to
 * say.
 */
export async function stopV5Turn(
  identity: { scenarioId: string; turnId: string },
  opts: StopTurnOptions = {},
): Promise<TurnStopResult> {
  const fetchFn = opts.fetchImpl ?? fetch
  const budget = opts.timeoutMs ?? STOP_ACK_BUDGET_MS
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), budget)
  const url = getV5StopEndpoint()
  const headers = { 'Content-Type': 'application/json', ...(opts.headers ?? {}) }
  const wireBody = { scenario_id: identity.scenarioId, turn_id: identity.turnId }
  // ── R-9: trace capture, mirroring `callV5Turn` ─────────────────────────────
  // Until this existed the stop POST was the ONLY outbound call invisible to
  // the debug bundle. Auth headers are redacted downstream: the trace store
  // runs headers through redactPayload (default sensitiveKeys include
  // 'authorization') plus free-form Bearer/JWT scrubbing — the same guarantee
  // the PR #268 review verified for the buffered turn. Capture sits before the
  // try, exactly where the sibling puts it.
  const requestId = crypto.randomUUID()
  const requestedAt = Date.now()
  recordRequestPayload({
    id: requestId,
    endpoint: url,
    method: 'POST',
    headers,
    body: wireBody,
  })
  try {
    const res = await fetchFn(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(wireBody),
      signal: controller.signal,
    })
    if (!res.ok) {
      recordResponsePayload({
        id: requestId,
        status: res.status,
        headers: Object.fromEntries(res.headers.entries()),
        body: null,
        duration: Date.now() - requestedAt,
        error: `http_${res.status}`,
      })
      return { kind: 'unconfirmed', reason: `http_${res.status}` }
    }
    const body: unknown = await res.json().catch(() => null)
    // One capture for every 2xx path — the trace records the WIRE (status,
    // headers, raw body), never the classification verdict below.
    recordResponsePayload({
      id: requestId,
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body,
      duration: Date.now() - requestedAt,
    })
    if (body === null || typeof body !== 'object') {
      return { kind: 'unconfirmed', reason: 'unparseable_body' }
    }
    const parsed = body as { stopped?: unknown; already_committed?: unknown }
    // `stopped !== true` means the server answered 2xx without confirming the
    // tombstone. Treat that as not-known rather than as success: a 200 we cannot
    // read is the same epistemic position as no answer at all.
    if (parsed.stopped !== true) {
      return { kind: 'unconfirmed', reason: 'not_acknowledged' }
    }
    // ⚠ THREE-WAY, NOT A BOOLEAN COERCION — AMENDMENT A1 (adversarial review of
    //   PR #534). This was `already_committed === true ? already_saved :
    //   not_saved`, and that fell UNSAFE: an ABSENT field, `"true"`, `1` or
    //   `"yes"` all landed on `not_saved`, which tells the user *"it was
    //   cancelled before it was saved"* — a positive claim about their data, made
    //   on a server signal that may mean the exact opposite. That is the lie this
    //   module's own header forbids, and it contradicted its own premise: the body
    //   is parsed as `unknown` precisely because it is untrusted, so reading an
    //   UNRECOGNISED value as `false` was treating untrusted input as a fact.
    //
    //   `stopped` was already strict-with-a-fallback (anything unexpected →
    //   `unconfirmed`); this makes `already_committed` behave the same way, which
    //   is also what makes the three-state design actually three-state:
    //     literal true  → already_saved
    //     literal false → not_saved
    //     anything else → unconfirmed   ("we cannot tell", which is TRUE)
    if (parsed.already_committed === true) return { kind: 'already_saved' }
    if (parsed.already_committed === false) return { kind: 'not_saved' }
    return { kind: 'unconfirmed', reason: 'already_committed_unrecognised' }
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    recordResponsePayload({
      id: requestId,
      status: 0,
      headers: {},
      body: null,
      duration: Date.now() - requestedAt,
      error: err instanceof Error ? err.message : String(err),
      errorName: name ?? 'Error',
      // AbortError here is OUR ack-budget timer, not the user's Stop — the
      // sibling's classification for its own aborts. Other throws keep their
      // errorName + message, which is enough to tell preflight/DNS apart in
      // the bundle without copying v5Adapter's message-sniffing classifier
      // (a second copy of that would be the trap-12 mirror).
      source: name === 'AbortError' ? 'browser_timeout' : 'unknown',
    })
    return { kind: 'unconfirmed', reason: name === 'AbortError' ? 'timeout' : 'transport' }
  } finally {
    clearTimeout(timer)
  }
}
