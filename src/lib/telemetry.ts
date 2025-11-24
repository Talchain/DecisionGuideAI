// src/lib/telemetry.ts
// Minimal, opt-in telemetry seam. No PII, counters only.
import { isTelemetryEnabled } from '../flags'

export type TelemetryEvent =
  | 'edge.stream.start'
  | 'edge.stream.token'
  | 'edge.stream.done'
  | 'edge.stream.cancelled'
  | 'edge.stream.limited'
  | 'edge.stream.error'
  // Draft My Model funnel (R1/R2)
  | 'draft.request'
  | 'draft.success'
  | 'draft.error'
  | 'draft.stream.start'
  | 'draft.stream.done'
  | 'draft.apply'
  | 'draft.reject'
  | 'draft.clarifier.submit'
  | 'draft.clarifier.skip'
  // Scenario Sandbox funnel (R2)
  | 'sandbox.canvas.opened'
  | 'sandbox.run.clicked'
  | 'sandbox.run.blocked'
  | 'sandbox.results.viewed'
  | 'sandbox.compare.opened'
  | 'sandbox.issues.opened'
  | 'sandbox.history.item.selected'

const counters: Record<TelemetryEvent, number> = {
  'edge.stream.start': 0,
  'edge.stream.token': 0,
  'edge.stream.done': 0,
  'edge.stream.cancelled': 0,
  'edge.stream.limited': 0,
  'edge.stream.error': 0,
  'draft.request': 0,
  'draft.success': 0,
  'draft.error': 0,
  'draft.stream.start': 0,
  'draft.stream.done': 0,
  'draft.apply': 0,
  'draft.reject': 0,
  'draft.clarifier.submit': 0,
  'draft.clarifier.skip': 0,
  'sandbox.canvas.opened': 0,
  'sandbox.run.clicked': 0,
  'sandbox.run.blocked': 0,
  'sandbox.results.viewed': 0,
  'sandbox.compare.opened': 0,
  'sandbox.issues.opened': 0,
  'sandbox.history.item.selected': 0,
}

export function track(event: TelemetryEvent): void {
  if (!isTelemetryEnabled()) return
  counters[event] = (counters[event] || 0) as number + 1
  try {
    const dev = (import.meta as any)?.env?.DEV
    if (dev && typeof console !== 'undefined' && typeof console.debug === 'function') {
      // Coded line only; no payloads or IDs
      console.debug('[TLM]', event)
    }
  } catch {
    // ignore
  }
}

// Test helpers (lightweight)
export function __getTelemetryCounters() {
  return { ...counters }
}

export function __resetTelemetryCounters() {
  (Object.keys(counters) as TelemetryEvent[]).forEach((k) => (counters[k] = 0))
}
