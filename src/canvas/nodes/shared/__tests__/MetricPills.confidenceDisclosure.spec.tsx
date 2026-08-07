/**
 * MetricPills — the confidence figure can never render BARE.
 *
 * The number itself is gated upstream (useNodeDisplayMetadata → the shared
 * display policy), so today this pill shows no confidence at all. These tests
 * cover the contract for the day the policy is flipped: whatever disclosure
 * flags the policy hands down MUST travel with the number, in the same element.
 *
 * ESCAPE THIS TEST IS WRITTEN TO CATCH: `container.textContent` welds adjacent
 * text nodes, so "Confidence 25%" + "*" reads as "Confidence 25%*" and a
 * whole-document `toContain` assertion cannot tell WHICH element carries what —
 * a disclosure rendered somewhere else entirely (or nowhere near the number)
 * would still pass. Every assertion below resolves the pill by testid and reads
 * that element's own attributes.
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MetricPills } from '../MetricPills'

describe('MetricPills — confidence disclosure travels with the number', () => {
  it('marks a defaulted figure on the SAME element as the number', () => {
    render(<MetricPills confidencePct={25} confidenceIsDefaulted confidenceIsProvisional />)
    const pill = screen.getByTestId('metric-pill-confidence')

    // The number and the disclosure are one element — not two siblings that a
    // layout change could separate.
    expect(pill.textContent).toContain('25%')
    expect(pill.getAttribute('aria-label')).toContain('Default estimate')
    expect(pill.getAttribute('aria-label')).toContain('Calibration is provisional')
    expect(pill.getAttribute('title')).toContain('Default estimate')
    expect(screen.getByTestId('metric-pill-confidence-default-estimate')).toBeDefined()
  })

  it('does NOT claim a default estimate when the policy did not say so', () => {
    render(<MetricPills confidencePct={45} />)
    const pill = screen.getByTestId('metric-pill-confidence')

    // Anti-vacuity: the pill IS rendered and DOES carry the number…
    expect(pill.textContent).toContain('45%')
    // …and only then is the absence of the marker meaningful.
    expect(screen.queryByTestId('metric-pill-confidence-default-estimate')).toBeNull()
    expect(pill.getAttribute('aria-label')).not.toContain('Default estimate')
    expect(pill.getAttribute('aria-label')).not.toContain('provisional')
  })

  it('discloses provisional calibration independently of defaulting', () => {
    render(<MetricPills confidencePct={70} confidenceIsProvisional />)
    const pill = screen.getByTestId('metric-pill-confidence')
    expect(pill.getAttribute('aria-label')).toContain('Calibration is provisional')
    expect(pill.getAttribute('aria-label')).not.toContain('Default estimate')
    expect(screen.queryByTestId('metric-pill-confidence-default-estimate')).toBeNull()
  })

  it('renders no confidence pill at all when the policy withheld the number', () => {
    // The live state today. Note the influence pill is still asked for, so a
    // pass here cannot come from the component rendering nothing.
    render(<MetricPills influencePct={80} confidencePct={null} confidenceIsDefaulted />)
    expect(screen.getByText('Influence 80%')).toBeDefined()
    expect(screen.queryByTestId('metric-pill-confidence')).toBeNull()
    expect(screen.queryByTestId('metric-pill-confidence-default-estimate')).toBeNull()
  })
})
