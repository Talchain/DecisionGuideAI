/**
 * A CHAT RESULT CARD FOR AN EARLIER RUN SAYS SO — bound by RESULT IDENTITY,
 * never by position (Paul's OpenAI test, 24 Sep 2026: "historical result cards
 * must be distinguishable from the current analysis").
 *
 * The identity is the content hash the STORE writes to `results.hash` for a V5
 * result — `mapV5AnalysisToReport(block).model_card.response_hash`, the exact
 * expression `applyV5State` evaluates before `resultsComplete` — and which the
 * card reads back as `v5AnalysisBlockContentHash(block)`. The first test pins
 * that those two agree, so the marker is bound to the writer, not to a copy.
 *
 * RED proof: without the marker the `earlier` assertions find no
 * `v5-analysis-result-earlier-run` and no `data-run-currency`.
 */
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, act, within } from '@testing-library/react'
import { V5AnalysisResultBlock, EARLIER_RUN_MARKER } from '../V5AnalysisResultBlock'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import { mapV5AnalysisToReport, v5AnalysisBlockContentHash } from '../../mapV5AnalysisToReport'
import { useCanvasStore } from '../../../canvas/store'

afterEach(() => {
  cleanup()
  useCanvasStore.setState({ results: { status: 'idle', progress: 0 } } as never)
})

/** The two results of Paul's session: before and after adopting four assumptions. */
const FIRST_RUN: V5AnalysisResultBlockType = {
  type: 'v5_analysis_result',
  summary: 'Ran analysis on your current scenario.',
  leading_option_id: null,
  win_probabilities: { 'Raise to £59 at Release': 0.6252, '£59 for New Customers': 0.3463, 'Hold £49 Pro Price': 0.0285 },
  enrichment: { robustness: { level: 'low' } },
}
const RERUN: V5AnalysisResultBlockType = {
  ...FIRST_RUN,
  win_probabilities: { 'Raise to £59 at Release': 0.5811, '£59 for New Customers': 0.3902, 'Hold £49 Pro Price': 0.0287 },
}

function displayResultOf(block: V5AnalysisResultBlockType) {
  // What `applyV5State` writes: the report mapper's hash over the WIRE block.
  const wire = {
    type: 'analysis_result' as const,
    summary: block.summary,
    leading_option_id: block.leading_option_id,
    win_probabilities: block.win_probabilities,
    enrichment: block.enrichment,
  }
  const hash = mapV5AnalysisToReport(wire as never).model_card.response_hash
  useCanvasStore.setState({ results: { status: 'complete', progress: 100, hash } } as never)
  return hash
}

const card = (i: number) => screen.getAllByTestId('v5-analysis-result')[i]

describe('the card knows whether it is the analysis on display', () => {
  it('the store’s written hash IS the card’s identity (bound to the writer, not a copy)', () => {
    expect(displayResultOf(RERUN)).toBe(v5AnalysisBlockContentHash(RERUN))
    expect(v5AnalysisBlockContentHash(FIRST_RUN)).not.toBe(v5AnalysisBlockContentHash(RERUN))
  })

  it('EARLIER: a card whose result is not displayed says "Earlier run"', () => {
    displayResultOf(RERUN)
    render(<V5AnalysisResultBlock block={FIRST_RUN} />)
    expect(screen.getByTestId('v5-analysis-result-earlier-run')).toHaveTextContent(EARLIER_RUN_MARKER)
    expect(card(0)).toHaveAttribute('data-run-currency', 'earlier')
  })

  it('CURRENT: the displayed result’s card carries no marker', () => {
    displayResultOf(RERUN)
    render(<V5AnalysisResultBlock block={RERUN} />)
    expect(screen.queryByTestId('v5-analysis-result-earlier-run')).toBeNull()
    expect(card(0)).toHaveAttribute('data-run-currency', 'current')
  })

  it('IDENTITY, NOT POSITION: the LAST card in the transcript can be the earlier one', () => {
    displayResultOf(RERUN)
    // Transcript order deliberately inverted: the displayed result first, the
    // non-displayed one last — a "newest card is current" rule would mark
    // the wrong one.
    render(
      <>
        <V5AnalysisResultBlock block={RERUN} />
        <V5AnalysisResultBlock block={FIRST_RUN} />
      </>,
    )
    expect(within(card(0)).queryByTestId('v5-analysis-result-earlier-run')).toBeNull()
    expect(within(card(1)).getByTestId('v5-analysis-result-earlier-run')).toBeInTheDocument()
  })

  it('LIVE: when the displayed analysis changes, the marker moves with it — no remount', () => {
    displayResultOf(FIRST_RUN)
    render(
      <>
        <V5AnalysisResultBlock block={FIRST_RUN} />
        <V5AnalysisResultBlock block={RERUN} />
      </>,
    )
    expect(card(0)).toHaveAttribute('data-run-currency', 'current')
    expect(card(1)).toHaveAttribute('data-run-currency', 'earlier')
    act(() => {
      displayResultOf(RERUN)
    })
    expect(card(0)).toHaveAttribute('data-run-currency', 'earlier')
    expect(card(1)).toHaveAttribute('data-run-currency', 'current')
  })

  it('same content, a different object (a re-delivered block) is still current — content identity', () => {
    displayResultOf(RERUN)
    render(<V5AnalysisResultBlock block={{ ...RERUN, win_probabilities: { ...RERUN.win_probabilities } }} />)
    expect(card(0)).toHaveAttribute('data-run-currency', 'current')
  })

  it('NOTHING DISPLAYED: no claim either way — a card is not "earlier" than an absent analysis', () => {
    render(<V5AnalysisResultBlock block={FIRST_RUN} />)
    expect(screen.queryByTestId('v5-analysis-result-earlier-run')).toBeNull()
    expect(card(0)).toHaveAttribute('data-run-currency', 'unknown')
  })
})
