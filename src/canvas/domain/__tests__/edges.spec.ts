/**
 * Edge domain tests
 *
 * Tests for Brief 5: EdgeV2 Schema, dual beliefs, functional forms
 */

import { describe, it, expect } from 'vitest'
import {
  migrateEdgeDataToV4,
  needsMigrationToV4,
  computeEffectiveWeight,
  sampleDualBelief,
  noisyOr,
  noisyAndNot,
  logistic,
  validateFunctionParams,
  evaluateEdgeFunction,
  validateNoisyAndNotUsage,
  formRequiresBinaryValidation,
  FORM_DISPLAY_NAMES,
  DEFAULT_EDGE_DATA,
  type EdgeData,
} from '../edges'

describe('EdgeV2 Schema', () => {
  describe('DEFAULT_EDGE_DATA', () => {
    it('should have schemaVersion 4', () => {
      expect(DEFAULT_EDGE_DATA.schemaVersion).toBe(4)
    })

    it('should have dual belief defaults', () => {
      expect(DEFAULT_EDGE_DATA.beliefExists).toBe(0.7)
      expect(DEFAULT_EDGE_DATA.beliefStrength).toBe(0.5)
    })
  })
})

describe('Brief 5.2: Migration v3→v4', () => {
  it('should migrate v3 data to v4 with dual beliefs', () => {
    const v3Data: Partial<EdgeData> = {
      belief: 0.5,
      schemaVersion: 3,
    }

    const result = migrateEdgeDataToV4(v3Data)

    expect(result.schemaVersion).toBe(4)
    // beliefExists = sqrt(0.5) ≈ 0.707
    expect(result.beliefExists).toBeCloseTo(Math.sqrt(0.5), 2)
    // beliefStrength = 0.5
    expect(result.beliefStrength).toBe(0.5)
  })

  it('should preserve existing v4 data', () => {
    const v4Data: Partial<EdgeData> = {
      beliefExists: 0.9,
      beliefStrength: 0.8,
      schemaVersion: 4,
    }

    const result = migrateEdgeDataToV4(v4Data)

    expect(result.beliefExists).toBe(0.9)
    expect(result.beliefStrength).toBe(0.8)
  })

  it('should detect migration needed for v3', () => {
    expect(needsMigrationToV4({ schemaVersion: 3 })).toBe(true)
    expect(needsMigrationToV4({ schemaVersion: 4 })).toBe(false)
    expect(needsMigrationToV4({})).toBe(true) // defaults to 3
  })
})

describe('Brief 5.3: Sampling Rules', () => {
  describe('computeEffectiveWeight', () => {
    it('should multiply base weight by dual beliefs', () => {
      const result = computeEffectiveWeight(1.0, 0.8, 0.5)
      expect(result).toBe(0.4) // 1.0 * 0.8 * 0.5
    })

    it('should return 0 when beliefExists is 0', () => {
      const result = computeEffectiveWeight(1.0, 0, 1.0)
      expect(result).toBe(0)
    })

    it('should clamp values to [0,1]', () => {
      const result = computeEffectiveWeight(2.0, 1.5, 1.5)
      expect(result).toBe(1) // clamped to 1 * 1 * 1
    })
  })

  describe('sampleDualBelief', () => {
    it('should return active=true when random < beliefExists', () => {
      const result = sampleDualBelief(0.8, 0.5, 0.5) // 0.5 < 0.8
      expect(result.active).toBe(true)
      expect(result.strength).toBe(0.5)
    })

    it('should return active=false when random >= beliefExists', () => {
      const result = sampleDualBelief(0.3, 0.5, 0.5) // 0.5 >= 0.3
      expect(result.active).toBe(false)
      expect(result.strength).toBe(0)
    })
  })
})

describe('Brief 5.4: Noisy-OR', () => {
  it('should return leak probability when x=0', () => {
    const result = noisyOr(0, 0.7, 0.1)
    expect(result).toBeCloseTo(0.1, 5) // leak only
  })

  it('should return full effect when x=1 and strength=1', () => {
    const result = noisyOr(1, 1.0, 0)
    expect(result).toBe(1)
  })

  it('should compute correct intermediate values', () => {
    // P(Y|X=0.5) = 1 - (1-0.1) * (1 - 0.8 * 0.5)
    // = 1 - 0.9 * 0.6 = 1 - 0.54 = 0.46
    const result = noisyOr(0.5, 0.8, 0.1)
    expect(result).toBeCloseTo(0.46, 2)
  })
})

describe('Brief 5.5: Logistic', () => {
  it('should return ~0.5 at midpoint with zero bias', () => {
    const result = logistic(0.5, 0, 4)
    expect(result).toBeCloseTo(0.5, 1)
  })

  it('should approach 0 for low inputs', () => {
    const result = logistic(0, 0, 4)
    expect(result).toBeLessThan(0.1)
  })

  it('should approach 1 for high inputs', () => {
    const result = logistic(1, 0, 4)
    expect(result).toBeGreaterThan(0.9)
  })

  it('should shift left with negative bias', () => {
    const resultNoBias = logistic(0.3, 0, 4)
    const resultNegBias = logistic(0.3, -1, 4)
    expect(resultNegBias).toBeGreaterThan(resultNoBias)
  })
})

describe('Brief 5.6: Validation', () => {
  describe('validateFunctionParams', () => {
    it('should accept linear without params', () => {
      const result = validateFunctionParams('linear')
      expect(result.valid).toBe(true)
    })

    it('should validate noisy_or params', () => {
      const valid = validateFunctionParams('noisy_or', {
        noisyOrStrength: 0.7,
        noisyOrLeak: 0.05,
      })
      expect(valid.valid).toBe(true)

      const invalid = validateFunctionParams('noisy_or', {
        noisyOrStrength: 1.5, // out of range
      })
      expect(invalid.valid).toBe(false)
    })

    it('should validate logistic params', () => {
      const valid = validateFunctionParams('logistic', {
        logisticBias: 0,
        logisticScale: 4,
      })
      expect(valid.valid).toBe(true)

      const invalid = validateFunctionParams('logistic', {
        logisticBias: -10, // out of range
      })
      expect(invalid.valid).toBe(false)
    })
  })

  describe('evaluateEdgeFunction', () => {
    it('should evaluate linear correctly', () => {
      expect(evaluateEdgeFunction(0.5, 'linear')).toBe(0.5)
    })

    it('should evaluate threshold correctly', () => {
      expect(evaluateEdgeFunction(0.4, 'threshold', { threshold: 0.5 })).toBe(0)
      expect(evaluateEdgeFunction(0.6, 'threshold', { threshold: 0.5 })).toBe(1)
    })

    it('should evaluate noisy_or correctly', () => {
      const result = evaluateEdgeFunction(0.5, 'noisy_or', {
        noisyOrStrength: 0.8,
        noisyOrLeak: 0.1,
      })
      expect(result).toBeCloseTo(0.46, 2)
    })

    it('should evaluate logistic correctly', () => {
      const result = evaluateEdgeFunction(0.5, 'logistic', {
        logisticBias: 0,
        logisticScale: 4,
      })
      expect(result).toBeCloseTo(0.5, 1)
    })

    it('should evaluate noisy_and_not correctly', () => {
      // P(Y|X=0) = 0.8 (base rate with no prevention)
      const resultNoPrevent = evaluateEdgeFunction(0, 'noisy_and_not', {
        noisyAndNotBaseRate: 0.8,
        noisyAndNotStrength: 0.7,
      })
      expect(resultNoPrevent).toBeCloseTo(0.8, 2)

      // P(Y|X=1) = 0.8 * (1 - 0.7 * 1) = 0.8 * 0.3 = 0.24
      const resultFullPrevent = evaluateEdgeFunction(1, 'noisy_and_not', {
        noisyAndNotBaseRate: 0.8,
        noisyAndNotStrength: 0.7,
      })
      expect(resultFullPrevent).toBeCloseTo(0.24, 2)
    })
  })
})

// =============================================================================
// Brief 19: Noisy-AND-NOT Tests
// =============================================================================

describe('Brief 19: Noisy-AND-NOT', () => {
  describe('noisyAndNot function', () => {
    it('should return base rate when prevention is inactive (x=0)', () => {
      const result = noisyAndNot(0, 0.8, 0.7)
      expect(result).toBeCloseTo(0.8, 5)
    })

    it('should reduce probability when prevention is active', () => {
      // P(Y|X=1) = 0.8 * (1 - 0.7 * 1) = 0.8 * 0.3 = 0.24
      const result = noisyAndNot(1, 0.8, 0.7)
      expect(result).toBeCloseTo(0.24, 2)
    })

    it('should return 0 when prevention strength is 1 and x=1', () => {
      // Complete blocking: 0.8 * (1 - 1 * 1) = 0
      const result = noisyAndNot(1, 0.8, 1.0)
      expect(result).toBeCloseTo(0, 5)
    })

    it('should have no effect when strength is 0', () => {
      // No prevention effect: 0.8 * (1 - 0 * 1) = 0.8
      const result = noisyAndNot(1, 0.8, 0)
      expect(result).toBeCloseTo(0.8, 5)
    })

    it('should compute correct intermediate values', () => {
      // P(Y|X=0.5) = 0.8 * (1 - 0.7 * 0.5) = 0.8 * 0.65 = 0.52
      const result = noisyAndNot(0.5, 0.8, 0.7)
      expect(result).toBeCloseTo(0.52, 2)
    })

    it('should clamp inputs to [0,1]', () => {
      // Out of range inputs should be clamped
      const result1 = noisyAndNot(2, 0.8, 0.7) // x > 1 clamped to 1
      expect(result1).toBeCloseTo(0.24, 2)

      const result2 = noisyAndNot(-0.5, 0.8, 0.7) // x < 0 clamped to 0
      expect(result2).toBeCloseTo(0.8, 2)
    })
  })

  describe('FORM_DISPLAY_NAMES', () => {
    it('should have display name for noisy_and_not', () => {
      expect(FORM_DISPLAY_NAMES.noisy_and_not).toBeDefined()
      expect(FORM_DISPLAY_NAMES.noisy_and_not.name).toBe('Preventative')
      expect(FORM_DISPLAY_NAMES.noisy_and_not.icon).toBe('⊖')
    })

    it('should have short description for noisy_and_not', () => {
      expect(FORM_DISPLAY_NAMES.noisy_and_not.shortDescription).toContain('block')
    })
  })

  describe('validateFunctionParams for noisy_and_not', () => {
    it('should accept valid noisy_and_not params', () => {
      const result = validateFunctionParams('noisy_and_not', {
        noisyAndNotBaseRate: 0.8,
        noisyAndNotStrength: 0.7,
      })
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject out-of-range base rate', () => {
      const result = validateFunctionParams('noisy_and_not', {
        noisyAndNotBaseRate: 1.5, // > 1
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('base rate'))).toBe(true)
    })

    it('should reject out-of-range strength', () => {
      const result = validateFunctionParams('noisy_and_not', {
        noisyAndNotStrength: -0.5, // < 0
      })
      expect(result.valid).toBe(false)
      expect(result.errors.some(e => e.includes('strength'))).toBe(true)
    })
  })

  describe('validateNoisyAndNotUsage', () => {
    it('should return valid for binary-compatible node types', () => {
      const result = validateNoisyAndNotUsage('risk', 'outcome')
      expect(result.valid).toBe(true)
      expect(result.warning).toBeUndefined()
    })

    it('should warn for non-binary source node type', () => {
      const result = validateNoisyAndNotUsage('factor', 'outcome')
      expect(result.valid).toBe(false)
      expect(result.warning).toContain('factor')
    })

    it('should warn for non-binary target node type', () => {
      const result = validateNoisyAndNotUsage('risk', 'factor')
      expect(result.valid).toBe(false)
      expect(result.warning).toContain('factor')
    })

    it('should provide suggestions when validation fails', () => {
      const result = validateNoisyAndNotUsage('factor', 'factor')
      expect(result.suggestion).toBeDefined()
    })
  })

  describe('formRequiresBinaryValidation', () => {
    it('should return true for noisy_and_not', () => {
      expect(formRequiresBinaryValidation('noisy_and_not')).toBe(true)
    })

    it('should return true for noisy_or', () => {
      expect(formRequiresBinaryValidation('noisy_or')).toBe(true)
    })

    it('should return false for other forms', () => {
      expect(formRequiresBinaryValidation('linear')).toBe(false)
      expect(formRequiresBinaryValidation('threshold')).toBe(false)
      expect(formRequiresBinaryValidation('logistic')).toBe(false)
    })
  })
})
