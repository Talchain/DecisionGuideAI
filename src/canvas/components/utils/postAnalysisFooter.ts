/**
 * Post-analysis footer status + meta derivation.
 *
 * Pure function — extracted from OutputsDock so the verdict mapping and
 * evidence-gap meta logic can be tested in isolation without dragging in the
 * full OutputsDock dependency tree.
 *
 * Status (single-source robustness rule — see ROBUSTNESS-VERDICT-CONTRACT):
 * a positive/negative robustness verdict may ONLY come from the display-safe
 * `robustnessVerdict` (the same field that drives the certified
 * "Robustness unknown" glyph) — NEVER from raw `recommendation_stability` /
 * `ranking_stability`. The verdict is the producer's own
 * `robustness.display_verdict` (PLoT #202, consumed lane 35 fix 3),
 * normalised fail-closed upstream:
 *   - robustnessVerdict 'robust'                → success "Stable ranking"
 *   - robustnessVerdict 'moderate' | 'fragile'  → warning "Ranking sensitive to
 *     assumptions"
 *
 * ⭐ ROADMAP 2.580 member 3 — WHY THE LABELS NAME THE RANKING.
 *
 * The verdict is derived from `recommendation_stability`, which ISL declares
 * as "P(same recommendation across samples)" and reports as "{winner} wins in
 * {x:.0%} of sampled scenarios". What held is the ORDER, in a finite sample —
 * not "the result". Codex (5 Aug 2026) saw "Stable result" beside 19 sensitive
 * assumptions and zero stable edges, and the sensitive assumptions were
 * exactly the numbers that did not hold. The labels now say which claim is
 * being made; the mapping, the fail-closed allowlist and the verdict source
 * are untouched.
 *
 * ⚠ THE LEADING META SEGMENT IS STILL THE PRODUCER'S, VERBATIM. PLoT authors
 * "this result held up under the changes we tested"
 * (`src/routes/v2/robustness-display-verdict.ts:62`), and rewording a
 * producer-owned display phrase in the consumer is exactly the divergence this
 * file's single-source rule exists to prevent. That half is a PLoT patch spec,
 * not a UI change — see the PR body.
 *   - robustnessVerdict 'not_assessed'          → neutral "Robustness not assessed"
 *     (the producer's own stated absence — rendered as stated, not upgraded
 *     and not blurred into the UI's "unknown")
 *   - missing / undefined (older PLoT builds)   → neutral "Robustness unknown"
 *
 * Meta (F7 — display honesty): the raw `stability` number is NEVER rendered.
 * It is the legacy `recommendation_stability` field, which is in fact the
 * LEADER'S WIN PROBABILITY (see the field note where the hook populates it),
 * not a stability/robustness measure — so "{N}% stability" mislabelled a win
 * probability as stability. The numeric segment has been removed entirely
 * (previously it was gated to a determinate verdict; now it never renders).
 * Only the display-safe verdict/reason and the evidence-gap text survive:
 *   - the producer's `robustnessVerdictReason` — leading segment, VERBATIM
 *     (producer-owned display phrase; never authored in the UI, never shown
 *     without its verdict)
 *   - "Evidence strong"      — appended ONLY when there are gaps AND every one
 *     of them carries a STATED confidence at or above the addressed threshold
 *   - "Evidence gaps remain" — appended otherwise, when there are gaps
 *   - omitted entirely when there are no review cards at all
 *
 * The Lucide icon is supplied by name (`'check' | 'warning' | 'unknown'`)
 * rather than as the icon component so this helper has no React import.
 * The caller maps the name back to a `LucideIcon`.
 */

import type { RobustnessDisplayVerdict } from '@/components/results/types'
import { everyEvidenceGapAddressed } from '@/components/results/utils/evidenceGapConfidenceDisplay'
import type { FreshnessDisplaySemantic } from '@/canvas/store/analysisFreshness'

export type PostFooterIcon = 'check' | 'warning' | 'unknown'

export interface PostFooterStatus {
  icon: PostFooterIcon
  iconClass: string
  label: string
}

export interface PostFooterMetaInput {
  /**
   * The SAME display-safe verdict that drives `derivePostFooterStatus`.
   * Gates the "{N}% stability" segment: without a determinate verdict the
   * footer status is "Robustness unknown"/"Robustness not assessed", and a
   * raw stability percentage beside it would contradict that admission — so
   * the segment is suppressed unless the verdict is 'robust' | 'moderate' |
   * 'fragile'. Runtime-safe like the status: anything other than the exact
   * enum values suppresses.
   */
  robustnessVerdict: RobustnessDisplayVerdict | null | undefined
  /**
   * The producer's own display reason for the verdict
   * (`robustness.display_verdict_reason`) — rendered VERBATIM as the leading
   * meta segment. Ignored when no verdict exists (the hook never populates
   * it without one, and this helper re-checks).
   */
  robustnessVerdictReason?: string | null
  /**
   * Subset of `ResultsSectionDataReturn.confidence.topEvidenceGaps` (or
   * `evidenceGaps`) — only the `confidence` field is needed for the
   * "Evidence gaps remain" decision.
   */
  reviewCards: ReadonlyArray<{ confidence?: number | null }>
  /**
   * Why the footer's Rerun is DISABLED, when it is.
   *
   * ⭐ VISIBLE, NOT HOVER-ONLY (Analysis convergence, 18 Aug 2026). Measured on
   * deployed staging `c71ea7e0`: `results-analysis-footer-action` rendered
   * disabled with its only explanation in the native `title` attribute —
   * invisible to anyone not hovering, and to touch entirely. The visible footer
   * read "Stable ranking · this result held up under the changes we tested ·
   * Rerun", i.e. a reassuring line beside a control that cannot be pressed and
   * says nothing about why.
   *
   * It LEADS the meta line because it is the only actionable part of it, and it
   * is ADDED rather than substituted: the robustness reason answers a different
   * question and both are true at once.
   */
  blockedReason?: string | null
}

/**
 * Derive the footer status from the display-safe robustness verdict ONLY.
 * Raw stability must never reach this function — it is surfaced separately as
 * neutral metadata via `derivePostFooterMeta`.
 *
 * RUNTIME-SAFE (allowlist, not catch-all): ONLY the known display-safe verdict
 * enum values produce a verdict. Type safety alone is not enough — if a raw
 * stability number (e.g. 0.87), a stringified number, or any other malformed
 * value accidentally reaches this helper at runtime, it must fall NEUTRAL,
 * never fabricate a "Ranking sensitive to assumptions"/"Stable ranking" claim from an
 * uncertified source. So the only branches that emit a verdict are the exact
 * enum matches; everything else (undefined, null, unknown string, number,
 * malformed) returns "Robustness unknown".
 */
export function derivePostFooterStatus(
  robustnessVerdict: RobustnessDisplayVerdict | null | undefined,
): PostFooterStatus {
  if (robustnessVerdict === 'robust') {
    return { icon: 'check', iconClass: 'text-success', label: 'Stable ranking' }
  }
  // Known display-safe sensitive verdicts → warning, mirroring the certified
  // glyph's "Sensitive" label. Explicit allowlist (NOT a non-robust
  // catch-all) so unexpected runtime values cannot reach this branch.
  if (robustnessVerdict === 'moderate' || robustnessVerdict === 'fragile') {
    return { icon: 'warning', iconClass: 'text-warning', label: 'Ranking sensitive to assumptions' }
  }
  // The producer explicitly said robustness was not assessed — state THAT,
  // verbatim in meaning, rather than the vaguer "unknown".
  if (robustnessVerdict === 'not_assessed') {
    return { icon: 'unknown', iconClass: 'text-text-light', label: 'Robustness not assessed' }
  }
  // undefined / null / unknown string / number / malformed → neutral.
  return { icon: 'unknown', iconClass: 'text-text-light', label: 'Robustness unknown' }
}

export function derivePostFooterMeta({
  robustnessVerdict,
  robustnessVerdictReason,
  reviewCards,
  blockedReason,
}: PostFooterMetaInput): string | null {
  // F7 (display honesty): the "{N}% stability" numeric segment is REMOVED.
  // `stability` here is the legacy `recommendation_stability` field, which
  // this file's own header comment documents is in fact the LEADER'S WIN
  // PROBABILITY, not a robustness/stability measure — so rendering it as
  // "{N}% stability" mislabels a win probability as stability (same doctrine
  // #407 applied to the Advanced receipts). Only the display-safe
  // verdict/reason and the evidence-gap text survive.
  //
  // ⛔ ROADMAP 2.1273 finished the job: the `stability` input is now GONE from
  // `PostFooterMetaInput` too, and its caller (`OutputsDock`) no longer computes
  // the value to pass. F7 stopped the render; leaving the parameter in place
  // kept a live reader of a field PLoT withholds, which is what the wide
  // read-ban guard now forbids. A field a helper accepts and discards still
  // obliges every caller to source it.
  // Removal trigger: PLoT supplies a genuine numeric robustness/stability
  // field distinct from the win probability.
  const verdictKnown =
    robustnessVerdict === 'robust' ||
    robustnessVerdict === 'moderate' ||
    robustnessVerdict === 'fragile' ||
    robustnessVerdict === 'not_assessed'
  // ⭐ NO ALL-CLEAR WITHOUT AUTHORITY — THE CROSS-SURFACE TWIN.
  //
  // This used to read
  //   `reviewCards.some(g => typeof g.confidence === 'number' && g.confidence < 50)`
  // — byte-for-byte the predicate `TriageActionCardsBody` used for its
  // "Evidence covered" tick, on a DIFFERENT surface (`results-analysis-footer`)
  // fed from the SAME list (`OutputsDock` passes
  // `confidence.topEvidenceGaps ?? confidence.evidenceGaps ?? []` to both).
  //
  // Two-valued over a three-valued input: a gap whose confidence the producer
  // NEVER STATED is `null` by design, so it was not "weak", so it was
  // "Evidence strong" — an all-clear minted from a silence. A defect fixed on
  // one surface and left on its twin is the same defect, and this estate's
  // chronic failure is precisely the same predicate living under two names.
  //
  // So there is now ONE predicate, imported, not a second copy that happens to
  // agree today: `everyEvidenceGapAddressed` — which is also what the results
  // panel's tick and its "N of M addressed" counter are derived from.
  const evidenceText = reviewCards.length === 0
    ? null
    : (everyEvidenceGapAddressed(reviewCards) ? 'Evidence strong' : 'Evidence gaps remain')
  const parts: string[] = []
  // The blocked reason leads: it is the only part the user can act on, and a
  // disabled control whose reason is hover-only is a control with no reason.
  if (typeof blockedReason === 'string' && blockedReason.trim() !== '') {
    parts.push(blockedReason.trim())
  }
  // Producer reason VERBATIM, next — but only beside a known verdict (never
  // render a robustness sentence the status line cannot vouch for).
  if (
    verdictKnown &&
    typeof robustnessVerdictReason === 'string' &&
    robustnessVerdictReason.trim() !== ''
  ) {
    parts.push(robustnessVerdictReason)
  }
  if (evidenceText) parts.push(evidenceText)
  return parts.length > 0 ? parts.join(' · ') : null
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RERUN AFFORDANCE'S LABEL (Core System A, exit A3, link 4).
//
// ⭐ WHAT WAS BROKEN. The run affordance never consulted freshness at ALL.
// `canRunAnalysis` takes ten inputs and none of them is freshness; this
// footer's action label was the literal `'Rerun'`; and this file's OWN status
// half (`derivePostFooterStatus`) is a pure function of `robustnessVerdict`,
// so it cannot speak about currency either. A user edited their model, the
// analysis went stale, and the footer could render a green ✓ "Stable ranking"
// beside an unqualified "Rerun" — while CEE's own answer sat composed at
// `analysisStateSelector.ts` (`requiresRerun`) and was read by NOTHING.
//
// ⭐ THIS IS NOT A SEVENTH STALENESS COMPUTATION, and that distinction is the
// whole design. The estate already carries six, three of which can disagree on
// screen; adding one would BE the defect. This function DERIVES NOTHING about
// freshness. It takes two members that `useAnalysisState()` has already
// composed and maps them to a string. It reads no store slice, applies no
// predicate to a graph hash, and cannot disagree with the strip above it,
// because both bottom out in the same selector.
//
// ⚠ TWO MEMBERS, TWO QUESTIONS — NAMED APART ON PURPOSE (trap 21).
//   · `requiresRerun` answers *"would a rerun move this user forward?"* It is
//     the GATE: it alone decides whether the label is qualified at all. Under
//     the wire branch it is CEE's own `requires_rerun`; under the derived
//     branch it is the affordance rule the UI has always applied.
//   · `semantic` answers *"what may I SAY about this result's currency?"* It is
//     the WORDING only, and it is never allowed to re-open the gate.
// The estate's chronic defect is two authorities silently answering different
// questions under similar names. Here they answer different questions ON
// PURPOSE, the split is stated, and the disagreement cell is decided below
// rather than left to whichever happens to be read first.
//
// ⚠ `'model changed'` IS A POSITIVE CLAIM AND IS MINTED ONLY FROM `'changed'`.
// `classifyFreshnessForDisplay`'s rule — "'changed' must never be claimed for a
// CEE-sourced 'unknown'" — binds this surface too. So the DISAGREEMENT CELL
// (`requiresRerun` true while `semantic` is `'current'` / `'none'`, reachable
// when CEE sets `requires_rerun` on a `complete_current` run) falls to the
// WEAKER cannot-confirm wording, never to the change claim. Degrading toward
// the claim we can defend is the only safe direction: an unrecognised state is
// precisely when the product has least right to assert what happened.
//
// ⚠ THE ABSENCE CELL, DECIDED AND DISCLOSED. `analysisStateV1` is
// CLEAR-ON-ABSENCE while `analysisFreshness` is RETAIN-ON-ABSENCE, so a turn
// carrying no `analysis_state` demotes this reader back to the retained legacy
// verdict — and a retained `fresh` therefore yields the UNQUALIFIED label. That
// is honest ONLY because the unqualified label asserts NOTHING about currency:
// the demotion costs a warning we can no longer justify, and never manufactures
// a false all-clear. Unknown does not render as current — it renders as
// cannot-confirm, and `'none'` (nothing has run) renders as neither.
//   And note what SURVIVES the demotion: the local dirty overlay is retained,
//   so an edit-since-run still downgrades `fresh` → `unknown` → `cannot_confirm`
//   → `requiresRerun`. The brief's own case — the user edited their model — is
//   therefore marked even on a silent turn. Pinned in
//   `OutputsDock.rerunAffordanceStaleness.spec.tsx`.
//
// ⛔ IT MARKS, IT NEVER GATES. Nothing here touches `actionDisabled`. A stale
// analysis is RERUNNABLE, and disabling the one control that fixes staleness
// would be a worse lie than the silence this replaced.
// ─────────────────────────────────────────────────────────────────────────────

/** Label shown while a run is in flight. Unchanged — the run states itself. */
export const RERUN_LABEL_RUNNING = 'Running analysis…'
/** The unqualified label. Asserts nothing about currency, deliberately. */
export const RERUN_LABEL_PLAIN = 'Rerun'
/** The POSITIVE claim. Only a stated `'changed'` earns it. */
export const RERUN_LABEL_CHANGED = 'Rerun — model changed'
/** The weaker, always-defensible claim. Every other rerun-required state. */
export const RERUN_LABEL_CANNOT_CONFIRM = "Rerun — can't confirm current"

export interface RerunActionLabelInput {
  /** A run in flight states itself and outranks every currency statement. */
  isRunning: boolean
  /**
   * `useAnalysisState().requiresRerun` — THE GATE. Producer-composed; never
   * re-derived here.
   */
  requiresRerun: boolean
  /**
   * `useAnalysisState().semantic` — THE WORDING ONLY. Never re-opens the gate.
   */
  semantic: FreshnessDisplaySemantic
}

/**
 * The rerun affordance's label, which is ALSO its accessible name —
 * `AnalysisFooter` leaves `actionAriaLabel` unset, so
 * `aria-label={actionAriaLabel ?? actionLabel}` keeps the two identical. That
 * is a property worth keeping: a button whose visible text and accessible name
 * make different claims is the same divergence one layer down.
 *
 * Pure and total, so it is mutation-testable without a store.
 */
export function deriveRerunActionLabel({
  isRunning,
  requiresRerun,
  semantic,
}: RerunActionLabelInput): string {
  // A run in flight is a run in flight, whatever the currency verdict says —
  // the same precedence `useAnalysisRunState` applies one level up. Stating
  // staleness over a run that is already fixing it would be noise.
  if (isRunning) return RERUN_LABEL_RUNNING

  // THE GATE. Not stale, or nothing to rerun for → say nothing about currency.
  if (!requiresRerun) return RERUN_LABEL_PLAIN

  // THE WORDING. Only a stated change earns the change claim.
  switch (semantic) {
    case 'changed':
      return RERUN_LABEL_CHANGED
    case 'cannot_confirm':
      return RERUN_LABEL_CANNOT_CONFIRM
    // ⚠ THE DISAGREEMENT CELL. `requiresRerun` says a rerun would help while
    // the copy classification has no change to report. Both are true
    // statements about different questions; the honest resolution is the
    // weaker claim, never silence (the gate did fire) and never the positive
    // one (nothing stated a change).
    case 'current':
    case 'none':
      return RERUN_LABEL_CANNOT_CONFIRM
    default: {
      // RUNTIME FLOOR + COMPILE-TIME EXHAUSTIVENESS, the pair this repo uses
      // wherever a producer enum can outgrow its pin. A semantic this build
      // does not recognise degrades to cannot-confirm — never to a completion
      // claim, and never to the change claim.
      const unhandled: never = semantic
      void unhandled
      return RERUN_LABEL_CANNOT_CONFIRM
    }
  }
}
