/**
 * Validation metadata types for multi-pass CEE edge validation.
 *
 * When two independent AI passes disagree on an edge's parameters the edge is
 * flagged as "contested". This module defines the exact shapes produced by CEE
 * and consumed by the Model-tab UI.
 *
 * Source-of-truth: validation_ui_data_contract_v1.md
 */

// ── Enumerations ──────────────────────────────────────────────────────────────

/**
 * Why two passes disagree on an edge.
 * Multiple reasons may apply simultaneously.
 */
export type ContestedReason =
  | 'sign_flip'                  // causal direction reversed
  | 'strength_band_change'       // e.g. moderate vs weak
  | 'confidence_band_change'     // e.g. high vs moderate uncertainty
  | 'existence_boundary_crossing'// crossed 0.5, 0.7, or 0.9
  | 'raw_magnitude'              // |delta mean| > 0.20

/**
 * What evidence the independent review estimate is based on.
 */
export type EstimateBasis =
  | 'brief_explicit'             // brief directly states this
  | 'structural_inference'       // derived from graph topology
  | 'domain_prior'               // general domain knowledge
  | 'weak_guess'                 // thin brief, low signal

/**
 * How the user resolved (or chose not to resolve) a contested edge.
 */
export type UserAction =
  | 'pending'                    // not yet resolved
  | 'accepted_pass1'             // kept the original value
  | 'accepted_pass2'             // switched to the reviewer's value
  | 'overridden'                 // user entered their own value
  | 'dismissed'                  // user chose not to engage

// ── Core interfaces ───────────────────────────────────────────────────────────

/** Custom strength/existence value entered by the user. */
export interface ResolvedValue {
  strength_mean?: number
  strength_std?: number
  exists_probability?: number
}

/** Full validation metadata for a single causal edge. */
export interface ValidationMetadata {
  // Core classification
  status: 'agreed' | 'contested'
  /** Empty when status === 'agreed' */
  contested_reasons: ContestedReason[]

  // Pass 1 — what the graph currently uses
  pass1: {
    strength_mean: number
    strength_std: number
    exists_probability: number
  }

  // Pass 2 — independent review
  pass2: {
    strength_mean: number
    strength_std: number
    exists_probability: number
    /** One sentence, plain language */
    reasoning: string
    basis: EstimateBasis
    needs_user_input: boolean
  }

  // Ordering and priority
  /** 0–1, higher = more disagreement */
  max_divergence: number
  /** Topological hops from edge target to goal node */
  distance_to_goal: number

  // Post-analysis enrichment (null before first MC run)
  /** 1 = highest impact on decision; null pre-analysis */
  evoi_rank: number | null
  /** Percentage points of goal probability; null pre-analysis */
  evoi_impact: number | null

  // Visibility control (CEE applies one-per-target-node cap)
  /** Whether CEE selected this contested edge for user review */
  surfaced: boolean

  // User interaction tracking
  was_shown: boolean
  user_action: UserAction
  resolved_value: ResolvedValue | null
  resolved_by: 'default' | 'user'
}
