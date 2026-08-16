/**
 * RESIDUAL COMPARATIVE SURFACES — the per-option win readout
 * (ROADMAP 1.239, residual 3). RELABEL, not gate.
 *
 * The probe found "Leads NN%" 18 times on EVERY run including withheld ones:
 * the Likely-outcome lens labels every option "Leads 52% / Leads 30% /
 * Leads 18%". Because the verb is applied to ALL options it makes no single
 * designation — but it is a leader VERB attached to a metric, and the ordinal
 * is legible straight off it.
 *
 * VERDICT: relabel to the noun, exactly as #493 did for WinGauge's
 * "Leads across scenarios" → "Win probability across scenarios". Gating would
 * be the wrong instrument twice over: it would delete the win-probability
 * DATA from the panel (over-suppression), and a carve-out list of "leader
 * words that are actually fine" is the hand-maintained mirror CLAUDE.md trap
 * 12 exists to warn about. The noun is not invented copy — it is already what
 * the canvas node, WinGauge and the confidence ring caption say.
 *
 * Number-first matches the sibling readout in the same copy module
 * (`goal.hitReadout`: "{formatted} hit target"), so the two lenses stay one
 * voice.
 *
 * ⚠ THE COPY-MODULE ARM IS GONE WITH ITS DECK (V7 retirement). This file opened
 * with a describe over `V7_LENS_COPY.outcome.winReadout`, which DELEGATED to
 * `COMPARATIVE_COPY.phrase`. The deck is deleted. `RangeVisualization` — the
 * surviving surface below — reads `COMPARATIVE_COPY.phrase` DIRECTLY, so the
 * rendered claim is measured on the live surface rather than on a delegation,
 * and nothing about the register's own wording is lost: it is pinned in
 * `utils/goalAnchorCopy.ts`'s own suite.
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { RangeVisualization } from '../RangeVisualization'
import type { OptionResult } from '../types'

const OPTIONS: OptionResult[] = [
  {
    id: 'opt_mac',
    label: 'Standardise on MacBook Pro',
    expected: 68,
    outcome: { mean: 68, p10: 54, p50: 67, p90: 82 },
    p10: 54,
    p50: 67,
    p90: 82,
    isRecommended: true,
    winProbability: 0.66,
    goalProbability: 0.75,
  },
  {
    id: 'opt_dell',
    label: 'Standardise on Dell XPS',
    expected: 41,
    outcome: { mean: 41, p10: 30, p50: 40, p90: 52 },
    p10: 30,
    p50: 40,
    p90: 52,
    isRecommended: false,
    winProbability: 0.31,
    goalProbability: 0.4,
  },
] as unknown as OptionResult[]

describe('RangeVisualization per-option probability text (ROADMAP 1.239)', () => {
  it('reads as a noun, not a leader verb', () => {
    const { container } = render(<RangeVisualization options={OPTIONS} winnerId="opt_mac" />)
    expect(screen.getByText('Came out ahead in 66% of simulated scenarios')).toBeDefined()
    expect(screen.getByText('Came out ahead in 31% of simulated scenarios')).toBeDefined()
    expect(/\bleads\b/i.test(container.textContent ?? '')).toBe(false)
  })

  it('the goal-threshold branch is untouched — it was never comparative', () => {
    // Over-suppression control: only the win-probability readout is relabelled,
    // and only when no goal threshold is in play.
    render(<RangeVisualization options={OPTIONS} winnerId="opt_mac" goalThreshold={50} />)
    expect(screen.getByText('40% chance of hitting your goal')).toBeDefined()
  })
})
