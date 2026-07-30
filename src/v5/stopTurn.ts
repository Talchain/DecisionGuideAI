/**
 * stopTurn — telling the SERVER that the user pressed Stop.
 *
 * Until this existed, Stop aborted our own `AbortController` and nothing else.
 * CEE deliberately does not cancel a turn when the client hangs up
 * (`streamed-turn-sse.ts:71-78`), so the turn ran to completion and COMMITTED.
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
 *   'unconfirmed'   — we could not reach the server, it answered non-2xx, or we
 *                     ran out of patience. We do not know, and the copy says so.
 *
 * A single boolean would have collapsed 'already_saved' and 'unconfirmed' into
 * the same silence, which is exactly the state this whole lane is about.
 */
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
  try {
    const res = await fetchFn(getV5StopEndpoint(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ scenario_id: identity.scenarioId, turn_id: identity.turnId }),
      signal: controller.signal,
    })
    if (!res.ok) {
      return { kind: 'unconfirmed', reason: `http_${res.status}` }
    }
    const body: unknown = await res.json().catch(() => null)
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
    return parsed.already_committed === true
      ? { kind: 'already_saved' }
      : { kind: 'not_saved' }
  } catch (err) {
    const name = (err as { name?: string } | null)?.name
    return { kind: 'unconfirmed', reason: name === 'AbortError' ? 'timeout' : 'transport' }
  } finally {
    clearTimeout(timer)
  }
}
