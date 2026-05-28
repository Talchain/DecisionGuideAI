/**
 * Deterministic row ranking + category assignment.
 *
 * Source of truth: docs/investigations/analysis-hero-v17.md §11.1 + §11.3.
 *
 * Precedence (first to fire wins; ties broken by VOI descending, then by
 * alphabetical factor label):
 *   1. Primary risk  ←  topFragileEdge / scenario_contexts / flip_thresholds
 *   2. High-VOI evidence gaps  ←  topEvidenceGaps[] sorted by VOI
 *   3. Missing / weak user input — NOT IMPLEMENTABLE in v1 (provenance gap)
 *   4. Coverage gaps  ←  missing baseline, low option count, missing risks
 *   5. Reflective / framing  ←  m2BiasFindings
 *   6. Scientific-method prompts — NOT plumbed in v1
 *
 * Category is assigned at build time based on the source field, never
 * inferred from copy. See HeroRow.category in analysisHeroVM.types.ts.
 *
 * Returns the ordered superset; the caller slices [0..3] visible and [3..6] hidden.
 */

import type { ResultsSectionDataReturn } from '../useResultsSectionData'
import type { HeroRow, PriorityBand, RowAction, RowCategory, HeroState } from './analysisHeroVM.types'
// Single canonical glossary matcher shared across production + test
// scanner — see glossaryCheck.ts. Row builders sanitise generated copy
// (chat prompts, reasons) against the same list the test scanner
// enforces, so a banned term cannot ship undetected. Row TITLES still
// preserve the user's verbatim label — only generated copy uses the
// fallback. (Per P1.1 review feedback.)
import {
  containsBannedTerm as rowContainsBannedTerm,
  safeInterpolatedLabel as safeRowLabel,
} from './glossaryCheck'

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
 * Row TITLES preserve the user's verbatim label (`gap.factorLabel`,
 * `fragile.fromLabel`, `f.type`) — we never rewrite user data. The verb
 * is prepended; the underlying user-supplied string flows through
 * unchanged. The TITLE field is the only place this preservation applies;
 * generated copy (reason, chatPrompt) still uses `safeRowLabel`.
 *
 * Verb mapping (locked 2026-05-21):
 *   evidence / risk / causal  →  Verify  (estimate to check)
 *   reflect                    →  Challenge  (framing / result challenge)
 *   coverage                   →  Add  (missing structural element — special-cased)
 *   ready                      →  (existing imperative literal — no prefix)
 *
 * Validate ("evidence/source to validate") is documented but unused; no
 * current row category resolves to a citable-source shape. Add the branch
 * when an explicit evidence-source row exists.
 */
function verbLeadTitle(category: RowCategory, label: string): string {
  // Defensive: never compose a prefix-with-empty-label like "Verify "
  // (trailing space, no factor name). Generic fallbacks below produce
  // sensible copy if upstream data is degenerate. In normal data,
  // factor labels are always non-empty by the time we reach a row
  // builder, so these fallbacks are belt-and-braces.
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
      // composes with "Add " (the literal was 'Option coverage'), so
      // substitute a verb-led title. No user data is interpolated here.
      return 'Add an alternative option'
    case 'ready':
      // Existing 'Create decision brief' is already imperative — keep
      // the row builder's literal verbatim.
      return label
  }
}

/**
 * Action set per row category. Right-aligned cluster on every row.
 *
 * (Fix 4) Standardised ordering: positions 1-2 are always `ai` + `discuss`,
 * then category-specific actions. Gives consistent visual rhythm across
 * different row types. Count still varies by category (intentional) but
 * positional differences are now intentional rather than accidental.
 */
function actionsForCategory(category: RowCategory, hasTarget: boolean): RowAction[] {
  switch (category) {
    case 'evidence':
      return hasTarget ? ['ai', 'discuss', 'edit', 'confirm'] : ['ai', 'discuss']
    case 'risk':
      // `add` previously rendered the Plus icon here, but the icon implied a
      // direct model mutation that does not happen — `add` just routes to the
      // same `prefillChat` handler as `ai`/`discuss`, so it was both
      // ambiguous and redundant. Drop until there is a real Add-context
      // affordance with a clear tooltip.
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
 * Glossary-aligned reason copy template. Ground → Propose.
 *
 * 2026-05-21 correction pass: the `${band} evidence priority. ` lede was
 * removed alongside the priority pill + mini-bar. Row order communicates
 * priority; the reason explains why the row matters, not what its band
 * is. Without this change, evidence rows still emitted
 *   "High evidence priority. Check whether this estimate matches your
 *    experience."
 * which preserved the priority-band vocabulary the pill removal was
 * meant to retire.
 *
 * `band` is still passed through (used by downstream
 * `priority`/`priorityWidth` fields on the row VM, retained for forward-
 * compat with tests that exercise the data layer), but it no longer
 * influences the rendered reason copy.
 */
function buildReason(
  _category: RowCategory,
  _band: PriorityBand,
  ground: string,
): string {
  return ground.trim()
}

/**
 * Single-row chat prefill — matches the v17 prototype template, glossary-safe.
 * User-supplied labels that trip the scanner are swapped for a generic
 * phrase BEFORE interpolation. The row's own `title` field still preserves
 * the user's exact label — we do not rewrite user data, only the
 * generated prompt that names it.
 *
 * Defensive guard (2026-05-21 self-review): trim the label and fall back
 * to the generic phrase when the cleaned label is empty. `safeRowLabel`
 * only filters banned terms, so whitespace-only inputs would otherwise
 * pass through and produce `"Help me with    ."`.
 */
function chatPromptFor(title: string, fallback = 'this factor'): string {
  const trimmed = (title ?? '').trim()
  const safe = trimmed ? safeRowLabel(trimmed, fallback) : fallback
  return `Help me with ${safe}. Ask one focused question first, then suggest the smallest useful update.`
}

// ── Source-specific builders ────────────────────────────────────────────────

function fragileEdgeRow(data: ResultsSectionDataReturn): HeroRow | null {
  const fragile = data?.confidence?.topFragileEdge ?? data?.confidence?.m1CoachingTopFragileEdge
  if (!fragile) return null
  // Verbed display title vs. raw label for chat prompt — `chatPromptFor`
  // uses the user's underlying label, NOT the "Verify "-prefixed title.
  const rawLabel = fragile.fromLabel
  const title = verbLeadTitle('risk', rawLabel)
  const { band, width } = bandFromVoi(0.6) // fragile edges are inherently high-priority
  // V17 power pass (2026-05-27): the earlier generic reason
  //   "Check this first. It could change the result."
  // read as "this is the most important factor", which conflicts with the
  // hero's dependency line ("The result depends most on {dominant factor}")
  // whenever the fragile-edge factor differs from the dominant driver.
  // Naming the factor and the consequence explicitly disambiguates the
  // fragility signal from the dominance signal: this row is about what
  // happens if the estimate shifts, not about THIS factor being the
  // strongest cause. The dominant driver still surfaces on the dependency
  // line above.
  //
  // (Codex round-4 P2 #1): the label now sits as the object of `for` at
  // the end of the clause, so no word ever lands adjacent to the verb.
  // Earlier forms ("If {label} changes, ..." and "If the estimate for
  // {label} changes, ...") both produced mid-sentence repetition for
  // labels that themselves end in "changes" or "shifts" (e.g. "hiring
  // changes"). With the verb leading and the label trailing, the awkward
  // adjacency is structurally impossible.
  const trimmedLabel = (rawLabel ?? '').trim()
  const safeFromLabel = trimmedLabel ? safeRowLabel(trimmedLabel, 'this factor') : 'this factor'
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
  }
}

/**
 * Strict generic-row rule (V17 power pass, 2026-05-27): the CEE-emitted
 * suggestion `Gather data on "<label>" to reduce uncertainty` is a content-
 * free template — it interpolates the factor name but adds no coaching
 * beyond the row's existing "Verify <label>" title. Rows whose only
 * suggestion is this template are dropped rather than surfaced with
 * redundant copy. Fewer useful rows is preferred over more generic rows.
 */
const GATHER_DATA_TEMPLATE = /^\s*Gather data on .* to reduce uncertainty\.?\s*$/i

function evidenceGapRows(data: ResultsSectionDataReturn): HeroRow[] {
  const gaps = data?.confidence?.topEvidenceGaps ?? data?.confidence?.evidenceGaps ?? []
  // Sort by VOI desc (deterministic; alphabetical tie-break).
  const sorted = [...gaps].sort((a, b) => {
    const aVoi = a.voi ?? -1
    const bVoi = b.voi ?? -1
    if (aVoi !== bVoi) return bVoi - aVoi
    return a.factorLabel.localeCompare(b.factorLabel)
  })
  const rows: HeroRow[] = []
  for (const gap of sorted) {
    const targetId = gap.targetNodeId ?? gap.factorId
    const { band, width } = bandFromVoi(gap.voi)
    const suggestion = gap.suggestion?.trim() ?? ''
    // Only render rows whose CEE suggestion carries factor-specific
    // coaching. Drop empty, banned-term, and the generic "Gather data on
    // X" template — those rows would be noise with no actionable signal
    // beyond the verb-led row title.
    const isUseful =
      suggestion.length > 0
      && !rowContainsBannedTerm(suggestion)
      && !GATHER_DATA_TEMPLATE.test(suggestion)
    if (!isUseful) continue
    rows.push({
      key: `evidence-${gap.factorId}`,
      // Verbed display title; chatPrompt continues to interpolate the
      // raw user label (not the "Verify "-prefixed title).
      title: verbLeadTitle('evidence', gap.factorLabel),
      reason: buildReason('evidence', band, suggestion),
      priority: band,
      priorityWidth: width,
      category: 'evidence',
      actions: actionsForCategory('evidence', !!targetId),
      targetNodeId: targetId,
      chatPrompt: chatPromptFor(gap.factorLabel),
    })
  }
  return rows
}

function coverageRow(data: ResultsSectionDataReturn): HeroRow | null {
  const optionCount = data?.recommendation?.allOptions?.length ?? 0
  if (optionCount >= 2) return null
  // Single-option model: coverage row prompting to add an alternative.
  // `verbLeadTitle('coverage', ...)` ignores its label argument and
  // returns the special-cased 'Add an alternative option' literal — see
  // the verb-mapping comment above.
  const title = verbLeadTitle('coverage', '')
  return {
    key: 'coverage-options',
    title,
    // (Fix 3) Tightened: action-oriented one-liner instead of the
    // longer two-sentence explanation that was prone to truncation.
    reason: buildReason(
      'coverage',
      'Medium',
      'Add a comparable alternative to test a real trade-off.',
    ),
    priority: 'Medium',
    priorityWidth: 60,
    category: 'coverage',
    actions: actionsForCategory('coverage', false),
    targetNodeId: undefined,
    chatPrompt: 'Help me identify a comparable alternative option to compare against.',
  }
}

function reflectRows(data: ResultsSectionDataReturn): HeroRow[] {
  const findings = data?.confidence?.m2BiasFindings ?? []
  return findings.map((f, i) => {
    const rawTitle = f.type || 'Reflective check'
    const safeReason = rowContainsBannedTerm(f.description)
      ? 'Worth considering whether this pattern is influencing the framing.'
      : (f.description ?? 'Worth considering whether this pattern is influencing the framing.')
    return {
      key: `reflect-${i}`,
      // Verbed display title; chatPrompt continues to use the raw label.
      title: verbLeadTitle('reflect', rawTitle),
      reason: buildReason('reflect', 'Medium', safeReason),
      priority: 'Medium' as const,
      priorityWidth: 60,
      category: 'reflect' as const,
      actions: actionsForCategory('reflect', false),
      targetNodeId: undefined,
      chatPrompt: chatPromptFor(rawTitle, 'this reflective check'),
    }
  })
}

function readyRow(): HeroRow {
  return {
    key: 'ready-brief',
    title: 'Create decision brief',
    reason: buildReason('ready', 'Ready', 'Capture the result, rationale, key assumptions and caveats before sharing.'),
    priority: 'Ready',
    priorityWidth: 100,
    category: 'ready',
    actions: actionsForCategory('ready', false),
    targetNodeId: undefined,
    chatPrompt: 'Help me capture the result, rationale, key assumptions and caveats as a decision brief.',
  }
}

/**
 * Build the ordered row list in precedence order. Caller slices [0..3] visible,
 * [3..6] hidden, and anything beyond is suppressed (already covered by
 * existing post-analysis sections below the hero).
 */
export function rankHeroRows(data: ResultsSectionDataReturn, state: HeroState): HeroRow[] {
  // Strong state shows a single ready row + selected reflective rows.
  if (state === 'strong') {
    return [readyRow(), ...reflectRows(data).slice(0, 2)]
  }

  const rows: HeroRow[] = []
  const risk = fragileEdgeRow(data)
  if (risk) rows.push(risk)
  rows.push(...evidenceGapRows(data))
  const coverage = coverageRow(data)
  if (coverage) rows.push(coverage)
  rows.push(...reflectRows(data))
  return rows
}
