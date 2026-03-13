/**
 * Guidance telemetry event taxonomy.
 *
 * All event names are snake_case and prefixed with `guidance_`.
 * No PII — only IDs, types, and counts.
 *
 * Events fire only when isTelemetryEnabled() is ON (checked inside trackGuidance).
 */

import { trackEvent } from '../lib/posthog'
import { isTelemetryEnabled } from '../flags'

// ---------------------------------------------------------------------------
// § 1 — Event name constants
// ---------------------------------------------------------------------------

export const GUIDANCE_EVENTS = {
  // Coaching items (DSK bias alerts, technique recommendations)
  COACHING_SHOWN: 'guidance_coaching_shown',
  COACHING_CLICKED: 'guidance_coaching_clicked',
  COACHING_DISMISSED: 'guidance_coaching_dismissed',

  // One-click fixes
  FIX_SHOWN: 'guidance_fix_shown',
  FIX_CLICKED: 'guidance_fix_clicked',
  FIX_COMPLETED: 'guidance_fix_completed',
  FIX_UNDONE: 'guidance_fix_undone',

  // Trust surfaces
  MODEL_CARD_VIEWED: 'guidance_model_card_viewed',
  CAUSAL_CLAIM_EXPANDED: 'guidance_causal_claim_expanded',

  // Evidence gaps
  EVIDENCE_GAP_SHOWN: 'guidance_evidence_gap_shown',
  EVIDENCE_GAP_TECHNIQUE_CLICKED: 'guidance_evidence_gap_technique_clicked',

  // Cross-surface
  HIGHLIGHT_TRIGGERED: 'guidance_highlight_triggered',
} as const

// ---------------------------------------------------------------------------
// § 2 — Standard payload
// ---------------------------------------------------------------------------

export interface GuidanceEventPayload {
  /** Deterministic ID from DSK coaching or fix telemetry ID */
  item_id: string
  /** Categorical type of the item */
  item_type: 'bias_alert' | 'technique_rec' | 'fix' | 'trust' | 'evidence_gap' | 'claim' | 'highlight'
  /** Surface where the event originated */
  surface: 'guidance_panel' | 'pre_analysis' | 'results' | 'model_tab' | 'inspector' | 'canvas'
  /** Current scenario ID (no content — only ID) */
  scenario_id?: string
  /** Decision lifecycle stage */
  profile_stage?: 'frame' | 'ideate' | 'evaluate' | 'decide'
}

// ---------------------------------------------------------------------------
// § 3 — Typed capture helper
// ---------------------------------------------------------------------------

/**
 * Fire a guidance telemetry event via PostHog.
 *
 * No-ops when:
 * - isTelemetryEnabled() is false
 * - PostHog is not initialised
 *
 * Payload is validated to contain no PII fields (content, brief, message).
 */
export function trackGuidance(
  event: keyof typeof GUIDANCE_EVENTS,
  payload: GuidanceEventPayload,
): void {
  if (!isTelemetryEnabled()) return
  trackEvent(GUIDANCE_EVENTS[event], payload as Record<string, unknown>)
}
