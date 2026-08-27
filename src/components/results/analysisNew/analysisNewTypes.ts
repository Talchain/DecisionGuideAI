/**
 * Analysis (New) — view-model types for the duplicate Analysis tab experiment.
 *
 * ⭐ THE ONE RULE THIS FILE EXISTS TO ENFORCE: this view model may SELECT,
 * RANK, GROUP and FORMAT what `useResultsSectionData()` already produced. It
 * may NOT create analytical truth. Every field below is traceable to a producer
 * field or to an existing UI authority, and the trace is written next to it.
 *
 * The experiment (Paul, 27 Aug 2026) is an INFORMATION-ARCHITECTURE comparison:
 * the existing Analysis tab is untouched, and this second surface renders THE
 * SAME analysis run through a reasoning-led IA:
 *
 *   Key insights · Strengthen the reasoning · Drivers and dynamics ·
 *   Uncertainty and gaps  (+ deeper material behind progressive disclosure)
 *
 * ⚠ WHY THE SECTIONS CARRY `groundedIn` STRINGS. Every row a user sees must be
 * able to say which producer signal put it there. That is not decoration — it
 * is the difference between this surface and a generated summary, and it is the
 * property that makes a wrong row diagnosable rather than merely wrong.
 */

import type { Recommendation } from '../strengthen/strengthenTypes'

/**
 * How confident the SURFACE is entitled to sound — never an "AI confidence".
 *
 * ⚠ THERE IS NO `'confident'` MEMBER AND THAT IS DELIBERATE. The absence of a
 * provisional marker is the confident case. Adding a positive token would
 * invite a surface to assert soundness it was never told about, which is the
 * fabrication class this experiment is forbidden from introducing.
 */
export type ProvisionalMarker =
  /** The producer disclosed the value is provisional/auto-derived. */
  | 'provisional'
  /** The displayed run predates the current model (freshness, not quality). */
  | 'stale'
  /** The producer declined to compute or to disclose. Absence, not zero. */
  | 'not_assessed'

/** A level-3 "inspect" payload: label/value pairs, rendered verbatim. */
export interface InspectRow {
  label: string
  /** Already formatted for display by the adapter. Components never compute. */
  value: string
}

/**
 * A contextual reasoning intervention attached to ONE finding.
 *
 * ⚠ Only ever populated from a Recommendation the strengthen ENGINE emitted for
 * the same entity. It is never authored here: a client-authored "why not try…"
 * beside a producer finding is exactly the fabricated-coaching defect the brief
 * forbids. `recommendationId` is the join, and it is what a test binds to.
 */
export interface ContextualIntervention {
  recommendationId: string
  label: string
  /** Present only when the engine supplied one. */
  targetId: string | null
}

/** Shared shape for a progressively-disclosed row across all four sections. */
export interface AnalysisNewFinding {
  /** Stable identity. Tests bind to this, never to a value predicate. */
  id: string
  /** Level 1 — scan. Short, specific, no hedging adverbs. */
  headline: string
  /** Level 1 — one concise implication sentence. */
  implication: string
  /** Level 2 — expanded rationale/relationship/evidence, when there is one. */
  detail?: string
  /** Which producer signal put this row here. Rendered at level 2. */
  groundedIn: string
  marker?: ProvisionalMarker
  /** Canvas focus target, when the producer named one. */
  targetId?: string
  /** Level 3 — inspect. Empty array renders no inspect affordance. */
  inspect: InspectRow[]
  intervention?: ContextualIntervention
}

/**
 * Key insights — 2 to 4 of them. NOT decision-centric by construction: a
 * comparative insight is one KIND among several and appears only when the
 * single decision verdict entitles it.
 */
export interface KeyInsightsSection {
  insights: AnalysisNewFinding[]
  /**
   * How many grounded candidates existed before the cap. Rendered as a plain
   * count so the cap is disclosed rather than silent (no silent truncation).
   */
  candidateCount: number
}

/**
 * The producer's DSK attestation for one intervention.
 *
 * ⚠ PRESENCE IS THE ATTESTATION. An intervention without a `claimId` is "not
 * grounded", never "unknown" and never a default — which is why this whole
 * object is absent rather than partially filled. `strength` is a closed
 * vocabulary carried verbatim; `claimId`/`protocolId` are IDS and ride as
 * `data-*` attributes only, never as user-facing copy.
 *
 * ⚠ AND WHAT THIS IS NOT: it is NOT a licence to label an intervention with a
 * technique name the producer did not send. §15 is explicit — a recommendation
 * is not "scientifically grounded" because it sounds like a recognised method.
 * This carries the producer's own attestation or nothing.
 */
export interface ScienceGrounding {
  claimId: string
  protocolId?: string
  strength?: string
}

/** Strengthen the reasoning — the prioritised interventions, 1 to 3. */
export interface StrengthenSection {
  /**
   * Engine output, already filtered against the strengthen lifecycle store and
   * capped. The engine is `buildRecommendations` — this surface runs it and
   * renders it; it never adds a recommendation of its own.
   */
  interventions: Recommendation[]
  /** Total active engine output before the cap. Disclosed, never silent. */
  candidateCount: number
  /**
   * Producer DSK attestation, keyed by recommendation id. Sparse BY DESIGN: an
   * absent key means the producer attested nothing for that intervention.
   *
   * ⚠ WHY THIS EXISTS AT ALL. The carrier is wire-witnessed on guidance items
   * (`dsk_claim_id` / `dsk_protocol_id` / `evidence_strength`), but
   * `toStrengthenPhase3Item` maps nine fields and none of these — so a
   * genuinely grounded recommendation reached the Strengthen panel with its
   * grounding stripped. The join is re-made HERE, in the presentation adapter,
   * rather than by editing the shared mapper, because that mapper is on the
   * existing Analysis tab's path and this experiment may not touch it.
   */
  scienceGrounding: Record<string, ScienceGrounding>
}

export interface DriversSection {
  findings: AnalysisNewFinding[]
  /**
   * TRUE when the influence figures on display are SET-RELATIVE
   * (`displayProvenance === 'normalised_elasticity'`), i.e. "largest in this
   * set", NOT a causal share of the outcome. Drives the caveat line.
   *
   * ⚠ This is the "do not conflate structurally different scientific
   * quantities" rule made mechanical: the caveat is a function of the
   * producer's own provenance token, not of the adapter's taste.
   */
  influenceIsSetRelative: boolean
  /** The option sensitivities were computed against, when disclosed. */
  referenceOptionLabel: string | null
  totalCount: number
}

export interface UncertaintySection {
  findings: AnalysisNewFinding[]
  /**
   * Did the producer ASSESS evidence on this run at all?
   *
   * ⚠ THE WHOLE POINT OF CARRYING THIS. An empty gap list answers two different
   * questions — "assessed, none found" and "never assessed" — and a surface
   * that turns the empty list into "No evidence gaps" makes a claim only the
   * first licenses. Sourced from `confidence.evidenceGapsAssessed`.
   */
  evidenceAssessed: boolean
  /**
   * Whole-decision value of information, as a VERDICT only. `'not_computed'`
   * renders nothing; `'measured_zero'` is a real result and says so.
   */
  decisionVoi: 'not_computed' | 'measured_zero' | 'measured_non_zero'
  totalCount: number
}

/** Level-3 material. One collapsed region, never a fifth top-level section. */
export interface DeeperAnalysisSection {
  groups: Array<{ title: string; rows: InspectRow[] }>
}

/**
 * The truthful run status carried into this tab. Contextualises the content;
 * it must never dominate the surface (§20).
 *
 * ⚠ `coverage` IS NOT `readiness`. `RunAdmission` remains the sole authority on
 * whether analysis may run, and nothing here is derived from it or claims to
 * speak for it. Uneven coverage is provenance, not a verdict on validity.
 */
export interface AnalysisNewStatus {
  /** No completed analysis is being displayed. */
  isPreRun: boolean
  isRunning: boolean
  /** The displayed report predates the current model. */
  isStale: boolean
  /** The producer disclosed the result as partial/incomplete. */
  isProvisional: boolean
  /** Producer-owned reason, verbatim, when there is one. Never authored here. */
  statusNote: string | null
}

export interface AnalysisNewViewModel {
  status: AnalysisNewStatus
  keyInsights: KeyInsightsSection
  strengthen: StrengthenSection
  drivers: DriversSection
  uncertainty: UncertaintySection
  deeper: DeeperAnalysisSection
}
