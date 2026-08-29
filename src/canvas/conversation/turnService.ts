/**
 * turnService — RESIDUAL SURFACE ONLY.
 *
 * ── WHAT WAS HERE, AND WHY IT IS GONE (2026-08-29) ───────────────────────────
 * This module was the V4 orchestrator HTTP client. It built
 * `/bff/orchestrate/v1/turn` (and `…/stream`) and exported `callOrchestratorTurn`
 * + `streamOrchestratorTurn`. Both are DELETED.
 *
 * It could not function. `/bff/orchestrate/*` was closed at the Netlify edge on
 * 2026-08-28 (`netlify/edge-functions/orchestrator-proxy.ts`:
 * `ALLOWED_TARGETS: readonly RegExp[] = []`) after a wire-witnessed anonymous
 * scenario-ownership takeover. Probed 2026-08-29 against
 * `https://staging--olumi.netlify.app` with an allowed Origin:
 *
 *   /bff/orchestrate/v1/turn         → 404 {"error":"Not found"}   (edge sentinel)
 *   /bff/orchestrate/v1/turn/stream  → 404 {"error":"Not found"}   (edge sentinel)
 *   /totally-fabricated-off-prefix   → 404 text/html               (SPA — control)
 *   /bff/cee/graph-readiness         → 400 cee.error.v1            (reached CEE — control)
 *
 * The off-prefix control returning SPA HTML where the real prefix returns JSON,
 * and the live route reaching CEE, are what make that probe DISCRIMINATING: without
 * an allowed Origin every path 403s and the probe would prove nothing.
 * `tests/ci-guards/bffProxyPathAllowlist.spec.ts` pins the same property in CI.
 *
 * ── WHAT SURVIVES, AND WHY (named residuals, deliberately not deleted) ───────
 *  1. `OrchestratorError` — `useConversation.buildErrorMessage` still discriminates
 *     on it, and `__tests__/buildErrorMessage.spec.ts` covers those branches.
 *     Nothing throws it now that the V4 transport is gone, so its status branches
 *     are unreachable in practice; removing it would mean rewriting a shared,
 *     well-tested error formatter that the LIVE V5 path calls. Out of scope for a
 *     deletion lane — a named residual beats a broken V5 path.
 *  2. `parseSSELines` — a RE-EXPORT of `lib/sse/parseSSELines`, the app's single
 *     SSE line parser, still used by the V5 streamed-turn consumer.
 *     `__tests__/streamEventParsing.spec.ts` imports it from here.
 */

import { parseSSELines } from '../../lib/sse/parseSSELines'

export class OrchestratorError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body: unknown,
    /** x-request-id from CEE response for correlation */
    public readonly requestId?: string,
  ) {
    super(message)
    this.name = 'OrchestratorError'
  }
}

/**
 * Re-exported from the app's single SSE line parser (`lib/sse/parseSSELines`).
 *
 * ROADMAP 2.122: the staged V5 turn consumer (`v5/streamedDraftFrames`) needs
 * the same parser, and writing a second one would be trap 12 with a silent
 * failure mode (a drift on multi-line `data:` or CRLF would read as green in
 * both suites). The body moved; this name stays so
 * `__tests__/streamEventParsing.spec.ts` keeps covering it unchanged.
 */
export { parseSSELines }
