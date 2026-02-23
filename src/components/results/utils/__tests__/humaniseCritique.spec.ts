import { describe, it, expect, vi } from 'vitest'
import { humaniseCritique } from '../humaniseCritique'
import type { UncertaintyItem } from '../../types'

function makeItem(overrides: Partial<UncertaintyItem> = {}): UncertaintyItem {
  return {
    code: 'UNKNOWN',
    message: 'targets factor node constraint_fac_customer_churn_max observed_state.value intercept=0',
    ...overrides,
  }
}

describe('humaniseCritique', () => {
  describe('mapped codes', () => {
    it('MISSING_OBSERVED_STATE with resolved label', () => {
      const labels = new Map([['fac_churn', 'Customer churn']])
      const result = humaniseCritique(
        makeItem({ code: 'MISSING_OBSERVED_STATE', affectedNodes: ['fac_churn'] }),
        labels,
      )
      expect(result.title).toBe('Customer churn is missing a current value')
      expect(result.description).toContain('default was assumed')
      expect(result.suggestion).toContain('Customer churn')
      expect(result.factorId).toBe('fac_churn')
    })

    it('CONSTRAINT_MISSING_VALUE with resolved label', () => {
      const labels = new Map([['fac_rev', 'Revenue']])
      const result = humaniseCritique(
        makeItem({ code: 'CONSTRAINT_MISSING_VALUE', affectedNodes: ['fac_rev'] }),
        labels,
      )
      expect(result.title).toContain('Revenue')
      expect(result.title).toContain("can't be fully evaluated")
      expect(result.factorId).toBe('fac_rev')
    })

    it('LOW_EVIDENCE', () => {
      const result = humaniseCritique(makeItem({ code: 'LOW_EVIDENCE' }))
      expect(result.title).toBe('Limited evidence available')
      expect(result.description).toContain('evidence coverage')
    })

    it('NO_RISK_NODES', () => {
      const result = humaniseCritique(makeItem({ code: 'NO_RISK_NODES' }))
      expect(result.title).toBe('No risk factors connected')
    })

    it('ORPHAN_NODES', () => {
      const result = humaniseCritique(makeItem({ code: 'ORPHAN_NODES' }))
      expect(result.title).toContain("aren't connected")
    })

    it('DECISION_AFTER_OUTCOME', () => {
      const result = humaniseCritique(makeItem({ code: 'DECISION_AFTER_OUTCOME' }))
      expect(result.title).toBe('Model structure needs review')
    })

    it('ASSUMPTIONS_USED', () => {
      const result = humaniseCritique(makeItem({ code: 'ASSUMPTIONS_USED' }))
      expect(result.title).toBe('Default assumptions applied')
    })

    it('EMPTY_COMPUTED_RESULTS', () => {
      const result = humaniseCritique(makeItem({ code: 'EMPTY_COMPUTED_RESULTS' }))
      expect(result.title).toBe('Analysis returned limited results')
    })
  })

  describe('unknown code fallback', () => {
    it('uses safe fallback title and description', () => {
      const result = humaniseCritique(
        makeItem({
          code: 'NEVER_SEEN_BEFORE',
          message: 'constraint_fac_customer_churn_max observed_state.value intercept=0',
        }),
      )
      expect(result.title).toBe("Review this factor's inputs")
      expect(result.description).toContain("isn't available yet")
      // V12.1: Unmapped codes must NOT have suggestion — banner filter (suggestion != null)
      // excludes them from the attention banner above the hero.
      expect(result.suggestion).toBeUndefined()
    })

    it('does NOT include raw message in any output field', () => {
      const rawMessage = 'constraint_fac_customer_churn_max observed_state.value intercept=0'
      const result = humaniseCritique(
        makeItem({ code: 'TOTALLY_UNKNOWN', message: rawMessage }),
      )
      expect(result.title).not.toContain('constraint_fac')
      expect(result.title).not.toContain('observed_state')
      expect(result.title).not.toContain('intercept=0')
      expect(result.description).not.toContain('constraint_fac')
      expect(result.description).not.toContain('observed_state')
      expect(result.description).not.toContain('intercept=0')
      if (result.suggestion) {
        expect(result.suggestion).not.toContain('constraint_fac')
        expect(result.suggestion).not.toContain('observed_state')
      }
    })

    it('logs raw message in development only', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      humaniseCritique(makeItem({ code: 'UNKNOWN_CODE', message: 'raw stuff' }))
      warnSpy.mockRestore()
      // Note: import.meta.env.DEV determines if warn fires; in test it typically is true
    })
  })

  describe('factor label resolution', () => {
    it('resolves from nodeLabels via affectedNodes', () => {
      const labels = new Map([['node_123', 'Market share']])
      const result = humaniseCritique(
        makeItem({ code: 'MISSING_OBSERVED_STATE', affectedNodes: ['node_123'] }),
        labels,
      )
      expect(result.title).toContain('Market share')
      expect(result.factorId).toBe('node_123')
    })

    it('does NOT extract fac_ pattern from message (global rule: nodeId lookup only)', () => {
      const labels = new Map([['fac_customer_churn', 'Customer churn']])
      const result = humaniseCritique(
        makeItem({
          code: 'MISSING_OBSERVED_STATE',
          message: 'targets factor node fac_customer_churn',
          affectedNodes: undefined,
        }),
        labels,
      )
      // Should use "This factor" fallback, NOT parse label from message
      expect(result.title).toContain('This factor')
      expect(result.factorId).toBeUndefined()
    })

    it('falls back to "This factor" when node not found in labels map', () => {
      const result = humaniseCritique(
        makeItem({ code: 'MISSING_OBSERVED_STATE', affectedNodes: ['unknown_id'] }),
        new Map(),
      )
      expect(result.title).toContain('This factor')
      expect(result.factorId).toBe('unknown_id')
    })

    it('falls back to "This factor" when no nodeLabels provided', () => {
      const result = humaniseCritique(
        makeItem({ code: 'MISSING_OBSERVED_STATE', affectedNodes: ['some_id'] }),
      )
      expect(result.title).toContain('This factor')
    })

    it('falls back to "This factor" when no affectedNodes', () => {
      const result = humaniseCritique(
        makeItem({ code: 'MISSING_OBSERVED_STATE', message: 'some generic message', affectedNodes: undefined }),
      )
      expect(result.title).toContain('This factor')
      expect(result.factorId).toBeUndefined()
    })
  })
})
