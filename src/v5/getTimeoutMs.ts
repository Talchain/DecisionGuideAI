/**
 * How long the client waits for a V5 turn.
 *
 * ROADMAP 2.665 (b) — THE INVARIANT THIS FILE NOW ENFORCES:
 * **the client must never stop waiting before the server's own deadline.**
 *
 * WHY IT IS AN INVARIANT AND NOT A PREFERENCE. CEE does not abandon a turn
 * because the browser stopped listening: it runs the turn to completion and
 * COMMITS it. And the client has no way to collect that turn afterwards —
 * `conversation_turns` / `v5_conversation_turns` have ZERO readers anywhere in
 * this client (see `utils/transcriptStore.ts`, whose whole reason for existing
 * is that the transcript is local-first), and CEE registers no status or
 * turns-list route — only POST `/proxy/v5/turn`, `/proxy/v5/turn/stream` and
 * `/proxy/v5/turn/stop`. So a client wait shorter than the server's deadline
 * does not "give up early"; it DESTROYS a reply that was produced, with no
 * recovery path on any surface.
 *
 * Live-witnessed cost (`PHASE0-EVIDENCE-2026-07-28/splitter-final-witness-2026-08-07.md`):
 * a composer-path turn completed server-side at 118.5s and 123.1s (200,
 * committed) while this module handed the client a 60s budget. Both replies
 * were discarded unseen, and the user was told the message had not gone
 * through.
 *
 * THE SERVER'S DEADLINE, derived at CEE `0ecf5c67` rather than remembered:
 *
 *   ROUTE_TIMEOUT_MS         135s  Fastify, outermost
 *   BROWSER_PROXY_TIMEOUT_MS 125s  `src/config/index.ts` → `.default(125_000)`
 *   DRAFT_REQUEST_BUDGET_MS  120s
 *   V5 turn budget                 clamped to BROWSER_PROXY_TIMEOUT_MS minus
 *                                  TURN_RESPONSE_HEADROOM_MS
 *                                  (`orchestrator-v5/budgets.ts`,
 *                                  clampTurnBudgetToProxyDeadline)
 *
 * CEE therefore guarantees it speaks before 125s, and the proxy guarantees a
 * structured body by then. A client budget above that always receives a real
 * outcome; a client budget below it is a coin toss the user loses silently.
 *
 * WHAT CHANGED. The old shape selected between a 60s default and a 130s
 * "extended" budget on a hand-listed set of turn types — `explicit_generate`,
 * `run_analysis`, `analyse_now`, stage `frame`. That list is a mirror of "which
 * turns CEE runs slowly", and it drifted the moment CEE grew a second
 * composition (the 2.474 batch splitter) on an ordinary `conversation` turn.
 * The list cannot be kept correct from this side of the wire, so it is gone:
 * the budget no longer depends on guessing what CEE will do with a turn.
 */

/**
 * CEE's `BROWSER_PROXY_TIMEOUT_MS` default — the outermost deadline any turn
 * response must beat. Read from CEE `src/config/index.ts` (`.default(125_000)`)
 * at staging tip `0ecf5c67`, and restated here only because the two services
 * cannot share a constant. It exists so the floor below is a DERIVED
 * relationship (`> this`) rather than an unexplained literal.
 */
export const SERVER_TURN_DEADLINE_MS = 125_000

/**
 * The client's wait for every V5 turn.
 *
 * MUST be greater than {@link SERVER_TURN_DEADLINE_MS} — `turnWaitCoversServerDeadline`
 * in the tests asserts exactly that, over every argument combination the call
 * sites can produce, so the relationship cannot be broken by editing one number.
 */
export const TURN_WAIT_MS = 130_000

/**
 * @deprecated Retained so existing importers keep compiling. Equal to
 * {@link TURN_WAIT_MS} — there is no longer a second, shorter budget.
 */
export const EXTENDED_TIMEOUT_MS = TURN_WAIT_MS

/**
 * Select the client's wait for a V5 turn.
 *
 * The parameters are retained (call sites pass them, and they still describe
 * the turn) but no longer select anything: every turn gets a budget that
 * outlasts the server's own deadline, because there is no turn for which
 * abandoning the server's committed answer is the better outcome.
 */
export function getTimeoutMs(
  _turnType?: string,
  _triggerSurface?: string,
  _derivedStage?: string,
): number {
  return TURN_WAIT_MS
}
