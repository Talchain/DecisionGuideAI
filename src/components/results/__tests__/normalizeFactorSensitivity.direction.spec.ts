/**
 * ROADMAP 2.234 — the DUPLICATE direction collapse, pinned.
 *
 * ⚠ THIS FILE EXISTS BECAUSE A MUTATION CHECK CAUGHT ITS ABSENCE. Reverting
 * the fix in `normalizeFactorSensitivity` left the entire
 * `useResultsSectionData` suite GREEN (123/123) — so the second half of the
 * 2.234 fix was shipping with no test that could see it. A fix whose reversion
 * turns nothing red is theatre (CLAUDE.md trap 11), and the only reason this
 * was found is that the mutation was run rather than assumed.
 *
 * THE DEFECT. `mapV5AnalysisToReport` narrowed the producer's direction domain
 * to two values and inferred the rest from a magnitude's sign; the IDENTICAL
 * collapse was written a second time here:
 *
 *     const direction = typed.direction
 *       ? (String(typed.direction).toLowerCase() === 'negative' ? 'negative' : 'positive')
 *       : elasticity >= 0 ? 'positive' : 'negative'
 *
 * Note the shape of it: ANY non-empty string that is not exactly "negative"
 * became `'positive'`. So `mixed` and `unknown` were not merely dropped here —
 * they were converted into the opposite of what the producer said, on the V4
 * path as well as the V5 one. Two copies of one rule meant a fix to either
 * would have left the other lying.
 */
import { describe, expect, it } from 'vitest'

import { normalizeFactorSensitivity } from '../useResultsSectionData'

const NO_LABELS = new Map<string, string>()

function directionOf(raw: Record<string, unknown>) {
  return normalizeFactorSensitivity(raw, NO_LABELS).direction
}

describe('normalizeFactorSensitivity — the producer domain survives (ROADMAP 2.234)', () => {
  it('positive / negative are carried', () => {
    expect(directionOf({ node_id: 'n1', direction: 'positive', elasticity: 0.4 })).toBe('positive')
    expect(directionOf({ node_id: 'n1', direction: 'negative', elasticity: 0.4 })).toBe('negative')
  })

  it('`mixed` stays `mixed` — it must NOT become "positive"', () => {
    expect(directionOf({ node_id: 'n1', direction: 'mixed', elasticity: 0.4 })).toBe('mixed')
  })

  it('`unknown` stays `unknown` — it must NOT become "positive"', () => {
    expect(directionOf({ node_id: 'n1', direction: 'unknown', elasticity: 0.4 })).toBe('unknown')
  })

  it('an UNRECOGNISED value fails closed to `unknown`, never to a directional claim', () => {
    expect(directionOf({ node_id: 'n1', direction: 'sideways', elasticity: 0.4 })).toBe('unknown')
  })

  it('NO direction and a NON-NEGATIVE magnitude → null (the sign is not evidence)', () => {
    // This is the exact combination that made the old fallback silently mean
    // "positive" on every row the producer left undirected.
    expect(directionOf({ node_id: 'n1', elasticity: 0.4 })).toBeNull()
    expect(directionOf({ node_id: 'n1', sensitivity_score: 0.4 })).toBeNull()
  })

  it('NO direction and a NEGATIVE magnitude → null too (not "negative")', () => {
    expect(directionOf({ node_id: 'n1', elasticity: -0.4 })).toBeNull()
  })

  it('a null direction is absence, not a default', () => {
    expect(directionOf({ node_id: 'n1', direction: null, elasticity: 0.4 })).toBeNull()
  })

  it('the empty-row fallback carries no direction either', () => {
    expect(normalizeFactorSensitivity(null, NO_LABELS).direction).toBeNull()
  })

  it('POSITIVE CONTROL — the rest of the row is still normalised (not an "everything went null" pass)', () => {
    const row = normalizeFactorSensitivity(
      { node_id: 'n_market', label: 'Market size', direction: 'mixed', elasticity: 0.42, confidence: 0.8 },
      NO_LABELS,
    )
    expect(row.factorId).toBe('n_market')
    expect(row.label).toBe('Market size')
    expect(row.elasticity).toBe(0.42)
    expect(row.confidence).toBe(0.8)
  })
})
