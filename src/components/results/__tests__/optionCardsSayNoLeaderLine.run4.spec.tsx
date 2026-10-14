/**
 * ⭐ Run-4 judge, BLOCKING for Batch F (DL 12 Oct; live/runs/2026-10-12T172858Z/capacity/03-run-results.json, UI 616bbf21):
 * capacity's Results option card for ‘Add one specialist’ said
 *   "Supported in more simulated scenarios than any other option, but this depends on Additional specialist capacity"
 * beside its goal chance ("about 36% chance of meeting your goal"). That is a leader claim built from a win share; ruling A
 * and the guiding principle allow no "more than any other option". CEE does not send it; `OptionCards` composed it. The line
 * goes, and no words replace it.
 *
 * The card is rendered with the served facts: the leader claim permitted (canonical `leader_licence: 'permitted'`), the
 * winner ‘Add one specialist’, both options carrying a win share (the arm that composes the line), and the fragile-edge
 * hinge the served sentence names. The served text is the RED oracle.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import type { HingeInfo, OptionResult } from '../types'

/** The served card's second line, verbatim (03-run-results.json, option-card-add_one_specialist). */
const SERVED_LINE = 'Supported in more simulated scenarios than any other option, but this depends on Additional specialist capacity'

const option = (id: string, label: string, winProbability: number, extra: Partial<OptionResult> = {}) => ({
  id, label, expected: 0.5, outcome: { mean: 0.5, p10: 0.4, p50: 0.5, p90: 0.6 }, winProbability, nValidSamples: 1000, ...extra,
}) as unknown as OptionResult
const KEEP = option('keep_current_staffing', 'Keep current staffing', 0.3, { isBaseline: true } as Partial<OptionResult>)
const ADD = option('add_one_specialist', 'Add one specialist', 0.7)
const HINGE: HingeInfo = { label: 'Additional specialist capacity', nodeId: 'additional_specialist_capacity', kind: 'edge',
  reason: 'fragile_edge', edgeDetail: null } as HingeInfo

function cards(hinge: HingeInfo | null) {
  render(<OptionCards options={[KEEP, ADD]} winnerId={ADD.id} hasLeadingOption hinge={hinge} />)
  return screen.getByTestId(`option-card-${ADD.id}`).textContent ?? ''
}

describe('run 4: the option card makes no leader claim from a win share', () => {
  it('⭐ the winner card no longer says the served line, and no words take its place', () => {
    const text = cards(HINGE)
    expect(text).not.toContain(SERVED_LINE)
    expect(text).not.toMatch(/than any other option/i)
    // No replacement: the hinge clause was only ever the claim's tail.
    expect(text).not.toContain('but this depends on')
  })

  it('without a hinge too: no "more simulated scenarios than any other option"', () => {
    expect(cards(null)).not.toMatch(/more simulated scenarios than any other option/i)
  })

  it('CONTROL: the baseline card keeps its own line (only the winner\'s claim is removed)', () => {
    cards(HINGE)
    expect(screen.getByTestId(`option-card-${KEEP.id}`).textContent).toContain('Baseline')
  })
})
