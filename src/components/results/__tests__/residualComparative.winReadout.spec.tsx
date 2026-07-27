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
 */
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { V7_LENS_COPY } from '../v7/v7LensCopy'
import { RangeVisualization } from '../RangeVisualization'
import type { OptionResult } from '../types'

describe('v7LensCopy.outcome.winReadout (ROADMAP 1.239)', () => {
  it('reads as a noun, not a leader verb', () => {
    expect(V7_LENS_COPY.outcome.winReadout('52%')).toBe('52% win probability')
  })

  it('carries no leader verb at all', () => {
    expect(V7_LENS_COPY.outcome.winReadout('52%')).not.toMatch(/\bleads?\b/i)
  })

  it('keeps the number — the relabel must not cost the DATA', () => {
    // Over-suppression control: this residual is a wording fix, and a change
    // that dropped the percentage would be a worse failure than the wording.
    expect(V7_LENS_COPY.outcome.winReadout('52%')).toContain('52%')
  })

  it('stays one voice with its sibling readout in the same lens group', () => {
    // `goal.hitReadout` is number-first; the outcome lens now matches it.
    expect(V7_LENS_COPY.goal.hitReadout('40%')).toBe('40% hit target')
  })
})

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
    expect(screen.getByText('66% win probability')).toBeDefined()
    expect(screen.getByText('31% win probability')).toBeDefined()
    expect(/\bleads\b/i.test(container.textContent ?? '')).toBe(false)
  })

  it('the goal-threshold branch is untouched — it was never comparative', () => {
    // Over-suppression control: only the win-probability readout is relabelled,
    // and only when no goal threshold is in play.
    render(<RangeVisualization options={OPTIONS} winnerId="opt_mac" goalThreshold={50} />)
    expect(screen.getByText('40% hit target')).toBeDefined()
  })
})
