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
  | 'challenge-result'        // reflect — prefill only ("Test the result"); kept as name for handler stability after Fix 9 dropped auto-send
  | 'create-decision-brief'   // strong — prefill only

export interface FooterCta {
  label: string
  kind: FooterCtaKind
  /** Pre-built prompt text. */
  chatPrompt: string
  /** Factor to focus (moderate state only). */
  focusTargetId: string | undefined
  /**
   * Cleaned target label used for the chat-closed "Focus {target}"
   * variant (moderate state only). `null` when the CTA does not mirror
   * Row 1 — either the state is not moderate, or Row 1's underlying
   * user label was unsafe (banned-term) / non-Verify-prefixed. The
   * `label` and `chatPrompt` fields are already composed from this
   * value upstream; `HeroFooter` reads `targetLabel` directly to avoid
   * re-parsing `label`. Added 2026-05-21 corrections pass.
   */
  targetLabel: string | null
}

/**
 * @deprecated Fix 1 (2026-05-13): the v17 hero used to render a separate
 * "{n} inputs verified" line below the strip in addition to the strip's
 * own `checkedCount`. Two lines, same number. Removed in favour of
 * `checkedCount` as the single source of truth. The type and field stay
 * for backward compatibility (text always null); next major bump can
 * remove it.
 */
export interface ContributionLine {
  text: string | null
}

export interface AnalysisHeroVM {
  state: HeroState
  /** Verified-count summary above the title — "No inputs verified" / "1 input verified" / "N inputs verified". */
  checkedCount: string | null
  /** @deprecated See `ContributionLine`. Always `{ text: null }`. */
  contribution: ContributionLine
  /** 4-segment readiness colour strip (Structure / Evidence / Coverage / Verified). */
  dimensions: DimensionSegment[]
  /** Top hero result card. */
  resultLine: string
  /**
   * Flip-risk narrative — kept on the VM as a future slot for V5 Phase 3
   * substitution but no longer rendered in the result-context block. The
   * fragile-edge signal already surfaces in Row 1 of the input rows below.
   */
  reasonLine: string | null
  /**
   * "The result depends most on {factor}." Renders below the result line
   * when a safe dominant-factor source (PLoT B1 / M1 key_drivers) is
   * available and the label passes the glossary gate. `null` hides the line.
   */
  dependencyLine: string | null
  /** Key question card — null hides the card entirely. */
  keyQuestion: KeyQuestion | null
  /** Top 3 visible rows. */
  inputRows: HeroRow[]
  /** Next 3 rows hidden behind the +3 disclosure. */
  hiddenRows: HeroRow[]
  /** "Also:" footer links (up to 3). */
  alsoLinks: AlsoLink[]
  /**
   * @deprecated 2026-05-21 corrections pass: no longer rendered by
   * HeroFooter (the 4-check row duplicated the readiness strip above
   * and added cognitive load). Retained on the VM for forward-compat
   * with a potential debug surface; scheduled for removal in the next
   * major VM bump if no consumer emerges.
   */
  footerChecks: FooterCheck[]
  /**
   * @deprecated 2026-05-21 corrections pass: no longer rendered by
   * HeroFooter (the hint duplicated Row 1's title). Retained on the
   * VM for forward-compat; scheduled for removal in the next major
   * VM bump.
   */
  footerHint: string
  /** State-dependent CTA. */
  footerCta: FooterCta
}

// `AnalysisHeroBuilderArgs` (the actual VM-builder input shape) lives in
// `buildAnalysisHeroViewModel.ts` alongside the function it parameterises.
// An earlier stub here became dead after the structureSignals + coverageSignals
// fields were added round-3; removed to avoid drift.
