/**
 * ⭐ C4 — "Not assessed" on a Reasoning row is a STATUS, so it is a mark.
 *
 * The design system's Tier 3: status icons are always visible and REPLACE text
 * labels. The words "Not assessed" rendered on 5 rows of the market-entry
 * render (4 drivers, 1 gap). R1 makes `HelpCircle` the panel's one glyph for an
 * unresolved question, and this is the Reasoning tab's own "not assessed"
 * glyph already (`WhatWeChecked`).
 *
 * ⚠ THE WORDS SURVIVE for assistive tech and on hover: the mark is `role="img"`
 * named "Not assessed", so the row toggle's accessible name still says it.
 * ⚠ ONLY `not_assessed` MOVES. "Provisional" and "From an earlier run" are
 * different claims with no ruled glyph; they stay words (contrast below).
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { DisclosureRow } from '../DisclosureRow'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { AnalysisNewFinding } from '../analysisNewTypes'

const finding = (marker: AnalysisNewFinding['marker']): AnalysisNewFinding => ({
  id: 'driver:f_adopt',
  headline: 'Customer adoption',
  implication: 'Among the strongest influences in this run.',
  detail: 'These numbers are sensitive to this relationship.',
  groundedIn: 'factor sensitivity, ranked within this run',
  marker,
  inspect: [],
})

describe('C4 · "Not assessed" is the unresolved-question mark', () => {
  it('the marker is an image named "Not assessed", drawing HelpCircle, with no visible words', () => {
    render(<DisclosureRow finding={finding('not_assessed')} testIdPrefix="row" />)
    const mark = screen.getByRole('img', { name: COPY.markers.notAssessed })
    expect(mark).toBe(screen.getByTestId('row-marker'))
    expect(mark.textContent?.trim()).toBe('')
    expect(mark.querySelector('svg.lucide-help-circle')).not.toBeNull()
    expect(mark).toHaveAttribute('title', COPY.markers.notAssessed)
  })

  it('the row toggle still SAYS "Not assessed" to assistive tech', () => {
    render(<DisclosureRow finding={finding('not_assessed')} testIdPrefix="row" />)
    expect(screen.getByTestId('row-row-toggle')).toHaveAccessibleName(/Not assessed/)
  })

  it('CONTRAST: "Provisional" is not a ruled glyph, so it stays words', () => {
    render(<DisclosureRow finding={finding('provisional')} testIdPrefix="row" />)
    const marker = screen.getByTestId('row-marker')
    expect(marker).toHaveTextContent(COPY.markers.provisional)
    expect(marker.querySelector('svg')).toBeNull()
  })
})
