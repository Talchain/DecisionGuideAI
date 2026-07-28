/**
 * systemEvents — Wire serialisation adapter for CEE v3 system event contract
 *
 * The internal SystemEvent shape { type, payload } is preserved for all
 * in-UI code. This module converts to the CEE v3 Zod wire format
 * { event_type, timestamp, event_id, details } at the HTTP boundary.
 *
 * V3 format is always used — CEE staging requires the discriminated union
 * on `event_type`. Events not in CEE_V3_KNOWN_TYPES are dropped before
 * reaching the network (see sendSystemEvent pre-filter in useConversation).
 */

import type { SystemEvent, WireSystemEventType } from './types'
import { WIRE_SYSTEM_EVENT_TYPES } from './types'

/**
 * Alias for WireSystemEventType — the subset accepted by CEE's v3 Zod schema.
 * Canonical definition lives in types.ts as WireSystemEventType.
 */
export type CeeV3EventType = WireSystemEventType

/** Wire format matching CEE v3 Zod schema (always used). */
export interface SystemEventWire {
  event_type: CeeV3EventType
  timestamp: string       // ISO-8601
  event_id: string        // UUID for tracing / idempotency
  details: Record<string, unknown>
}

/**
 * CEE v3 known event types. Events NOT in this set will be skipped
 * (not sent) to avoid 400 errors from CEE's strict Zod validation.
 *
 * session_resume and undo_draft are internal UI events only.
 *
 * DERIVED from `WIRE_SYSTEM_EVENT_TYPES` (CLAUDE.md trap 12). This used to be a
 * second hand-written list beside the `WireSystemEventType` union, and it was
 * the DANGEROUS half of the pair: a type present in the union but absent here
 * is dropped before the network by `serializeSystemEvent` below, with only a
 * DEV console warning — the send silently becomes a no-op and every test that
 * does not assert on the wire stays green. Deriving it makes that drift
 * impossible to express rather than merely discouraged.
 */
const CEE_V3_KNOWN_TYPES: ReadonlySet<CeeV3EventType> = new Set<CeeV3EventType>(
  WIRE_SYSTEM_EVENT_TYPES,
)

/**
 * UUID fallback for test environments where crypto.randomUUID may not exist.
 */
function generateEventId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  // Fallback for jsdom / older test environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.floor(Math.random() * 16)
    const v = c === 'x' ? r : (r & 0x3) | 0x8
    return v.toString(16)
  })
}

/**
 * Convert internal SystemEvent to CEE v3 wire format.
 *
 * Returns null if the event_type is not in the CEE v3 known set — caller
 * should skip sending in that case.
 *
 * Called once per turn in useConversation.sendTurn before attaching to request.
 */
export function serializeSystemEvent(event: SystemEvent): SystemEventWire | null {
  // Cast to string for the Set lookup — SystemEventType is wider than CeeV3EventType
  if (!CEE_V3_KNOWN_TYPES.has(event.type as CeeV3EventType)) {
    if (import.meta.env.DEV) {
      console.warn(
        `[systemEvents] Skipping unknown CEE v3 event type: "${event.type}". ` +
        'This event type is not in the CEE v3 Zod schema and would cause a 400.',
      )
    }
    return null
  }

  return {
    event_type: event.type as CeeV3EventType,
    timestamp: new Date().toISOString(),
    event_id: generateEventId(),
    details: event.payload ?? {},
  }
}
