/**
 * Unit tests for graphDisplayCalculations
 * Decision Graph Display v2
 */

import { describe, it, expect } from 'vitest'
import {
  calculateEdgeImportance,
  importanceToStrokeWidth,
  calculateRiskSeverity,
  existenceCertaintyToLineStyle,
  weightMagnitudeToStrokeWidth,
  getRiskSeverityColors,
  getControllabilityBorderStyle,
  deriveControllability,
  formatDisplayValue,
} from '../graphDisplayCalculations'

describe('graphDisplayCalculations', () => {
  describe('calculateEdgeImportance', () => {
    it('calculates importance with all defined values', () => {
      const importance = calculateEdgeImportance(0.9, 2.0, 0.8)
      expect(importance).toBe(0.9 * 2.0 * 0.8) // 1.44
    })

    it('uses defaults for undefined belief (1.0)', () => {
      const importance = calculateEdgeImportance(undefined, 2.0, 0.8)
      expect(importance).toBe(1.0 * 2.0 * 0.8)
    })

    it('uses defaults for undefined strength (0.5)', () => {
      const importance = calculateEdgeImportance(0.9, undefined, 0.8)
      expect(importance).toBe(0.9 * 0.5 * 0.8)
    })

    it('uses defaults for undefined goal sensitivity (1.0)', () => {
      // Per Issue #2 fix: Use 1.0 fallback for non-factor edges
      const importance = calculateEdgeImportance(0.9, 2.0, undefined)
      expect(importance).toBe(0.9 * 2.0 * 1.0)
    })

    it('uses all defaults when all values undefined', () => {
      // Strength defaults to 0.5 (aligned with DEFAULT_EDGE_DATA.weight), belief/sensitivity default to 1.0
      const importance = calculateEdgeImportance(undefined, undefined, undefined)
      expect(importance).toBe(1.0 * 0.5 * 1.0)
    })

    it('handles negative strength by taking absolute value', () => {
      const importance = calculateEdgeImportance(0.8, -2.0, 0.5)
      expect(importance).toBe(0.8 * 2.0 * 0.5)
    })

    it('handles zero values', () => {
      const importance = calculateEdgeImportance(0, 0, 0)
      expect(importance).toBe(0)
    })

    it('handles fractional values correctly', () => {
      const importance = calculateEdgeImportance(0.5, 1.5, 0.25)
      expect(importance).toBeCloseTo(0.1875, 4)
    })
  })

  describe('importanceToStrokeWidth', () => {
    it('returns default width (2px) when maxImportance is 0', () => {
      const width = importanceToStrokeWidth(0, 0)
      expect(width).toBe(2)
    })

    it('returns minimum width (1px) for zero importance', () => {
      const width = importanceToStrokeWidth(0, 10)
      expect(width).toBe(1)
    })

    it('returns maximum width (8px) for importance = maxImportance', () => {
      const width = importanceToStrokeWidth(10, 10)
      expect(width).toBe(8)
    })

    it('scales linearly between min (1px) and max (8px)', () => {
      const width = importanceToStrokeWidth(5, 10)
      expect(width).toBe(4.5) // 1 + (5/10) * 7 = 1 + 3.5 = 4.5
    })

    it('handles fractional importance values', () => {
      const width = importanceToStrokeWidth(2.5, 10)
      expect(width).toBe(2.75) // 1 + (2.5/10) * 7 = 1 + 1.75
    })
  })

  describe('calculateRiskSeverity', () => {
    it('returns null when probability is undefined', () => {
      const severity = calculateRiskSeverity(undefined, 'high')
      expect(severity).toBeNull()
    })

    it('returns null when impact is undefined', () => {
      const severity = calculateRiskSeverity(0.5, undefined)
      expect(severity).toBeNull()
    })

    it('returns "low" for score <0.5', () => {
      // score = 1 * 0.4 = 0.4 < 0.5
      const severity = calculateRiskSeverity(0.4, 'low')
      expect(severity).toBe('low')
    })

    it('returns "medium" for score 0.5-1.5', () => {
      // score = 2 * 0.5 = 1.0 (0.5 <= x < 1.5)
      const severity = calculateRiskSeverity(0.5, 'medium')
      expect(severity).toBe('medium')
    })

    it('returns "high" for score 1.5-3', () => {
      // score = 3 * 0.6 = 1.8 (1.5 <= x < 3)
      const severity = calculateRiskSeverity(0.6, 'high')
      expect(severity).toBe('high')
    })

    it('returns "critical" for score >=3', () => {
      // score = 4 * 0.8 = 3.2 >= 3
      const severity = calculateRiskSeverity(0.8, 'critical')
      expect(severity).toBe('critical')
    })

    it('handles exact threshold boundaries (0.5)', () => {
      // score = 2 * 0.25 = 0.5 (exactly at medium threshold)
      const severity = calculateRiskSeverity(0.25, 'medium')
      expect(severity).toBe('medium')
    })

    it('handles exact threshold boundaries (1.5)', () => {
      // score = 2 * 0.75 = 1.5 (exactly at high threshold)
      const severity = calculateRiskSeverity(0.75, 'medium')
      expect(severity).toBe('high')
    })

    it('handles exact threshold boundaries (3.0)', () => {
      // score = 4 * 0.75 = 3.0 (exactly at critical threshold)
      const severity = calculateRiskSeverity(0.75, 'critical')
      expect(severity).toBe('critical')
    })

    it('returns "low" for low impact, low probability', () => {
      // score = 1 * 0.1 = 0.1 < 0.5
      const severity = calculateRiskSeverity(0.1, 'low')
      expect(severity).toBe('low')
    })

    it('returns "critical" for critical impact, high probability', () => {
      // score = 4 * 1.0 = 4.0 >= 3
      const severity = calculateRiskSeverity(1.0, 'critical')
      expect(severity).toBe('critical')
    })
  })

  describe('existenceCertaintyToLineStyle', () => {
    it('returns undefined (solid) for undefined probability', () => {
      const lineStyle = existenceCertaintyToLineStyle(undefined)
      expect(lineStyle).toBeUndefined()
    })

    it('returns undefined (solid) for >70% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.71)
      expect(lineStyle).toBeUndefined()
    })

    it('returns undefined (solid) for exactly 100% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(1.0)
      expect(lineStyle).toBeUndefined()
    })

    it('returns "6,4" (dashed) for 40-70% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.5)
      expect(lineStyle).toBe('6,4')
    })

    it('returns "6,4" (dashed) for exactly 70% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.7)
      expect(lineStyle).toBe('6,4')
    })

    it('returns "6,4" (dashed) for exactly 40% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.4)
      expect(lineStyle).toBe('6,4')
    })

    it('returns "6,4" (dashed) for <40% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.39)
      expect(lineStyle).toBe('6,4')
    })

    it('returns "6,4" (dashed) for very low certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.05)
      expect(lineStyle).toBe('6,4')
    })

    it('returns "6,4" (dashed) for 0% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0)
      expect(lineStyle).toBe('6,4')
    })
  })

  describe('weightMagnitudeToStrokeWidth', () => {
    // Graph Editing Experience Task 9a: Linear 1-5px scale (1 + |mean| * 4)
    it('returns 1px for magnitude 0', () => {
      expect(weightMagnitudeToStrokeWidth(0)).toBe(1)
    })

    it('returns linear scale for magnitude 0.25', () => {
      expect(weightMagnitudeToStrokeWidth(0.25)).toBe(2)
    })

    it('returns linear scale for magnitude 0.5', () => {
      expect(weightMagnitudeToStrokeWidth(0.5)).toBe(3)
    })

    it('returns linear scale for magnitude 0.75', () => {
      expect(weightMagnitudeToStrokeWidth(0.75)).toBe(4)
    })

    it('returns 5px for magnitude 1.0', () => {
      expect(weightMagnitudeToStrokeWidth(1.0)).toBe(5)
    })

    it('clamps magnitude > 1 to 5px', () => {
      expect(weightMagnitudeToStrokeWidth(1.5)).toBe(5)
    })

    it('handles negative values via internal Math.abs', () => {
      expect(weightMagnitudeToStrokeWidth(-0.5)).toBe(3)
      expect(weightMagnitudeToStrokeWidth(-1.0)).toBe(5)
    })
  })

  describe('getRiskSeverityColors', () => {
    it('returns yellow classes for low severity', () => {
      const colors = getRiskSeverityColors('low')
      expect(colors).toEqual({
        bg: 'bg-yellow-100',
        border: 'border-yellow-400',
        text: 'text-yellow-900',
      })
    })

    it('returns orange classes for medium severity', () => {
      const colors = getRiskSeverityColors('medium')
      expect(colors).toEqual({
        bg: 'bg-orange-100',
        border: 'border-orange-400',
        text: 'text-orange-900',
      })
    })

    it('returns danger classes for high severity', () => {
      const colors = getRiskSeverityColors('high')
      expect(colors).toEqual({
        bg: 'bg-panel',
        border: 'border-danger',
        text: 'text-danger',
      })
    })

    it('returns danger classes for critical severity', () => {
      const colors = getRiskSeverityColors('critical')
      expect(colors).toEqual({
        bg: 'bg-panel',
        border: 'border-danger',
        text: 'text-danger',
      })
    })

    it('returns gray classes for null severity', () => {
      const colors = getRiskSeverityColors(null)
      expect(colors).toEqual({
        bg: 'bg-gray-100',
        border: 'border-gray-300',
        text: 'text-gray-700',
      })
    })
  })

  describe('getControllabilityBorderStyle', () => {
    it('returns "border-solid" for controllable', () => {
      const style = getControllabilityBorderStyle('controllable')
      expect(style).toBe('border-solid')
    })

    it('returns "border-dashed" for partial', () => {
      const style = getControllabilityBorderStyle('partial')
      expect(style).toBe('border-dashed')
    })

    it('returns "border-solid" for unknown (P1 Hotfix: no visual distinction)', () => {
      const style = getControllabilityBorderStyle('unknown')
      expect(style).toBe('border-solid')
    })

    it('returns "border-solid" (default) for undefined', () => {
      const style = getControllabilityBorderStyle(undefined)
      expect(style).toBe('border-solid')
    })

    // CEE V12.4: New category values
    it('returns "border-dashed" for observable', () => {
      const style = getControllabilityBorderStyle('observable')
      expect(style).toBe('border-dashed')
    })

    it('returns "border-dotted" for external', () => {
      const style = getControllabilityBorderStyle('external')
      expect(style).toBe('border-dotted')
    })
  })

  describe('deriveControllability', () => {
    const mockOptions = [
      {
        id: 'option-a',
        interventions: { 'factor-1': 10, 'factor-2': 20 },
      },
      {
        id: 'option-b',
        interventions: { 'factor-1': 15 },
      },
    ]

    // P1 Hotfix: Multi-hop test edges
    // factor-1 → factor-3 → factor-7 → factor-8 (chain from controllable)
    // factor-2 → factor-4
    // factor-5 → factor-6 (no connection to interventions)
    const mockEdges = [
      { source: 'factor-1', target: 'factor-3' },
      { source: 'factor-3', target: 'factor-7' },
      { source: 'factor-7', target: 'factor-8' },
      { source: 'factor-2', target: 'factor-4' },
      { source: 'factor-5', target: 'factor-6' },
    ]

    it('returns "unknown" when options is undefined', () => {
      const result = deriveControllability('factor-1', undefined, mockEdges)
      expect(result).toBe('unknown')
    })

    it('returns "unknown" when options is empty', () => {
      const result = deriveControllability('factor-1', [], mockEdges)
      expect(result).toBe('unknown')
    })

    it('returns "controllable" for factors directly targeted by interventions', () => {
      const result = deriveControllability('factor-1', mockOptions, mockEdges)
      expect(result).toBe('controllable')
    })

    it('returns "controllable" for factor targeted by single option', () => {
      const result = deriveControllability('factor-2', mockOptions, mockEdges)
      expect(result).toBe('controllable')
    })

    it('returns "partial" for factors with incoming edge from controllable factor (1-hop)', () => {
      // factor-3 has incoming edge from factor-1 (which is controllable)
      const result = deriveControllability('factor-3', mockOptions, mockEdges)
      expect(result).toBe('partial')
    })

    it('returns "partial" for factors 2 hops downstream (P1 Hotfix: multi-hop BFS)', () => {
      // factor-7 is 2 hops from factor-1: factor-1 → factor-3 → factor-7
      const result = deriveControllability('factor-7', mockOptions, mockEdges)
      expect(result).toBe('partial')
    })

    it('returns "partial" for factors 3 hops downstream (P1 Hotfix: multi-hop BFS)', () => {
      // factor-8 is 3 hops from factor-1: factor-1 → factor-3 → factor-7 → factor-8
      const result = deriveControllability('factor-8', mockOptions, mockEdges)
      expect(result).toBe('partial')
    })

    it('returns "partial" for downstream factors (1-hop from factor-2)', () => {
      // factor-4 has incoming edge from factor-2 (which is controllable)
      const result = deriveControllability('factor-4', mockOptions, mockEdges)
      expect(result).toBe('partial')
    })

    it('returns "unknown" for factors with no path to any intervention', () => {
      // factor-6 has incoming edge from factor-5, but factor-5 is not reachable from interventions
      const result = deriveControllability('factor-6', mockOptions, mockEdges)
      expect(result).toBe('unknown')
    })

    it('returns "unknown" for factors not in any intervention or edge', () => {
      const result = deriveControllability('factor-unknown', mockOptions, mockEdges)
      expect(result).toBe('unknown')
    })

    it('returns "unknown" when edges is undefined', () => {
      // factor-3 would be partial if edges existed
      const result = deriveControllability('factor-3', mockOptions, undefined)
      expect(result).toBe('unknown')
    })

    it('returns "controllable" when factor in interventions even without edges', () => {
      const result = deriveControllability('factor-1', mockOptions, undefined)
      expect(result).toBe('controllable')
    })

    it('handles interventions with object value format', () => {
      const optionsWithObjectValues = [
        {
          id: 'option-a',
          interventions: { 'factor-obj': { value: 10 } },
        },
      ]
      const result = deriveControllability('factor-obj', optionsWithObjectValues, mockEdges)
      expect(result).toBe('controllable')
    })

    it('returns "unknown" when edges is empty array', () => {
      // factor-3 would be partial if edges existed, but with empty edges it's unknown
      const result = deriveControllability('factor-3', mockOptions, [])
      expect(result).toBe('unknown')
    })

    it('handles cycles in graph without infinite loop', () => {
      // Add cycle: factor-8 → factor-3 (creates cycle)
      const edgesWithCycle = [
        ...mockEdges,
        { source: 'factor-8', target: 'factor-3' },
      ]
      // Should still work without hanging
      const result = deriveControllability('factor-8', mockOptions, edgesWithCycle)
      expect(result).toBe('partial')
    })

    // CEE V12.4: Category parameter tests
    describe('with explicit category parameter', () => {
      it('returns "controllable" when category is "controllable"', () => {
        const result = deriveControllability('factor-unknown', mockOptions, mockEdges, 'controllable')
        expect(result).toBe('controllable')
      })

      it('returns "observable" when category is "observable"', () => {
        const result = deriveControllability('factor-unknown', mockOptions, mockEdges, 'observable')
        expect(result).toBe('observable')
      })

      it('returns "external" when category is "external"', () => {
        const result = deriveControllability('factor-unknown', mockOptions, mockEdges, 'external')
        expect(result).toBe('external')
      })

      it('category takes precedence over BFS derivation', () => {
        // factor-1 would be "controllable" via BFS, but category overrides to "external"
        const result = deriveControllability('factor-1', mockOptions, mockEdges, 'external')
        expect(result).toBe('external')
      })

      it('category takes precedence even with undefined options', () => {
        // Without category, undefined options returns "unknown"
        // With category, it should return the category value
        const result = deriveControllability('factor-1', undefined, undefined, 'observable')
        expect(result).toBe('observable')
      })

      it('falls back to BFS when category is undefined', () => {
        // factor-1 is directly in interventions
        const result = deriveControllability('factor-1', mockOptions, mockEdges, undefined)
        expect(result).toBe('controllable')
      })

      it('falls back to BFS when category is invalid string', () => {
        // Invalid category should fall back to BFS derivation
        const result = deriveControllability('factor-1', mockOptions, mockEdges, 'invalid-category')
        expect(result).toBe('controllable')
      })

      it('falls back to BFS when category is empty string', () => {
        const result = deriveControllability('factor-1', mockOptions, mockEdges, '')
        expect(result).toBe('controllable')
      })

      // P1 Hotfix: Category normalization tests
      describe('category normalization', () => {
        it('normalizes "External" to "external" → dotted border', () => {
          const result = deriveControllability('factor-unknown', mockOptions, mockEdges, 'External')
          expect(result).toBe('external')
        })

        it('normalizes "external " (trailing space) to "external"', () => {
          const result = deriveControllability('factor-unknown', mockOptions, mockEdges, 'external ')
          expect(result).toBe('external')
        })

        it('normalizes " external" (leading space) to "external"', () => {
          const result = deriveControllability('factor-unknown', mockOptions, mockEdges, ' external')
          expect(result).toBe('external')
        })

        it('normalizes "OBSERVABLE" to "observable" → dashed border', () => {
          const result = deriveControllability('factor-unknown', mockOptions, mockEdges, 'OBSERVABLE')
          expect(result).toBe('observable')
        })

        it('normalizes "CONTROLLABLE" to "controllable" → solid border', () => {
          const result = deriveControllability('factor-unknown', mockOptions, mockEdges, 'CONTROLLABLE')
          expect(result).toBe('controllable')
        })

        it('normalizes " Observable " (whitespace) to "observable"', () => {
          const result = deriveControllability('factor-unknown', mockOptions, mockEdges, ' Observable ')
          expect(result).toBe('observable')
        })

        it('falls back to BFS for invalid normalized value "foo"', () => {
          // factor-unknown is not in interventions or reachable, so returns "unknown"
          const result = deriveControllability('factor-unknown', mockOptions, mockEdges, 'foo')
          expect(result).toBe('unknown')
        })

        it('falls back to BFS for whitespace-only category', () => {
          const result = deriveControllability('factor-1', mockOptions, mockEdges, '   ')
          expect(result).toBe('controllable') // factor-1 is directly controlled
        })
      })

      // Verify fallback never produces observable/external
      describe('fallback logic constraints', () => {
        it('BFS fallback only returns controllable, partial, or unknown', () => {
          // Directly controlled → controllable
          expect(deriveControllability('factor-1', mockOptions, mockEdges)).toBe('controllable')
          // Reachable from controlled → partial
          expect(deriveControllability('factor-3', mockOptions, mockEdges)).toBe('partial')
          // Not reachable → unknown
          expect(deriveControllability('factor-6', mockOptions, mockEdges)).toBe('unknown')
          // No options → unknown
          expect(deriveControllability('factor-1', undefined, mockEdges)).toBe('unknown')
        })
      })
    })
  })

  describe('formatDisplayValue', () => {
    it('returns "—" for undefined value', () => {
      expect(formatDisplayValue(undefined)).toBe('—')
    })

    it('returns "—" for null value', () => {
      expect(formatDisplayValue(null)).toBe('—')
    })

    it('returns "—" for NaN', () => {
      expect(formatDisplayValue(NaN)).toBe('—')
    })

    it('returns "—" for Infinity', () => {
      expect(formatDisplayValue(Infinity)).toBe('—')
    })

    it('formats integer with thousands separator', () => {
      expect(formatDisplayValue(1234567)).toBe('1,234,567')
    })

    it('formats decimal with max 2 decimal places', () => {
      expect(formatDisplayValue(1234.5678)).toBe('1,234.57')
    })

    it('formats decimal with 1 decimal place correctly', () => {
      expect(formatDisplayValue(1234.5)).toBe('1,234.5')
    })

    it('formats zero correctly', () => {
      expect(formatDisplayValue(0)).toBe('0')
    })

    it('formats negative numbers correctly', () => {
      expect(formatDisplayValue(-1234.56)).toBe('-1,234.56')
    })

    it('formats small decimals correctly', () => {
      expect(formatDisplayValue(0.123456)).toBe('0.12')
    })

    it('formats currency values with 2 decimal places', () => {
      expect(formatDisplayValue(1234.5, 'currency')).toBe('1,234.50')
    })

    it('formats $ prefixed unit as currency', () => {
      expect(formatDisplayValue(1234.5, '$')).toBe('1,234.50')
    })

    it('formats £ prefixed unit as currency', () => {
      expect(formatDisplayValue(1234.5, '£')).toBe('1,234.50')
    })

    it('formats € prefixed unit as currency', () => {
      expect(formatDisplayValue(1234.5, '€')).toBe('1,234.50')
    })

    // P1 Fix: Strip .00 for whole number currency values
    it('strips .00 for whole number currency (100000 → 100,000)', () => {
      expect(formatDisplayValue(100000, 'currency')).toBe('100,000')
    })

    it('strips .00 for whole number £ values', () => {
      expect(formatDisplayValue(100000, '£')).toBe('100,000')
    })

    it('keeps decimals for currency when meaningful (49.99)', () => {
      expect(formatDisplayValue(49.99, '£')).toBe('49.99')
    })

    it('strips .00 for 50.00 currency', () => {
      expect(formatDisplayValue(50, '$')).toBe('50')
    })

    // UI Polish Task 1: Percentage formatting tests
    it('formats 0-1 scale value as percentage (0.2 → 20%)', () => {
      expect(formatDisplayValue(0.2, '%')).toBe('20%')
    })

    it('formats 0 as 0%', () => {
      expect(formatDisplayValue(0, '%')).toBe('0%')
    })

    it('formats 1 as 100%', () => {
      expect(formatDisplayValue(1, '%')).toBe('100%')
    })

    it('formats already-percentage value correctly (50 → 50%)', () => {
      expect(formatDisplayValue(50, '%')).toBe('50%')
    })

    it('formats negative 0-1 scale value as percentage (-0.2 → -20%)', () => {
      // Fix: Negative values in [-1,0) should multiply by 100
      expect(formatDisplayValue(-0.2, '%')).toBe('-20%')
    })

    it('formats -1 as -100%', () => {
      expect(formatDisplayValue(-1, '%')).toBe('-100%')
    })

    it('formats negative already-percentage value correctly (-50 → -50%)', () => {
      expect(formatDisplayValue(-50, '%')).toBe('-50%')
    })

    it('handles very small values with precision', () => {
      expect(formatDisplayValue(0.001)).toBe('0')
    })

    it('rounds correctly at boundaries', () => {
      // Note: 1.005 has floating-point representation issues in JS
      // Use 1.006 which rounds correctly
      expect(formatDisplayValue(1.006)).toBe('1.01')
      expect(formatDisplayValue(1.004)).toBe('1')
    })
  })
})
