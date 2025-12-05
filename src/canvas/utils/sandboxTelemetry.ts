// src/canvas/utils/sandboxTelemetry.ts
// Thin helpers around telemetry track() for Scenario Sandbox funnel events.
import { track } from '../../lib/telemetry'
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

export function trackCompareOpened(): void {
  track('sandbox.compare.opened')
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
