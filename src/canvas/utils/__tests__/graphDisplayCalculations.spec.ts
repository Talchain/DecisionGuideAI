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
  getRiskSeverityColors,
  getControllabilityBorderStyle,
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

    it('uses defaults for undefined strength (1.0)', () => {
      const importance = calculateEdgeImportance(0.9, undefined, 0.8)
      expect(importance).toBe(0.9 * 1.0 * 0.8)
    })

    it('uses defaults for undefined goal sensitivity (0.5)', () => {
      const importance = calculateEdgeImportance(0.9, 2.0, undefined)
      expect(importance).toBe(0.9 * 2.0 * 0.5)
    })

    it('uses all defaults when all values undefined', () => {
      const importance = calculateEdgeImportance(undefined, undefined, undefined)
      expect(importance).toBe(1.0 * 1.0 * 0.5)
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

    it('returns "8,4" (dashed) for 30-70% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.5)
      expect(lineStyle).toBe('8,4')
    })

    it('returns "8,4" (dashed) for exactly 70% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.7)
      expect(lineStyle).toBe('8,4')
    })

    it('returns "8,4" (dashed) for exactly 30% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.3)
      expect(lineStyle).toBe('8,4')
    })

    it('returns "2,2" (dotted) for <30% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.29)
      expect(lineStyle).toBe('2,2')
    })

    it('returns "2,2" (dotted) for very low certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0.05)
      expect(lineStyle).toBe('2,2')
    })

    it('returns "2,2" (dotted) for 0% certainty', () => {
      const lineStyle = existenceCertaintyToLineStyle(0)
      expect(lineStyle).toBe('2,2')
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

    it('returns red classes for high severity', () => {
      const colors = getRiskSeverityColors('high')
      expect(colors).toEqual({
        bg: 'bg-red-100',
        border: 'border-red-500',
        text: 'text-red-900',
      })
    })

    it('returns darker red classes for critical severity', () => {
      const colors = getRiskSeverityColors('critical')
      expect(colors).toEqual({
        bg: 'bg-red-200',
        border: 'border-red-600',
        text: 'text-red-950',
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

    it('returns "border-dotted" for external', () => {
      const style = getControllabilityBorderStyle('external')
      expect(style).toBe('border-dotted')
    })

    it('returns "border-solid" (default) for undefined', () => {
      const style = getControllabilityBorderStyle(undefined)
      expect(style).toBe('border-solid')
    })
  })
})
