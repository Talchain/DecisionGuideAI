/**
 * canvasSignals — typed factor/risk/goal guards + Structure + Coverage
 * score derivations.
 *
 * Per P1.6 (no `as any`) and P1.1 (genuine derivation) review feedback.
 */

import { describe, it, expect } from 'vitest'
import {
  isFactorNode,
  isRiskNode,
  isGoalNode,
  deriveStructureScore,
  deriveCoverageScore,
} from '../canvasSignals'

describe('canvasSignals — typed node guards', () => {
  describe('isFactorNode', () => {
    it('recognises legacy React Flow type === "factor"', () => {
      expect(isFactorNode({ id: 'n1', type: 'factor' })).toBe(true)
    })

    it('recognises schema-v2 data.kind === "factor" when type is something else', () => {
      expect(isFactorNode({ id: 'n2', type: undefined, data: { kind: 'factor' } })).toBe(true)
      expect(isFactorNode({ id: 'n3', type: 'custom', data: { kind: 'factor' } })).toBe(true)
    })

    it('rejects non-factor nodes', () => {
      expect(isFactorNode({ id: 'g1', type: 'goal' })).toBe(false)
      expect(isFactorNode({ id: 'g2', type: 'goal', data: { kind: 'goal' } })).toBe(false)
      expect(isFactorNode({ id: 'o1', type: 'option' })).toBe(false)
      expect(isFactorNode({ id: 'r1', type: 'risk' })).toBe(false)
    })

    it('handles missing or malformed data shapes without throwing', () => {
      expect(isFactorNode({ id: 'n4' })).toBe(false)
      expect(isFactorNode({ id: 'n5', data: null })).toBe(false)
      expect(isFactorNode({ id: 'n6', data: undefined })).toBe(false)
      expect(isFactorNode({ id: 'n7', data: 42 })).toBe(false)
      expect(isFactorNode({ id: 'n8', data: 'string' })).toBe(false)
      expect(isFactorNode({ id: 'n9', data: {} })).toBe(false)
      expect(isFactorNode({ id: 'n10', data: { kind: undefined } })).toBe(false)
      expect(isFactorNode({ id: 'n11', data: { kind: 'option' } })).toBe(false)
    })
  })

  describe('isRiskNode', () => {
    it('matches type or data.kind', () => {
      expect(isRiskNode({ id: 'r1', type: 'risk' })).toBe(true)
      expect(isRiskNode({ id: 'r2', data: { kind: 'risk' } })).toBe(true)
    })

    it('rejects non-risk nodes', () => {
      expect(isRiskNode({ id: 'n1', type: 'factor' })).toBe(false)
      expect(isRiskNode({ id: 'n2', data: {} })).toBe(false)
    })
  })

  describe('isGoalNode', () => {
    it('matches type or data.kind', () => {
      expect(isGoalNode({ id: 'g1', type: 'goal' })).toBe(true)
      expect(isGoalNode({ id: 'g2', data: { kind: 'goal' } })).toBe(true)
    })

    it('rejects non-goal nodes', () => {
      expect(isGoalNode({ id: 'n1', type: 'factor' })).toBe(false)
      expect(isGoalNode({ id: 'n2', data: { kind: 'option' } })).toBe(false)
    })
  })
})

describe('deriveStructureScore', () => {
  it('all four signals present → 1.0', () => {
    expect(deriveStructureScore({
      hasGoal: true, hasMultipleOptions: true, hasFactors: true, hasConnections: true,
    })).toBe(1)
  })

  it('none present → 0', () => {
    expect(deriveStructureScore({
      hasGoal: false, hasMultipleOptions: false, hasFactors: false, hasConnections: false,
    })).toBe(0)
  })

  it('each signal contributes 0.25', () => {
    expect(deriveStructureScore({
      hasGoal: true, hasMultipleOptions: false, hasFactors: false, hasConnections: false,
    })).toBe(0.25)
    expect(deriveStructureScore({
      hasGoal: true, hasMultipleOptions: true, hasFactors: false, hasConnections: false,
    })).toBe(0.5)
    expect(deriveStructureScore({
      hasGoal: true, hasMultipleOptions: true, hasFactors: true, hasConnections: false,
    })).toBe(0.75)
  })
})

describe('deriveCoverageScore', () => {
  it('all four signals present → 1.0', () => {
    expect(deriveCoverageScore({
      hasMultipleOptions: true, hasRisks: true, hasBaseline: true, hasGoalThreshold: true,
    })).toBe(1)
  })

  it('none present → 0', () => {
    expect(deriveCoverageScore({
      hasMultipleOptions: false, hasRisks: false, hasBaseline: false, hasGoalThreshold: false,
    })).toBe(0)
  })

  it('each signal contributes 0.25', () => {
    expect(deriveCoverageScore({
      hasMultipleOptions: true, hasRisks: false, hasBaseline: false, hasGoalThreshold: false,
    })).toBe(0.25)
    expect(deriveCoverageScore({
      hasMultipleOptions: true, hasRisks: true, hasBaseline: false, hasGoalThreshold: false,
    })).toBe(0.5)
    expect(deriveCoverageScore({
      hasMultipleOptions: true, hasRisks: true, hasBaseline: true, hasGoalThreshold: false,
    })).toBe(0.75)
  })
})
