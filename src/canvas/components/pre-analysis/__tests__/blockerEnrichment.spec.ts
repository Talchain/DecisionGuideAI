/**
 * blockerEnrichment tests
 *
 * Covers:
 * - getBlockerGuidance returns correct title/description/actions for each code
 * - enrichBlocker applies contextual titles for CEE_BLOCKER
 * - enrichAndSortBlockers sorts by priority
 * - suggestedActions present on all known blocker codes
 * - ID display hygiene: prettifyId, looksLikeId
 * - hydrateBlockerLabels resolves node labels from graph
 * - deduplicateBlockers removes duplicates by factor_id
 */

import { describe, it, expect } from 'vitest'
import {
  getBlockerGuidance,
  enrichBlocker,
  enrichAndSortBlockers,
  looksLikeId,
  prettifyId,
  hydrateBlockerLabels,
  deduplicateBlockers,
} from '../blockerEnrichment'
import type { EnrichedBlocker } from '../blockerEnrichment'
import type { ValidationBlocker } from '@talchain/schemas'

describe('getBlockerGuidance', () => {
  it('returns correct guidance for UNREACHABLE_FACTOR_RETAINED with label', () => {
    const guidance = getBlockerGuidance('UNREACHABLE_FACTOR_RETAINED', { nodeLabel: 'Market Share' })

    expect(guidance.title).toBe('"Market Share" is not connected')
    expect(guidance.description).toContain('no option directly affects it')
    expect(guidance.suggestedActions).toContain('Connect it to an option')
    expect(guidance.suggestedActions).toContain('Remove if not relevant')
  })

  it('returns correct guidance for STATUS_QUO_UNREACHABLE', () => {
    const guidance = getBlockerGuidance('STATUS_QUO_UNREACHABLE')

    expect(guidance.title).toBe('"Do nothing" option incomplete')
    expect(guidance.suggestedActions).toContain('Describe consequences of inaction')
    expect(guidance.suggestedActions).toContain('Remove status quo')
  })

  it('returns correct guidance for needs_user_mapping', () => {
    const guidance = getBlockerGuidance('needs_user_mapping')

    expect(guidance.title).toBe('Options need configuration')
    expect(guidance.suggestedActions).toContain('Map option effects to factors')
  })

  it('returns correct guidance for needs_encoding', () => {
    const guidance = getBlockerGuidance('needs_encoding')

    expect(guidance.title).toBe('Values need confirmation')
    expect(guidance.suggestedActions).toContain('Confirm numeric values')
  })

  it('returns correct guidance for EMPTY_INTERVENTIONS with option label', () => {
    const guidance = getBlockerGuidance('EMPTY_INTERVENTIONS', { optionLabel: 'Expand East' })

    expect(guidance.title).toBe('"Expand East" has no effects')
    expect(guidance.suggestedActions).toContain('Add effects')
    expect(guidance.suggestedActions).toContain('Remove option')
  })

  it('falls back to BLOCKER_DISPLAY for known codes without specific guidance', () => {
    const guidance = getBlockerGuidance('MISSING_GOAL_NODE')

    expect(guidance.title).toBe('No goal selected')
    expect(guidance.suggestedActions).toContain('Select a goal node')
  })

  it('returns generic fallback for unknown codes', () => {
    const guidance = getBlockerGuidance('SOME_FUTURE_CODE')

    expect(guidance.title).toBe('Validation issue')
    expect(guidance.suggestedActions).toEqual([])
  })
})

describe('enrichBlocker', () => {
  it('applies contextual title for CEE_BLOCKER using action.label', () => {
    const blocker: ValidationBlocker = {
      code: 'CEE_BLOCKER',
      message: 'No causal path to goal',
      affectedIds: ['factor_price'],
      action: { type: 'retry_draft', label: 'Price' },
    }

    const enriched = enrichBlocker(blocker)

    expect(enriched.display.title).toBe('"Price" is not connected')
    expect(enriched.display.suggestedActions).toContain('Connect it to an option')
  })

  it('uses static title for EMPTY_INTERVENTIONS (action.label is CTA, not option name)', () => {
    const blocker: ValidationBlocker = {
      code: 'EMPTY_INTERVENTIONS',
      message: '1 option(s) have no interventions',
      affectedIds: ['opt_a'],
      action: { type: 'configure_option', label: 'Add interventions', optionId: 'opt_a' },
    }

    const enriched = enrichBlocker(blocker)

    // Should use the static display title, not action.label
    expect(enriched.display.title).toBe('Option has no effects')
  })

  it('passes through status-specific message for ANALYSIS_NOT_READY', () => {
    const blocker: ValidationBlocker = {
      code: 'ANALYSIS_NOT_READY',
      message: 'Some options have categorical values that need encoding',
      action: { type: 'retry_draft', label: 'Retry Draft' },
    }

    const enriched = enrichBlocker(blocker)

    // Description should be the specific message, not the generic BLOCKER_DISPLAY description
    expect(enriched.display.description).toBe('Some options have categorical values that need encoding')
    expect(enriched.display.title).toBe('Analysis not ready')
  })

  it('uses original message for unknown blocker codes', () => {
    const blocker: ValidationBlocker = {
      code: 'SOMETHING_NEW',
      message: 'A future blocker type',
    }

    const enriched = enrichBlocker(blocker)

    expect(enriched.display.title).toBe('Validation issue')
    expect(enriched.display.description).toBe('A future blocker type')
  })

  it('all known codes have non-empty suggestedActions', () => {
    const knownCodes = [
      'MISSING_GOAL_NODE', 'GOAL_NODE_NOT_FOUND', 'GOAL_NODE_KIND_MISMATCH',
      'NO_OPTIONS', 'ANALYSIS_NOT_READY', 'ANALYSIS_READY_INVALID',
      'OPTIONS_NEED_MAPPING', 'EMPTY_INTERVENTIONS', 'INTERVENTION_TARGETS_OPTION',
      'CATEGORY_MISSING', 'CEE_BLOCKER',
    ]

    for (const code of knownCodes) {
      const enriched = enrichBlocker({ code, message: 'test' } as ValidationBlocker)
      expect(enriched.display.suggestedActions.length, `${code} should have suggestedActions`).toBeGreaterThan(0)
    }
  })
})

describe('enrichAndSortBlockers', () => {
  it('sorts structural fatal before draft failure before CEE blockers', () => {
    const blockers: ValidationBlocker[] = [
      { code: 'CEE_BLOCKER', message: 'z', affectedIds: ['f1'], action: { type: 'retry_draft', label: 'F1' } },
      { code: 'ANALYSIS_NOT_READY', message: 'b', action: { type: 'retry_draft', label: 'Retry' } },
      { code: 'MISSING_GOAL_NODE', message: 'a' },
    ]

    const sorted = enrichAndSortBlockers(blockers)

    expect(sorted[0].blocker.code).toBe('MISSING_GOAL_NODE')
    expect(sorted[1].blocker.code).toBe('ANALYSIS_NOT_READY')
    expect(sorted[2].blocker.code).toBe('CEE_BLOCKER')
  })
})

// ── ID display hygiene ──────────────────────────────────────────

describe('looksLikeId', () => {
  it('returns true for fac_ prefixed strings', () => {
    expect(looksLikeId('fac_keeping_monthly_churn')).toBe(true)
  })

  it('returns true for other known prefixes', () => {
    expect(looksLikeId('opt_expand_east')).toBe(true)
    expect(looksLikeId('constraint_budget')).toBe(true)
    expect(looksLikeId('goal_profit')).toBe(true)
    expect(looksLikeId('risk_market_downturn')).toBe(true)
    expect(looksLikeId('out_revenue')).toBe(true)
    expect(looksLikeId('dec_strategy')).toBe(true)
  })

  it('returns true for lowercase underscore-delimited strings without spaces', () => {
    expect(looksLikeId('some_unknown_id')).toBe(true)
    expect(looksLikeId('keeping_monthly_churn')).toBe(true)
  })

  it('returns false for mixed-case underscore labels (likely human-authored)', () => {
    expect(looksLikeId('Net_Profit')).toBe(false)
    expect(looksLikeId('GDP_Growth')).toBe(false)
    expect(looksLikeId('Price_Variance')).toBe(false)
  })

  it('returns false for human-readable labels', () => {
    expect(looksLikeId('Market Share')).toBe(false)
    expect(looksLikeId('Revenue Growth')).toBe(false)
    expect(looksLikeId('Price')).toBe(false)
  })

  it('returns false for labels with both underscores and spaces', () => {
    // Unlikely in practice, but spaces indicate human-authored text
    expect(looksLikeId('some_thing with spaces')).toBe(false)
  })
})

describe('prettifyId', () => {
  it('strips fac_ prefix and title-cases', () => {
    expect(prettifyId('fac_keeping_monthly_churn')).toBe('Keeping Monthly Churn')
  })

  it('strips constraint_fac_ compound prefix', () => {
    expect(prettifyId('constraint_fac_budget')).toBe('Budget')
  })

  it('strips constraint_ prefix', () => {
    expect(prettifyId('constraint_headcount')).toBe('Headcount')
  })

  it('strips opt_ prefix', () => {
    expect(prettifyId('opt_expand_east')).toBe('Expand East')
  })

  it('strips goal_ prefix', () => {
    expect(prettifyId('goal_profit_margin')).toBe('Profit Margin')
  })

  it('handles IDs with no known prefix', () => {
    expect(prettifyId('some_unknown_thing')).toBe('Some Unknown Thing')
  })

  it('handles single-word IDs', () => {
    expect(prettifyId('fac_revenue')).toBe('Revenue')
  })
})

describe('enrichBlocker — ID prettification', () => {
  it('prettifies CEE_BLOCKER action.label when it looks like an ID', () => {
    const blocker: ValidationBlocker = {
      code: 'CEE_BLOCKER',
      message: 'No causal path to goal',
      affectedIds: ['fac_keeping_monthly_churn'],
      action: { type: 'retry_draft', label: 'fac_keeping_monthly_churn' },
    }

    const enriched = enrichBlocker(blocker)

    expect(enriched.display.title).toBe('"Keeping Monthly Churn" is not connected')
  })

  it('preserves human-readable CEE_BLOCKER action.label', () => {
    const blocker: ValidationBlocker = {
      code: 'CEE_BLOCKER',
      message: 'No causal path to goal',
      affectedIds: ['fac_price'],
      action: { type: 'retry_draft', label: 'Price' },
    }

    const enriched = enrichBlocker(blocker)

    expect(enriched.display.title).toBe('"Price" is not connected')
  })
})

// ── hydrateBlockerLabels ────────────────────────────────────────

describe('hydrateBlockerLabels', () => {
  function makeCeeBlocker(factorId: string, actionLabel: string): EnrichedBlocker {
    return enrichBlocker({
      code: 'CEE_BLOCKER',
      message: 'No causal path to goal',
      affectedIds: [factorId],
      action: { type: 'retry_draft', label: actionLabel },
    } as ValidationBlocker)
  }

  it('replaces prettified title with real node label from graph', () => {
    const blocker = makeCeeBlocker('fac_churn', 'fac_churn')
    const nodesById = new Map([['fac_churn', { label: 'Monthly Churn Rate' }]])

    const [hydrated] = hydrateBlockerLabels([blocker], nodesById)

    expect(hydrated.display.title).toBe('"Monthly Churn Rate" is not connected')
  })

  it('keeps prettified title when node has no label', () => {
    const blocker = makeCeeBlocker('fac_churn', 'fac_churn')
    const nodesById = new Map([['fac_churn', {}]])

    const [hydrated] = hydrateBlockerLabels([blocker], nodesById)

    // Falls back to prettified action.label
    expect(hydrated.display.title).toBe('"Churn" is not connected')
  })

  it('keeps prettified title when node label itself looks like an ID', () => {
    const blocker = makeCeeBlocker('fac_churn', 'fac_churn')
    const nodesById = new Map([['fac_churn', { label: 'fac_churn_rate' }]])

    const [hydrated] = hydrateBlockerLabels([blocker], nodesById)

    // Node label is also an ID — don't use it, stick with prettified action.label
    expect(hydrated.display.title).toBe('"Churn" is not connected')
  })

  it('keeps prettified title when node is not in graph', () => {
    const blocker = makeCeeBlocker('fac_churn', 'fac_churn')
    const nodesById = new Map<string, { label?: string }>()

    const [hydrated] = hydrateBlockerLabels([blocker], nodesById)

    expect(hydrated.display.title).toBe('"Churn" is not connected')
  })

  it('does not modify non-CEE_BLOCKER items', () => {
    const enriched = enrichBlocker({
      code: 'MISSING_GOAL_NODE',
      message: 'No goal',
    } as ValidationBlocker)
    const nodesById = new Map([['fac_x', { label: 'X Factor' }]])

    const [result] = hydrateBlockerLabels([enriched], nodesById)

    expect(result.display.title).toBe('No goal selected')
  })
})

// ── deduplicateBlockers ─────────────────────────────────────────

describe('deduplicateBlockers', () => {
  it('removes duplicate blockers with the same factor_id', () => {
    const b1 = enrichBlocker({
      code: 'CEE_BLOCKER',
      message: 'No causal path',
      affectedIds: ['fac_price'],
      action: { type: 'retry_draft', label: 'Price' },
    } as ValidationBlocker)

    const b2 = enrichBlocker({
      code: 'CEE_BLOCKER',
      message: 'Unreachable',
      affectedIds: ['fac_price'],
      action: { type: 'retry_draft', label: 'Price' },
    } as ValidationBlocker)

    const result = deduplicateBlockers([b1, b2])

    expect(result).toHaveLength(1)
    expect(result[0].blocker.message).toBe('No causal path')
  })

  it('keeps blockers with different factor_ids', () => {
    const b1 = enrichBlocker({
      code: 'CEE_BLOCKER',
      message: 'No causal path',
      affectedIds: ['fac_price'],
      action: { type: 'retry_draft', label: 'Price' },
    } as ValidationBlocker)

    const b2 = enrichBlocker({
      code: 'CEE_BLOCKER',
      message: 'No causal path',
      affectedIds: ['fac_revenue'],
      action: { type: 'retry_draft', label: 'Revenue' },
    } as ValidationBlocker)

    const result = deduplicateBlockers([b1, b2])

    expect(result).toHaveLength(2)
  })

  it('deduplicates non-node blockers by code:message key', () => {
    const b1 = enrichBlocker({
      code: 'MISSING_GOAL_NODE',
      message: 'No goal',
    } as ValidationBlocker)

    const b2 = enrichBlocker({
      code: 'MISSING_GOAL_NODE',
      message: 'No goal',
    } as ValidationBlocker)

    const result = deduplicateBlockers([b1, b2])

    expect(result).toHaveLength(1)
  })

  it('keeps non-node blockers with different codes', () => {
    const b1 = enrichBlocker({
      code: 'MISSING_GOAL_NODE',
      message: 'No goal',
    } as ValidationBlocker)

    const b2 = enrichBlocker({
      code: 'NO_OPTIONS',
      message: 'No options',
    } as ValidationBlocker)

    const result = deduplicateBlockers([b1, b2])

    expect(result).toHaveLength(2)
  })

  it('preserves first occurrence (richer CEE metadata)', () => {
    const first = enrichBlocker({
      code: 'CEE_BLOCKER',
      message: 'Detailed: no causal path from any option to factor via DAG edges',
      affectedIds: ['fac_price'],
      action: { type: 'retry_draft', label: 'Price' },
    } as ValidationBlocker)

    const second = enrichBlocker({
      code: 'CEE_BLOCKER',
      message: 'Short msg',
      affectedIds: ['fac_price'],
      action: { type: 'retry_draft', label: 'Price' },
    } as ValidationBlocker)

    const result = deduplicateBlockers([first, second])

    expect(result[0].blocker.message).toBe('Detailed: no causal path from any option to factor via DAG edges')
  })
})
