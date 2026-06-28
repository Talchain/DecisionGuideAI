/**
 * Coaching panel — LOCAL typed mock of the coaching envelope.
 *
 * Phase 0 render layer. This is the ONLY place the shape is declared. We do NOT
 * import from `@talchain/schemas`: Lane A (the structured coaching wire) is not
 * open yet, so this mirrors the agreed envelope shape from the brief and stays
 * deliberately tolerant. When Lane A's contract lands (envelope spec v0.3 /
 * signal contract v0.3 — not yet in the repo), reconcile this file and the
 * fixtures against it.
 *
 * Invariant F.6 — render, do not compute. These types describe data the UI is
 * GIVEN. The renderer never ranks, prioritises, selects, transitions lifecycle,
 * or derives staleness; those belong to CEE.
 */

/**
 * UNCONFIRMED enum. `move` is a technical signal field. It is used for
 * traceability/tests/debug only (see UX amendment 3) — never rendered as
 * user-facing copy. Kept as an open string so unknown values are tolerated.
 */
export type CoachingMove = string

/**
 * UNCONFIRMED enum. `source` is a technical provenance field. Traceability-only;
 * never rendered as user-facing copy. Open string so unknowns are tolerated.
 */
export type CoachingSource = string

/**
 * Entity kind the coaching is about. Known kinds drive the entity shape/colour
 * cue; unknown/absent kinds degrade to a neutral marker (never a raw string).
 * `(string & {})` keeps literal autocomplete while tolerating any value.
 */
export type CoachingTargetKind = 'goal' | 'option' | 'factor' | (string & {})

export interface CoachingGrounding {
  /** Human-readable observation. The collapsed primary line (no invented title). */
  observation: string
  /** Technical refs — traceability/debug only, never user-facing copy. */
  field_refs?: string[]
}

export interface CoachingSuggestedAction {
  id?: string
  /** Human label. Display-only this phase (no execution). */
  label: string
}

export interface CoachingEvidenceItem {
  /** Human label. */
  label: string
  /** Technical ref — traceability/debug only. */
  ref?: string
}

export interface CoachingStaleness {
  /** Human label rendered verbatim when present (fixture-only this phase). */
  label?: string
  [key: string]: unknown
}

export interface CoachingSignal {
  signal_id: string
  move: CoachingMove
  source: CoachingSource
  grounding: CoachingGrounding
  target_kind?: CoachingTargetKind
  /** Technical refs — traceability/debug only. */
  target_refs?: string[]
  /** Human label for the target entity (user-facing). */
  target_label?: string

  // ── Roadmap fields: OPTIONAL, fixture-only future-state render. Never assumed
  //    live and never drive production behaviour (UX amendment 7). ──
  /** Render-only; NEVER used to sort/rank (F.6). Numeric priority is not shown as prose. */
  priority?: number | string
  /** Human prose, rendered verbatim when present. */
  priority_reason?: string
  /** Lifecycle label rendered verbatim as a badge; no transition logic (F.6). */
  lifecycle_state?: string
  suggested_actions?: CoachingSuggestedAction[]
  evidence?: CoachingEvidenceItem[]
  staleness?: CoachingStaleness
}

export interface Coaching {
  /** Envelope version metadata; not rendered. */
  version: string
  /** Orientation summary line (user-facing). Omitted from the UI when absent. */
  summary?: string
  signals: CoachingSignal[]
}
