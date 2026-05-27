/**
 * ReadinessColourStrip — V17 power pass: dimension-tooltip descriptions.
 *
 * Hover-only descriptions appended to each segment's `title` attribute.
 * Visible legend text and aria-label structure remain unchanged.
 */

import '@testing-library/jest-dom/vitest'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ReadinessColourStrip } from '../ReadinessColourStrip'
import type { DimensionSegment } from '../analysisHeroVM.types'

function dims(): DimensionSegment[] {
  // VM-builder-equivalent fixtures. `tooltip` is set on every segment for
  // backward compatibility but the strip itself reads from DIMENSION_DESCRIPTION
  // (V17 power pass) for the hover text — see strip implementation.
  return [
    { label: 'Structure', value: 0.75, token: 'success', tooltip: 'unused-by-strip' },
    { label: 'Evidence', value: 0.5, token: 'warning', tooltip: 'unused-by-strip' },
    { label: 'Coverage', value: 0.25, token: 'info', tooltip: 'unused-by-strip' },
    { label: 'Verified', value: 0.5, token: 'option', tooltip: 'unused-by-strip' },
  ]
}

describe('ReadinessColourStrip — dimension tooltips', () => {
  it('each segment title contains the dimension description (hover-only)', () => {
    render(<ReadinessColourStrip checkedCount={null} dimensions={dims()} />)
    expect(screen.getByTestId('strip-structure').getAttribute('title'))
      .toBe('Structure: 75% — Goal, options, factors, connections present')
    expect(screen.getByTestId('strip-evidence').getAttribute('title'))
      .toBe('Evidence: 50% — How much the result depends on uncertain inputs')
    expect(screen.getByTestId('strip-coverage').getAttribute('title'))
      .toBe('Coverage: 25% — Alternatives and risks represented')
    expect(screen.getByTestId('strip-verified').getAttribute('title'))
      .toBe('Verified: 50% — Inputs you have confirmed')
  })

  it('Verified title includes checkedCount in parentheses before the description', () => {
    render(
      <ReadinessColourStrip
        checkedCount="3 inputs verified"
        dimensions={dims()}
      />,
    )
    expect(screen.getByTestId('strip-verified').getAttribute('title'))
      .toBe('Verified: 50% (3 inputs verified) — Inputs you have confirmed')
  })

  it('Verified aria-label mirrors the title (with checkedCount + description) — accessibility surface unchanged otherwise', () => {
    render(
      <ReadinessColourStrip
        checkedCount="No inputs verified"
        dimensions={dims()}
      />,
    )
    // Visible legend text stays plain (label only), no description.
    expect(screen.getByText('Structure')).toBeInTheDocument()
    expect(screen.getByText('Evidence')).toBeInTheDocument()
    // aria-label is set on the Verified segment to surface the count to
    // assistive tech; with the V17 power pass the description rides along.
    const verifiedNode = screen.getByTestId('strip-verified')
    expect(verifiedNode.getAttribute('aria-label'))
      .toBe('Verified: 50% (No inputs verified) — Inputs you have confirmed')
  })

  it('visible legend text remains plain labels (no description leak)', () => {
    render(<ReadinessColourStrip checkedCount={null} dimensions={dims()} />)
    // The dimension descriptions must NOT appear as visible legend copy —
    // they live only in the title (and aria-label for Verified).
    expect(screen.queryByText(/Goal, options, factors, connections present/))
      .not.toBeInTheDocument()
    expect(screen.queryByText(/How much the result depends/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Alternatives and risks represented/)).not.toBeInTheDocument()
    expect(screen.queryByText(/Inputs you have confirmed/)).not.toBeInTheDocument()
  })
})
