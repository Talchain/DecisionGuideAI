/**
 * EACH CAVEAT ONCE — the chat's "Analysis result" card no longer states the
 * robustness caveat twice (Paul's OpenAI test, 24 Sep 2026: "the result card
 * repeated caveats").
 *
 * WHAT WAS DOUBLED, MEASURED ON A LIVE CAPTURE (not an authored fixture):
 * `live-analysis-turn-walkA-2026-08-04.json` `blocks[0]` renders, in ONE card,
 *   · UI  `v5-analysis-result-uncertainty-copy`  "This result is tentative. The
 *         uncertainty is substantial."      (calibrateUncertaintyCopy, very_low)
 *   · CEE `v5-analysis-result-robustness-summary` "The ordering holds in only
 *         about 42% of variations …, signalling substantial instability …"
 * The UI line is the duplicate — it restates the producer's verdict with less
 * in it — so it yields wherever CEE's own sentence renders, and stays the
 * fallback everywhere else (the Agent-lane card in Paul's test carried no
 * decision review, so its line is kept — pinned below).
 *
 * WHAT THIS DOES NOT DO (and why): CEE-authored repeats are NOT suppressed —
 * `summary` ("The result is not yet robust") vs `robustness_explanation`, and
 * the Agent's answer prose vs the card's `summary` (the churn-limit disclosure,
 * CEE `coaching/constraint-gap-disclosure.ts` via `routing/validation-registry.ts`).
 * Those are the producer's text, rendered verbatim, and are routed to Core.
 * The first test below pins that the summary is untouched.
 */
import { describe, it, expect, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import walkA from '../../__tests__/fixtures/live-analysis-turn-walkA-2026-08-04.json'

afterEach(cleanup)

const TENTATIVE = 'This result is tentative. The uncertainty is substantial.'

/** `blocks[0]` of the live turn, mapped exactly as `mapV5Blocks` maps it. */
function walkABlock(): V5AnalysisResultBlockType {
  const wire = (walkA as { blocks: Array<Record<string, unknown>> }).blocks[0]
  return {
    type: 'v5_analysis_result',
    summary: wire.summary as string,
    leading_option_id: wire.leading_option_id as string | null,
    win_probabilities: wire.win_probabilities as Record<string, number>,
    enrichment: wire.enrichment as Record<string, unknown>,
  }
}

function withoutDecisionReview(block: V5AnalysisResultBlockType): V5AnalysisResultBlockType {
  const rest = { ...(block.enrichment as Record<string, unknown>) }
  delete rest.decision_review
  return { ...block, enrichment: rest }
}

/**
 * The Agent-lane card from Paul's screenshot `0c49ba79…` — summary is CEE's
 * run confirmation + constraint-gap disclosure, verbatim; shares 63/35/3; a
 * fragile robustness band; NO decision review. (Only the fields this card
 * reads; the wire block itself was not captured in either export.)
 */
const AGENT_LANE_CARD: V5AnalysisResultBlockType = {
  type: 'v5_analysis_result',
  summary:
    'Ran analysis on your current scenario. One limit on your model could not be checked: "Monthly churn < 7%". We could not line it up with anything this analysis measures, so it was not part of the comparison.',
  leading_option_id: null,
  win_probabilities: {
    'Raise to £59 at Release': 0.6252,
    '£59 for New Customers': 0.3463,
    'Hold £49 Pro Price': 0.0285,
  },
  enrichment: { robustness: { level: 'low' } },
}

describe('the chat result card states the robustness caveat once', () => {
  it('LIVE walkA: CEE’s robustness sentence renders and the UI’s restatement does not', () => {
    const block = walkABlock()
    render(<V5AnalysisResultBlock block={block} />)
    // Precondition: CEE's own sentence IS on screen (else absence proves nothing).
    expect(screen.getByTestId('v5-analysis-result-robustness-summary')).toHaveTextContent(
      'substantial instability',
    )
    expect(screen.queryByTestId('v5-analysis-result-uncertainty-copy')).toBeNull()
    expect(screen.getByTestId('v5-analysis-result')).not.toHaveTextContent(TENTATIVE)
    // The producer's summary is rendered verbatim — no UI de-duplication of CEE text.
    expect(screen.getByTestId('v5-analysis-result-summary').textContent).toBe(block.summary)
  })

  it('CONTRAST (same block, decision review removed): the UI line DOES fire — so the suppression above is the cause', () => {
    render(<V5AnalysisResultBlock block={withoutDecisionReview(walkABlock())} />)
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(TENTATIVE)
    expect(screen.queryByTestId('v5-analysis-result-robustness-summary')).toBeNull()
  })

  it('CONTRAST (Paul’s Agent-lane card, no decision review): the UI line is the ONLY robustness statement and stays', () => {
    render(<V5AnalysisResultBlock block={AGENT_LANE_CARD} />)
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(TENTATIVE)
    expect(screen.getAllByText(TENTATIVE)).toHaveLength(1)
  })

  it('a decision review WITHOUT a robustness sentence keeps the UI line (the fallback is not lost)', () => {
    const block = walkABlock()
    const enrichment = block.enrichment as Record<string, unknown>
    const review = enrichment.decision_review as Record<string, unknown>
    render(
      <V5AnalysisResultBlock
        block={{
          ...block,
          enrichment: { ...enrichment, decision_review: { ...review, robustness_explanation: null } },
        }}
      />,
    )
    expect(screen.queryByTestId('v5-analysis-result-robustness-summary')).toBeNull()
    expect(screen.getByTestId('v5-analysis-result-uncertainty-copy')).toHaveTextContent(TENTATIVE)
  })
})
