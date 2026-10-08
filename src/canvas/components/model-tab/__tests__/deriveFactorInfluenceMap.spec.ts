/**
 * deriveFactorInfluenceMap — one outcome-sensitivity list across surfaces.
 *
 * This retained projection helper's values follow the shared per-set
 * normalised |elasticity| contract, matching
 * the hero, results ranking and canvas rank. Producer influence_score is a
 * separate quantity and cannot put a pinned factor first in this list.
 * Missing or non-finite elasticity is unranked, represented by no map entry.
 *
 * Fixture: real staging capture (v5-analysis-result.bundle-45c9b625,
 * enrichment.factor_sensitivity) — same fixture already locked by
 * src/v5/__tests__/mapV5AnalysisToReport.influence-warnings.spec.ts for the
 * mapper layer. fac_marketing_expertise is the real reproduction: rank 1,
 * influence_score 1, sensitivity_score/elasticity both 0,
 * zero_reason intervention_override.
 */
import { describe, expect, it } from 'vitest'

import { deriveFactorInfluenceMap } from '../utils'

import bundleFixture from '../../../../v5/__tests__/fixtures/v5-analysis-result.bundle-45c9b625.json'

describe('deriveFactorInfluenceMap', () => {
  it('normalises the real fixture by |elasticity|, leaving defined zero elasticities at zero', () => {
    const factorSensitivity = (bundleFixture.block as { enrichment: { factor_sensitivity: unknown[] } })
      .enrichment.factor_sensitivity

    const map = deriveFactorInfluenceMap({ factor_sensitivity: factorSensitivity })

    expect(map).toBeDefined()
    // A structural score of 1 does not override a defined elasticity of 0.
    expect(map!.get('fac_marketing_expertise')).toBe(0)
    expect(map!.get('fac_manager_cost')).toBe(0)
    expect(map!.get('fac_ad_spend')).toBe(0)
    expect(map!.get('fac_market_receptivity')).toBe(1)
    expect(map!.get('fac_founder_time')).toBeCloseTo(
      0.4838709677419354 / 0.6209677419354838,
    )
  })

  it('normalises by |elasticity| regardless of producer score coverage', () => {
    // A producer score on one row cannot change its basis or outrank a
    // larger elasticity on another. The Model tab and graph badge agree.
    const map = deriveFactorInfluenceMap({
      factor_sensitivity: [
        { factor_id: 'fac_a', influence_score: 0.9, elasticity: 0.1 },
        { factor_id: 'fac_b', elasticity: 0.4 },
      ],
    })

    expect(map!.get('fac_a')).toBeCloseTo(0.25) // 0.1 / 0.4 — NOT the lone 0.9
    expect(map!.get('fac_b')).toBeCloseTo(1.0)
  })

  it('normalises legacy magnitude fields through the shared rawElasticity chain', () => {
    // Legacy fields feed rawElasticity through the shared extractor; they
    // receive the same set normalisation as explicit elasticity rows.
    const map = deriveFactorInfluenceMap({
      factor_sensitivity: [
        { factor_id: 'fac_legacy_elasticity', elasticity: 0.4 },
        { factor_id: 'fac_legacy_sensitivity', sensitivity_score: 0.25 },
        { factor_id: 'fac_legacy_importance', importance_score: 0.1 },
      ],
    })

    expect(map!.get('fac_legacy_elasticity')).toBeCloseTo(1.0)
    expect(map!.get('fac_legacy_sensitivity')).toBeCloseTo(0.625)
    expect(map!.get('fac_legacy_importance')).toBeCloseTo(0.25)
  })

  it('uses factor_sensitivity elasticities ahead of the enrichment passthrough (badge parity)', () => {
    // useNodeDisplayMetadata (the graph badge) prefers certified
    // factor_sensitivity; if this map preferred the untyped enrichment seam
    // the two surfaces could rank different row-sets for the same node.
    const map = deriveFactorInfluenceMap({
      factor_sensitivity: [
        { factor_id: 'fac_x', influence_score: 0.9, elasticity: 0.1 },
        { factor_id: 'fac_leader', elasticity: 0.4 },
      ],
      enrichment: {
        sensitivity_analysis: {
          factors: [{ factor_id: 'fac_x', influence_score: 0.1, elasticity: 0.8 }],
        },
      },
    })

    expect(map!.get('fac_x')).toBeCloseTo(0.25)
    expect(map!.get('fac_leader')).toBe(1)
  })

  it('does not let either casing of a producer score change elasticity values', () => {
    const map = deriveFactorInfluenceMap({
      factor_sensitivity: [
        { factor_id: 'fac_camel', influenceScore: 0.9, elasticity: 0.1 },
        { factor_id: 'fac_snake', influence_score: 0.5, elasticity: 0.4 },
      ],
    })

    // Producer score fields do not decide the displayed basis.
    expect(map!.get('fac_camel')).toBeCloseTo(0.25)
    expect(map!.get('fac_snake')).toBeCloseTo(1.0)
  })

  it('reads from enrichment.sensitivity_analysis.factors when factor_sensitivity is absent', () => {
    const map = deriveFactorInfluenceMap({
      enrichment: {
        sensitivity_analysis: {
          factors: [
            { factor_id: 'fac_alt_path', influence_score: 0.77 },
            { factor_id: 'fac_defined', elasticity: -0.2 },
            { factor_id: 'fac_smaller', elasticity: 0.1 },
          ],
        },
      },
    })

    expect(map!.has('fac_alt_path')).toBe(false)
    expect(map!.get('fac_defined')).toBe(1)
    expect(map!.get('fac_smaller')).toBeCloseTo(0.5)
  })

  it.each([undefined, null, Number.NaN, Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY])(
    'omits an undefined/non-finite elasticity (%s), preserving measured zero and signed magnitudes',
    (elasticity) => {
      const map = deriveFactorInfluenceMap({
        factor_sensitivity: [
          { factor_id: 'fac_unranked', influence_score: 1, elasticity },
          { factor_id: 'fac_leader', influence_score: 0.1, elasticity: 0.5 },
          { factor_id: 'fac_negative', elasticity: -0.25 },
          { factor_id: 'fac_zero', elasticity: 0 },
        ],
      })

      expect(map!.has('fac_unranked')).toBe(false)
      expect(map!.size).toBe(3)
      expect(map!.get('fac_leader')).toBe(1)
      expect(map!.get('fac_negative')).toBeCloseTo(0.5)
      expect(map!.get('fac_zero')).toBe(0)
    },
  )

  it('returns no map when every row has a producer score but no defined elasticity', () => {
    expect(deriveFactorInfluenceMap({
      factor_sensitivity: [{ factor_id: 'fac_unranked', influence_score: 0.9 }],
    })).toBeUndefined()
  })

  it('returns undefined for an empty or malformed report (no fabrication)', () => {
    expect(deriveFactorInfluenceMap(undefined)).toBeUndefined()
    expect(deriveFactorInfluenceMap({})).toBeUndefined()
    expect(deriveFactorInfluenceMap({ factor_sensitivity: [] })).toBeUndefined()
  })
})
