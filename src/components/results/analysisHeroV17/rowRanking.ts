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
      return hasTarget ? ['ai', 'discuss', 'add'] : ['ai', 'discuss']
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

/** Glossary-aligned reason copy template. Ground → Propose. */
function buildReason(
  category: RowCategory,
  band: PriorityBand,
  ground: string,
): string {
  // Ground → Propose minimum. Band labelled per glossary §8.
  const priorityLede = band === 'Ready' ? '' : `${band} evidence priority. `
  return `${priorityLede}${ground}`.trim()
}

/**
 * Single-row chat prefill — matches the v17 prototype template, glossary-safe.
 * User-supplied labels that trip the scanner are swapped for a generic
 * phrase BEFORE interpolation. The row's own `title` field still preserves
 * the user's exact label — we do not rewrite user data, only the
 * generated prompt that names it.
 */
function chatPromptFor(title: string, fallback = 'this factor'): string {
  const safe = safeRowLabel(title, fallback)
  return `Help me with ${safe}. Ask one focused question first, then suggest the smallest useful update.`
}

// ── Source-specific builders ────────────────────────────────────────────────

function fragileEdgeRow(data: ResultsSectionDataReturn): HeroRow | null {
  const fragile = data?.confidence?.topFragileEdge ?? data?.confidence?.m1CoachingTopFragileEdge
  if (!fragile) return null
  const title = fragile.fromLabel
  const { band, width } = bandFromVoi(0.6) // fragile edges are inherently high-priority
  // (Fix 3) Reason is action-oriented and does not repeat the fragility
  // prose already shown in the result-context line. The row's TITLE
  // already carries the factor name; the reason no longer names it
  // again. Fits comfortably in two panelBody lines — no truncation.
  const reason = buildReason(
    'risk',
    band,
    'Highest-priority assumption. Most likely to change which option leads.',
  )
  return {
    key: `risk-${fragile.fromId}`,
    title,
    reason,
    priority: band,
    priorityWidth: width,
    category: 'risk',
    actions: actionsForCategory('risk', !!fragile.fromId),
    targetNodeId: fragile.fromId,
    chatPrompt: chatPromptFor(title),
  }
}

function evidenceGapRows(data: ResultsSectionDataReturn): HeroRow[] {
  const gaps = data?.confidence?.topEvidenceGaps ?? data?.confidence?.evidenceGaps ?? []
  // Sort by VOI desc (deterministic; alphabetical tie-break).
  const sorted = [...gaps].sort((a, b) => {
    const aVoi = a.voi ?? -1
    const bVoi = b.voi ?? -1
    if (aVoi !== bVoi) return bVoi - aVoi
    return a.factorLabel.localeCompare(b.factorLabel)
  })
  return sorted.map(gap => {
    const targetId = gap.targetNodeId ?? gap.factorId
    const { band, width } = bandFromVoi(gap.voi)
    // (Fix 3) Tightened fallback ground — no longer duplicates "This
    // factor influences the outcome", which was redundant when paired
    // with the priority lede. Suggestion may carry pre-existing
    // upstream copy that contains a banned term (e.g. legacy "could
    // change the recommendation"). Fall back to the clean ground when
    // the upstream prose is unsafe.
    const fallbackGround = 'Check whether this estimate matches your experience.'
    const ground = gap.suggestion && !rowContainsBannedTerm(gap.suggestion)
      ? gap.suggestion
      : fallbackGround
    return {
      key: `evidence-${gap.factorId}`,
      title: gap.factorLabel,
      reason: buildReason('evidence', band, ground),
      priority: band,
      priorityWidth: width,
      category: 'evidence' as const,
      actions: actionsForCategory('evidence', !!targetId),
      targetNodeId: targetId,
      chatPrompt: chatPromptFor(gap.factorLabel),
    }
  })
}

function coverageRow(data: ResultsSectionDataReturn): HeroRow | null {
  const optionCount = data?.recommendation?.allOptions?.length ?? 0
  if (optionCount >= 2) return null
  // Single-option model: coverage row prompting to add an alternative.
  const title = 'Option coverage'
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
      title: rawTitle,
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
