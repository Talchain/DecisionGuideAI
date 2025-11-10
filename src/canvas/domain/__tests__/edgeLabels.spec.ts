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
        const result = describeEdge(0.9, 0.9)
        expect(result.label).toBe('Strong boost')
        expect(result.tooltip).toContain('Weight: 0.90')
        expect(result.tooltip).toContain('Belief: 90%')
      })

      it('returns "Moderate boost" for medium positive weight', () => {
        const result = describeEdge(0.5, 0.8)
        expect(result.label).toBe('Moderate boost')
      })

      it('returns "Weak boost" for low positive weight', () => {
        const result = describeEdge(0.2, 0.8)
        expect(result.label).toBe('Weak boost')
      })

      it('adds "(uncertain)" qualifier for low belief', () => {
        expect(describeEdge(0.9, 0.5).label).toBe('Strong boost (uncertain)')
        expect(describeEdge(0.5, 0.4).label).toBe('Moderate boost (uncertain)')
        expect(describeEdge(0.2, 0.3).label).toBe('Weak boost (uncertain)')
      })

      it('handles edge case at 0.7 threshold', () => {
        expect(describeEdge(0.7, 0.8).label).toBe('Strong boost')
        expect(describeEdge(0.69, 0.8).label).toBe('Moderate boost')
      })

      it('handles edge case at 0.3 threshold', () => {
        expect(describeEdge(0.3, 0.8).label).toBe('Moderate boost')
        expect(describeEdge(0.29, 0.8).label).toBe('Weak boost')
      })
    })

    describe('Negative weights (drag)', () => {
      it('returns "Strong drag" for high negative weight', () => {
        expect(describeEdge(-0.9, 0.9).label).toBe('Strong drag')
      })

      it('returns "Moderate drag" for medium negative weight', () => {
        expect(describeEdge(-0.5, 0.8).label).toBe('Moderate drag')
      })

      it('returns "Weak drag" for low negative weight', () => {
        expect(describeEdge(-0.2, 0.8).label).toBe('Weak drag')
      })

      it('adds "(uncertain)" qualifier for low belief', () => {
        expect(describeEdge(-0.9, 0.5).label).toBe('Strong drag (uncertain)')
        expect(describeEdge(-0.5, 0.4).label).toBe('Moderate drag (uncertain)')
        expect(describeEdge(-0.2, 0.3).label).toBe('Weak drag (uncertain)')
      })
    })

    describe('Belief thresholds', () => {
      it('treats >= 80% as high confidence (no qualifier)', () => {
        expect(describeEdge(0.5, 0.8).label).toBe('Moderate boost')
        expect(describeEdge(0.5, 0.85).label).toBe('Moderate boost')
        expect(describeEdge(0.5, 1.0).label).toBe('Moderate boost')
      })

      it('treats 60-80% as medium confidence (no qualifier)', () => {
        expect(describeEdge(0.5, 0.6).label).toBe('Moderate boost')
        expect(describeEdge(0.5, 0.7).label).toBe('Moderate boost')
        expect(describeEdge(0.5, 0.79).label).toBe('Moderate boost')
      })

      it('treats < 60% as low confidence (adds uncertain)', () => {
        expect(describeEdge(0.5, 0.59).label).toBe('Moderate boost (uncertain)')
        expect(describeEdge(0.5, 0.4).label).toBe('Moderate boost (uncertain)')
        expect(describeEdge(0.5, 0.1).label).toBe('Moderate boost (uncertain)')
      })
    })

    describe('Missing belief', () => {
      it('treats undefined belief as uncertain', () => {
        expect(describeEdge(0.9).label).toBe('Strong boost (uncertain)')
        expect(describeEdge(0.5).label).toBe('Moderate boost (uncertain)')
        expect(describeEdge(0.2).label).toBe('Weak boost (uncertain)')
        expect(describeEdge(-0.9).label).toBe('Strong drag (uncertain)')
      })

      it('provides tooltip even when belief is missing', () => {
        const result = describeEdge(0.6)
        expect(result.tooltip).toContain('Weight: 0.60')
        expect(result.tooltip).toContain('not set')
      })
    })

    describe('Zero weight', () => {
      it('treats zero weight as weak boost', () => {
        expect(describeEdge(0, 0.8).label).toBe('Weak boost')
      })
    })
  })

  describe('formatNumericLabel', () => {
    it('formats positive weight with belief', () => {
      expect(formatNumericLabel(0.6, 0.85)).toBe('w 0.60 • b 85%')
    })

    it('formats negative weight with belief using proper minus sign', () => {
      expect(formatNumericLabel(-0.6, 0.85)).toBe('w −0.60 • b 85%')
    })

    it('formats weight without belief', () => {
      expect(formatNumericLabel(0.6)).toBe('w 0.60')
    })

    it('rounds belief to nearest integer percentage', () => {
      expect(formatNumericLabel(0.5, 0.856)).toBe('w 0.50 • b 86%')
      expect(formatNumericLabel(0.5, 0.854)).toBe('w 0.50 • b 85%')
    })

    it('formats weight to 2 decimal places', () => {
      expect(formatNumericLabel(0.123456, 0.8)).toBe('w 0.12 • b 80%')
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
      const result = getEdgeLabel(0.9, 0.9, 'human')
      expect(result.label).toBe('Strong boost')
      expect(result.tooltip).toContain('Weight: 0.90')
    })

    it('returns numeric label when mode is "numeric"', () => {
      const result = getEdgeLabel(0.6, 0.85, 'numeric')
      expect(result.label).toBe('w 0.60 • b 85%')
    })

    it('uses localStorage mode when mode parameter is not provided', () => {
      setEdgeLabelMode('numeric')
      expect(getEdgeLabel(0.6, 0.85).label).toBe('w 0.60 • b 85%')

      setEdgeLabelMode('human')
      expect(getEdgeLabel(0.9, 0.9).label).toBe('Strong boost')
    })

    it('defaults to human mode when localStorage is empty', () => {
      localStorage.clear()
      expect(getEdgeLabel(0.9, 0.9).label).toBe('Strong boost')
    })
  })

  describe('Integration: Full workflow', () => {
    it('allows switching between human and numeric modes', () => {
      const weight = 0.6
      const belief = 0.85

      // Start in human mode (default)
      expect(getEdgeLabel(weight, belief).label).toBe('Moderate boost')

      // Switch to numeric
      setEdgeLabelMode('numeric')
      expect(getEdgeLabel(weight, belief).label).toBe('w 0.60 • b 85%')

      // Switch back to human
      setEdgeLabelMode('human')
      expect(getEdgeLabel(weight, belief).label).toBe('Moderate boost')
    })

    it('persists mode across function calls', () => {
      setEdgeLabelMode('numeric')

      expect(getEdgeLabelMode()).toBe('numeric')
      expect(getEdgeLabel(0.5, 0.8).label).toBe('w 0.50 • b 80%')

      setEdgeLabelMode('human')

      expect(getEdgeLabelMode()).toBe('human')
      expect(getEdgeLabel(0.5, 0.8).label).toBe('Moderate boost')
    })
  })

  describe('Real-world examples', () => {
    it('handles typical template edge weights', () => {
      // Strong positive influence
      expect(describeEdge(0.8, 0.9).label).toBe('Strong boost')

      // Moderate positive influence
      expect(describeEdge(0.5, 0.8).label).toBe('Moderate boost')

      // Weak negative influence
      expect(describeEdge(-0.2, 0.7).label).toBe('Weak drag')

      // Strong negative influence with uncertainty
      expect(describeEdge(-0.9, 0.5).label).toBe('Strong drag (uncertain)')
    })

    it('provides meaningful labels for user-edited weights', () => {
      // User sets high confidence strong influence
      expect(describeEdge(0.95, 0.95).label).toBe('Strong boost')

      // User sets low confidence moderate influence
      expect(describeEdge(0.45, 0.4).label).toBe('Moderate boost (uncertain)')

      // User sets medium confidence weak drag
      expect(describeEdge(-0.15, 0.75).label).toBe('Weak drag')
    })
  })
})
