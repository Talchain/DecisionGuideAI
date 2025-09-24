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

const counters: Record<TelemetryEvent, number> = {
  'edge.stream.start': 0,
  'edge.stream.token': 0,
  'edge.stream.done': 0,
  'edge.stream.cancelled': 0,
  'edge.stream.limited': 0,
  'edge.stream.error': 0,
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
