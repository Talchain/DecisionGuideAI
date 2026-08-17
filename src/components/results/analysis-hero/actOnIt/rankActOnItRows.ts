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
 * `reflect` took the identical branch. So only the `strong` predicate was
 * carried over:
 *
 *   selectHeroState returns 'strong'  ⟺
 *     hasWinner
 *     ∧ ¬(stability < 0.5 ∧ gaps ≥ 3)     [weak guard 2]
 *     ∧ ¬(gaps ≥ 4)                        [weak guard 3]
 *     ∧ optionCount ≥ 2                    [weak guard 4]
 *     ∧ robustnessVerdict === 'robust'
 *     ∧ stability ≥ 0.85 ∧ gaps ≤ 1 ∧ fragileEdgeCount === 0
 *
 * ⚠ THE HEADER'S EQUIVALENCE CLAIM WAS FALSE WHEN FIRST WRITTEN, and the
 * correction is worth keeping. This module landed in the cockpit consolidation
 * citing a proof spec that DID NOT EXIST: 278 lines of live ranking logic
 * (reached from `AnalysisHeroContainer`) with zero tests, under a header
 * claiming execution proof. The spec exists now. A comment asserting a proof is
 * not evidence of one — check the file before trusting the next such sentence,
 * including this one. (Its test count is deliberately NOT restated here: the
 * previous number went stale within weeks. Run the file.)
 *
 * ── ROADMAP 2.1228: THE `stability ≥ 0.85` CONJUNCT IS RETIRED ──────────────
 *
 * It is gone, and the predicate now DELIBERATELY DIVERGES from the legacy
 * selector on exactly the rows that cliff used to block. Three findings, each
 * derived at the producer's bytes rather than reasoned from this repo:
 *
 * 1. THE CLIFF WAS UI-INVENTED. `0.85` appears in no contract, no schema and no
 *    producer. It banded a bare 0-1 float with no display-safe label.
 *
 * 2. ⭐ THE PRODUCER DELIBERATELY WITHHOLDS THE FIELD IT GATED ON, so the
 *    conjunct made this predicate UNREACHABLE ON EVERY FRESH RUN. PLoT stopped
 *    emitting `robustness.recommendation_stability` on /v2/run (lane PLoT-H
 *    item B, 2026-07-07; `src/routes/v2/run.ts:3266-3277`) because ISL derives
 *    it as `option_wins[winner]/n_samples` — the leader's `win_probability`
 *    relabelled, "zero independent information" — and the UI printing it as
 *    "N% stability" was "a fabricated second statistic". `useResultsSectionData`
 *    populates the field from that wire slot and nothing else, so it arrives
 *    undefined and `typeof stability !== 'number'` returned false forever. The
 *    ready-to-brief row was DARK, and its own spec fixtures were the only place
 *    the cliff could be satisfied (trap 16-inverse: reachability inside one
 *    service is not reachability in the system, and a fixture you wrote
 *    yourself is not evidence about the wire).
 *
 * 3. THE CLIFF WAS A MIRROR OF A PRODUCER BAND THAT HAS ALREADY MOVED. What the
 *    producer's own `robust` verdict entails, traced end to end:
 *      · PLoT `robustness-display-verdict.ts:182-207` — `display_verdict ===
 *        'robust'` ⟺ robustness computed ∧ `is_robust === true` ∧
 *        `level === 'high'` (BOTH facts required; an explicit `is_robust:
 *        false` always wins → 'fragile').
 *      · ISL `src/api/robustness.py:1230` — `level === 'high'` ⟺ `is_robust`
 *        ∧ `confidence > 0.8`.
 *      · ISL `robustness_analyzer_v2.py:6015` + `:1670` — `is_robust` ⟺
 *        `recommendation_stability >= ROBUST_THRESHOLD (0.7)`; and since ISL
 *        #114 the `confidence` slot IS the bare stability fraction
 *        (`_stability_confidence_figure`, `:3391`).
 *      ⟹ `robust` entails `recommendation_stability > 0.8`.
 *    So the UI's 0.85 sat 0.05 above a producer threshold it duplicated — and
 *    that threshold has already shifted once (pre-#114 the `confidence` slot
 *    carried `stability × (1 − 1/√n)`, putting the entailed floor near 0.826 at
 *    n=1000). A UI constant tracking a producer band it cannot see is the
 *    hand-maintained mirror this estate keeps paying for.
 *
 * WHAT THE CHANGE COSTS, STATED HONESTLY: the licensing band widens from
 * `≥ 0.85` to the producer's `> 0.8`. That is a real relaxation of ~5 points of
 * stability, and it is the correct direction — inside that band the producer's
 * own display-safe verdict says `robust`, and meaning is producer-owned. It
 * cannot let a FRAGILE result brief: `is_robust === false` or a low/very_low
 * level maps to 'fragile' before any of this is reached.
 *
 * THE OTHER CONJUNCTS ARE UNTOUCHED, and two points matter:
 *  · The bracketed weak guards are entailed by `gaps ≤ 1` ALONE (gaps ≤ 1 ⟹
 *    ¬(gaps ≥ 3) ∧ ¬(gaps ≥ 4)). The old header credited the entailment to
 *    `stability ≥ 0.85 ∧ gaps ≤ 1`; the stability half was never doing any of
 *    that work, which is why retiring it reopens neither guard.
 *  · `fragileEdgeCount === 0` is an INDEPENDENT measurement, not a proxy for
 *    stability — ISL's own note at `robustness_analyzer_v2.py:6013-6014` is that
 *    "fragile_edges is a separate indicator of edge-level sensitivity", and
 *    `is_robust: true` can co-occur with fragile edges. So edge fragility still
 *    blocks a brief on its own, and that guard is now carrying the load the
 *    cliff was imagined to carry.
 *
 * Both the divergence set and the "nothing else was relaxed" twin are pinned by
 * execution in `./__tests__/rankActOnItRows.spec.ts` §6/§7, bidirectionally: the
 * divergence REDs if it grows (a conjunct was relaxed) or shrinks (the cliff
 * came back).
 *
 * ── THE KNOWN-GAP SET IN `../__tests__/hygiene.spec.ts` IS NOW EMPTY ────────
 *
 * Both entries that named this file are resolved, and in OPPOSITE ways:
 *  · `recommendationStability` (ROADMAP 2.1228) — the ban was right and the
 *    code was wrong, so the READ IS GONE, as described above.
 *  · `robustnessVerdict` (ROADMAP 2.1227) — the code was right and the ban was
 *    STALE, so THE SYMBOL LEFT THE REGEX. `types.ts` documents this field as
 *    sourced only from PLoT's `robustness.display_verdict`, fail-closed
 *    normalised in `useResultsSectionData.ts:1974-1986`, and instructs surfaces
 *    to use it for the binary glyph. The read below IS the sanctioned path, so
 *    pinning it was recording a debt that did not exist.
 *    ⚠ `robustnessLevel` remains banned and that is the point — it is the
 *    NON-display-safe twin, carrying a UI-SEM-005 stability fallback, and
 *    `types.ts` says it must not drive the binary verdict. Unbanning the wrong
 *    twin would have been the differently-named-twins defect.
 *
 * The `robustnessVerdict === 'robust'` conjunct is LOAD-BEARING and must not be
 * relaxed: it is now the ONLY trust authority in this predicate (single-source
 * rule, ROBUSTNESS-VERDICT-CONTRACT). Older producers omit the field, and then
 * this predicate is simply unreachable — the honest direction.
 */
export function isReadyToBrief(
  data: ResultsSectionDataReturn,
  fragileEdgeCount: number,
): boolean {
  const rec = data?.recommendation
  if (!rec?.recommendedOption) return false
  if ((rec.allOptions?.length ?? 0) < 2) return false
  if (rec.robustnessVerdict !== 'robust') return false
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
