/**
 * systemEvents — Wire serialisation adapter for CEE v3 system event contract
 *
 * The internal SystemEvent shape { type, payload } is preserved for all
 * in-UI code. This module converts to the CEE Brief C v3 Zod wire format
 * { event_type, timestamp, event_id, details } at the HTTP boundary.
 *
 * Gated by ENABLE_V3_SYSTEM_EVENTS flag (default OFF). When OFF the
 * raw internal shape is sent, preserving backward-compat with older CEE.
 *
 * TODO: Once CEE Brief C v3 Zod schema is confirmed on staging, enable
 * the flag by default and migrate internal SystemEvent to match wire format.
 */

import type { SystemEvent } from './types'

/**
 * The subset of SystemEventType values accepted by CEE's v3 Zod schema.
 * session_resume and undo_draft are internal UI events only — not sent over the wire.
 */
export type CeeV3EventType =
  | 'patch_accepted'
  | 'patch_dismissed'
  | 'direct_graph_edit'
  | 'direct_analysis_run'
  | 'feedback_submitted'

/**
 * Wire format matching CEE Brief C v3 Zod schema.
 * Only sent when ENABLE_V3_SYSTEM_EVENTS flag is ON.
 */
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
 */
const CEE_V3_KNOWN_TYPES = new Set<CeeV3EventType>([
  'patch_accepted',
  'patch_dismissed',
  'direct_graph_edit',
  'direct_analysis_run',
  'feedback_submitted',
])

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
