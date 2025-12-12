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
  logistic,
  validateFunctionParams,
  evaluateEdgeFunction,
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
  })
})
