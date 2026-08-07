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
 * counter behind `isTelemetryEnabled`, wired to the real compare-open actions at
 * `OutputsDock.tsx:1698` and `CompactOptionSpread.tsx:86`) and a PostHog one in
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
