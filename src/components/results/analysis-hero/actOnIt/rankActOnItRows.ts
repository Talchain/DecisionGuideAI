/**
 * Deterministic act-on-it row ranking + category assignment.
 *
 * Salvaged from `analysisHeroV17/rowRanking.ts` (see `types.ts` for why).
 * Original source of truth: docs/investigations/analysis-hero-v17.md §11.1/§11.3.
 *
 * Precedence (first to fire wins):
 *   1. Primary risk   ←  topFragileEdge
 *   2. Coverage gaps  ←  single-option model
 *   3. Reflective     ←  m2BiasFindings
 * plus the ready-to-brief row when the run has earned that posture.
 *
 * ⭐ ONE DELIBERATE SUBTRACTION FROM THE SALVAGED VERSION — the EVIDENCE-GAP
 * ROWS ARE GONE FROM HERE, BECAUSE THE TRIAGE QUEUE OWNS THEM.
 *
 * `analysisHeroV17` (deleted) and `TriageActionCardsBody` both read
 * `confidence.topEvidenceGaps` and both rendered a row per gap; v17 resolved
 * the duplication by SUPPRESSING the queue (`suppressTriageQueue`). That
 * resolution is unavailable here and would be a regression if it were: the
 * queue's card is the ONLY host of P4's "Confirm AI estimate" + inline value
 * editor (`mapEvidenceGapsToActions` → `TriageCard` → `InlineValueControls`),
 * pinned by `ResultsBody.confirmEstimateLiveMount.spec.tsx`. A v17-style row
 * offers a `confirm` ICON and no editor — strictly less. So the split is by
 * CAPABILITY, not by preference: the queue keeps evidence gaps, these rows
 * keep every category the queue does not produce. Both directions are pinned
 * in `analysisCockpit.mountPath.spec.tsx` §2a.
 *
 * Category is assigned at build time from the SOURCE FIELD, never inferred
 * from copy.
 */

import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import type { ActOnItRow, PriorityBand, RowAction, RowCategory } from './types'
// Single canonical glossary matcher shared across production + test scanner.
// Row builders sanitise GENERATED copy (chat prompts, reasons) against the
// same list the test scanner enforces. Row TITLES still preserve the user's
// verbatim label — only generated copy uses the fallback.
import {
  containsBannedTerm as rowContainsBannedTerm,
  safeInterpolatedLabel as safeRowLabel,
} from '../../utils/glossaryCheck'

/**
 * READY-TO-BRIEF PREDICATE.
 *
 * ⚠ DERIVED, NOT INVENTED. The salvaged `stateSelection.selectHeroState`
 * returned one of `weak | moderate | reflect | strong`, but `rankHeroRows`
 * only ever discriminated `strong` from everything else — `moderate` and
 * `reflect` took the identical branch. So only the `strong` predicate is
 * carried over, and it is carried over EXACTLY:
 *
 *   selectHeroState returns 'strong'  ⟺
 *     hasWinner
 *     ∧ ¬(stability < 0.5 ∧ gaps ≥ 3)     [weak guard 2]
 *     ∧ ¬(gaps ≥ 4)                        [weak guard 3]
 *     ∧ optionCount ≥ 2                    [weak guard 4]
 *     ∧ robustnessVerdict === 'robust'
 *     ∧ stability ≥ 0.85 ∧ gaps ≤ 1 ∧ fragileEdgeCount === 0
 *
 * The two bracketed weak guards are entailed by `stability ≥ 0.85 ∧ gaps ≤ 1`
 * (0.85 ≮ 0.5, and 1 < 3 ≤ 4), so dropping them changes nothing. That
 * equivalence is proved by execution — not asserted here — in
 * `./__tests__/rankActOnItRows.spec.ts`, which replays the original selector's
 * own table against this predicate.
 *
 * ⚠ THAT SENTENCE WAS FALSE WHEN FIRST WRITTEN, and the correction is worth
 * keeping. This module landed in the cockpit consolidation citing a proof
 * spec that DID NOT EXIST: 278 lines of live ranking logic (reached from
 * `AnalysisHeroContainer`) with zero tests, under a header claiming execution
 * proof. The spec now exists (67 tests, 19 mutants, 0 survivors) and the claim
 * is true. A comment asserting a proof is not evidence of one — check the file
 * before trusting the next such sentence, including this one.
 *
 * ⚠ KNOWN GAP, PINNED NOT HIDDEN. The two reads below —
 * `robustnessVerdict` and `recommendationStability` — are banned by
 * `../__tests__/hygiene.spec.ts` (no producer display-safe label => any read
 * is a fabrication path). They are recorded there in an EXACTLY-pinned
 * known-gap set that REDs if it grows or shrinks, rather than being carved out
 * of the guard. The two are different debts and are rowed separately: the ban
 * is stale for `robustnessVerdict` (PLoT does publish a display-safe verdict),
 * and correct for `recommendationStability` (the `0.85` cliff below is
 * UI-invented). Do not resolve either by editing the pin.
 *
 * The `robustnessVerdict === 'robust'` conjunct is LOAD-BEARING and must not
 * be relaxed: raw stability alone must never unlock a "ready to brief" claim
 * (single-source rule, ROBUSTNESS-VERDICT-CONTRACT). Older producers omit the
 * field, and then this predicate is simply unreachable — the honest direction.
 */
export function isReadyToBrief(
  data: ResultsSectionDataReturn,
  fragileEdgeCount: number,
): boolean {
  const rec = data?.recommendation
  if (!rec?.recommendedOption) return false
  if ((rec.allOptions?.length ?? 0) < 2) return false
  if (rec.robustnessVerdict !== 'robust') return false
  const stability = rec.recommendationStability
  if (typeof stability !== 'number' || !Number.isFinite(stability) || stability < 0.85) return false
  const gaps = (data?.confidence?.topEvidenceGaps ?? data?.confidence?.evidenceGaps ?? []).length
  if (gaps > 1) return false
  return fragileEdgeCount === 0
}

/** VOI → priority band + bar width. Bands match investigation §11.1. */
function bandFromVoi(voi: number | null | undefined): { band: PriorityBand; width: number } {
  if (voi == null || !Number.isFinite(voi)) return { band: 'Low', width: 30 }
  if (voi >= 0.5) return { band: 'High', width: 100 }
  if (voi >= 0.2) return { band: 'Medium', width: 60 }
  return { band: 'Low', width: 30 }
}

/**
 * Verb-led title composition.
 *
 * Row TITLES preserve the user's verbatim label — we never rewrite user data.
 * The verb is prepended; the underlying user-supplied string flows through
 * unchanged. Generated copy (reason, chatPrompt) still uses `safeRowLabel`.
 *
 * Verb mapping (locked 2026-05-21):
 *   evidence / risk / causal  →  Verify
 *   reflect                   →  Challenge
 *   coverage                  →  Add (special-cased literal)
 *   ready                     →  (existing imperative literal — no prefix)
 */
function verbLeadTitle(category: RowCategory, label: string): string {
  // Defensive: never compose a prefix-with-empty-label like "Verify "
  // (trailing space, no factor name).
  const trimmed = (label ?? '').trim()
  switch (category) {
    case 'evidence':
    case 'risk':
    case 'causal':
      return trimmed ? `Verify ${trimmed}` : 'Verify this factor'
    case 'reflect':
      return trimmed ? `Challenge ${trimmed}` : 'Challenge this assumption'
    case 'coverage':
      // The coverage row's underlying source isn't a noun phrase that
      // composes with "Add ", so substitute a verb-led literal. No user data
      // is interpolated here.
      return 'Add an alternative option'
    case 'ready':
      return label
  }
}

/**
 * Action set per row category. Right-aligned cluster on every row.
 * Positions 1-2 are always `ai` + `discuss`, then category-specific actions.
 */
function actionsForCategory(category: RowCategory, hasTarget: boolean): RowAction[] {
  switch (category) {
    case 'evidence':
      return hasTarget ? ['ai', 'discuss', 'edit', 'confirm'] : ['ai', 'discuss']
    case 'risk':
      // `add` previously rendered a Plus icon here, but it implied a direct
      // model mutation that does not happen — it routed to the same chat send
      // as `ai`/`discuss`. Dropped until there is a real Add-context affordance.
      return ['ai', 'discuss']
    case 'coverage':
      return ['ai', 'discuss', 'add']
    case 'reflect':
      return ['ai', 'discuss', 'challenge']
    case 'causal':
      return hasTarget ? ['ai', 'discuss', 'edit'] : ['ai', 'discuss']
    case 'ready':
      return ['ai', 'discuss', 'brief']
  }
}

/**
 * Trim a user-supplied label, run it through the glossary filter, and fall
 * back to a generic phrase when the result is empty or the input was a banned
 * term. Without the trim guard, whitespace-only inputs would slip past
 * `safeRowLabel` and produce strings like `"Help me with    ."`.
 */
function safeOrFallback(label: string | null | undefined, fallback = 'this factor'): string {
  const trimmed = (label ?? '').trim()
  return trimmed ? safeRowLabel(trimmed, fallback) : fallback
}

/**
 * Single-row chat send text, glossary-safe. User-supplied labels that trip the
 * scanner are swapped for the generic phrase BEFORE interpolation. The row's
 * own `title` still preserves the user's exact label.
 */
function chatPromptFor(title: string, fallback = 'this factor'): string {
  return `Help me with ${safeOrFallback(title, fallback)}. Ask one focused question first, then suggest the smallest useful update.`
}

// ── Source-specific builders ────────────────────────────────────────────────

function fragileEdgeRow(data: ResultsSectionDataReturn): ActOnItRow | null {
  const fragile = data?.confidence?.topFragileEdge ?? data?.confidence?.m1CoachingTopFragileEdge
  if (!fragile) return null
  const rawLabel = fragile.fromLabel
  const title = verbLeadTitle('risk', rawLabel)
  const { band, width } = bandFromVoi(0.6) // fragile edges are inherently high-priority
  // The verb leads and the label trails so no word ever lands adjacent to the
  // verb — earlier forms ("If {label} changes, …") produced mid-sentence
  // repetition for labels that themselves end in "changes"/"shifts".
  const safeFromLabel = safeOrFallback(rawLabel)
  const reason = `If the estimate changes for ${safeFromLabel}, the leading option could change.`
  return {
    key: `risk-${fragile.fromId}`,
    title,
    reason,
    priority: band,
    priorityWidth: width,
    category: 'risk',
    actions: actionsForCategory('risk', !!fragile.fromId),
    targetNodeId: fragile.fromId,
    chatPrompt: chatPromptFor(rawLabel),
    // A fragile edge carries no micro-intervention: only bias findings do.
    // Stated, not omitted — see the field docs in `types.ts`.
    steps: [],
    estimatedMinutes: null,
  }
}

function coverageRow(data: ResultsSectionDataReturn): ActOnItRow | null {
  const optionCount = data?.recommendation?.allOptions?.length ?? 0
  if (optionCount >= 2) return null
  return {
    key: 'coverage-options',
    title: verbLeadTitle('coverage', ''),
    reason: 'Add a comparable alternative to test a real trade-off.',
    priority: 'Medium',
    priorityWidth: 60,
    category: 'coverage',
    actions: actionsForCategory('coverage', false),
    targetNodeId: undefined,
    chatPrompt: 'Help me identify a comparable alternative option to compare against.',
    // Derived from the option count, not from a producer finding — no steps.
    steps: [],
    estimatedMinutes: null,
  }
}

/**
 * Reflective rows — the ONE row category sourced from a producer bias finding,
 * and therefore the only one that can carry a micro-intervention.
 *
 * ⭐ RE-HOMED SURFACE. `V7BiasSection` (deleted; preserved at `ca8cb0c1`) was
 * the only place in the product that rendered `micro_intervention.steps` and
 * the "About N min" estimate. These rows replaced it showing the bias type and
 * description alone, so both were lost. They are carried again here, read from
 * the single mapping site (`results/mapM2BiasFindings.ts`) rather than
 * re-derived from the wire — `V7BiasSection` and `buildV7Bias` had drifted into
 * exactly that two-readers-one-field shape, which is what this avoids.
 *
 * ⚠ ABSENT MEANS ABSENT. A finding with no `microIntervention` yields `[]` and
 * `null`, and the renderer draws nothing extra — no empty list, no invented
 * step, no default duration. The mapper guarantees `microIntervention` is
 * either absent or non-empty, so there is no third "present but hollow" state
 * to defend against here.
 */
function reflectRows(data: ResultsSectionDataReturn): ActOnItRow[] {
  const findings = data?.confidence?.m2BiasFindings ?? []
  return findings.map((f, i) => {
    const rawTitle = f.type || 'Reflective check'
    const fallbackReason = 'Worth considering whether this pattern is influencing the framing.'
    const safeReason = rowContainsBannedTerm(f.description)
      ? fallbackReason
      : (f.description ?? fallbackReason)
    return {
      key: `reflect-${i}`,
      title: verbLeadTitle('reflect', rawTitle),
      reason: safeReason.trim(),
      priority: 'Medium' as const,
      priorityWidth: 60,
      category: 'reflect' as const,
      actions: actionsForCategory('reflect', false),
      targetNodeId: undefined,
      chatPrompt: chatPromptFor(rawTitle, 'this reflective check'),
      // Producer steps are rendered as DATA, verbatim from the mapper — they
      // are not generated copy, so they are not routed through the glossary
      // fallback that `reason` above uses (same rule the row TITLE follows for
      // the user's own label).
      steps: f.microIntervention?.steps ?? [],
      estimatedMinutes: f.microIntervention?.estimatedMinutes ?? null,
    }
  })
}

function readyRow(): ActOnItRow {
  return {
    key: 'ready-brief',
    title: 'Create decision brief',
    reason: 'Capture the result, rationale, key assumptions and caveats before sharing.',
    priority: 'Ready',
    priorityWidth: 100,
    category: 'ready',
    actions: actionsForCategory('ready', false),
    targetNodeId: undefined,
    chatPrompt: 'Help me capture the result, rationale, key assumptions and caveats as a decision brief.',
    // A posture row, built from no producer finding — no steps, no estimate.
    steps: [],
    estimatedMinutes: null,
  }
}

/**
 * Build the ordered row list in precedence order. The caller slices [0..3]
 * visible and [3..6] hidden; anything beyond is suppressed (already covered by
 * the sections below the cockpit).
 */
export function rankActOnItRows(
  data: ResultsSectionDataReturn,
  opts: { readyToBrief: boolean },
): ActOnItRow[] {
  // Ready-to-brief posture shows a single ready row + up to two reflective rows.
  if (opts.readyToBrief) {
    return [readyRow(), ...reflectRows(data).slice(0, 2)]
  }

  const rows: ActOnItRow[] = []
  const risk = fragileEdgeRow(data)
  if (risk) rows.push(risk)
  const coverage = coverageRow(data)
  if (coverage) rows.push(coverage)
  rows.push(...reflectRows(data))
  return rows
}

/** Visible / hidden split — three visible, up to three behind the disclosure. */
export function splitActOnItRows(rows: ActOnItRow[]): {
  visible: ActOnItRow[]
  hidden: ActOnItRow[]
} {
  return { visible: rows.slice(0, 3), hidden: rows.slice(3, 6) }
}
