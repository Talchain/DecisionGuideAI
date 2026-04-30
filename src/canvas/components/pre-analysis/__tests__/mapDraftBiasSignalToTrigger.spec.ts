/**
 * Tests for mapDraftBiasSignalToTrigger — the pure helper that maps a CEE
 * coaching.bias_signals entry into the NormalisedBiasTrigger shape consumed
 * by the existing bias-card render path in PreAnalysisPanel.
 *
 * Critical invariants:
 *  - target is never copied into any visible field (subtitle/title/fullExplanation)
 *  - unresolved targets do NOT populate targetFactorId (so hover-highlight is silent)
 *  - resolved targets populate both targetFactorId AND targetFactorLabel
 *  - friendly labels resolve for all known LLM bias types (not just "Bias detected")
 *  - safe-looking unknown types get sentence-case fallback, not generic
 *  - unsafe inputs fall through to "Bias detected" without echoing the raw string
 */

import { describe, it, expect, vi } from 'vitest'
import { mapDraftBiasSignalToTrigger, safeBiasTitle, buildBiasHoverHandlers, FORBIDDEN_TYPE_PREFIXES } from '../PreAnalysisPanel'

const noResolve = (_id: string): string | null => null

describe('mapDraftBiasSignalToTrigger', () => {
  it('returns null when detail is empty after trim', () => {
    expect(mapDraftBiasSignalToTrigger({ type: 'anchoring', detail: '   ' }, 0, noResolve)).toBeNull()
  })

  it('maps known lowercase snake_case types to friendly labels', () => {
    const cases: Array<[string, string]> = [
      ['confirmation_bias', 'Confirmation bias'],
      ['anchoring_bias', 'Anchoring'],
      ['optimism_bias', 'Optimism bias'],
      ['status_quo_bias', 'Status quo bias'],
      ['authority_bias', 'Authority bias'],
      ['availability_bias', 'Availability bias'],
      ['blind_spots', 'Blind spots'],
      ['overconfidence', 'Overconfidence'],
      ['framing', 'Narrow framing'],
    ]
    for (const [type, expected] of cases) {
      const t = mapDraftBiasSignalToTrigger({ type, detail: 'x' }, 0, noResolve)
      expect(t?.title, `case: ${type}`).toBe(expected)
    }
  })

  it('falls back to sentence-case for safe unknown types', () => {
    const t = mapDraftBiasSignalToTrigger({ type: 'novel_bias_type', detail: 'x' }, 0, noResolve)
    expect(t?.title).toBe('Novel bias type')
  })

  it('falls back to "Bias detected" for unsafe inputs', () => {
    const t = mapDraftBiasSignalToTrigger({ type: '<script>alert(1)</script>', detail: 'x' }, 0, noResolve)
    expect(t?.title).toBe('Bias detected')
  })

  it('does not include target in any visible string field when resolver returns a label', () => {
    const trigger = mapDraftBiasSignalToTrigger(
      { type: 'anchoring', detail: 'Watch the anchor.', target: 'fac_price' },
      0,
      (id) => (id === 'fac_price' ? 'Price' : null),
    )!
    expect(trigger.targetFactorId).toBe('fac_price')        // structural — not rendered as text
    expect(trigger.targetFactorLabel).toBe('Price')
    expect(trigger.title).not.toContain('fac_price')
    expect(trigger.subtitle).not.toContain('fac_price')
    expect(trigger.fullExplanation).not.toContain('fac_price')
  })

  it('omits targetFactorId when resolver returns null (unresolved target → silent hover)', () => {
    const trigger = mapDraftBiasSignalToTrigger(
      { type: 'anchoring', detail: 'Beware.', target: 'unknown_id' },
      0,
      noResolve,
    )!
    expect(trigger.targetFactorId).toBeNull()
    expect(trigger.targetFactorLabel).toBeNull()
  })

  it('omits targetFactorId when no target is supplied', () => {
    const trigger = mapDraftBiasSignalToTrigger(
      { type: 'framing', detail: 'X.' },
      0,
      noResolve,
    )!
    expect(trigger.targetFactorId).toBeNull()
    expect(trigger.targetFactorLabel).toBeNull()
  })

  it('preserves the full detail in fullExplanation and truncates subtitle when very long', () => {
    const long = 'a'.repeat(200)
    const trigger = mapDraftBiasSignalToTrigger({ type: 'framing', detail: long }, 0, noResolve)!
    expect(trigger.fullExplanation).toBe(long)
    expect(trigger.subtitle.length).toBeLessThan(long.length)
    expect(trigger.subtitle.endsWith('…')).toBe(true)
  })

  it('falls back to "Bias detected" when type is a raw entity-ID prefix (never echoes IDs)', () => {
    // A CEE bug or contract drift could pass an entity ID as the bias type;
    // safeBiasTitle must reject these so they fall through to BIAS_FALLBACK
    // rather than rendering as "Fac price" / "Opt a" / etc.
    //
    // Covers all canonical CEE entity-ID prefixes mirrored from
    // olumi-assistants-service:tools/v5-journey-replay/output-safety.ts
    // ENTITY_ID_RE, plus UI-side defensive prefixes (node_, edge_).
    const cases = [
      // Short canonical prefixes
      'fac_price', 'opt_a', 'goal_revenue', 'dec_x', 'out_revenue', 'risk_high', 'con_budget',
      // Long canonical prefixes
      'factor_price', 'option_a', 'decision_x', 'outcome_y', 'constraint_z',
      // UI-side defensive
      'node_1', 'edge_2',
    ]
    for (const id of cases) {
      const t = mapDraftBiasSignalToTrigger({ type: id, detail: 'X.' }, 0, noResolve)
      expect(t?.title, `case: ${id}`).toBe('Bias detected')
      expect(t?.title).not.toContain('_')
      expect(t?.title.toLowerCase()).not.toContain(id.split('_')[0])
    }
  })
})

describe('safeBiasTitle', () => {
  // One per-prefix test for each entry in FORBIDDEN_TYPE_PREFIXES — drift-proof
  // because the test source is the same constant the production code uses.
  describe.each(FORBIDDEN_TYPE_PREFIXES.map((p) => [p]))('rejects entity-ID prefix %s', (prefix) => {
    it(`returns null for "${prefix}…" lowercase`, () => {
      expect(safeBiasTitle(`${prefix}sample`)).toBeNull()
    })
    it(`returns null for "${prefix}…" uppercase (case-insensitive)`, () => {
      expect(safeBiasTitle(`${prefix.toUpperCase()}SAMPLE`)).toBeNull()
    })
  })

  it('sentence-cases safe tokens', () => {
    expect(safeBiasTitle('novel_bias')).toBe('Novel bias')
    expect(safeBiasTitle('OVERCONFIDENCE')).toBe('Overconfidence')
  })

  it('returns null for unsafe characters', () => {
    expect(safeBiasTitle('<script>')).toBeNull()
    expect(safeBiasTitle('a b c')).toBeNull()
    expect(safeBiasTitle('a-b-c')).toBeNull()
    expect(safeBiasTitle('')).toBeNull()
  })

  it('exposes all canonical CEE prefixes plus UI defensive prefixes', () => {
    // Sanity check on the constant itself — guards against accidental shrinkage.
    // If a future commit removes one of the canonical prefixes, this test will
    // fail and force the author to re-confirm the cross-repo lockstep.
    const canonical = ['fac_', 'opt_', 'goal_', 'dec_', 'out_', 'risk_', 'con_',
                       'factor_', 'option_', 'decision_', 'outcome_', 'constraint_']
    const defensive = ['node_', 'edge_']
    for (const p of [...canonical, ...defensive]) {
      expect(FORBIDDEN_TYPE_PREFIXES, `expected to include ${p}`).toContain(p)
    }
  })
})

describe('buildBiasHoverHandlers', () => {
  it('returns no handlers when targetId is null (silent hover)', () => {
    const setNodes = vi.fn()
    const setEdges = vi.fn()
    const handlers = buildBiasHoverHandlers(null, setNodes, setEdges)
    expect(handlers.onMouseEnter).toBeUndefined()
    expect(handlers.onMouseLeave).toBeUndefined()
  })

  it('returns handlers that highlight the target node and clear edge highlights on enter', () => {
    const setNodes = vi.fn()
    const setEdges = vi.fn()
    const handlers = buildBiasHoverHandlers('fac_price', setNodes, setEdges)
    handlers.onMouseEnter!()
    expect(setNodes).toHaveBeenCalledWith(['fac_price'])
    expect(setEdges).toHaveBeenCalledWith([])
  })

  it('returns handlers that clear both node and edge highlights on leave', () => {
    const setNodes = vi.fn()
    const setEdges = vi.fn()
    const handlers = buildBiasHoverHandlers('fac_price', setNodes, setEdges)
    handlers.onMouseLeave!()
    expect(setNodes).toHaveBeenCalledWith([])
    expect(setEdges).toHaveBeenCalledWith([])
  })
})
