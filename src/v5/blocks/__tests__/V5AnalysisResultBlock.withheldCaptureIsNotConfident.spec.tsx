/**
 * ⭐ ON THE REAL OPENAI RUN THAT CONTRADICTED ITSELF, the card no longer says
 * "This result looks fairly confident."
 *
 * AI Conversation, #63 5822346711: on AI Quality's capture of the pricing Run
 * (CEE `57f903c`, OpenAI agent lane) the reply said "This run does not
 * establish whether you should raise Pro to £59" while this card said "This
 * result looks fairly confident." The turn carried
 * `leader_claim {permitted:false, withheld_reason:'constraint_verdict_withheld'}`,
 * `leading_option_id: null` and `robustness.level: 'high'`.
 *
 * `withheldIsNotConfident.spec.tsx` pins the rule on a hand-built fixture. This
 * binds it to the producer's own bytes, with the opposite control the report
 * asked for: the same block with the leader identity restored keeps today's
 * copy, so the absence below is the gate, not a calibration that returns
 * nothing for this run.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
import capture from '../../__tests__/fixtures/openai-57f903c-pricing-explicit-run.analysis-block.json'

const CONFIDENT = 'This result looks fairly confident.'
const COPY_ID = 'v5-analysis-result-uncertainty-copy'
const RAISE = 'raise_pro_to_59_at_release'
const KEEP = 'keep_pro_at_49'

type Json = Record<string, unknown>
const clone = (): Json => JSON.parse(JSON.stringify(capture.block)) as Json

/** The capture with the producer's leader identity put back: a permitted twin. */
const permittedTwin = (): Json => {
  const b = clone()
  const enrichment = b.enrichment as Json
  const robustness = enrichment.robustness as Json
  b.leading_option_id = RAISE
  robustness.near_tie = { ...(robustness.near_tie as Json), top_option_id: RAISE, second_option_id: KEEP }
  return b
}

afterEach(() => cleanup())

describe('the captured withheld OpenAI pricing run', () => {
  it('PRECONDITION: the capture is the withheld turn the report describes', () => {
    const b = clone()
    const robustness = (b.enrichment as Json).robustness as Json
    expect(b.type).toBe('analysis_result')
    expect(b.leading_option_id).toBeNull()
    expect(robustness.level).toBe('high')
    expect((robustness.near_tie as Json).top_option_id, 'the withheld projection dropped the identity').toBeUndefined()
  })

  it('OPPOSITE CONTROL: the same bytes with the leader identity restored keep today\'s copy', () => {
    render(<V5AnalysisResultBlock block={{ ...permittedTwin(), type: 'v5_analysis_result' } as unknown as V5AnalysisResultBlockType} />)
    expect(screen.getByTestId(COPY_ID)).toHaveTextContent(CONFIDENT)
  })

  it('⭐ the withheld capture renders no "fairly confident" line', () => {
    render(<V5AnalysisResultBlock block={{ ...clone(), type: 'v5_analysis_result' } as unknown as V5AnalysisResultBlockType} />)
    expect(screen.queryByText(CONFIDENT)).toBeNull()
    expect(screen.queryByTestId(COPY_ID)).toBeNull()
    // The producer's own summary still renders: suppression, not a blank card.
    expect(screen.getByTestId('v5-analysis-result-summary').textContent?.length ?? 0).toBeGreaterThan(0)
  })
})
