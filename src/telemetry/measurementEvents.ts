/**
 * measurementEvents — the ROADMAP 1.68 measurement taxonomy.
 *
 * Modelled on `./guidanceEvents.ts` (closed interfaces, literal unions) and
 * deliberately NOT on the deleted `src/observability/metrics.ts`, whose
 * `MetricProperties` carried an open index signature
 * (`[key: string]: string | number | boolean | undefined`). An open property
 * type is a PII hole BY CONSTRUCTION: any property name typechecks, so no
 * leak detector can enforce against it. The closed shape is the pattern.
 *
 * NAMING. Bare `snake_case`, matching the live product/journey events
 * (`scenario_created`, `scenario_opened`, `model_details_viewed`). The dotted
 * `ui.*` namespace is reserved for contract-health events
 * (`ui.envelope_shape_invalid` etc.) — measurement events do not go there. The
 * single exception is `ui.measurement_schema_violation` below, which IS a
 * contract-health event and is namespaced accordingly.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * NEVER-CAPTURE — BINDING. Every name here is a real field at the tip,
 * reachable from an instrumented surface, i.e. one careless spread away.
 *
 *   User- or model-authored text — NEVER:
 *     node/edge `label`, `description`, `title` · `factor_label`
 *     (`components/results/voi/voiRanking.ts` — the resolve-next surface
 *     RENDERS it, so it is the single likeliest leak on this seam) · scenario
 *     title · `assistant_text` · `reasoning` · `framing_question` ·
 *     `_answer_shape.headline`/`.bullets`/`.detail` · any chat message content.
 *
 *   Numbers the user typed — NEVER:
 *     `success_threshold` · `goal_threshold` / `goal_threshold_raw` ·
 *     distribution min/max/mode · per-factor values · constraint caps.
 *
 *   Identity — NEVER as an event property:
 *     email · display name · raw user id. (`posthog.identify` is a separate,
 *     deliberate channel; its posture is a human ruling, not settled here.)
 *
 *   Also: no full `graph_hash` (prefix only — a full hash is a cross-session
 *   linking token) · no URLs with query strings · no freeform search text ·
 *   never widen a `payload_keys`-style reflection from schema key NAMES to
 *   values.
 *
 * RULE OF CONSTRUCTION: every payload is a CLOSED interface with literal
 * unions where possible, no index signatures. Where a property must be a free
 * string it is an **ID or an enum member**, and its comment says which.
 * ─────────────────────────────────────────────────────────────────────────────
 *
 * ENFORCEMENT. `trackMeasurement` is not a pass-through. It validates the
 * payload against `MEASUREMENT_EVENT_SCHEMAS` — the module's own declaration —
 * and DROPS any property the schema does not declare, reporting the violation
 * as `ui.measurement_schema_violation` (key NAMES only, never values). So an
 * accidental spread cannot reach PostHog even if it typechecks through an
 * `as any`, and the accident is visible rather than silent.
 */

import { trackEvent } from '../lib/posthog'

// ---------------------------------------------------------------------------
// § 1 — Event names
// ---------------------------------------------------------------------------

export const MEASUREMENT_EVENTS = {
  EVIDENCE_VIEW_OPENED: 'evidence_view_opened',
  CONTESTED_EDGE_VIEWED: 'contested_edge_viewed',
  SESSION_STARTED: 'session_started',
  TURN_FEEDBACK: 'turn_feedback',
} as const

export type MeasurementEventName =
  (typeof MEASUREMENT_EVENTS)[keyof typeof MEASUREMENT_EVENTS]

/** Contract-health event: emitted when a payload carried an undeclared property. */
export const MEASUREMENT_SCHEMA_VIOLATION_EVENT = 'ui.measurement_schema_violation'

// ---------------------------------------------------------------------------
// § 2 — Closed payload interfaces
// ---------------------------------------------------------------------------

/** The four evidence views — identical to `V7EvidenceDisclosure.tsx`'s union. */
export type EvidenceView = 'drivers' | 'flipRisks' | 'tradeOffs' | 'resolveNext'

/**
 * `evidence_view_opened` — the highest-value single site in this taxonomy.
 *
 * It captures WHAT THE PRODUCT TOLD THE USER, at the moment it told them. The
 * resolve-next ranking in particular is only the truth at the instant it is
 * displayed: it is recomputed every run, so reading it back afterwards reads a
 * different answer to the question the user actually saw.
 */
export interface EvidenceViewOpenedPayload {
  /** Which view. Enum member. */
  view: EvidenceView
  /** ID only. Never the scenario title. `null` when no scenario is loaded. */
  scenario_id: string | null
  /** True when the honest gate rendered instead of content. */
  gated: boolean
  /** First 8 chars of the run id. ID PREFIX only — never the full id. */
  run_id_prefix?: string
  /**
   * resolveNext only. The rank-1 factor's ID.
   * ⚠ ID ONLY. NEVER `factor_label` — that is user/model-authored text and the
   * surface renders it one property away from here.
   */
  rank1_factor_id?: string
  /** resolveNext only. How many factors were ranked. A count, not a value. */
  ranked_count?: number
  /** resolveNext only. How many fell below this run's resolution. A count. */
  below_resolution_count?: number
  /** resolveNext only. Whether the producer flagged unassessed factors. */
  some_factors_unassessed?: boolean
}

/** Strength bands — identical to `canvas/components/model-tab/strengthBands.ts`. */
export type StrengthBandName = 'strong' | 'moderate' | 'weak' | 'negligible'

/**
 * `contested_edge_viewed` — ROADMAP 1.68's "time on contested edges", at the
 * surface where the phrase literally belongs.
 *
 * ⚠ CLAIM SCOPE, stated honestly: `dwell_ms` measures MOUNTED-IN-THE-DOM time,
 * not proven visibility. jsdom cannot prove visibility and neither can this
 * event. Read it as "the card was in the rendered tree for about this long".
 */
export interface ContestedEdgeViewedPayload {
  /** Display edge ID. ID only — never the edge label or its description. */
  edge_id: string
  /** BUCKETED per `measurementConfig.dwellBucketsMs`. Never a raw duration. */
  dwell_ms: number
  /** Enum member from the existing strengthBands vocabulary. */
  strength_band: StrengthBandName
  /** ID only. `null` when no scenario is loaded. */
  scenario_id: string | null
}

/**
 * `session_started` — the anchor every duration measure is relative to.
 * Paired with the re-routed `run_completed` it yields time-to-first-insight.
 */
export interface SessionStartedPayload {
  /** Pseudonymous tag from `measurementConfig`, or null when untagged. */
  participant_tag: string | null
  /** Build identifier (`VITE_BUILD_ID`) — already allowlisted, non-secret. */
  build_id: string
  /** Enum-ish deploy label (`VITE_AUTH_MODE`), e.g. 'guest'. Never a user id. */
  auth_mode: string
}

/**
 * `turn_feedback` — the closest existing proxy for turn-level endorsement or
 * rejection. The thumbs already route to CEE and reach PostHog never.
 *
 * ⚠ Carries NO turn content and no turn id: a turn id joins to the stored
 * transcript, and the transcript is the user's text.
 */
export interface TurnFeedbackPayload {
  /** Enum member. */
  rating: 'up' | 'down'
  /** ID only. `null` when no scenario is loaded. */
  scenario_id: string | null
}

// ---------------------------------------------------------------------------
// § 3 — The machine-readable schema (the source of truth for the contract spec)
// ---------------------------------------------------------------------------

/**
 * Declared property keys per event, split by whether they must always be
 * present. This is what `trackMeasurement` enforces and what
 * `__tests__/measurementEvents.contract.spec.ts` DERIVES its table from — the
 * spec hand-lists nothing (trap 12: derive, don't mirror).
 *
 * The § 4 compile-time assertions below tie each entry to its interface in BOTH
 * directions, so this cannot silently drift from the types: a property added to
 * an interface and not to its schema (or the reverse) is a TYPE ERROR, caught
 * by `pnpm run typecheck`, not a runtime surprise.
 */
export const MEASUREMENT_EVENT_SCHEMAS = {
  evidence_view_opened: {
    required: ['view', 'scenario_id', 'gated'],
    optional: [
      'run_id_prefix',
      'rank1_factor_id',
      'ranked_count',
      'below_resolution_count',
      'some_factors_unassessed',
    ],
  },
  contested_edge_viewed: {
    required: ['edge_id', 'dwell_ms', 'strength_band', 'scenario_id'],
    optional: [],
  },
  session_started: {
    required: ['participant_tag', 'build_id', 'auth_mode'],
    optional: [],
  },
  turn_feedback: {
    required: ['rating', 'scenario_id'],
    optional: [],
  },
} as const satisfies Record<
  MeasurementEventName,
  { required: readonly string[]; optional: readonly string[] }
>

/** Payload type for a given event name. */
export interface MeasurementPayloadMap {
  evidence_view_opened: EvidenceViewOpenedPayload
  contested_edge_viewed: ContestedEdgeViewedPayload
  session_started: SessionStartedPayload
  turn_feedback: TurnFeedbackPayload
}

// ---------------------------------------------------------------------------
// § 4 — Compile-time schema/interface tie-down
// ---------------------------------------------------------------------------
//
// Without these, `MEASUREMENT_EVENT_SCHEMAS` would be a hand-maintained mirror
// of the interfaces — trap 12, the dominant defect class here. These make the
// mirror FAIL LOUD at typecheck instead of drifting silently.

type SchemaKeys<K extends MeasurementEventName> =
  | (typeof MEASUREMENT_EVENT_SCHEMAS)[K]['required'][number]
  | (typeof MEASUREMENT_EVENT_SCHEMAS)[K]['optional'][number]

/** `never` iff the two key sets are identical in both directions. */
type KeyMismatch<K extends MeasurementEventName> =
  | Exclude<keyof MeasurementPayloadMap[K] & string, SchemaKeys<K>>
  | Exclude<SchemaKeys<K>, keyof MeasurementPayloadMap[K] & string>

/** Required schema keys must be the NON-optional interface keys, exactly. */
type RequiredMismatch<K extends MeasurementEventName> =
  | Exclude<
      { [P in keyof MeasurementPayloadMap[K]]-?: Record<string, never> extends Pick<MeasurementPayloadMap[K], P> ? never : P }[keyof MeasurementPayloadMap[K]] & string,
      (typeof MEASUREMENT_EVENT_SCHEMAS)[K]['required'][number]
    >
  | Exclude<
      (typeof MEASUREMENT_EVENT_SCHEMAS)[K]['required'][number],
      { [P in keyof MeasurementPayloadMap[K]]-?: Record<string, never> extends Pick<MeasurementPayloadMap[K], P> ? never : P }[keyof MeasurementPayloadMap[K]] & string
    >

// If either line below errors, an interface and its schema entry have diverged.
// The error names the offending property. Fix BOTH, never just one.
type _AssertKeysMatch = { [K in MeasurementEventName]: KeyMismatch<K> extends never ? true : KeyMismatch<K> }
type _AssertRequiredMatch = { [K in MeasurementEventName]: RequiredMismatch<K> extends never ? true : RequiredMismatch<K> }
const _keysMatch: _AssertKeysMatch = {
  evidence_view_opened: true,
  contested_edge_viewed: true,
  session_started: true,
  turn_feedback: true,
}
const _requiredMatch: _AssertRequiredMatch = {
  evidence_view_opened: true,
  contested_edge_viewed: true,
  session_started: true,
  turn_feedback: true,
}
void _keysMatch
void _requiredMatch

// ---------------------------------------------------------------------------
// § 5 — The emit seam
// ---------------------------------------------------------------------------

/**
 * Emit a measurement event.
 *
 * VALIDATES then emits. Any property not declared in
 * `MEASUREMENT_EVENT_SCHEMAS[event]` is DROPPED, and the undeclared key NAMES
 * (never their values — a leaked value must not leak again through the leak
 * report) are emitted as `ui.measurement_schema_violation`.
 *
 * Dropping rather than throwing is deliberate: telemetry must never break the
 * product. Reporting rather than silently dropping is equally deliberate: a
 * guard that hides its own findings is the assume-good mirror this codebase
 * keeps getting caught by.
 */
export function trackMeasurement<K extends MeasurementEventName>(
  event: K,
  payload: MeasurementPayloadMap[K],
): void {
  // ⚠ NEVER-THROW. This wrapper is not defensive decoration.
  //
  // The design promised the deleted `metrics.ts`'s never-throw discipline would
  // "reappear in the new schema module", and it did not — this function was
  // unguarded while its own doc comment claimed telemetry must never break the
  // product. Meanwhile `ContestedEdgeCard` emits from a `useEffect` CLEANUP: a
  // throw there propagates out of React's unmount path and takes down the
  // canvas subtree. A third-party SDK throwing inside `posthog.capture` would
  // have unmounted the user's decision canvas.
  //
  // Pinned by `measurementEvents.neverThrow.spec.tsx`, driven from the real
  // ContestedEdgeCard unmount, not from a synthetic call.
  try {
    emitMeasurement(event, payload)
  } catch {
    /* telemetry must never break the product */
  }
}

function emitMeasurement<K extends MeasurementEventName>(
  event: K,
  payload: MeasurementPayloadMap[K],
): void {
  const schema = MEASUREMENT_EVENT_SCHEMAS[event]
  const declared = new Set<string>([...schema.required, ...schema.optional])

  const safe: Record<string, unknown> = {}
  const undeclared: string[] = []
  for (const [key, value] of Object.entries(payload as unknown as Record<string, unknown>)) {
    if (declared.has(key)) safe[key] = value
    else undeclared.push(key)
  }

  if (undeclared.length > 0) {
    trackEvent(MEASUREMENT_SCHEMA_VIOLATION_EVENT, {
      event,
      // KEY NAMES ONLY. Sending the values here would defeat the whole point.
      undeclared_keys: undeclared.sort(),
    })
  }

  trackEvent(event, safe)
}
