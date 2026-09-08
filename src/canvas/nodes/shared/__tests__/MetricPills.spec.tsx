/**
 * MetricPills — what survives after the influence pill was deleted.
 *
 * ⚠ THIS FILE USED TO BE THE INFLUENCE-SCALE DISCLOSURE SPEC (lane C4), and
 * four of its six tests rendered `<MetricPills influencePct={...} />` directly.
 * Those tests were REACHABLE ONLY FROM THE SPEC: influence moved to the shared
 * `NodeMetricRow` on 1 Sep 2026, and from then on the single `<MetricPills>`
 * mount (FactorNode) passed `influenceProvenance` but never `influencePct`, so
 * `hasInfluence` was false on every render in the product. The branch and its
 * tests are deleted together.
 *
 * THE DISCLOSURE ITSELF IS NOT LOST — it moved with the number. The claim that
 * a per-set-normalised figure must never read as an absolute causal share is
 * pinned on the surviving surface by
 * `FactorNode.spec.tsx` ("passes influence provenance ... (C4)", re-pointed to
 * the row on 1 Sep and deliberately not relaxed) and by
 * `components/results/__tests__/influenceIsNeverCalledAbsolute.spec.ts`.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricPills } from '../MetricPills'

describe('MetricPills', () => {
  it('renders nothing when no metric is present', () => {
    const { container } = render(<MetricPills />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the confidence pill', () => {
    render(<MetricPills confidencePct={45} />)
    expect(screen.getByText('Confidence 45%')).toBeDefined()
  })
})
