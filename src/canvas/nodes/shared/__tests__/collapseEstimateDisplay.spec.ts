/**
 * R6 — the "Moderate (0.5)" half of the placeholder wall.
 *
 * The corpus below is NOT invented: the `display_value` strings are lifted from
 * the shipped starter draft (`src/canvas/starters/data/vendor-selection.draft.json`,
 * which carries `"Moderate (0.5)"` nine times and `"Low (0)"` twice) — i.e. from
 * the producer, not from what this function's author imagined a value looks
 * like. The negative cases are the ones that matter: the rule must strip a
 * DEFAULT leaking through, and must never strip CONTENT that happens to sit in
 * brackets.
 */
import { describe, it, expect } from 'vitest'
import { collapseEstimateDisplay } from '../collapseEstimateDisplay'

describe('collapseEstimateDisplay — strips the raw number, keeps the meaning', () => {
  it.each([
    ['Moderate (0.5)', 'Moderate'],
    ['Low (0)', 'Low'],
    ['High (0.82)', 'High'],
    ['Strong (1)', 'Strong'],
    ['Weak (-0.3)', 'Weak'],
    ['Moderate (50%)', 'Moderate'],
    ['Very high (0.95)', 'Very high'],
  ])('%s → %s', (input, expected) => {
    expect(collapseEstimateDisplay(input)).toBe(expected)
  })

  it.each([
    // Content in brackets is content. Stripping these would DELETE meaning, not
    // tidy it — the failure mode this rule must never have.
    ['Moderate (per Q3 board pack)'],
    ['£200,000 (annual)'],
    ['Moderate (0.5 to 0.7)'],
    ['12 people (FTE)'],
    ['Moderate'],
    ['0.5'],
    ['(0.5)'],
    [''],
    ['   '],
  ])('leaves %s untouched', (input) => {
    expect(collapseEstimateDisplay(input)).toBe(input)
  })

  it('passes null and undefined through as null', () => {
    expect(collapseEstimateDisplay(null)).toBeNull()
    expect(collapseEstimateDisplay(undefined)).toBeNull()
  })
})
