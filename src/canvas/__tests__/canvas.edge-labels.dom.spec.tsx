/**
 * Edge labels integration tests
 * Tests blueprint metadata pipeline (weight, belief, provenance) → readable labels
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { getEdgeLabel, describeEdge, formatNumericLabel, setEdgeLabelMode, getEdgeLabelMode } from '../domain/edgeLabels'
import { cleanupCanvas } from './__helpers__/renderCanvas'

describe('Canvas: Edge labels (blueprint metadata → UI)', () => {
  beforeEach(() => {
    cleanupCanvas()
    // Reset to human mode for consistent tests
    setEdgeLabelMode('human')
  })

  describe('Human-readable labels (default)', () => {
    it('generates "Strong boost" for high weight + high belief (no uncertain)', () => {
      const weight = 0.8   // Strong (>= 0.7)
      const belief = 0.9   // High (>= 0.8)

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Strong boost')
      expect(result.label).not.toContain('uncertain')
      expect(result.tooltip).toContain('Weight: 0.80')
      expect(result.tooltip).toContain('Belief: 90%')
    })

    it('generates "Moderate boost (uncertain)" for moderate weight + low belief', () => {
      const weight = 0.5   // Moderate (0.3 <= w < 0.7)
      const belief = 0.4   // Low (< 0.6)

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Moderate boost (uncertain)')
      expect(result.tooltip).toContain('Weight: 0.50')
      expect(result.tooltip).toContain('Belief: 40%')
    })

    it('generates "Strong drag" for negative weight + high belief', () => {
      const weight = -0.75  // Strong negative
      const belief = 0.85   // High confidence

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Strong drag')
      expect(result.label).not.toContain('uncertain')
      expect(result.tooltip).toContain('Weight: −0.75') // Proper minus sign
      expect(result.tooltip).toContain('Belief: 85%')
    })

    it('generates "Weak boost (uncertain)" for low weight + missing belief', () => {
      const weight = 0.2   // Weak (< 0.3)
      const belief = undefined  // Missing belief → uncertain

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Weak boost (uncertain)')
      expect(result.tooltip).toContain('Weight: 0.20')
      expect(result.tooltip).toContain('Belief: not set')
    })

    it('generates "Moderate drag (uncertain)" for negative moderate weight + low belief', () => {
      const weight = -0.5  // Moderate negative
      const belief = 0.5   // Low (< 0.6)

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Moderate drag (uncertain)')
    })

    it('generates "Weak drag" for small negative weight + high belief', () => {
      const weight = -0.25  // Weak
      const belief = 0.9    // High

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Weak drag')
    })

    it('treats medium confidence (0.6-0.8) as certain (no qualifier)', () => {
      const weight = 0.6   // Moderate
      const belief = 0.7   // Medium (0.6 <= b < 0.8)

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Moderate boost')
      expect(result.label).not.toContain('uncertain')
    })
  })

  describe('Numeric labels mode', () => {
    beforeEach(() => {
      setEdgeLabelMode('numeric')
    })

    it('generates numeric format with belief', () => {
      const weight = 0.6
      const belief = 0.85

      const label = formatNumericLabel(weight, belief)

      expect(label).toBe('w 0.60 • b 85%')
    })

    it('generates numeric format for negative weight', () => {
      const weight = -0.7
      const belief = 0.9

      const label = formatNumericLabel(weight, belief)

      expect(label).toBe('w −0.70 • b 90%') // Proper minus sign
    })

    it('generates numeric format without belief when missing', () => {
      const weight = 0.5
      const belief = undefined

      const label = formatNumericLabel(weight, belief)

      expect(label).toBe('w 0.50')
      expect(label).not.toContain('b')
    })

    it('uses numeric mode via getEdgeLabel when mode is set', () => {
      const weight = 0.6
      const belief = 0.85

      const result = getEdgeLabel(weight, belief)

      expect(result.label).toBe('w 0.60 • b 85%')
    })
  })

  describe('Mode switching', () => {
    it('defaults to human mode', () => {
      const mode = getEdgeLabelMode()

      expect(mode).toBe('human')
    })

    it('switches to numeric mode when set', () => {
      setEdgeLabelMode('numeric')

      const mode = getEdgeLabelMode()

      expect(mode).toBe('numeric')
    })

    it('persists mode to localStorage', () => {
      setEdgeLabelMode('numeric')

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

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Weak boost')
    })

    it('handles weight of exactly 0.3 (boundary)', () => {
      const weight = 0.3
      const belief = 0.8

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Moderate boost')
    })

    it('handles weight of exactly 0.7 (boundary)', () => {
      const weight = 0.7
      const belief = 0.8

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Strong boost')
    })

    it('handles belief of exactly 0.6 (boundary)', () => {
      const weight = 0.5
      const belief = 0.6

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Moderate boost')
      expect(result.label).not.toContain('uncertain')
    })

    it('handles belief of exactly 0.8 (boundary)', () => {
      const weight = 0.5
      const belief = 0.8

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Moderate boost')
      expect(result.label).not.toContain('uncertain')
    })

    it('handles belief of 0', () => {
      const weight = 0.5
      const belief = 0

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Moderate boost (uncertain)')
    })

    it('handles belief of 1', () => {
      const weight = 0.5
      const belief = 1.0

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Moderate boost')
    })

    it('handles very small weight', () => {
      const weight = 0.01
      const belief = 0.9

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Weak boost')
    })

    it('handles maximum weight', () => {
      const weight = 1.0
      const belief = 1.0

      const result = describeEdge(weight, belief)

      expect(result.label).toBe('Strong boost')
    })
  })
})
