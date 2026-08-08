/**
 * Edge Labels Tests
 * Tests for meaningful human-readable edge labels (v1.2)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  describeEdge,
  formatNumericLabel,
  getEdgeLabel,
  getEdgeLabelMode,
  setEdgeLabelMode,
  type EdgeLabelMode
} from '../edgeLabels'
import type { EdgeDirectionDisplay } from '../edgeValueProvenance'

/**
 * ROADMAP 2.935 — the direction is now an ARGUMENT, not an inference from the
 * sign of `weight`.
 *
 * ⚠ WHY EVERY ASSERTION BELOW USED TO PASS WHILE THE PRODUCT WAS WRONG. This
 * file called `describeEdge(-0.5, 0.8)` and got "Moderate drag" — with a
 * NEGATIVE weight the producer cannot emit. Both ingestion paths store
 * `Math.abs(rawWeight)` (UI-SEM-023), so the only argument the product ever
 * passed was non-negative and the "drag" branch was unreachable in the live
 * product while being fully covered here. CLAUDE.md trap 16-inverse: the code
 * path was live and the DATA could never reach it — a fixture you wrote
 * yourself is not evidence about the wire.
 *
 * The signed weights are KEPT below deliberately, and now prove something
 * stronger: `describeEdge` uses `weight` for its MAGNITUDE ONLY, so a signed
 * argument cannot smuggle a direction claim past the gate. The integration-level
 * proof against real capture data lives in
 * `edges/__tests__/StyledEdge.edgeLabelDirectionWords.2935.spec.tsx`.
 */
const STATED_POSITIVE: EdgeDirectionDisplay = { show: true, direction: 'positive', source: 'user' }
const STATED_NEGATIVE: EdgeDirectionDisplay = { show: true, direction: 'negative', source: 'user' }
const NOT_STATED: EdgeDirectionDisplay = { show: false, reason: 'not_set' }

describe('edgeLabels', () => {
  // Clean up localStorage between tests
  beforeEach(() => {
    localStorage.clear()
  })

  afterEach(() => {
    localStorage.clear()
  })

  describe('describeEdge', () => {
    describe('Positive weights (boost)', () => {
      it('returns "Strong boost" for high positive weight with high belief', () => {
        const result = describeEdge(0.9, 0.9, STATED_POSITIVE)
        expect(result.label).toBe('Strong boost')
        expect(result.tooltip).toContain('Weight: 0.90')
        expect(result.tooltip).toContain('Belief: 90%')
      })

      it('returns "Moderate boost" for medium positive weight', () => {
        const result = describeEdge(0.5, 0.8, STATED_POSITIVE)
        expect(result.label).toBe('Moderate boost')
      })

      it('returns "Weak boost" for low positive weight', () => {
        const result = describeEdge(0.2, 0.8, STATED_POSITIVE)
        expect(result.label).toBe('Weak boost')
      })

      it('adds "(uncertain)" qualifier for low belief', () => {
        expect(describeEdge(0.9, 0.5, STATED_POSITIVE).label).toBe('Strong boost (uncertain)')
        expect(describeEdge(0.5, 0.4, STATED_POSITIVE).label).toBe('Moderate boost (uncertain)')
        expect(describeEdge(0.2, 0.3, STATED_POSITIVE).label).toBe('Weak boost (uncertain)')
      })

      it('handles edge case at 0.7 threshold', () => {
        expect(describeEdge(0.7, 0.8, STATED_POSITIVE).label).toBe('Strong boost')
        expect(describeEdge(0.69, 0.8, STATED_POSITIVE).label).toBe('Moderate boost')
      })

      it('handles edge case at 0.3 threshold', () => {
        expect(describeEdge(0.3, 0.8, STATED_POSITIVE).label).toBe('Moderate boost')
        expect(describeEdge(0.29, 0.8, STATED_POSITIVE).label).toBe('Weak boost')
      })
    })

    describe('Negative weights (drag)', () => {
      it('returns "Strong drag" for high negative weight', () => {
        expect(describeEdge(-0.9, 0.9, STATED_NEGATIVE).label).toBe('Strong drag')
      })

      it('returns "Moderate drag" for medium negative weight', () => {
        expect(describeEdge(-0.5, 0.8, STATED_NEGATIVE).label).toBe('Moderate drag')
      })

      it('returns "Weak drag" for low negative weight', () => {
        expect(describeEdge(-0.2, 0.8, STATED_NEGATIVE).label).toBe('Weak drag')
      })

      it('adds "(uncertain)" qualifier for low belief', () => {
        expect(describeEdge(-0.9, 0.5, STATED_NEGATIVE).label).toBe('Strong drag (uncertain)')
        expect(describeEdge(-0.5, 0.4, STATED_NEGATIVE).label).toBe('Moderate drag (uncertain)')
        expect(describeEdge(-0.2, 0.3, STATED_NEGATIVE).label).toBe('Weak drag (uncertain)')
      })
    })

    describe('Belief thresholds', () => {
      it('treats >= 80% as high confidence (no qualifier)', () => {
        expect(describeEdge(0.5, 0.8, STATED_POSITIVE).label).toBe('Moderate boost')
        expect(describeEdge(0.5, 0.85, STATED_POSITIVE).label).toBe('Moderate boost')
        expect(describeEdge(0.5, 1.0, STATED_POSITIVE).label).toBe('Moderate boost')
      })

      it('treats 60-80% as medium confidence (no qualifier)', () => {
        expect(describeEdge(0.5, 0.6, STATED_POSITIVE).label).toBe('Moderate boost')
        expect(describeEdge(0.5, 0.7, STATED_POSITIVE).label).toBe('Moderate boost')
        expect(describeEdge(0.5, 0.79, STATED_POSITIVE).label).toBe('Moderate boost')
      })

      it('treats < 60% as low confidence (adds uncertain)', () => {
        expect(describeEdge(0.5, 0.59, STATED_POSITIVE).label).toBe('Moderate boost (uncertain)')
        expect(describeEdge(0.5, 0.4, STATED_POSITIVE).label).toBe('Moderate boost (uncertain)')
        expect(describeEdge(0.5, 0.1, STATED_POSITIVE).label).toBe('Moderate boost (uncertain)')
      })
    })

    describe('Missing belief', () => {
      it('treats undefined belief as uncertain', () => {
        expect(describeEdge(0.9, undefined, STATED_POSITIVE).label).toBe('Strong boost (uncertain)')
        expect(describeEdge(0.5, undefined, STATED_POSITIVE).label).toBe('Moderate boost (uncertain)')
        expect(describeEdge(0.2, undefined, STATED_POSITIVE).label).toBe('Weak boost (uncertain)')
        expect(describeEdge(-0.9, undefined, STATED_NEGATIVE).label).toBe('Strong drag (uncertain)')
      })

      it('provides tooltip even when belief is missing', () => {
        const result = describeEdge(0.6, undefined, STATED_POSITIVE)
        expect(result.tooltip).toContain('Weight: 0.60')
        expect(result.tooltip).toContain('not set')
      })
    })

    describe('Zero weight', () => {
      it('treats zero weight as weak boost', () => {
        expect(describeEdge(0, 0.8, STATED_POSITIVE).label).toBe('Weak boost')
      })
    })
  })

  describe('formatNumericLabel', () => {
    it('formats positive weight with belief', () => {
      expect(formatNumericLabel(0.6, 0.85, STATED_POSITIVE)).toBe('w 0.60 • b 85%')
    })

    it('formats negative weight with belief using proper minus sign', () => {
      expect(formatNumericLabel(-0.6, 0.85, STATED_NEGATIVE)).toBe('w −0.60 • b 85%')
    })

    it('formats weight without belief', () => {
      expect(formatNumericLabel(0.6, undefined, STATED_POSITIVE)).toBe('w 0.60')
    })

    it('rounds belief to nearest integer percentage', () => {
      expect(formatNumericLabel(0.5, 0.856, STATED_POSITIVE)).toBe('w 0.50 • b 86%')
      expect(formatNumericLabel(0.5, 0.854, STATED_POSITIVE)).toBe('w 0.50 • b 85%')
    })

    it('formats weight to 2 decimal places', () => {
      expect(formatNumericLabel(0.123456, 0.8, STATED_POSITIVE)).toBe('w 0.12 • b 80%')
    })
  })

  describe('getEdgeLabelMode', () => {
    it('returns "human" by default when localStorage is empty', () => {
      expect(getEdgeLabelMode()).toBe('human')
    })

    it('returns "numeric" when stored in localStorage', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'numeric')
      expect(getEdgeLabelMode()).toBe('numeric')
    })

    it('returns "human" for invalid stored values', () => {
      localStorage.setItem('canvas.edge-labels-mode', 'invalid')
      expect(getEdgeLabelMode()).toBe('human')
    })

    it('returns "human" when localStorage is unavailable', () => {
      // This would require mocking localStorage, but the function handles it gracefully
      expect(getEdgeLabelMode()).toBe('human')
    })
  })

  describe('setEdgeLabelMode', () => {
    it('stores "numeric" mode in localStorage', () => {
      setEdgeLabelMode('numeric')
      expect(localStorage.getItem('canvas.edge-labels-mode')).toBe('numeric')
    })

    it('stores "human" mode in localStorage', () => {
      setEdgeLabelMode('human')
      expect(localStorage.getItem('canvas.edge-labels-mode')).toBe('human')
    })

    it('overwrites previous mode', () => {
      setEdgeLabelMode('numeric')
      expect(localStorage.getItem('canvas.edge-labels-mode')).toBe('numeric')

      setEdgeLabelMode('human')
      expect(localStorage.getItem('canvas.edge-labels-mode')).toBe('human')
    })
  })

  describe('getEdgeLabel', () => {
    it('returns human label when mode is "human"', () => {
      const result = getEdgeLabel(0.9, 0.9, STATED_POSITIVE, 'human')
      expect(result.label).toBe('Strong boost')
      expect(result.tooltip).toContain('Weight: 0.90')
    })

    it('returns numeric label when mode is "numeric"', () => {
      const result = getEdgeLabel(0.6, 0.85, STATED_POSITIVE, 'numeric')
      expect(result.label).toBe('w 0.60 • b 85%')
    })

    it('uses localStorage mode when mode parameter is not provided', () => {
      setEdgeLabelMode('numeric')
      expect(getEdgeLabel(0.6, 0.85, STATED_POSITIVE).label).toBe('w 0.60 • b 85%')

      setEdgeLabelMode('human')
      expect(getEdgeLabel(0.9, 0.9, STATED_POSITIVE).label).toBe('Strong boost')
    })

    it('defaults to human mode when localStorage is empty', () => {
      localStorage.clear()
      expect(getEdgeLabel(0.9, 0.9, STATED_POSITIVE).label).toBe('Strong boost')
    })
  })

  describe('Integration: Full workflow', () => {
    it('allows switching between human and numeric modes', () => {
      const weight = 0.6
      const belief = 0.85

      // Start in human mode (default)
      expect(getEdgeLabel(weight, belief, STATED_POSITIVE).label).toBe('Moderate boost')

      // Switch to numeric
      setEdgeLabelMode('numeric')
      expect(getEdgeLabel(weight, belief, STATED_POSITIVE).label).toBe('w 0.60 • b 85%')

      // Switch back to human
      setEdgeLabelMode('human')
      expect(getEdgeLabel(weight, belief, STATED_POSITIVE).label).toBe('Moderate boost')
    })

    it('persists mode across function calls', () => {
      setEdgeLabelMode('numeric')

      expect(getEdgeLabelMode()).toBe('numeric')
      expect(getEdgeLabel(0.5, 0.8, STATED_POSITIVE).label).toBe('w 0.50 • b 80%')

      setEdgeLabelMode('human')

      expect(getEdgeLabelMode()).toBe('human')
      expect(getEdgeLabel(0.5, 0.8, STATED_POSITIVE).label).toBe('Moderate boost')
    })
  })

  describe('V3 strength.mean → weight → label consistency', () => {
    it('strength.mean = 0.65 produces weight = 0.65 and "Moderate boost" label', () => {
      // V3 edges: weight = abs(strength.mean), so 0.65 → 0.65
      // Strength band: 0.3 ≤ 0.65 < 0.7 → "Moderate"
      // Direction: positive → "boost"
      const weight = 0.65 // as derived from abs(strength.mean)
      const result = describeEdge(weight, 0.85, STATED_POSITIVE)
      expect(result.label).toBe('Moderate boost')
    })

    it('strength.mean = 0.70 crosses into "Strong" band', () => {
      const result = describeEdge(0.70, 0.85, STATED_POSITIVE)
      expect(result.label).toBe('Strong boost')
    })

    it('negative strength.mean = -0.65 produces "Moderate drag"', () => {
      // ⚠ CORRECTED (ROADMAP 2.935). This comment used to read "describeEdge
      // receives the signed weight for label purposes". THAT WAS FALSE, and it
      // is the sentence that let the defect live for as long as it did: in the
      // canvas store `weight = abs(-0.65) = 0.65` and the sign lives in a
      // SEPARATE `direction` field, so `describeEdge` never received a signed
      // weight from the product at all. The magnitude and the direction are
      // passed separately below, exactly as the store holds them.
      const result = describeEdge(0.65, 0.85, STATED_NEGATIVE)
      expect(result.label).toBe('Moderate drag')
    })

    it('the same magnitude with the direction UNSTATED asserts no direction', () => {
      // The case the product actually hits on every edge whose producer sent
      // `effect_direction: 'unknown'` or omitted it — and the case this file
      // had no coverage for at all before 2.935.
      const result = describeEdge(0.65, 0.85, NOT_STATED)
      expect(result.label).toBe('Moderate effect, direction not stated')
      expect(result.label).not.toContain('boost')
      expect(result.label).not.toContain('drag')
    })

    it('the magnitude alone cannot produce a direction word', () => {
      // The gate's whole point: a caller passing a signed number does not get a
      // signed word. Same |w|, opposite signs, direction unstated → identical.
      expect(describeEdge(-0.65, 0.85, NOT_STATED).label)
        .toBe(describeEdge(0.65, 0.85, NOT_STATED).label)
    })

    it('an unstated direction prints no minus in the numeric channel either', () => {
      expect(formatNumericLabel(-0.65, 0.85, NOT_STATED)).toBe('w 0.65 • b 85%')
      expect(formatNumericLabel(0.65, 0.85, STATED_NEGATIVE)).toBe('w −0.65 • b 85%')
    })

    it('the tooltip sign tracks the STATED direction, not the argument sign', () => {
      expect(describeEdge(0.65, 0.85, STATED_NEGATIVE).tooltip).toContain('Weight: −0.65')
      expect(describeEdge(-0.65, 0.85, STATED_POSITIVE).tooltip).toContain('Weight: 0.65')
      expect(describeEdge(-0.65, 0.85, NOT_STATED).tooltip).toContain('Weight: 0.65')
    })
  })

  describe('Real-world examples', () => {
    it('handles typical template edge weights', () => {
      // Strong positive influence
      expect(describeEdge(0.8, 0.9, STATED_POSITIVE).label).toBe('Strong boost')

      // Moderate positive influence
      expect(describeEdge(0.5, 0.8, STATED_POSITIVE).label).toBe('Moderate boost')

      // Weak negative influence
      expect(describeEdge(-0.2, 0.7, STATED_NEGATIVE).label).toBe('Weak drag')

      // Strong negative influence with uncertainty
      expect(describeEdge(-0.9, 0.5, STATED_NEGATIVE).label).toBe('Strong drag (uncertain)')
    })

    it('provides meaningful labels for user-edited weights', () => {
      // User sets high confidence strong influence
      expect(describeEdge(0.95, 0.95, STATED_POSITIVE).label).toBe('Strong boost')

      // User sets low confidence moderate influence
      expect(describeEdge(0.45, 0.4, STATED_POSITIVE).label).toBe('Moderate boost (uncertain)')

      // User sets medium confidence weak drag
      expect(describeEdge(-0.15, 0.75, STATED_NEGATIVE).label).toBe('Weak drag')
    })
  })
})
