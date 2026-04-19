/**
 * ResultsFooter — Brief 5.2 Task 1 tier-aware stability label.
 *
 * Locks the rendered text for tier × stability combinations. The footer is
 * the second surface where Brief 5.2 calibration matters (after the hero
 * headline in DecisionConfidencePanel): an evidence-weak bundle must read
 * "Stability sensitive" regardless of numeric stability.
 */

import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ResultsFooter } from '../ResultsFooter'

function getFooterText(): string {
  return screen.getByTestId('results-footer').textContent ?? ''
}

describe('ResultsFooter — Brief 5.2 Task 1 tier-aware label', () => {
  describe('strong tier + high numeric stability → "Stable result"', () => {
    it('97% stability renders "Stable result · 97%"', () => {
      render(
        <ResultsFooter
          stability={0.97}
          confidenceTier="strong"
          coachingReadiness="ready"
        />,
      )
      const text = getFooterText()
      expect(text).toContain('Stable result')
      expect(text).toContain('97%')
      expect(text).not.toContain('Stability sensitive')
    })
  })

  describe('weak tier at high numeric stability → "Stability sensitive"', () => {
    it('needs_work + 97% stability renders "Stability sensitive" not "Stable result" (bundle 609164c7)', () => {
      render(
        <ResultsFooter
          stability={0.97}
          confidenceTier="needs_work"
          coachingReadiness="needs_evidence"
        />,
      )
      const text = getFooterText()
      expect(text).toContain('Stability sensitive')
      expect(text).not.toContain('Stable result')
      expect(text).toContain('97%')
    })

    it.each([
      ['needs_evidence' as const],
      ['needs_framing' as const],
      ['low' as const],
      ['not_ready' as const],
    ])('weak readiness %s at 95%% stability still reads "Stability sensitive"', (readiness) => {
      render(
        <ResultsFooter
          stability={0.95}
          confidenceTier="strong"
          coachingReadiness={readiness}
        />,
      )
      const text = getFooterText()
      expect(text).toContain('Stability sensitive')
      expect(text).not.toContain('Stable result')
    })
  })

  describe('passthrough at low numeric stability', () => {
    it('strong tier + 0.55 stability → "Sensitive to assumptions"', () => {
      render(
        <ResultsFooter
          stability={0.55}
          confidenceTier="strong"
          coachingReadiness="ready"
        />,
      )
      const text = getFooterText()
      expect(text).toContain('Sensitive to assumptions')
    })

    it('weak tier + 0.3 stability still reads "Stability sensitive" (unified wording)', () => {
      render(
        <ResultsFooter
          stability={0.3}
          confidenceTier="needs_work"
        />,
      )
      const text = getFooterText()
      expect(text).toContain('Stability sensitive')
    })
  })

  describe('absent props fall back to numeric classification', () => {
    it('no tier / no readiness → numeric label', () => {
      render(<ResultsFooter stability={0.9} />)
      const text = getFooterText()
      expect(text).toContain('Stable result')
    })
  })

  it('influence percentage renders when provided', () => {
    render(
      <ResultsFooter
        stability={0.9}
        influencePct={0.62}
        confidenceTier="strong"
        coachingReadiness="ready"
      />,
    )
    const text = getFooterText()
    expect(text).toContain('62% of influence')
  })
})
