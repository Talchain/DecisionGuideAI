/**
 * Guidance telemetry event taxonomy.
 *
 * All event names are snake_case and prefixed with `guidance_`.
 * No PII — only IDs, types, and counts.
 *
 * Events fire whenever PostHog is initialised. There is NO feature-flag gate:
 * `VITE_FEATURE_TELEMETRY` used to be checked here and defaulted FALSE with no
 * deploy entry, so all 12 guidance_* events were dark independently of the
 * keys — a dark launch of the exact coaching-disposition signal ROADMAP 1.68
 * needs. Standing doctrine is no env-var gates and no dark launches: the
 * capability ships ON, and rollback is a code revert.
 */

import { trackEvent } from '../lib/posthog'

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
  /**
   * ROADMAP 1.68 — how long the item had been SHOWN when it was clicked or
   * dismissed, BUCKETED via `measurementConfig.bucketDwellMs`. This is 1.68's
   * "time on contested edges" in the second place it is measurable: a coaching
   * item dismissed in under a second is a different disposition from one
   * dismissed after fifteen.
   *
   * Never a raw duration (a high-resolution dwell is a behavioural
   * fingerprint), and only meaningful on COACHING_CLICKED / COACHING_DISMISSED.
   */
  dwell_ms?: number
}

// ---------------------------------------------------------------------------
// § 3 — Typed capture helper
// ---------------------------------------------------------------------------

/**
 * Fire a guidance telemetry event via PostHog.
 *
 * No-ops only when PostHog is not initialised (`trackEvent` returns early).
 *
 * ROADMAP 1.68 removed the `if (!isTelemetryEnabled()) return` gate that used
 * to sit on the first line. `flags.telemetry` reads `VITE_FEATURE_TELEMETRY`,
 * which has no `defaultValue` and therefore defaults FALSE
 * (`src/lib/flagFactory.ts`), and the variable is absent from netlify.toml. So
 * this gate was permanently closed on staging: every event below was dark for
 * reasons unrelated to whether analytics was configured. Do not add it back.
 *
 * `flags.ts`'s `telemetry` entry and the `isTelemetryEnabled` export are
 * deliberately LEFT IN PLACE — removing an export is a separate sweep with its
 * own consumer manifest, and doing it here would bundle an unrelated change.
 *
 * Payload is a CLOSED interface (no index signature) — see GuidanceEventPayload.
 */
export function trackGuidance(
  event: keyof typeof GUIDANCE_EVENTS,
  payload: GuidanceEventPayload,
): void {
  trackEvent(GUIDANCE_EVENTS[event], payload as Record<string, unknown>)
}
