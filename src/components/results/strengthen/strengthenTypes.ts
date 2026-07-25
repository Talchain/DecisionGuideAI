/**
 * Strengthen your model — Wave 3a types (brief §8; DEV-PLAN v2 §3 Wave 3a).
 *
 * The engine input is a NARROW slice of what the results hook and stores
 * expose — only the fields the triggers actually read, so the engine stays
 * pure, unit-testable from fixtures, and decoupled from the giant
 * ResultsSectionDataReturn shape.
 */

import type { GuidanceCategory } from '../../../canvas/stores/guidanceStore'
import type { FactorConfidenceDisplay } from '../driverConfidenceDisplayPolicy'

/** §8.2 adaptive help types — internal only, never shown as stages. */
export type HelpType = 'clarify' | 'broaden' | 'challenge' | 'evaluate' | 'commit'

/** §8.5 lifecycle statuses — stable identities, never wholesale reset. */
export type RecStatus = 'recommended' | 'in_progress' | 'addressed' | 'dismissed' | 'reopened'

/** §8.8 primary action routes. */
export type RecActionKind = 'inline-edit' | 'ai-dialogue' | 'canvas-focus' | 'rerun' | 'open-modal'

export interface RecAction {
  kind: RecActionKind
  /** Visible CTA label (sentence case, en-GB). */
  label: string
  /** Explicit guidance action_type for ai-dialogue routes (never the keyword
   * heuristic — chip_metadata survives only on conversation-typed turns). */
  actionType?: string
  parameters?: Record<string, unknown>
  /** open-modal routes: which parity modal the primary action opens. */
  modal?: 'define-success' | 'decision-record'
  /** The prompt sent for ai-dialogue routes (also the _sendMessage degrade).
   * Named 'prompt', not 'message': the V14.3 guard forbids `.message`
   * property access in results components (critique-render protection). */
  prompt?: string
}

/** One recommendation as the engine emits it (display snapshot). */
export interface Recommendation {
  /** Stable, namespaced, entity-scoped id, e.g. 'strengthen:flip:edge_9'. */
  id: string
  helpType: HelpType
  title: string
  /** §8.4 short signal — why it appeared. */
  signal: string
  /** §8.4 why it matters now. */
  whyNow: string
  /** §8.4 one practical instruction. */
  tryThis: string
  /** §8.4 named grounding source — honest about producer vs UI basis. */
  sourceLine: string
  action: RecAction
  /** Canvas focus target (node/edge id) — 'Focus on canvas' renders only when set. */
  targetId: string | null
  /** Engine priority (ascending = more important). Reprioritises, never resets. */
  priority: number
  /**
   * The producer's four-value `category` VERBATIM (Stage 2) — set only on
   * phase-3 guidance recs, the only recs the producer categorises. Drives the
   * honest severity badge; absent = no badge (never synthesised for the UI's
   * own deterministic triggers, which the producer never categorised).
   */
  category?: GuidanceCategory
}

// ── Engine inputs (narrow, fixture-friendly) ─────────────────────────────────

export interface StrengthenFragileEdge {
  edgeId: string
  factorLabel: string
  switchProbability: number
  alternativeWinnerLabel?: string
}

export interface StrengthenFactor {
  factorId: string
  label: string
  /**
   * The driver DISPLAY-POLICY value (driverDisplayModel via the stamped
   * DriverItem.displayInfluence) — NOT raw producer influence_score. Named
   * `influence` so a raw-metric read cannot hide behind the field name
   * (Lane 2, Codex R3-B1 class).
   */
  influence?: number
  /**
   * Factor confidence RESOLVED THROUGH THE DISPLAY POLICY, never the raw
   * producer number.
   *
   * This used to be `confidence?: number | null` and the engine gated the LEHI
   * recommendation ("High influence, low evidence.") on `confidence < 0.4`.
   * The producer's value here IS the placeholder — `0.25` with
   * `confidence_components.sampling_stability: 0` in both real staging
   * captures — so the ceiling always passed and the panel asserted "low
   * evidence" about a number nobody measured. The old comment
   * "producer confidence ONLY" was true and beside the point.
   *
   * Carrying `FactorConfidenceDisplay` instead of a number means the engine
   * CANNOT read a value without also reading whether it is fit to speak;
   * `show: false` has no `.value` to compare against, so re-opening the fork
   * is a type error rather than a `<` that silently always fires.
   */
  confidenceDisplay: FactorConfidenceDisplay
  /** True when the producer explicitly flagged this factor worth investigating. */
  worthInvestigating?: boolean
  /** EVPI in percentage points when provided. */
  canFocus: boolean
}

export interface StrengthenPhase3Item {
  id: string
  title: string
  body?: string
  actionIntent?: string
  actionLabel?: string
  /**
   * The producer's four-value `category` VERBATIM (Stage 2). Primary display
   * order in the engine (severity-major); drives the row's severity badge.
   * Absent = uncategorised (honest absence; never synthesised).
   */
  category?: GuidanceCategory
  /**
   * The producer's `signal` display line VERBATIM (Stage 2) — user-facing
   * producer copy carried today only on the deterministic stale-rerun nudge.
   * When present it is the row's subtitle, preferred over the body; absent
   * everywhere else.
   */
  signal?: string
  targetIds: string[]
  /**
   * The producer's 0.19.0 `priority_rank` VERBATIM (ascending display
   * ordinal, lower = shown first; positive integers, UNBOUNDED — bands: 1-9
   * lifecycle, 10-99 review cards, 100-199 coaching, 200+ prompts; never
   * inverted, never clamped). PRESENCE is the "producer ranked this" fact
   * (UI-SEM-085): when absent the item is demoted below the producer-backed
   * ladder and labelled "not ranked — shown in the order received" rather
   * than presented as a ranked fix. No companion flag — deriving ranked-ness
   * from anything other than the rank itself is a hand-maintained mirror.
   */
  priorityRank?: number
}

export interface StrengthenInputs {
  /** Effective user success target (null = no measurable success definition). */
  goalThreshold: number | null
  /** Whether a completed analysis exists (most triggers need one). */
  analysisComplete: boolean
  fragileEdges: StrengthenFragileEdge[]
  factors: StrengthenFactor[]
  robustness: { status: string | null; level: string | null }
  /** Producer-owned bias finding types (e.g. 'narrow_framing') — §8.7's
   * broaden trigger fires ONLY from these, never from local option counting. */
  biasFindingTypes: string[]
  phase3Items: StrengthenPhase3Item[]
  /** Producer-derived adaptive priority (the prototype's clarify/broaden/
   * challenge/evaluate/commit stage signal). When present, recommendations
   * whose helpType matches float to the top of the engine ordering; when
   * null/absent the deterministic PRIORITY ladder stands alone. The container
   * derives this ONLY from a producer-owned stage signal (UI-SEM-076) —
   * never from local canvas-state heuristics. */
  adaptivePriority?: HelpType | null
}
