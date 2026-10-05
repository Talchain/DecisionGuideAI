/**
 * The inspector's influence row says INFLUENCE, in the Drivers panel's words.
 *
 * Defect (staging since #2467, "plain strength disclosure"): `ImportanceBar` banded an influence score with the
 * CONFIDENCE vocabulary, so a factor ranked 1st at 62% influence read "1st · Low confidence · Influence on results".
 * An influence is not a confidence. The band now reads `influenceTierLabel` (the one owner of the 0.50 / 0.20
 * thresholds) in the words "What's driving this" already uses; the exact percentage stays behind "Show details".
 */
import { describe, it, expect, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { ImportanceBar } from '../ImportanceBar'
import { scienceBand, scienceQuantityText } from '../../../../../components/science/ScienceQuantity'
import { getConfidenceLabel } from '../../../../components/model-tab/strengthBands'
import { DriversSection } from '../../../../../components/results/DriversSection'
import type { DriversSectionData, DriverItem } from '../../../../../components/results/types'

vi.mock('../../../../utils/focusHelpers', () => ({
  focusNodeById: vi.fn(),
  focusByTarget: vi.fn(),
  focusExistingTarget: vi.fn(),
}))

describe('ImportanceBar: an influence reads as an influence', () => {
  it('⭐ a 1st-ranked 62% influence reads "High-impact driver" by default, never a confidence word, and 62% only behind Show details', () => {
    render(<ImportanceBar importanceScore={0.62} sensitivityRank={1} influenceProvenance="normalised_elasticity" />)
    const bar = screen.getByTestId('importance-bar')
    expect(bar.textContent).toBe('1stHigh-impact driverInfluence on resultsShow details')
    expect(bar.textContent).not.toMatch(/confidence/i)
    expect(bar.textContent).not.toMatch(/\d\s*%/)

    fireEvent.click(within(bar).getByRole('button', { name: 'Show details' }))
    expect(within(bar).getByText('62%')).toBeInTheDocument()
    expect(within(bar).getByRole('progressbar', { name: 'Relative influence' }).getAttribute('aria-valuenow')).toBe('62')
  })

  it('the band follows the one threshold owner: 0.50 high-impact, 0.20 moderate, below that lower', () => {
    expect(scienceBand('influence', 0.5)).toBe('High-impact driver')
    expect(scienceBand('influence', 0.49)).toBe('Moderate influence')
    expect(scienceBand('influence', 0.2)).toBe('Moderate influence')
    expect(scienceBand('influence', 0.19)).toBe('Lower influence')
    expect(scienceQuantityText('influence', 0.62, false, true)).toBe('62%')
  })

  it('the same influence reads the same words in the inspector and in "What\'s driving this"', () => {
    const driver: DriverItem = {
      factorKey: 'starter_tier',
      factorLabel: 'Starter tier availability',
      rawElasticity: 0.3,
      normalisedInfluence: 0.3,
      influenceScore: 0.3,
      rank: 2,
      direction: 'positive',
      semanticLabel: 'moderate',
      canFocus: true,
      matchedNodeId: 'starter_tier',
      displayInfluence: 0.3,
      displayProvenance: 'influence_score',
    }
    const data: DriversSectionData = {
      drivers: [driver],
      topDrivers: [],
      driversStatus: 'computed',
      totalCount: 1,
      hasMagnitudeData: true,
    }
    render(<DriversSection data={data} goalLabel="MRR" />)
    const pill = screen.getByTestId('driver-influence-pill-starter_tier').textContent
    render(<ImportanceBar importanceScore={0.3} sensitivityRank={2} influenceProvenance="influence_score" />)
    expect(pill).toBe('Moderate influence')
    expect(screen.getByTestId('importance-bar').textContent).toBe(`2nd${pill}Influence on resultsShow details`)
  })

  it('CONTRAST: the confidence, strength and probability words are unchanged', () => {
    for (const v of [0.1, 0.45, 0.62, 0.9]) expect(scienceBand('confidence', v)).toBe(getConfidenceLabel(v))
    expect(scienceBand('strength', 0.45)).toBe('Strong')
    expect(scienceQuantityText('probability', 0.62, false, true)).toBe('62%')
  })
})
