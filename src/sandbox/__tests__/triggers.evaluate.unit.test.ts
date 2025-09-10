// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { evaluateTriggers } from '@/sandbox/bridge/triggers'

describe('evaluateTriggers (pure)', () => {
  it('groups multiple high rules into MULTI_HIGH with rules payload', () => {
    const out = evaluateTriggers({
      p50DeltaAbs: 0,
      impactSums: { totalImpact: 0, deltaBalance: 0 },
      highRules: ['KR_MISS_PROJECTION', 'COUNTER_GUARDRAIL_BREACH'],
      krIds: ['kr1', 'kr2'],
    })
    expect(out.fire).toBe(true)
    expect(out.rule).toBe('MULTI_HIGH')
    expect(out.rules).toEqual(['KR_MISS_PROJECTION', 'COUNTER_GUARDRAIL_BREACH'])
    expect(out.kr_ids).toEqual(['kr1', 'kr2'])
  })

  it('fires CONFLICTING_IMPACTS on boundary: |pos-neg| < 0.02 and total >= 0.08', () => {
    const out = evaluateTriggers({
      p50DeltaAbs: 0.0,
      impactSums: { totalImpact: 0.081, deltaBalance: 0.019 },
      highRules: [],
    })
    expect(out.fire).toBe(true)
    expect(out.rule).toBe('CONFLICTING_IMPACTS')
  })

  it('fires COUNTER_GUARDRAIL_BREACH when p50DeltaAbs > 0.10 (fallback)', () => {
    const out = evaluateTriggers({
      p50DeltaAbs: 0.11,
      impactSums: { totalImpact: 0, deltaBalance: 1 },
      highRules: [],
    })
    expect(out.fire).toBe(true)
    expect(out.rule).toBe('COUNTER_GUARDRAIL_BREACH')
  })

  it('returns no fire otherwise', () => {
    const out = evaluateTriggers({
      p50DeltaAbs: 0.05,
      impactSums: { totalImpact: 0.05, deltaBalance: 0.01 },
      highRules: [],
    })
    expect(out.fire).toBe(false)
  })
})
