/**
 * TriageHealthHeader — slot wiring tests added in Brief 5.8B D2a.
 *
 * Scope: the post-analysis hero needs (a) a single-value ring AND dimension
 * bars on the same card, (b) a qualifier slot rendered between headline and
 * bars, and (c) a secondaryIndicator slot rendered below the ring caption.
 * The original component only allowed bars in composite mode and had no
 * caller hooks for either of the new slots.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TriageHealthHeader } from '../TriageHealthHeader'

const ringDims = { structure: 0.6, evidence: 0.7, coverage: 0.5, verified: 0.8 }

describe('TriageHealthHeader — D2a slots', () => {
  it('renders dimension bars in single mode when caller supplies dimensions', () => {
    render(
      <TriageHealthHeader
        title="Decision confidence"
        ringLabel="%"
        ringDimensions={ringDims}
        mode="single"
        overrideScore={62}
        dimensions={[
          { label: 'Evidence', value: 0.6, tooltip: 'tip-evidence' },
          { label: 'Robustness', value: 0.4, tooltip: 'tip-robustness' },
          { label: 'Framing', value: 0.8, tooltip: 'tip-framing' },
        ]}
      />,
    )
    expect(screen.getByText('Evidence')).toBeInTheDocument()
    expect(screen.getByText('Robustness')).toBeInTheDocument()
    expect(screen.getByText('Framing')).toBeInTheDocument()
    expect(screen.getByText('60%')).toBeInTheDocument()
    expect(screen.getByText('40%')).toBeInTheDocument()
    expect(screen.getByText('80%')).toBeInTheDocument()
  })

  it('renders qualifier slot between headline and bars', () => {
    render(
      <TriageHealthHeader
        title="Decision confidence"
        ringLabel="%"
        ringDimensions={ringDims}
        mode="single"
        overrideScore={62}
        headline="Option A leads"
        qualifier={<p data-testid="qual">Confidence limited</p>}
        dimensions={[{ label: 'Evidence', value: 0.4, tooltip: 't' }]}
      />,
    )
    expect(screen.getByTestId('qual')).toBeInTheDocument()
    expect(screen.getByText('Confidence limited')).toBeInTheDocument()
  })

  it('renders secondaryIndicator slot below the ring caption', () => {
    render(
      <TriageHealthHeader
        title="Decision confidence"
        ringLabel="%"
        ringDimensions={ringDims}
        mode="single"
        overrideScore={62}
        ringCaption="win probability"
        secondaryIndicator={<div data-testid="stab">Stability 75%</div>}
      />,
    )
    expect(screen.getByText('win probability')).toBeInTheDocument()
    expect(screen.getByTestId('stab')).toBeInTheDocument()
  })

  it('omits the bars block when no dimensions array is supplied', () => {
    render(
      <TriageHealthHeader
        title="Decision confidence"
        ringLabel="%"
        ringDimensions={ringDims}
        mode="single"
        overrideScore={62}
      />,
    )
    expect(screen.queryByText('Evidence')).not.toBeInTheDocument()
  })

  it('omits the bars block when dimensions is an empty array', () => {
    render(
      <TriageHealthHeader
        title="Decision confidence"
        ringLabel="%"
        ringDimensions={ringDims}
        mode="single"
        overrideScore={62}
        dimensions={[]}
      />,
    )
    expect(screen.queryByText('Evidence')).not.toBeInTheDocument()
  })

  it('renders nothing in qualifier/secondaryIndicator slots when not provided', () => {
    const { container } = render(
      <TriageHealthHeader
        title="Decision confidence"
        ringLabel="%"
        ringDimensions={ringDims}
        mode="single"
        overrideScore={62}
        headline="Option A leads"
      />,
    )
    expect(screen.getByText('Option A leads')).toBeInTheDocument()
    // No stray data-testids leak from the new slots.
    expect(container.querySelector('[data-testid="qual"]')).toBeNull()
    expect(container.querySelector('[data-testid="stab"]')).toBeNull()
  })
})
