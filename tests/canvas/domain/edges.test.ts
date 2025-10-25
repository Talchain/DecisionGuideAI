import { describe, it, expect } from 'vitest'
import { shouldShowLabel } from '../../../src/canvas/domain/edges'

describe('shouldShowLabel', () => {
  describe('Custom labels', () => {
    it('always shows custom labels prominently', () => {
      const result = shouldShowLabel('High risk path', 0.5, 2)
      expect(result).toEqual({ show: true, isCustom: true, deEmphasize: false })
    })

    it('shows custom labels even for single edges', () => {
      const result = shouldShowLabel('Main path', 1.0, 1)
      expect(result).toEqual({ show: true, isCustom: true, deEmphasize: false })
    })

    it('shows custom labels even with undefined confidence', () => {
      const result = shouldShowLabel('Custom label', undefined, 2)
      expect(result).toEqual({ show: true, isCustom: true, deEmphasize: false })
    })
  })

  describe('Auto-generated percentage labels', () => {
    it('shows auto-generated labels with de-emphasis for multiple edges', () => {
      const result = shouldShowLabel('50%', 0.5, 2)
      expect(result).toEqual({ show: true, isCustom: false, deEmphasize: true })
    })

    it('hides auto-generated labels for single edges (implicit 100%)', () => {
      const result = shouldShowLabel('100%', 1.0, 1)
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })

    it('hides labels for zero confidence', () => {
      const result = shouldShowLabel('0%', 0, 2)
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })
  })

  describe('Legacy edges (label but no confidence)', () => {
    it('shows legacy percentage labels with de-emphasis', () => {
      const result = shouldShowLabel('60%', undefined, 2)
      expect(result).toEqual({ show: true, isCustom: false, deEmphasize: true })
    })

    it('hides legacy percentage labels for single edges', () => {
      const result = shouldShowLabel('100%', undefined, 1)
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })

    it('hides legacy zero percentage labels', () => {
      const result = shouldShowLabel('0%', undefined, 2)
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })
  })

  describe('Confidence-only edges', () => {
    it('shows confidence as de-emphasized label for multiple edges', () => {
      const result = shouldShowLabel(undefined, 0.75, 2)
      expect(result).toEqual({ show: true, isCustom: false, deEmphasize: true })
    })

    it('hides confidence for single edges', () => {
      const result = shouldShowLabel(undefined, 1.0, 1)
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })

    it('hides zero confidence', () => {
      const result = shouldShowLabel(undefined, 0, 2)
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })
  })

  describe('Empty state', () => {
    it('hides when no label and no confidence', () => {
      const result = shouldShowLabel(undefined, undefined, 2)
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })
  })

  describe('Edge kind handling', () => {
    it('hides deterministic edge auto-generated labels', () => {
      const result = shouldShowLabel('100%', 1.0, 1, 'deterministic')
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })

    it('shows custom labels even for deterministic edges', () => {
      const result = shouldShowLabel('Always happens', 1.0, 1, 'deterministic')
      expect(result).toEqual({ show: true, isCustom: true, deEmphasize: false })
    })

    it('shows influence-weight labels even for single edges', () => {
      const result = shouldShowLabel('50%', 0.5, 1, 'influence-weight')
      expect(result).toEqual({ show: true, isCustom: false, deEmphasize: true })
    })

    it('hides zero influence-weight labels', () => {
      const result = shouldShowLabel('0%', 0, 2, 'influence-weight')
      expect(result).toEqual({ show: false, isCustom: false, deEmphasize: false })
    })

    it('uses standard probability rules for decision-probability', () => {
      const result = shouldShowLabel('50%', 0.5, 2, 'decision-probability')
      expect(result).toEqual({ show: true, isCustom: false, deEmphasize: true })
    })

    it('uses standard probability rules for risk-likelihood', () => {
      const result = shouldShowLabel('30%', 0.3, 2, 'risk-likelihood')
      expect(result).toEqual({ show: true, isCustom: false, deEmphasize: true })
    })
  })
})
