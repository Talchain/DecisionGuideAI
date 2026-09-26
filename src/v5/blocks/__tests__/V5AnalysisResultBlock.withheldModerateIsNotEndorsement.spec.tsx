/**
 * ⭐ ON A RUN THAT NAMES NO OPTION, the card no longer says "This result
 * appears to hold".
 *
 * THE SERVED DEFECT (R&C browser witness `bw-89716c13-8a2f291-pricing-fix2`,
 * UI `89716c13` · CEE `06325c6`, OpenAI agent lane, screenshot `03-run.png`):
 * the explicit Run's reply led with "No pricing option can be put forward from
 * this run…", and directly under it this card said "This result appears to
 * hold, though there's meaningful uncertainty in the estimate." The turn
 * carried `leader_claim {permitted:false, withheld_reason:
 * 'constraint_verdict_withheld'}`, `leading_option_id: null` and
 * `robustness.level: 'high'`.
 *
 * WHY THE EARLIER GATE MISSED IT. `withheldIsNotConfident.spec.tsx` withholds
 * only the CONFIDENT tier on an unlicensed run, on the premise that the hedged
 * tiers "state doubt and name no winner". That holds for TENTATIVE ("This
 * result is tentative…"). It does not hold for MODERATE, whose first clause
 * asserts that the result holds. On this capture the high band plus a headline
 * interval that straddles zero lands on MODERATE, so the gate let an
 * endorsement through beside the producer's refusal.
 *
 * WHAT THIS PINS, from the producer's own bytes:
 *   · the served block renders NO uncertainty line (MODERATE is withheld too);
 *   · OPPOSITE CONTROL: the same bytes with the leader identity restored still
 *     render MODERATE, so the absence is the licence gate, not a calibration
 *     that returns nothing for these inputs;
 *   · PRECONDITION: these inputs really do calibrate to MODERATE.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { calibrateUncertaintyCopy } from '../../../components/results/utils/uncertaintyCalibration'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'
// Kept OUT of `src/v5/__tests__/fixtures/` for the same reason as the 57f903c
// block beside it: that directory is the whole-turn live-capture corpus.
import capture from './fixtures/openai-06325c6-pricing-explicit-run.analysis-block.json'

const MODERATE = "This result appears to hold, though there's meaningful uncertainty in the estimate."
const COPY_ID = 'v5-analysis-result-uncertainty-copy'
const RAISE_59 = 'raise_pro_to_59'
const KEEP_49 = 'keep_pro_at_49'

type Json = Record<string, unknown>
const clone = (): Json => JSON.parse(JSON.stringify(capture.block)) as Json
const asBlock = (b: Json) => ({ ...b, type: 'v5_analysis_result' }) as unknown as V5AnalysisResultBlockType

/** The capture with the producer's leader identity put back: a permitted twin. */
const permittedTwin = (): Json => {
  const b = clone()
  const robustness = (b.enrichment as Json).robustness as Json
  b.leading_option_id = RAISE_59
  robustness.near_tie = { ...(robustness.near_tie as Json), top_option_id: RAISE_59, second_option_id: KEEP_49 }
  return b
}

const outcomeOf = (b: Json, id: string): Json => {
  const entries = (b.enrichment as Json).option_comparison as Json[]
  return entries.find((e) => e.id === id)!.outcome as Json
}

afterEach(() => cleanup())

describe('the served withheld OpenAI pricing Run (CEE 06325c6)', () => {
  it('PRECONDITION: the capture is the withheld turn, and its inputs calibrate to MODERATE', () => {
    const b = clone()
    const robustness = (b.enrichment as Json).robustness as Json
    expect(b.leading_option_id).toBeNull()
    expect(robustness.level).toBe('high')
    // With no leader the card's headline interval is the first entry's.
    const first = ((b.enrichment as Json).option_comparison as Json[])[0]
    const out = first.outcome as Json
    expect(calibrateUncertaintyCopy({ robustnessLevel: 'high', p10: out.p10 as number, p90: out.p90 as number })?.text)
      .toBe(MODERATE)
  })

  it('OPPOSITE CONTROL: the same bytes with the leader identity restored still say it appears to hold', () => {
    const twin = permittedTwin()
    const out = outcomeOf(twin, RAISE_59)
    // The restored leader's own interval also straddles zero, so MODERATE is expected.
    expect(calibrateUncertaintyCopy({ robustnessLevel: 'high', p10: out.p10 as number, p90: out.p90 as number })?.tier)
      .toBe('moderate')
    render(<V5AnalysisResultBlock block={asBlock(twin)} />)
    expect(screen.getByTestId(COPY_ID)).toHaveTextContent(MODERATE)
  })

  it('⭐ the withheld capture renders no "appears to hold" line', () => {
    render(<V5AnalysisResultBlock block={asBlock(clone())} />)
    expect(screen.queryByText(MODERATE)).toBeNull()
    expect(screen.queryByTestId(COPY_ID)).toBeNull()
    // The producer's own summary still renders: suppression, not a blank card.
    expect(screen.getByTestId('v5-analysis-result-summary').textContent?.length ?? 0).toBeGreaterThan(0)
  })
})
