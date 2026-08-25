// src/canvas/utils/sandboxTelemetry.ts
// Thin helpers around telemetry track() for Scenario Sandbox funnel events.
import { track } from '../../lib/telemetry'
import { trackEvent } from '../../lib/posthog'
import type { RunEligibilityResult } from './runEligibility'

export function trackCanvasOpened(): void {
  track('sandbox.canvas.opened')
}

export function trackRunAttempt(result: RunEligibilityResult): void {
  if (result.canRun) {
    track('sandbox.run.clicked')
  } else {
    track('sandbox.run.blocked')
  }
}

export function trackResultsViewed(): void {
  track('sandbox.results.viewed')
}

/**
 * Compare opened — the ONE sender for this action, deliberately.
 *
 * ⚠ There used to be TWO functions with this exact name: this one (an in-memory
 * counter behind `isTelemetryEnabled`, wired to the real compare-open action at
 * `OutputsDock.tsx:1698` — a second citation, `CompactOptionSpread.tsx:86`, was
 * dropped on 18 Aug 2026 when that unreachable component was deleted) and a
 * PostHog one in
 * `lib/resultsInstrumentation.ts` with **no call sites at all**. So the action
 * users actually perform incremented a counter nobody reads, while the sender
 * that would have reached PostHog was never called — and an import-site typo
 * between two same-named senders is invisible in review.
 *
 * The PostHog sender is gone; this function now drives BOTH sinks. The counter
 * keeps its existing flag gate (unchanged behaviour); the PostHog event is
 * UNGATED, per the no-env-var-gates doctrine that removed the same gate from
 * `telemetry/guidanceEvents.ts`.
 */
export function trackCompareOpened(): void {
  track('sandbox.compare.opened')
  trackEvent('compare_opened')
}

export function trackIssuesOpened(): void {
  track('sandbox.issues.opened')
}

export function trackHistoryItemSelected(): void {
  track('sandbox.history.item.selected')
}

export function trackAutoFixClicked(): void {
  track('sandbox.autofix.clicked')
}

export function trackAutoFixSuccess(): void {
  track('sandbox.autofix.success')
}

export function trackAutoFixFailed(): void {
  track('sandbox.autofix.failed')
}

/**
 * ⭐⭐ A LAYOUT FAILURE THAT THE PRODUCT SURVIVED IS STILL A FAILURE.
 *
 * The canvas now rescues a failed layout into a readable grid, which is the
 * point — but it also means the screen no longer screams. The witnessed defect
 * is INTERMITTENT (an independent journey drive on the same base produced a
 * perfectly healthy canvas: 16 nodes, 16 unique positions, 0 at the origin),
 * and the underlying error has never been captured. A rescue with no durable
 * signal would make an already-elusive failure harder to observe, not easier —
 * so survivability has to come with a trace an operator can count.
 *
 * ⚠ `track()` IS NOT THAT TRACE. It increments an in-memory counter and, in DEV
 * only, writes one coded line to `console.debug`; it reaches nothing outside the
 * tab and does not survive a reload. `trackEvent` is the durable half
 * (`posthog.capture`), so this deliberately uses only that one — and it needs no
 * change to `lib/telemetry.ts`'s closed `TelemetryEvent` union.
 *
 * Payload is a COUNT and a BOOLEAN. No labels, no values, no ids: the number of
 * nodes involved is enough to tell a one-node blip from a whole model, and
 * anything richer would put the user's own business content into analytics.
 */
export function trackLayoutFallbackApplied(nodeCount: number, rescued: boolean): void {
  trackEvent('canvas_layout_fallback_applied', { node_count: nodeCount, rescued })
}
