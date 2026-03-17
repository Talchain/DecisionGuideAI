/**
 * Audit F-57 regression: UnifiedStatusBadge must not fabricate numeric scores
 * from categorical confidence labels.
 *
 * The badge should display categorical labels directly (High/Medium/Low Confidence)
 * without converting them to fabricated numeric percentages.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { UnifiedStatusBadge, UnifiedStatusBadgeCompact } from '../UnifiedStatusBadge'
import type { DecisionReadiness } from '../../../types/plot'
import type { GraphQuality } from '../../../types/plot'

function makeReadiness(confidence: 'high' | 'medium' | 'low'): DecisionReadiness {
  return {
    confidence,
    blockers: [],
    warnings: [],
  }
}

function makeQuality(score: number): GraphQuality {
  return {
    score,
    issues_count: 0,
    recommendation: null,
  } as GraphQuality
}

describe('Audit F-57: UnifiedStatusBadge displays categorical labels, no fabricated scores', () => {
  it('displays "High Confidence" label without a fabricated percentage', () => {
    render(
      <UnifiedStatusBadge
        readiness={makeReadiness('high')}
        quality={makeQuality(0.8)}
      />
    )
    const badge = screen.getByTestId('unified-status-badge')
    const text = badge.textContent ?? ''

    expect(text).toContain('High Confidence')
    // Must NOT contain fabricated "80%" from high→0.8 mapping
    expect(text).not.toMatch(/\b80%/)
  })

  it('displays "Medium Confidence" without fabricated "50%"', () => {
    render(
      <UnifiedStatusBadge
        readiness={makeReadiness('medium')}
        quality={makeQuality(0.6)}
      />
    )
    const badge = screen.getByTestId('unified-status-badge')
    const text = badge.textContent ?? ''

    expect(text).toContain('Confidence')
    // Must NOT contain fabricated "50%" from medium→0.5 mapping
    expect(text).not.toMatch(/\b50%/)
  })

  it('displays "Low Confidence" without fabricated "30%"', () => {
    render(
      <UnifiedStatusBadge
        readiness={makeReadiness('low')}
        quality={makeQuality(0.2)}
      />
    )
    const badge = screen.getByTestId('unified-status-badge')
    const text = badge.textContent ?? ''

    expect(text).toContain('Low Confidence')
    // Must NOT contain fabricated "30%" from low→0.3 mapping
    expect(text).not.toMatch(/\b30%/)
  })

  it('compact variant also does not display fabricated percentages', () => {
    render(
      <UnifiedStatusBadgeCompact
        readiness={makeReadiness('high')}
        quality={makeQuality(0.8)}
      />
    )
    const compact = screen.getByTestId('unified-status-compact')
    const text = compact.textContent ?? ''

    expect(text).toContain('High Confidence')
    expect(text).not.toMatch(/\b80%/)
  })

  it('uses real numeric confidenceScore when provided (not fabricated)', () => {
    render(
      <UnifiedStatusBadge
        readiness={makeReadiness('low')}
        quality={makeQuality(0.8)}
        confidenceScore={0.92}
      />
    )
    const badge = screen.getByTestId('unified-status-badge')
    const text = badge.textContent ?? ''

    // When a real score is provided, it drives tier selection but is NOT displayed as "%"
    // Status should be "Ready to Review" (quality=0.8, confScore=0.92 → both high)
    expect(text).toContain('Ready to Review')
    expect(text).toContain('High Confidence')
  })
})
