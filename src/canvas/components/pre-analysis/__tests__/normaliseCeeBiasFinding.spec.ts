/**
 * Brief 5.7 D5 follow-up — Bias trigger normalisation: target factor naming.
 *
 * Asserts the render-adjacent output of `normaliseCeeBiasFinding`. The
 * Pre-analysis panel renders `trigger.title` / `trigger.subtitle` verbatim,
 * so asserting these fields covers the user-facing copy without needing
 * the heavy panel render mocks.
 */

import { describe, it, expect, vi } from 'vitest'
import { normaliseCeeBiasFinding } from '../PreAnalysisPanel'

const noResolver = () => null
const resolverFor = (id: string, label: string) =>
  vi.fn((lookup: string) => (lookup === id ? label : null))

describe('normaliseCeeBiasFinding (Brief 5.7 D5 follow-up — target propagation)', () => {
  it('returns null when CEE finding has no explanation', () => {
    expect(
      normaliseCeeBiasFinding({ code: 'NARROW_FRAMING' }, 0, noResolver),
    ).toBeNull()
  })

  it('renders a trigger without target when no target_factor_id is supplied', () => {
    const trigger = normaliseCeeBiasFinding(
      { code: 'NARROW_FRAMING', explanation: 'Consider more options.' },
      0,
      noResolver,
    )
    expect(trigger).not.toBeNull()
    expect(trigger!.title).toBe('Narrow framing')
    expect(trigger!.subtitle).toBe('Consider more options.')
    expect(trigger!.targetFactorId).toBeNull()
    expect(trigger!.targetFactorLabel).toBeNull()
  })

  it('returns null when target_factor_id is supplied but does not resolve', () => {
    const trigger = normaliseCeeBiasFinding(
      {
        code: 'AUTHORITY_BIAS',
        explanation: 'Senior stakeholders may anchor your estimates.',
        target_factor_id: 'unknown-id',
      },
      0,
      noResolver,
    )
    expect(trigger).toBeNull()
  })

  it('keeps title as the bias type and surfaces the factor name in the subtitle', () => {
    const resolve = resolverFor('fac-1', 'Engineering velocity')
    const trigger = normaliseCeeBiasFinding(
      {
        code: 'AUTHORITY_BIAS',
        explanation: 'Senior stakeholder estimates anchored your figure.',
        target_factor_id: 'fac-1',
      },
      0,
      resolve,
    )
    expect(trigger).not.toBeNull()
    // Title stays as the canonical bias category (no factor suffix) so
    // sparkle prompts read naturally and the card avoids visual redundancy.
    expect(trigger!.title).toBe('Authority bias')
    // Factor name lives in the subtitle's targeting sentence + appended
    // CEE explanation. Mirrors the brief D5 example copy.
    expect(trigger!.subtitle).toContain('Watch for authority bias on Engineering velocity.')
    expect(trigger!.subtitle).toContain('Senior stakeholder estimates anchored your figure.')
    expect(trigger!.targetFactorId).toBe('fac-1')
    expect(trigger!.targetFactorLabel).toBe('Engineering velocity')
    expect(resolve).toHaveBeenCalledWith('fac-1')
  })

  it('uses the lower-cased bias title in the targeting copy', () => {
    const resolve = resolverFor('fac-2', 'Hiring velocity')
    const trigger = normaliseCeeBiasFinding(
      {
        code: 'CONFIRMATION_BIAS',
        explanation: 'Pattern of confirming evidence detected.',
        target_factor_id: 'fac-2',
      },
      0,
      resolve,
    )
    expect(trigger!.title).toBe('Confirmation bias')
    // Lowercased bias title in targeting copy reads naturally as a sentence.
    expect(trigger!.subtitle).toMatch(/^Watch for confirmation bias on Hiring velocity\. /)
  })

  it('treats whitespace-only target_factor_id as absent', () => {
    const resolve = resolverFor('fac-1', 'Some factor')
    const trigger = normaliseCeeBiasFinding(
      {
        code: 'NARROW_FRAMING',
        explanation: 'Consider more options.',
        target_factor_id: '   ',
      },
      0,
      resolve,
    )
    expect(trigger).not.toBeNull()
    expect(trigger!.targetFactorId).toBeNull()
    expect(trigger!.targetFactorLabel).toBeNull()
    // Resolver should not be invoked for the whitespace id (early-return path).
    expect(resolve).not.toHaveBeenCalled()
  })

  it('treats target_factor_id resolving to an empty/whitespace label as unresolvable', () => {
    const blankResolve = vi.fn(() => '   ')
    const trigger = normaliseCeeBiasFinding(
      {
        code: 'AUTHORITY_BIAS',
        explanation: 'Some explanation.',
        target_factor_id: 'fac-blank',
      },
      0,
      blankResolve,
    )
    expect(trigger).toBeNull()
  })

  it('falls back to the BIAS_FALLBACK title for unknown bias codes', () => {
    const resolve = resolverFor('fac-3', 'Customer churn')
    const trigger = normaliseCeeBiasFinding(
      {
        code: 'NEW_BIAS_KIND',
        explanation: 'Some new bias.',
        target_factor_id: 'fac-3',
      },
      0,
      resolve,
    )
    expect(trigger).not.toBeNull()
    // Fallback title is the canonical "Bias detected"; factor name surfaces
    // via the targeting subtitle.
    expect(trigger!.title).toBe('Bias detected')
    expect(trigger!.subtitle).toMatch(/^Watch for bias detected on Customer churn\. /)
    expect(trigger!.targetFactorLabel).toBe('Customer churn')
  })
})
