/**
 * EdgePanel sensitive assumption copy contract.
 *
 * Locks the rule: raw field names (switch_probability: X.XX) must never
 * appear in the default-mode narrative. The percentage is shown inline in
 * default mode; the System annotation is tech-mode only.
 *
 * These tests operate on the copy-generation logic directly so they don't
 * require full EdgePanel / store setup.
 */

import { describe, it, expect } from 'vitest'

// ─── Copy helpers extracted from EdgePanel render logic ──────────────
// These functions MIRROR the inline expressions in EdgePanel.tsx (~lines 489-496).
// They are intentionally not imported (avoids full store/component setup).
// If the EdgePanel narrative logic changes, update these mirrors to match.

function defaultNarrative(switchProb: number | null): string {
  if (switchProb !== null) {
    return `If this effect changes, there is a ${Math.round(switchProb * 100)}% chance the recommendation would shift.`
  }
  return 'If this effect changes significantly, the recommendation may shift.'
}

function techAnnotation(switchProb: number | null): string | null {
  if (switchProb === null) return null
  return `System: switch_probability: ${switchProb.toFixed(2)}`
}

// ─── Tests ────────────────────────────────────────────────────────────

describe('EdgePanel — sensitive assumption narrative', () => {
  it('default mode: shows percentage inline when switch_probability is present', () => {
    const copy = defaultNarrative(0.16)
    expect(copy).toBe('If this effect changes, there is a 16% chance the recommendation would shift.')
    expect(copy).not.toContain('switch_probability')
    expect(copy).not.toContain(':')
  })

  it('default mode: rounds probability correctly (0.155 → 16%)', () => {
    const copy = defaultNarrative(0.155)
    expect(copy).toContain('16%')
  })

  it('default mode: graceful fallback when switch_probability is absent', () => {
    const copy = defaultNarrative(null)
    expect(copy).toBe('If this effect changes significantly, the recommendation may shift.')
    expect(copy).not.toContain('switch_probability')
    expect(copy).not.toContain('%')
  })

  it('tech mode: annotation contains the raw field name with decimal value', () => {
    const annotation = techAnnotation(0.16)
    expect(annotation).toBe('System: switch_probability: 0.16')
  })

  it('tech mode: annotation is null when switch_probability is absent', () => {
    expect(techAnnotation(null)).toBeNull()
  })

  it('default mode: no raw field names for any probability value', () => {
    const probabilities = [0, 0.01, 0.5, 0.99, 1]
    for (const p of probabilities) {
      const copy = defaultNarrative(p)
      expect(copy).not.toContain('switch_probability')
      expect(copy).not.toMatch(/\w+_\w+:/)  // no snake_case_field: pattern
    }
  })
})
