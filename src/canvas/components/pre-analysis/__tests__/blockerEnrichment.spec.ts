/**
 * blockerEnrichment tests
 *
 * Covers:
 * - getBlockerGuidance returns correct title/description/actions for each code
 * - enrichBlocker applies contextual titles for CEE_BLOCKER and EMPTY_INTERVENTIONS
 * - enrichAndSortBlockers sorts by priority
 * - suggestedActions present on all known blocker codes
 */

import { describe, it, expect } from 'vitest'
import {
  getBlockerGuidance,
  enrichBlocker,
  enrichAndSortBlockers,
} from '../blockerEnrichment'
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
