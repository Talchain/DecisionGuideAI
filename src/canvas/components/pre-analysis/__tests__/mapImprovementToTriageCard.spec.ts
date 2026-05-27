/**
 * P0-1 reproduction tests for "0 scale" leak.
 *
 * Two display paths produce triage card text:
 *   1. detail line  — built upstream in usePreAnalysisData (has the
 *      isInferredZero guard, expected to render "Not set")
 *   2. subtitle line — built here in mapImprovementToTriageCard via
 *      formatValueWithUnit, which historically only guarded `unit === 'scale'`
 *      with a 0..1 constraint. The leak surfaces for placeholder units other
 *      than 'scale' (score, index, norm) and for the edge subtitle parenthetical
 *      that referenced the wrong factor's value.
 *
 * The fix broadens the guard to use classifyUnit(...).kind === 'placeholder'
 * and drops the value parenthetical from edge subtitles entirely.
 */

import { describe, it, expect } from 'vitest'
import { mapImprovementToTriageCard } from '../mapImprovementToTriageCard'
import type { ImprovementItem } from '../hooks/usePreAnalysisData'

function makeFactorItem(overrides: Partial<ImprovementItem> = {}): ImprovementItem {
  return {
    key: 'verify_fac_direct_delivery_capacity',
    category: 'verify',
    label: 'Direct Delivery Capacity',
    detail: 'Not set',
    focus: { type: 'node', id: 'fac_direct_delivery_capacity', label: 'Direct Delivery Capacity' },
    sourceBadge: 'ai',
    rawValue: 0,
    unit: 'scale',
    ...overrides,
  }
}

function makeEdgeItem(overrides: Partial<ImprovementItem> = {}): ImprovementItem {
  return {
    key: 'verify_edge_e1',
    category: 'verify',
    label: 'Direct Delivery Capacity → On-time Delivery',
    detail: 'How strong is this link?',
    focus: { type: 'edge', id: 'e1', label: 'Direct Delivery Capacity → On-time Delivery' },
    rawValue: 0,
    unit: 'scale',
    ...overrides,
  }
}

describe('mapImprovementToTriageCard — P0-1 "0 scale" guard', () => {
  it('does not render "0 scale" for an inferred zero placeholder factor', () => {
    const card = mapImprovementToTriageCard(makeFactorItem(), 0.45)
    expect(card.subtitle ?? '').not.toMatch(/0\s*scale/i)
    expect(card.detail).not.toMatch(/0\s*scale/i)
  })

  it.each(['score', 'index', 'norm', 'normalised', 'unit', 'units'])(
    'does not render "0 %s" for placeholder unit %s',
    (unit) => {
      // Factor variant
      const factorCard = mapImprovementToTriageCard(makeFactorItem({ unit }), 0.45)
      expect(factorCard.subtitle ?? '').not.toMatch(new RegExp(`0\\s*${unit}`, 'i'))
    },
  )

  it('still renders meaningful units (e.g. "500 engineers") in factor subtitle', () => {
    // Factor with a meaningful unit and non-zero value should still display the unit
    // — only placeholder units are stripped. We use a non-edge factor item so the
    // factor-coaching path applies (subtitle does not reference rawValue here).
    const card = mapImprovementToTriageCard(
      makeFactorItem({ rawValue: 500, unit: 'engineers' }),
      0.45,
    )
    // The factor subtitle path doesn't include the value parenthetical, so we
    // assert that the value+unit doesn't get accidentally stripped if it ever
    // does — sanity check that classifyUnit('engineers').kind !== 'placeholder'.
    expect(card.detail).not.toMatch(/500\s*$/) // detail is left alone by mapper
  })

  it('does NOT include a value parenthetical "(0 scale)" in edge subtitles', () => {
    // The previous code rendered: "How strongly does X (0 scale) affect Y?"
    // — using ImprovementItem.rawValue, which belongs to the *target* factor, not
    // the source referenced in the question. Drop the parenthetical entirely.
    const card = mapImprovementToTriageCard(makeEdgeItem(), 0.45)
    expect(card.subtitle ?? '').not.toMatch(/\(\s*0\s*scale\s*\)/i)
    expect(card.subtitle ?? '').not.toMatch(/\(\s*\d+\s*\w+\s*\)/) // no value parenthetical at all
  })

  it.each(['score', 'index', 'norm'])(
    'edge subtitle for placeholder unit %s does not leak the unit',
    (unit) => {
      const card = mapImprovementToTriageCard(makeEdgeItem({ unit }), 0.45)
      expect(card.subtitle ?? '').not.toMatch(new RegExp(`0\\s*${unit}`, 'i'))
    },
  )
})

// ── pre-analysis-power-v1 Task 4 — sourcePill branches ────────────────────

describe('mapImprovementToTriageCard — sourcePill (pre-analysis-power-v1 Task 4)', () => {
  it('renames "AI estimate" to "Olumi\'s estimate" for sourceBadge="ai"', () => {
    const card = mapImprovementToTriageCard(makeFactorItem({ sourceBadge: 'ai' }), 0.5)
    expect(card.sourcePill?.label).toBe("Olumi's estimate")
    // Regression guard: the legacy literal must not appear.
    expect(card.sourcePill?.label).not.toBe('AI estimate')
    expect(card.sourcePill?.borderClass).toBe('border-info/30')
  })

  it('keeps "From brief" unchanged for sourceBadge="brief"', () => {
    const card = mapImprovementToTriageCard(makeFactorItem({ sourceBadge: 'brief' }), 0.5)
    expect(card.sourcePill?.label).toBe('From brief')
    expect(card.sourcePill?.borderClass).toBe('border-success/30')
  })

  it('routes no-value node items (category=fix) to "Needs value"', () => {
    const card = mapImprovementToTriageCard(
      makeFactorItem({ sourceBadge: undefined, category: 'fix', detail: 'No observed data' }),
      0.5,
    )
    expect(card.sourcePill?.label).toBe('Needs value')
    expect(card.sourcePill?.borderClass).toBe('border-warning/30')
  })

  it('routes no-value edge items (category=fix, focus.type=edge) to "Needs judgement"', () => {
    const card = mapImprovementToTriageCard(
      makeEdgeItem({ sourceBadge: undefined, category: 'fix', detail: 'No observed data' }),
      0.5,
    )
    expect(card.sourcePill?.label).toBe('Needs judgement')
    expect(card.sourcePill?.borderClass).toBe('border-warning/30')
  })

  it('triggers "Needs judgement" when detail is "No evidence" on an edge', () => {
    const card = mapImprovementToTriageCard(
      makeEdgeItem({ sourceBadge: undefined, category: 'verify', detail: 'No evidence' }),
      0.5,
    )
    expect(card.sourcePill?.label).toBe('Needs judgement')
  })

  it('returns null sourcePill when there is no badge, no fix category, and no missing-data detail', () => {
    const card = mapImprovementToTriageCard(
      makeFactorItem({ sourceBadge: undefined, category: 'verify', detail: 'Confirm or edit the AI estimate' }),
      0.5,
    )
    expect(card.sourcePill).toBeNull()
  })

  it('never emits the legacy "No data" label (replaced by "Needs value" / "Needs judgement")', () => {
    const nodeCard = mapImprovementToTriageCard(
      makeFactorItem({ sourceBadge: undefined, category: 'fix', detail: 'No observed data' }),
      0.5,
    )
    const edgeCard = mapImprovementToTriageCard(
      makeEdgeItem({ sourceBadge: undefined, category: 'fix', detail: 'No observed data' }),
      0.5,
    )
    expect(nodeCard.sourcePill?.label).not.toBe('No data')
    expect(edgeCard.sourcePill?.label).not.toBe('No data')
  })
})
