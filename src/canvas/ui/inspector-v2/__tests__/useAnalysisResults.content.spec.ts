import { describe, expect, it } from 'vitest'
import {
  hasAnyRealProbability,
  hasRenderableAnalysisResult,
  type InspectorReport,
} from '../useAnalysisResults'

// Leaf validation only. The captured receiver/store/display proof lives in
// hydrate/__tests__/provisionalDelivery.resultContent.spec.tsx.
describe('result content is distinct from probability availability', () => {
  it.each([null, undefined, {}, { option_comparison: [] }])('does not recognise an empty report %j', report => {
    expect(hasRenderableAnalysisResult(report)).toBe(false)
  })

  it.each([null, undefined, NaN, Infinity, -Infinity])('rejects a non-finite outcome %s', value => {
    const report: InspectorReport = {
      option_comparison: [{ option_id: 'option', outcome: { p50: value } }],
    }
    expect(hasRenderableAnalysisResult(report)).toBe(false)
  })

  it.each(['mean', 'p10', 'p50', 'p90'] as const)('recognises an actual zero %s without granting probability availability', field => {
    const report: InspectorReport = {
      option_comparison: [{ option_id: 'option', outcome: { [field]: 0 } }],
    }
    expect(hasRenderableAnalysisResult(report)).toBe(true)
    expect(hasAnyRealProbability(report)).toBe(false)
  })

  it('does not infer result presence from headline defaults, labels or a written summary', () => {
    expect(hasRenderableAnalysisResult({
      results: { conservative: 0, likely: 0, optimistic: 0 },
      summary: 'Analysis finished.',
      option_comparison: [{ option_id: 'option', option_label: 'A populated row' }],
    })).toBe(false)
  })

  it.each(['pending', 'running', 'error', 'failed'])('does not reuse a finite value under explicit %s computation', status => {
    const report: InspectorReport = {
      option_comparison_status: status,
      option_comparison: [{ option_id: 'option', win_probability: 0, outcome: { p50: 0 } }],
    }
    expect(hasRenderableAnalysisResult(report)).toBe(false)
    expect(hasAnyRealProbability(report)).toBe(true) // Old probability predicate is unchanged.
  })
})
