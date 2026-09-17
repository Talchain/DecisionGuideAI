/**
 * Edge labels integration tests
 * Tests blueprint metadata pipeline (weight, belief, provenance) → readable labels
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getEdgeLabel, describeEdge, formatNumericLabel, getEdgeLabelMode } from '../domain/edgeLabels'
import { cleanupCanvas } from './__helpers__/renderCanvas'
import type { EdgeDirectionDisplay, EdgeValueDisplay } from '../domain/edgeValueProvenance'

/**
 * ROADMAP 2.935 — the direction is an ARGUMENT now, never inferred from the
 * sign of `weight`. See the header of
 * `src/canvas/domain/__tests__/edgeLabels.spec.ts` for why the signed weights
 * in this file were never evidence about the product, and
 * `edges/__tests__/StyledEdge.edgeLabelDirectionWords.2935.spec.tsx` for the
 * integration-level proof against real CEE capture data.
 */
const STATED_POSITIVE: EdgeDirectionDisplay = { show: true, direction: 'positive', source: 'user' }
const STATED_NEGATIVE: EdgeDirectionDisplay = { show: true, direction: 'negative', source: 'user' }
// ROADMAP 2.950 — the strength is a resolved display now too, for the same
// reason. `SET` wraps the historical numeric fixtures unchanged; the unset
// states are covered in `domain/__tests__/edgeLabels.spec.ts` and, against
// real capture bytes, `edges/__tests__/StyledEdge.edgeLabelStrengthWords.2950.spec.tsx`.
const SET = (value: number): EdgeValueDisplay => ({ show: true, value, source: 'user' })
const LIKELIHOOD_NOT_SET: EdgeValueDisplay = { show: false, reason: 'not_set' }

/*
 * ⭐⭐ THE STRENGTH ADJECTIVES AND THE `// Strong (>= 0.7)`-STYLE COMMENTS BELOW
 * BOTH CHANGED, AND THE COMMENTS ARE THE POINT.
 *
 * `describeEdge` restated its own band table; the canonical one is
 * `getStrengthLabel` (`domain/vocabulary.ts`) — **Very strong ≥ 0.70, Strong ≥
 * 0.40, Moderate ≥ 0.20, Slight < 0.20**, `validation_ui_data_contract_v1.1`.
 * The two agree on exactly ONE band, |w| ∈ [0.30, 0.40), so the canvas chip and
 * the inspector panel named the SAME edge differently. Every expectation here is
 * re-derived from the canonical table; none is loosened, and the fixture VALUES
 * are unchanged except where a test exists to pin a cut that has moved (each
 * such case says so in place).
 */
describe('Canvas: Edge labels (blueprint metadata → UI)', () => {
  beforeEach(() => {
    cleanupCanvas()
    // Reset to human mode for consistent tests
    localStorage.setItem('canvas.edge-labels-mode', 'human')
  })

  describe('Human-readable labels (default)', () => {
    it('generates "Very strong boost" for high weight + high belief (no uncertain)', () => {
      const weight = 0.8   // Very strong (>= 0.70)
      const belief = 0.9   // At or above the hedge cut — no qualifier

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('Very strong boost')
      expect(result.label).not.toContain('uncertain')
      expect(result.tooltip).toContain('Weight: 0.80')
      expect(result.tooltip).toContain('Belief: 90%')
    })

    it('generates "Strong boost (uncertain)" for mid weight + low belief', () => {
      const weight = 0.5   // Strong (0.40 <= w < 0.70)
      const belief = 0.4   // Low (< LABEL_HEDGE_CUT)

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('Strong boost (uncertain)')
      expect(result.tooltip).toContain('Weight: 0.50')
      expect(result.tooltip).toContain('Belief: 40%')
    })

    it('generates "Very strong drag" for negative weight + high belief', () => {
      const weight = -0.75  // |w| >= 0.70 → Very strong
      const belief = 0.85   // High confidence

      const result = describeEdge(SET(weight), SET(belief), STATED_NEGATIVE)

      expect(result.label).toBe('Very strong drag')
      expect(result.label).not.toContain('uncertain')
      expect(result.tooltip).toContain('Weight: −0.75') // Proper minus sign
      expect(result.tooltip).toContain('Belief: 85%')
    })

    it('names an UNSET likelihood as unset, for low weight + missing belief', () => {
      const weight = 0.2   // Moderate — 0.20 is the cut exactly, inclusive

      // An UNSET likelihood is not a low one. The label says which of the two
      // it is, rather than reporting "uncertain" about a number nobody supplied.
      const result = describeEdge(SET(weight), LIKELIHOOD_NOT_SET, STATED_POSITIVE)

      expect(result.label).toBe('Moderate boost (likelihood not set)')
      expect(result.tooltip).toContain('Weight: 0.20')
      expect(result.tooltip).toContain('Belief: not set')
    })

    it('generates "Strong drag (uncertain)" for negative mid weight + low belief', () => {
      const weight = -0.5  // |w| in [0.40, 0.70) → Strong
      const belief = 0.5   // Low (< LABEL_HEDGE_CUT)

      const result = describeEdge(SET(weight), SET(belief), STATED_NEGATIVE)

      expect(result.label).toBe('Strong drag (uncertain)')
    })

    it('generates "Moderate drag" for small negative weight + high belief', () => {
      const weight = -0.25  // |w| in [0.20, 0.40) → Moderate
      const belief = 0.9    // High

      const result = describeEdge(SET(weight), SET(belief), STATED_NEGATIVE)

      expect(result.label).toBe('Moderate drag')
    })

    it('treats medium confidence (0.6-0.8) as certain (no qualifier)', () => {
      const weight = 0.6   // Strong (0.40 <= w < 0.70)
      const belief = 0.7   // At or above the hedge cut

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('Strong boost')
      expect(result.label).not.toContain('uncertain')
    })
  })

  describe('Numeric labels mode', () => {
    beforeEach(() => {
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')
    })

    it('generates numeric format with belief', () => {
      const weight = 0.6
      const belief = 0.85

      const label = formatNumericLabel(SET(weight), SET(belief), STATED_POSITIVE)

      expect(label).toBe('w 0.60 • b 85%')
    })

    it('generates numeric format for negative weight', () => {
      const weight = -0.7
      const belief = 0.9

      const label = formatNumericLabel(SET(weight), SET(belief), STATED_NEGATIVE)

      expect(label).toBe('w −0.70 • b 90%') // Proper minus sign
    })

    it('generates numeric format without belief when missing', () => {
      const weight = 0.5

      const label = formatNumericLabel(SET(weight), LIKELIHOOD_NOT_SET, STATED_POSITIVE)

      expect(label).toBe('w 0.50')
      expect(label).not.toContain('b')
    })

    it('uses numeric mode via getEdgeLabel when mode is set', () => {
      const weight = 0.6
      const belief = 0.85

      const result = getEdgeLabel(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('w 0.60 • b 85%')
    })
  })

  describe('Mode switching', () => {
    it('defaults to human mode', () => {
      const mode = getEdgeLabelMode()

      expect(mode).toBe('human')
    })

    it('switches to numeric mode when set', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')

      const mode = getEdgeLabelMode()

      expect(mode).toBe('numeric')
    })

    it('persists mode to localStorage', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')

      const stored = localStorage.getItem('canvas.edge-labels-mode')

      expect(stored).toBe('numeric')
    })

    it('loads mode from localStorage', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')

      const mode = getEdgeLabelMode()

      expect(mode).toBe('numeric')
    })

    it('returns human mode as fallback for invalid storage', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'invalid')

      const mode = getEdgeLabelMode()

      expect(mode).toBe('human')
    })
  })

  describe('Edge cases', () => {
    it('handles zero weight', () => {
      const weight = 0
      const belief = 0.8

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      // 0 < 0.20 → Slight, the canonical table's bottom band.
      expect(result.label).toBe('Slight boost')
    })

    it('handles weight of exactly 0.20 (boundary)', () => {
      // ⚠ THE NUMBER MOVED WITH THE CUT. This was 'exactly 0.3', which was a
      // cut in the RETIRED table and is a band INTERIOR in the canonical one —
      // keeping 0.3 would have kept the name "boundary" on a test that no
      // longer pins one (CLAUDE.md trap 13b: a guard that stops discriminating
      // while still passing). 0.20 is where Slight becomes Moderate.
      const belief = 0.8

      expect(describeEdge(SET(0.2), SET(belief), STATED_POSITIVE).label).toBe('Moderate boost')
      expect(describeEdge(SET(0.19), SET(belief), STATED_POSITIVE).label).toBe('Slight boost')
    })

    it('handles weight of exactly 0.40 (boundary)', () => {
      // The other cut the old table did not have: Moderate becomes Strong.
      const belief = 0.8

      expect(describeEdge(SET(0.4), SET(belief), STATED_POSITIVE).label).toBe('Strong boost')
      expect(describeEdge(SET(0.39), SET(belief), STATED_POSITIVE).label).toBe('Moderate boost')
    })

    it('handles weight of exactly 0.7 (boundary)', () => {
      // The one cut both tables share — the WORDS either side of it changed.
      const weight = 0.7
      const belief = 0.8

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('Very strong boost')
    })

    it('handles belief of exactly 0.6 (boundary)', () => {
      const weight = 0.5   // Strong (0.40 <= w < 0.70) — this test pins the
      const belief = 0.6   // BELIEF cut, so the strength is held constant.

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('Strong boost')
      expect(result.label).not.toContain('uncertain')
    })

    it('handles belief of exactly 0.8 (boundary)', () => {
      const weight = 0.5   // Strong; the varying quantity is the belief.
      const belief = 0.8

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('Strong boost')
      expect(result.label).not.toContain('uncertain')
    })

    it('handles belief of 0', () => {
      const weight = 0.5   // Strong; the varying quantity is the belief.
      const belief = 0

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('Strong boost (uncertain)')
    })

    it('handles belief of 1', () => {
      const weight = 0.5   // Strong; the varying quantity is the belief.
      const belief = 1.0

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      expect(result.label).toBe('Strong boost')
    })

    it('handles very small weight', () => {
      const weight = 0.01
      const belief = 0.9

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      // 0.01 < 0.20 → Slight.
      expect(result.label).toBe('Slight boost')
    })

    it('handles maximum weight', () => {
      const weight = 1.0
      const belief = 1.0

      const result = describeEdge(SET(weight), SET(belief), STATED_POSITIVE)

      // 1.0 >= 0.70 → Very strong, the top band.
      expect(result.label).toBe('Very strong boost')
    })
  })
})
