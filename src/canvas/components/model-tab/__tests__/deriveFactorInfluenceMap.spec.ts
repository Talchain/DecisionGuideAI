/**
 * deriveFactorInfluenceMap — unit tests (ROADMAP 1.7, honest-render tail).
 *
 * OutputsDock feeds this map into FactorsSection's "factor cards sorted by
 * influence" (model-tab). Before this fix the inline useMemo built the score
 * from `elasticity ?? sensitivity_score ?? importance_score` only — the
 * legacy sensitivity-flavoured measures — and never looked at the
 * producer's `influence_score` (roadmap 1.7; provisional_doctrine_v0:
 * influence ≠ sensitivity, same distinction already honoured by
 * mapV5AnalysisToReport / useNodeDisplayMetadata / useResultsSectionData).
 *
 * Consequence: a pinned/intervention-overridden factor carries
 * sensitivity=0 (options fix its value, so perturbing it moves nothing) but
 * can carry the producer's HIGHEST influence_score (it is structurally the
 * most causally important factor — the model just isn't free to vary it).
 * The old code rendered that factor's card at 0% influence — the opposite
 * of what the producer said.
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
  it('prefers the producer influence_score over elasticity/sensitivity_score for a pinned factor', () => {
    const factorSensitivity = (bundleFixture.block as { enrichment: { factor_sensitivity: unknown[] } })
      .enrichment.factor_sensitivity

    const map = deriveFactorInfluenceMap({ factor_sensitivity: factorSensitivity })

    expect(map).toBeDefined()
    // Rank-1 producer influence, but sensitivity/elasticity are BOTH zero
    // (intervention_override) — the old elasticity-first code would read 0.
    expect(map!.get('fac_marketing_expertise')).toBe(1)
    // Rank-4 and rank-5 factors are ALSO pinned (zero_reason
    // intervention_override) — same failure mode, different magnitudes.
    expect(map!.get('fac_manager_cost')).toBeCloseTo(0.45161290322580644)
    expect(map!.get('fac_ad_spend')).toBeCloseTo(0.14516129032258066)
    // A non-pinned factor's influence_score still wins over its own
    // elasticity (they happen to be equal here, but the read must come
    // from influence_score, not elasticity, per doctrine).
    expect(map!.get('fac_market_receptivity')).toBeCloseTo(0.6209677419354838)
  })

  it('Lane 2 (R3-B1): PARTIAL producer coverage falls back to per-set normalised elasticity for EVERY factor — no mixed basis', () => {
    // The complete-metric-set doctrine (driverDisplayModel): adopting the
    // producer score for SOME factors while others use elasticity mixes two
    // incomparable bases in one ranking — the exact bug the panel, badge,
    // hero and tornado were cured of. The model-tab card sits next to the
    // graph badge for the SAME node; they must agree.
    const map = deriveFactorInfluenceMap({
      factor_sensitivity: [
        { factor_id: 'fac_a', influence_score: 0.9, elasticity: 0.1 },
        { factor_id: 'fac_b', elasticity: 0.4 },
      ],
    })

    expect(map!.get('fac_a')).toBeCloseTo(0.25) // 0.1 / 0.4 — NOT the lone 0.9
    expect(map!.get('fac_b')).toBeCloseTo(1.0)
  })

  it('DELIBERATE PIN FLIP (Lane 2): the legacy shape (no influence_score anywhere) now yields SET-NORMALISED values via the shared policy', () => {
    // Previously raw passthrough (0.4 / 0.25 / 0.1). Under the shared
    // driverDisplayModel the no-producer-coverage case normalises to the
    // set's max |elasticity| — the same numbers the graph badge shows for
    // these factors.
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

  it('Lane 2 review fold: factor_sensitivity WINS over the enrichment passthrough when both exist (badge parity)', () => {
    // useNodeDisplayMetadata (the graph badge) prefers certified
    // factor_sensitivity; if this map preferred the untyped enrichment seam
    // the two surfaces could rank different row-sets for the same node.
    const map = deriveFactorInfluenceMap({
      factor_sensitivity: [{ factor_id: 'fac_x', influence_score: 0.9 }],
      enrichment: {
        sensitivity_analysis: {
          factors: [{ factor_id: 'fac_x', influence_score: 0.1 }],
        },
      },
    })

    expect(map!.get('fac_x')).toBeCloseTo(0.9)
  })

  it('Lane 2 review fold: camelCase influenceScore is IGNORED (panel parity — snake_case only decides coverage)', () => {
    // The panel reads snake_case influence_score only; a feeder accepting
    // camelCase would compute a different coverage-complete verdict for the
    // same rows. Camel-only rows fall back to the elasticity chain.
    const map = deriveFactorInfluenceMap({
      factor_sensitivity: [
        { factor_id: 'fac_camel', influenceScore: 0.9, elasticity: 0.1 },
        { factor_id: 'fac_snake', influence_score: 0.5, elasticity: 0.4 },
      ],
    })

    // fac_camel has NO snake producer score → partial coverage → both
    // normalise to the set max |elasticity| (0.4).
    expect(map!.get('fac_camel')).toBeCloseTo(0.25)
    expect(map!.get('fac_snake')).toBeCloseTo(1.0)
  })

  it('reads from enrichment.sensitivity_analysis.factors when factor_sensitivity is absent', () => {
    const map = deriveFactorInfluenceMap({
      enrichment: {
        sensitivity_analysis: {
          factors: [{ factor_id: 'fac_alt_path', influence_score: 0.77 }],
        },
      },
    })

    expect(map!.get('fac_alt_path')).toBeCloseTo(0.77)
  })

  it('returns undefined for an empty or malformed report (no fabrication)', () => {
    expect(deriveFactorInfluenceMap(undefined)).toBeUndefined()
    expect(deriveFactorInfluenceMap({})).toBeUndefined()
    expect(deriveFactorInfluenceMap({ factor_sensitivity: [] })).toBeUndefined()
  })
})
