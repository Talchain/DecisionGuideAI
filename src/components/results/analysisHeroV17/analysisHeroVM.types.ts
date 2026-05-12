/**
 * AnalysisHeroV17 view-model types.
 *
 * Source of truth: docs/investigations/analysis-hero-v17.md §9–§11.
 *
 * This file is deliberately presentation-shaped (strings, percentages,
 * pre-resolved labels) — the goal is that the React tree consumes the
 * VM and renders it without any further derivation. State selection,
 * row ranking, category assignment, copy fallbacks, and CTA mapping all
 * happen in `buildAnalysisHeroViewModel`.
 */

export type HeroState = 'weak' | 'moderate' | 'reflect' | 'strong'

export type RowCategory =
  | 'evidence'   // sourced from topEvidenceGaps[] / evidenceGaps[]
  | 'risk'       // sourced from topFragileEdge / scenario_contexts / flip_thresholds
  | 'coverage'   // sourced from missing-baseline / low option count / missing risks
  | 'reflect'    // sourced from bias_findings / framing-check / pre_mortem
  | 'causal'     // sourced from topFragileEdge.edgeId resolved to an edge
  | 'ready'      // strong-state only

export type PriorityBand = 'High' | 'Medium' | 'Low' | 'Ready'

export type RowAction =
  | 'ai'         // "Work through with AI" — primary chat prefill
  | 'discuss'    // "Discuss with AI" — chat prefill, alternate prompt
  | 'edit'       // "Edit" — onFocusNode(factorId)
  | 'confirm'    // "Confirm" — onConfirmFactor(factorId)
  | 'add'        // "Add" — chat prefill (v1)
  | 'challenge'  // "Challenge" — chat prefill (v1)
  | 'brief'      // "Create brief" — chat prefill (v1)

export interface DimensionSegment {
  /** v17 spec label. */
  label: 'Structure' | 'Evidence' | 'Coverage' | 'Verified'
  /** 0..1 — segment fill ratio. */
  value: number
  /** Token for the strip fill colour. */
  token: 'success' | 'warning' | 'info' | 'option'
  /** Optional hover tooltip. */
  tooltip: string
}

export interface MetaPill {
  label: string
  tone: 'neutral' | 'warn' | 'danger' | 'reflect'
}

export interface HeroRow {
  /** Stable key for React reconciliation. */
  key: string
  /** Display title — already glossary-scanned and label-cleaned. */
  title: string
  /** Reason / detail copy — Ground → Propose. */
  reason: string
  /** Evidence-priority label. */
  priority: PriorityBand
  /** 0..100 — priority-bar fill percent. */
  priorityWidth: number
  /** Row tint category + colour-dot token. */
  category: RowCategory
  /** Ordered list of action icons to render right-aligned. */
  actions: RowAction[]
  /** Factor or edge ID for Edit/Confirm wiring. Optional. */
  targetNodeId: string | undefined
  /** Prefilled prompt the row's AI actions use when invoked. */
  chatPrompt: string
}

export interface KeyQuestion {
  /** Main question text — glossary-scanned post-interpolation. */
  text: string
  /** Optional sub-questions revealed by +3 disclosure. */
  extras: string[]
  /** Optional reply chips shown beneath the question. */
  chips: string[]
}

export interface AlsoLink {
  label: string
  chatPrompt: string
}

export interface FooterCheck {
  label: string
  tone: 'ok' | 'warn' | 'danger' | 'reflect'
}

/** State-dependent footer call-to-action. The handler is identified by `kind`;
 *  the component dispatches via the appropriate handler from props. */
export type FooterCtaKind =
  | 'review-weak-inputs'      // weak — prefill only
  | 'check-key-estimate'      // moderate — focus first, then prefill, no auto-send
  | 'challenge-result'        // reflect — auto-send
  | 'create-decision-brief'   // strong — prefill only

export interface FooterCta {
  label: string
  kind: FooterCtaKind
  /** Pre-built prompt text. */
  chatPrompt: string
  /** Factor to focus (moderate state only). */
  focusTargetId: string | undefined
}

export interface ContributionLine {
  /** When `verifiedCount > 0`, the line reads "N inputs verified".
   *  When falsy, the line is hidden. */
  text: string | null
}

export interface AnalysisHeroVM {
  state: HeroState
  /** Visible above the title — e.g. "3 of 7 checked". */
  checkedCount: string | null
  /** Optional grounded verified-count summary — null when not shown. */
  contribution: ContributionLine
  /** 4-segment readiness colour strip (Structure / Evidence / Coverage / Verified). */
  dimensions: DimensionSegment[]
  /** Top hero result card. */
  resultLine: string
  reasonLine: string | null
  metaPills: MetaPill[]
  /** Key question card — null hides the card entirely. */
  keyQuestion: KeyQuestion | null
  /** Top 3 visible rows. */
  inputRows: HeroRow[]
  /** Next 3 rows hidden behind the +3 disclosure. */
  hiddenRows: HeroRow[]
  /** "Also:" footer links (up to 3). */
  alsoLinks: AlsoLink[]
  /** Footer check glyphs. */
  footerChecks: FooterCheck[]
  /** Footer hint line above the CTA. */
  footerHint: string
  /** State-dependent CTA. */
  footerCta: FooterCta
}

/**
 * Inputs to the VM builder. Kept as a flat record so the builder is
 * easily testable without instantiating the full ResultsSectionDataReturn.
 */
export interface AnalysisHeroBuilderInputs {
  /** From useResultsSectionData. */
  data: import('../useResultsSectionData').ResultsSectionDataReturn
  /** From buildResultsVM. */
  vm: import('../buildResultsVM').ResultsVM
  /** From canvas store — number of confirmed factor nodes. */
  confirmedFactorCount: number
  /** From canvas store — total factor-node count. */
  totalFactorCount: number
}
