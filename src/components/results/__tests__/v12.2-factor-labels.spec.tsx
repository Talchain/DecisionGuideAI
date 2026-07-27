/**
 * V12.2 Fix 3 & Fix 5: Factor label resolution
 * Tests for resolving raw factor IDs to human-readable labels
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ChallengeSection } from '../ChallengeSection'
import { humaniseCritique } from '../utils/humaniseCritique'
import type { ActionItem } from '../utils/groupActionItems'
import type { UncertaintyItem, DriverItem } from '../types'

// ─── Fix 3: Bias finding affected_elements resolution ──────────────────────

describe('Fix 3: Bias finding affected_elements shows factor labels', () => {
  it('resolves factor ID to label from evidence gaps', () => {
    const biasFindings: ActionItem[] = [
      {
        id: 'bias-1',
        title: 'Anchoring bias detected',
        affectedNodeIds: ['fac_engineering_capacity'],
        source: 'model',
      },
    ]

    const evidenceGaps: UncertaintyItem[] = [
      {
        code: 'EVIDENCE_GAP',
        message: 'Missing data',
        factorId: 'fac_engineering_capacity',
        factorLabel: 'Engineering Capacity',
        targetNodeId: 'fac_engineering_capacity',
        voi: 0.5,
      },
    ]

    render(
      <ChallengeSection
        designationsWithheld={false}
        biasFindings={biasFindings}
        preMortemItems={[]}
        evidenceGaps={evidenceGaps}
        drivers={[]}
      />
    )

    // Should show resolved label, not raw ID
    expect(screen.getByText('Engineering Capacity')).toBeInTheDocument()
    expect(screen.queryByText('fac_engineering_capacity')).not.toBeInTheDocument()
  })

  it('resolves factor ID to label from drivers when not in evidence gaps', () => {
    const biasFindings: ActionItem[] = [
      {
        id: 'bias-1',
        title: 'Confirmation bias detected',
        affectedNodeIds: ['fac_market_size'],
        source: 'model',
      },
    ]

    const drivers: DriverItem[] = [
      {
        factorKey: 'fac_market_size',
        factorLabel: 'Market Size',
        matchedNodeId: 'fac_market_size',
        normalisedInfluence: 0.8,
        rawElasticity: 0.3,
        label: 'high',
        confidence: 0.7,
      },
    ]

    render(
      <ChallengeSection
        designationsWithheld={false}
        biasFindings={biasFindings}
        preMortemItems={[]}
        evidenceGaps={[]}
        drivers={drivers}
      />
    )

    expect(screen.getByText('Market Size')).toBeInTheDocument()
    expect(screen.queryByText('fac_market_size')).not.toBeInTheDocument()
  })

  it('falls back to derived label when ID not in lookup data', () => {
    const biasFindings: ActionItem[] = [
      {
        id: 'bias-1',
        title: 'Bias detected',
        affectedNodeIds: ['fac_integration_complexity'],
        source: 'model',
      },
    ]

    render(
      <ChallengeSection
        designationsWithheld={false}
        biasFindings={biasFindings}
        preMortemItems={[]}
        evidenceGaps={[]}
        drivers={[]}
      />
    )

    // Should derive label: fac_integration_complexity → Integration Complexity
    expect(screen.getByText('Integration Complexity')).toBeInTheDocument()
    expect(screen.queryByText('fac_integration_complexity')).not.toBeInTheDocument()
  })

  it('handles multiple affected elements', () => {
    const biasFindings: ActionItem[] = [
      {
        id: 'bias-1',
        title: 'Multiple factors affected',
        affectedNodeIds: ['fac_revenue', 'fac_cost', 'fac_market_share'],
        source: 'model',
      },
    ]

    const evidenceGaps: UncertaintyItem[] = [
      {
        code: 'EVIDENCE_GAP',
        message: 'Missing data',
        factorId: 'fac_revenue',
        factorLabel: 'Revenue',
        targetNodeId: 'fac_revenue',
        voi: 0.5,
      },
    ]

    render(
      <ChallengeSection
        designationsWithheld={false}
        biasFindings={biasFindings}
        preMortemItems={[]}
        evidenceGaps={evidenceGaps}
        drivers={[]}
      />
    )

    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Cost')).toBeInTheDocument()
    expect(screen.getByText('Market Share')).toBeInTheDocument()
  })
})

// ─── Fix 5: Constraint investigate items name the factor ───────────────────

describe('Fix 5: Constraint investigate items name the factor', () => {
  it('CONSTRAINT_TARGET_NO_OBSERVED_VALUE uses factor label in title', () => {
    const nodeLabels = new Map([
      ['fac_customer_churn', 'Customer Churn Rate'],
    ])

    const item: UncertaintyItem = {
      code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
      message: 'constraint_fac_customer_churn_max has no observed_state.value set',
      affectedNodes: ['fac_customer_churn'],
      factorId: 'fac_customer_churn',
      voi: 0,
    }

    const result = humaniseCritique(item, nodeLabels)

    expect(result.title).toBe('Customer Churn Rate has no estimate set')
    expect(result.title).not.toContain('This factor')
    expect(result.factorId).toBe('fac_customer_churn')
  })

  it('CONSTRAINT_MISSING_RANGE uses factor label in title', () => {
    const nodeLabels = new Map([
      ['fac_revenue_target', 'Revenue Target'],
    ])

    const item: UncertaintyItem = {
      code: 'CONSTRAINT_MISSING_RANGE',
      message: 'constraint range missing',
      affectedNodes: ['fac_revenue_target'],
      factorId: 'fac_revenue_target',
      voi: 0,
    }

    const result = humaniseCritique(item, nodeLabels)

    expect(result.title).toBe('Revenue Target is missing a range for its constraint')
    expect(result.title).not.toContain('This factor')
  })

  it('derives factor label from ID when not in nodeLabels map', () => {
    const nodeLabels = new Map()  // Empty map

    const item: UncertaintyItem = {
      code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
      message: 'No observed value',
      affectedNodes: ['fac_market_penetration'],
      factorId: 'fac_market_penetration',
      voi: 0,
    }

    const result = humaniseCritique(item, nodeLabels)

    // Should derive: fac_market_penetration → Market Penetration
    expect(result.title).toBe('Market Penetration has no estimate set')
    expect(result.title).not.toContain('This factor')
    expect(result.title).not.toContain('fac_')
  })

  it('falls back to "This factor" when no affectedNodes', () => {
    const item: UncertaintyItem = {
      code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
      message: 'No observed value',
      affectedNodes: undefined,
      voi: 0,
    }

    const result = humaniseCritique(item)

    expect(result.title).toBe('This factor has no estimate set')
  })

  it('derives correct labels for various factor ID patterns', () => {
    const testCases = [
      { id: 'fac_customer_acquisition_cost', expected: 'Customer Acquisition Cost' },
      { id: 'fac_churn', expected: 'Churn' },
      { id: 'fac_ltv', expected: 'Ltv' },
      { id: 'fac_sales_cycle_length', expected: 'Sales Cycle Length' },
      { id: 'revenue_target', expected: 'Revenue Target' },  // No fac_ prefix
    ]

    testCases.forEach(({ id, expected }) => {
      const item: UncertaintyItem = {
        code: 'CONSTRAINT_TARGET_NO_OBSERVED_VALUE',
        message: 'test',
        affectedNodes: [id],
        factorId: id,
        voi: 0,
      }

      const result = humaniseCritique(item)
      expect(result.title).toBe(`${expected} has no estimate set`)
    })
  })
})
