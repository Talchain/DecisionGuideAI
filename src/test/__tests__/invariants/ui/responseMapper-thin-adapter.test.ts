/**
 * responseMapper.ts Thin Adapter Invariants
 *
 * ============================================================================
 * ARCHITECTURAL RULE
 * ============================================================================
 *
 * The data boundary between API responses and UI display has TWO layers:
 *
 * 1. THIN ADAPTER: src/adapters/plot/v2/responseMapper.ts
 *    - pickFactorSensitivityForUi() - MUST be thin adapter only
 *    - Routes data to typed mappers
 *    - Passes through values unchanged
 *    - Restructures object shapes (rename keys, nest/flatten)
 *
 * 2. TYPED MAPPERS: src/lib/mappers/
 *    - Semantic transforms ARE allowed here
 *    - All transforms documented and tested
 *    - Contract tests verify behavior
 *
 * This separation exists because P0-1 was caused by pickFactorSensitivityForUi()
 * doing semantic work (dropping importance_score, mixing fallback chains).
 *
 * ============================================================================
 * FORBIDDEN OPERATIONS in pickFactorSensitivityForUi()
 * ============================================================================
 *
 * 1. Numeric scaling: * 100, / 100, * 1000, / 1000
 * 2. Math operations: Math.round, Math.floor, Math.ceil, Math.max, Math.min
 *    (Exception: Math.abs() for threshold detection in hasRealData is allowed)
 * 3. Fallback chains for different semantic types:
 *    - BAD: sensitivity_score ?? importance_score (different semantics)
 *    - OK:  sensitivity_score ?? elasticity (same semantic meaning)
 * 4. Clamping patterns: value < min ? min : value > max ? max : value
 * 5. Default value injection: field ?? 0 (for numeric passthrough fields)
 *
 * ============================================================================
 * ALLOWED OPERATIONS in pickFactorSensitivityForUi()
 * ============================================================================
 *
 * 1. Object restructuring: { factor_id: f.node_id }
 * 2. Type assertions: (f.field as number)
 * 3. Array operations: map, filter (for routing, not transformation)
 * 4. Nullish coalescing for same-type aliases: f.factor_id ?? f.node_id
 * 5. String operations: for non-numeric fields
 * 6. Direction normalization: 'negative' ? 'negative' : 'positive'
 * 7. Math.abs() ONLY in hasRealData threshold check (> 0.001)
 *
 * ============================================================================
 * WHY THIS MATTERS
 * ============================================================================
 *
 * When semantic transforms are scattered across adapter code:
 * - Bugs are hard to find (P0-1 was in obscure adapter function)
 * - No single source of truth for data contracts
 * - Tests don't know what to verify
 *
 * When semantic transforms are isolated in typed mappers:
 * - One place to look for transform logic
 * - Contract tests verify exact behavior
 * - Adapters are simple routing code
 *
 * ============================================================================
 */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { join } from 'path'
import { pickFactorSensitivityForUi } from '../../../../adapters/plot/v2/responseMapper'
import type { V2RunResponse } from '../../../../adapters/plot/v2/types'

// =============================================================================
// Static Analysis Tests
// =============================================================================

describe('responseMapper Thin Adapter Invariants', () => {
  // Read the source file for static analysis
  const responseMapperPath = join(
    __dirname,
    '../../../../adapters/plot/v2/responseMapper.ts'
  )
  const sourceCode = readFileSync(responseMapperPath, 'utf-8')

  // Extract pickFactorSensitivityForUi function body for focused analysis
  const pickFactorFunctionMatch = sourceCode.match(
    /export function pickFactorSensitivityForUi\([\s\S]*?\n\}/
  )
  const pickFactorFunction = pickFactorFunctionMatch?.[0] ?? ''

  describe('static analysis: forbidden patterns in pickFactorSensitivityForUi', () => {
    it('should NOT contain numeric scaling (* 100, / 100)', () => {
      // These patterns indicate semantic transform (scale conversion)
      const scalingPatterns = [
        /\*\s*100\b/, // * 100
        /\/\s*100\b/, // / 100
        /\*\s*1000\b/, // * 1000
        /\/\s*1000\b/, // / 1000
      ]

      for (const pattern of scalingPatterns) {
        const match = pickFactorFunction.match(pattern)
        expect(
          match,
          `Found forbidden scaling pattern: ${pattern} at "${match?.[0]}"`
        ).toBeNull()
      }
    })

    it('should NOT contain Math.round, Math.floor, Math.ceil', () => {
      // These patterns indicate semantic transform (precision change)
      const mathPatterns = [
        /Math\.round\s*\(/,
        /Math\.floor\s*\(/,
        /Math\.ceil\s*\(/,
      ]

      for (const pattern of mathPatterns) {
        const match = pickFactorFunction.match(pattern)
        expect(
          match,
          `Found forbidden math operation: ${pattern}`
        ).toBeNull()
      }
    })

    it('should NOT contain Math.max or Math.min (except in comments)', () => {
      // These patterns indicate semantic transform (clamping)
      // Split by lines and check non-comment lines
      const lines = pickFactorFunction.split('\n')
      const codeLines = lines.filter(line => !line.trim().startsWith('//'))
      const codeOnly = codeLines.join('\n')

      const clampPatterns = [
        /Math\.max\s*\(/,
        /Math\.min\s*\(/,
      ]

      for (const pattern of clampPatterns) {
        const match = codeOnly.match(pattern)
        expect(
          match,
          `Found forbidden clamping operation: ${pattern}`
        ).toBeNull()
      }
    })

    it('should ONLY use Math.abs for threshold detection (hasRealData)', () => {
      // Math.abs is allowed ONLY in the hasRealData threshold check
      // It should appear as: Math.abs(f.xxx) > 0.001
      const mathAbsMatches = pickFactorFunction.match(/Math\.abs\s*\([^)]+\)/g) || []

      for (const match of mathAbsMatches) {
        // Each Math.abs should be followed by comparison with threshold
        const context = pickFactorFunction.slice(
          pickFactorFunction.indexOf(match),
          pickFactorFunction.indexOf(match) + match.length + 20
        )

        // Must be used in threshold comparison (> 0.001 or similar)
        const isThresholdCheck = />\s*0\.001/.test(context) || />\s*0\.01/.test(context)
        expect(
          isThresholdCheck,
          `Math.abs used outside threshold check: "${context}"`
        ).toBe(true)
      }
    })

    it('should NOT mix importance_score into sensitivity_score fallback chain', () => {
      // P0-1 root cause: importance_score was mixed into sensitivity_score
      // BAD: sensitivity_score: x ?? y ?? importance_score
      // OK: importance_score preserved as separate field

      // Look for sensitivity_score assignment with importance_score fallback
      const badPattern = /sensitivity_score\s*:\s*[^,]+\?\?\s*[^,]*importance_score/

      const match = pickFactorFunction.match(badPattern)
      expect(
        match,
        `Found forbidden cross-semantic fallback: sensitivity_score falling back to importance_score`
      ).toBeNull()
    })

    it('should preserve importance_score as separate field', () => {
      // importance_score must be passed through as its own field
      const hasImportanceScoreField = /importance_score\s*:\s*f\.importance_score/.test(pickFactorFunction)

      expect(
        hasImportanceScoreField,
        'importance_score must be preserved as separate field in output'
      ).toBe(true)
    })

    it('should preserve value_of_information as separate field', () => {
      // value_of_information must be passed through as its own field
      const hasVoiField = /value_of_information\s*:\s*f\.value_of_information/.test(pickFactorFunction)

      expect(
        hasVoiField,
        'value_of_information must be preserved as separate field in output'
      ).toBe(true)
    })
  })

  describe('static analysis: allowed patterns verification', () => {
    it('should use type assertions (as number) for field access', () => {
      // Type assertions are legitimate for runtime data
      const hasTypeAssertions = /as\s+number/.test(pickFactorFunction)
      expect(hasTypeAssertions).toBe(true)
    })

    it('should use nullish coalescing for same-type aliases', () => {
      // OK: f.factor_id ?? f.node_id (both are IDs)
      // OK: f.sensitivity_score ?? f.elasticity (both are sensitivity measures)
      const hasSameTypeCoalescing = /factor_id.*\?\?.*node_id/.test(pickFactorFunction) ||
        /node_id.*\?\?.*factor_id/.test(pickFactorFunction)

      expect(hasSameTypeCoalescing).toBe(true)
    })

    it('should use direction normalization pattern', () => {
      // Direction normalization is a lossless canonicalization, not semantic transform
      const hasDirectionNorm = /direction.*===.*'negative'.*\?.*'negative'.*:.*'positive'/.test(pickFactorFunction)

      expect(hasDirectionNorm).toBe(true)
    })
  })

  // =============================================================================
  // Semantic Contract Tests: Pass-Through Verification
  // =============================================================================

  describe('semantic contract: pass-through verification', () => {
    it('should pass through importance_score unchanged (not scaled)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  importance_score: 0.85, // Should remain 0.85, not become 85
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      expect(result.factors[0].importance_score).toBe(0.85)
      expect(result.factors[0].importance_score).not.toBe(85)
    })

    it('should pass through sensitivity_score unchanged (not scaled)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  sensitivity_score: 0.72, // Should remain 0.72, not become 72
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      expect(result.factors[0].sensitivity_score).toBe(0.72)
      expect(result.factors[0].sensitivity_score).not.toBe(72)
    })

    it('should pass through elasticity unchanged (not scaled)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  elasticity: 1.5, // Should remain 1.5
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      expect(result.factors[0].elasticity).toBe(1.5)
    })

    it('should pass through value_of_information unchanged (not scaled)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  importance_score: 0.5, // Need this for hasRealData
                  value_of_information: 0.68, // Should remain 0.68, not become 68
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      expect(result.factors[0].value_of_information).toBe(0.68)
      expect(result.factors[0].value_of_information).not.toBe(68)
    })

    it('should pass through confidence unchanged (not scaled)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  importance_score: 0.5, // Need this for hasRealData
                  confidence: 0.85, // Should remain 0.85, not become 85
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      expect(result.factors[0].confidence).toBe(0.85)
      expect(result.factors[0].confidence).not.toBe(85)
    })

    it('should NOT inject default values for missing numeric fields', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  importance_score: 0.5, // Only this field provided
                  // Missing: sensitivity_score, elasticity, confidence, value_of_information
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Missing fields should be undefined, NOT 0
      expect(result.factors[0].elasticity).toBeUndefined()
      expect(result.factors[0].confidence).toBeUndefined()
      expect(result.factors[0].value_of_information).toBeUndefined()
    })

    it('should preserve zero as zero (not undefined)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  importance_score: 0.5, // Need this for hasRealData check
                  elasticity: 0, // Real zero should be preserved
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Real zero should be preserved as 0, not become undefined
      expect(result.factors[0].elasticity).toBe(0)
    })

    it('should keep sensitivity_score and importance_score semantically separate', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  importance_score: 0.85, // Only importance_score provided
                  // No sensitivity_score or elasticity
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // CRITICAL: sensitivity_score should NOT be filled with importance_score
      // They are semantically different fields
      expect(result.factors[0].sensitivity_score).toBeUndefined()
      expect(result.factors[0].importance_score).toBe(0.85)
    })
  })

  // =============================================================================
  // Regression Guard Tests
  // =============================================================================

  describe('regression guards: P0-1 prevention', () => {
    it('should detect hasRealData when only importance_score present', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  importance_score: 0.85, // Only importance_score
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Should use ISL path (not fall through to top_level)
      expect(result._source_path).toBe('downstream_calls.isl')
    })

    it('should NOT detect hasRealData for placeholder zeros', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  importance_score: 0, // Placeholder zero
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Should fall through to top_level (no real data)
      expect(result._source_path).toBe('top_level')
    })

    it('should include all required fields in output for downstream consumers', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                {
                  factor_id: 'fac_test',
                  node_id: 'fac_test_node',
                  label: 'Test Factor',
                  sensitivity_score: 0.72,
                  importance_score: 0.85,
                  elasticity: 1.2,
                  direction: 'positive',
                  confidence: 0.9,
                  value_of_information: 0.68,
                  importance_rank: 1,
                },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)
      const factor = result.factors[0]

      // All fields must be present for downstream consumers
      expect(factor.factor_id).toBe('fac_test')
      expect(factor.node_id).toBe('fac_test_node')
      expect(factor.label).toBe('Test Factor')
      expect(factor.sensitivity_score).toBe(0.72)
      expect(factor.importance_score).toBe(0.85)
      expect(factor.elasticity).toBe(1.2)
      expect(factor.direction).toBe('positive')
      expect(factor.confidence).toBe(0.9)
      expect(factor.value_of_information).toBe(0.68)
      expect(factor.importance_rank).toBe(1)
    })
  })

  // =============================================================================
  // Negative Tests: What WOULD fail if transforms were added
  // =============================================================================

  describe('negative tests: would fail if transforms added', () => {
    it('documents what would fail if * 100 scaling added', () => {
      // This test documents the expectation.
      // If someone adds * 100 to importance_score:
      // - The static analysis test would fail (detects * 100 pattern)
      // - The semantic contract test would fail (0.85 !== 85)

      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_test', importance_score: 0.85 },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // This assertion would fail if * 100 was added
      expect(result.factors[0].importance_score).toBeLessThan(1.1)
    })

    it('documents what would fail if Math.round added', () => {
      // If someone adds Math.round to elasticity:
      // - The static analysis test would fail (detects Math.round pattern)
      // - Precision would be lost

      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_test', importance_score: 0.5, elasticity: 1.234 },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // This assertion would fail if Math.round was added
      expect(result.factors[0].elasticity).toBe(1.234)
    })

    it('documents what would fail if default 0 injected for missing fields', () => {
      // If someone adds ?? 0 for missing fields:
      // - The semantic contract test would fail (undefined !== 0)

      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_test', importance_score: 0.5 },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // This assertion would fail if ?? 0 was added
      expect(result.factors[0].elasticity).toBeUndefined()
    })
  })

  // =============================================================================
  // Import Allow-List: Prevent semantic transforms via helper imports
  // =============================================================================

  describe('static analysis: import allow-list', () => {
    // Extract all import statements from the source
    const importStatements = sourceCode.match(/^import\s+.*$/gm) || []
    const importPaths = importStatements
      .map(stmt => stmt.match(/from\s+['"]([^'"]+)['"]/)?.[1])
      .filter((path): path is string => path !== undefined)

    /**
     * ALLOWED IMPORTS - explicitly permitted
     * These are safe because they don't contain semantic transform logic
     */
    const allowedImports = [
      // Type-only imports (no runtime code)
      './types',
      '../types',
      '../../driversAdapter',
      '../../../types/cee',
      // Safe utilities (array handling, logging, not numeric transforms)
      '../../../lib/payload-trace-store',
      '../../../lib/array-utils',
      // The typed mappers (they DO transforms, but that's their job)
      '../../../lib/mappers',
    ]

    /**
     * FORBIDDEN IMPORT PATTERNS - indicate semantic transform utilities
     * If responseMapper imports from these, it's doing transforms it shouldn't
     */
    const forbiddenPatterns = [
      /math/i,           // Math utilities
      /normalise/i,      // Normalization functions
      /normalize/i,      // Normalization functions (US spelling)
      /compute/i,        // Computation utilities
      /scale/i,          // Scaling functions
      /transform/i,      // Transform utilities
      /clamp/i,          // Clamping functions
      /round/i,          // Rounding utilities
      /format/i,         // Formatting (display transforms)
      /convert/i,        // Conversion utilities
    ]

    it('should only import from allowed modules', () => {
      for (const importPath of importPaths) {
        // Skip if it's an allowed import
        if (allowedImports.some(allowed => importPath.includes(allowed))) {
          continue
        }

        // Check if it matches any forbidden pattern
        for (const pattern of forbiddenPatterns) {
          expect(
            pattern.test(importPath),
            `responseMapper.ts imports from forbidden path: "${importPath}" (matches ${pattern})`
          ).toBe(false)
        }
      }
    })

    it('should NOT import math utilities', () => {
      const mathImports = importPaths.filter(p => /math/i.test(p))
      expect(
        mathImports,
        `Found math utility imports: ${mathImports.join(', ')}`
      ).toHaveLength(0)
    })

    it('should NOT import normalization utilities', () => {
      const normImports = importPaths.filter(p => /normal[iz]e/i.test(p))
      expect(
        normImports,
        `Found normalization imports: ${normImports.join(', ')}`
      ).toHaveLength(0)
    })

    it('should NOT import compute/transform utilities', () => {
      const computeImports = importPaths.filter(p =>
        /compute/i.test(p) || /transform/i.test(p)
      )
      expect(
        computeImports,
        `Found compute/transform imports: ${computeImports.join(', ')}`
      ).toHaveLength(0)
    })

    it('documents allowed imports explicitly', () => {
      // This test documents what IS allowed and verifies the allow-list is used
      // If a new import is needed, it must be added to allowedImports
      expect(allowedImports.length).toBeGreaterThan(0)

      // Verify at least some expected imports are present
      const hasTypesImport = importPaths.some(p => p.includes('./types'))
      const hasArrayUtils = importPaths.some(p => p.includes('array-utils'))

      expect(hasTypesImport, 'Should import from ./types').toBe(true)
      expect(hasArrayUtils, 'Should import from array-utils').toBe(true)
    })
  })

  // =============================================================================
  // _meta Pass-Through: Verify metadata is routing info, not computed
  // =============================================================================

  describe('_meta pass-through verification', () => {
    it('should set _source_path based on routing decision (ISL path)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_test', importance_score: 0.85 },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // _source_path reflects which data source was used (routing metadata)
      expect(result._source_path).toBe('downstream_calls.isl')
    })

    it('should set _source_path based on routing decision (enrichment path)', () => {
      const v2Response = {
        enrichment: {
          sensitivity_analysis: {
            factors: [
              { factor_id: 'fac_test', sensitivity_score: 0.72 },
            ],
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // _source_path reflects which data source was used
      expect(result._source_path).toBe('enrichment')
    })

    it('should set _source_path based on routing decision (top_level path)', () => {
      const v2Response = {
        factor_sensitivity: [
          { factor_id: 'fac_test', importance_score: 0.85 },
        ],
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // _source_path reflects which data source was used
      expect(result._source_path).toBe('top_level')
    })

    it('should NOT recompute or derive _source_path from factor data', () => {
      // _source_path is set by routing logic, not derived from factor content
      // This test verifies the same input always produces the same _source_path
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_a', importance_score: 0.1 },
                { factor_id: 'fac_b', importance_score: 0.9 },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result1 = pickFactorSensitivityForUi(v2Response)
      const result2 = pickFactorSensitivityForUi(v2Response)

      // Same input → same _source_path (deterministic routing)
      expect(result1._source_path).toBe(result2._source_path)
      expect(result1._source_path).toBe('downstream_calls.isl')
    })

    it('should use exactly one of the three valid _source_path values', () => {
      const validPaths = ['downstream_calls.isl', 'enrichment', 'top_level']

      // Test each path
      const testCases = [
        {
          response: {
            downstream_calls: {
              isl: { response: { factor_sensitivity: [{ factor_id: 'f', importance_score: 0.5 }] } },
            },
          },
          expectedPath: 'downstream_calls.isl',
        },
        {
          response: {
            enrichment: { sensitivity_analysis: { factors: [{ factor_id: 'f', sensitivity_score: 0.5 }] } },
          },
          expectedPath: 'enrichment',
        },
        {
          response: {
            factor_sensitivity: [{ factor_id: 'f', importance_score: 0.5 }],
          },
          expectedPath: 'top_level',
        },
      ]

      for (const { response, expectedPath } of testCases) {
        const result = pickFactorSensitivityForUi(response as unknown as V2RunResponse)

        expect(validPaths).toContain(result._source_path)
        expect(result._source_path).toBe(expectedPath)
      }
    })

    it('should NOT contain computed _meta fields (no derived statistics)', () => {
      const v2Response = {
        downstream_calls: {
          isl: {
            response: {
              factor_sensitivity: [
                { factor_id: 'fac_a', importance_score: 0.9 },
                { factor_id: 'fac_b', importance_score: 0.5 },
                { factor_id: 'fac_c', importance_score: 0.1 },
              ],
            },
          },
        },
      } as unknown as V2RunResponse

      const result = pickFactorSensitivityForUi(v2Response)

      // Result should only have factors and _source_path
      // Should NOT have computed fields like:
      // - _meta.average_importance
      // - _meta.factor_count
      // - _meta.max_importance
      // - _meta.computation_time

      const resultKeys = Object.keys(result)
      expect(resultKeys).toContain('factors')
      expect(resultKeys).toContain('_source_path')

      // Should not have any other _meta-style computed fields
      const metaKeys = resultKeys.filter(k => k.startsWith('_') && k !== '_source_path')
      expect(
        metaKeys,
        `Found unexpected computed _meta fields: ${metaKeys.join(', ')}`
      ).toHaveLength(0)
    })
  })
})
