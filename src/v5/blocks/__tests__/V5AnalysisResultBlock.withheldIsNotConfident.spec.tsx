/**
 * ⭐ A RUN THAT MAY NOT NAME A LEADER MAY NOT CALL ITSELF "FAIRLY CONFIDENT".
 *
 * ── THE MEASURED DEFECT (AI Conversation lane, #63 5821253411, 24 Sep 2026) ─
 * OpenAI pricing run on staging: `complete_current`, `leader_claim.permitted:
 * false`, `constraint_verdict_withheld`. The reply said "This run does not
 * establish whether you should raise Pro to £59"; this card, on the same run,
 * said "This result looks fairly confident." The leader treatment below it was
 * already withheld (ROADMAP 1.267) — the calibration line above it was not,
 * because `calibrateUncertaintyCopy` reads robustness and one option's interval
 * and never asks whether the run may make a comparative claim at all.
 *
 * ── WHAT THIS PINS ─────────────────────────────────────────────────────────
 * The CONFIDENT tier renders only when the card may name a leader — the same
 * conjunction that gates `data-leader` (`verdict.hasLeadingOption` AND the
 * model's admission). The hedged tiers are statements of doubt, never of a
 * winner, so they still render on a withheld run.
 */
import '@testing-library/jest-dom/vitest'
import { describe, it, expect, afterEach } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { V5AnalysisResultBlock } from '../V5AnalysisResultBlock'
import { calibrateUncertaintyCopy } from '../../../components/results/utils/uncertaintyCalibration'
import type { V5AnalysisResultBlock as V5AnalysisResultBlockType } from '../../../canvas/conversation/types'

const RAISE = 'Raise Pro to £59'
const HOLD = 'Hold Pro at £49'
const CONFIDENT = 'This result looks fairly confident.'
const COPY_ID = 'v5-analysis-result-uncertainty-copy'

type NearTie = Record<string, unknown>

/** PLoT's near-tie block as a PERMITTED run carries it: names the rank-1 option. */
const permitting = (): NearTie => ({
  is_tie: false,
  top_option_id: 'opt_raise',
  second_option_id: 'opt_hold',
  gap: 0.24,
  threshold: 0.1,
})

/** CEE's withheld projection: "keep the fact, drop the identities". */
const withheldProjection = (): NearTie => ({ is_tie: false, gap: 0.24, threshold: 0.1 })

function block(opts: {
  leadingOptionId: string | null
  nearTie: NearTie
  robustnessLevel?: string
  robustnessLabel?: string
}): V5AnalysisResultBlockType {
  return {
    type: 'v5_analysis_result',
    summary: 'The comparison was computed.',
    leading_option_id: opts.leadingOptionId,
    win_probabilities: { opt_raise: 0.62, opt_hold: 0.38 },
    enrichment: {
      option_comparison: [
        { id: 'opt_raise', option_id: 'opt_raise', option_label: RAISE, win_probability: 0.62, outcome: { p10: 0.1, p50: 0.25, p90: 0.4 } },
        { id: 'opt_hold', option_id: 'opt_hold', option_label: HOLD, win_probability: 0.38, outcome: { p10: 0.05, p50: 0.15, p90: 0.3 } },
      ],
      robustness: {
        ...(opts.robustnessLevel ? { level: opts.robustnessLevel } : {}),
        ...(opts.robustnessLabel ? { label: opts.robustnessLabel } : {}),
        near_tie: opts.nearTie,
      },
    },
  } as V5AnalysisResultBlockType
}

afterEach(() => cleanup())

describe('the confident tier needs a licensed leader', () => {
  it('PRECONDITION: these robustness inputs calibrate to the confident tier', () => {
    expect(calibrateUncertaintyCopy({ robustnessLevel: 'high', robustnessLabel: null, p10: 0.1, p90: 0.4 } as never)?.tier)
      .toBe('confident')
  })

  it('CONTRAST: a permitted run says it looks fairly confident', () => {
    render(<V5AnalysisResultBlock block={block({ leadingOptionId: 'opt_raise', nearTie: permitting(), robustnessLevel: 'high' })} />)
    expect(screen.getByTestId(COPY_ID)).toHaveTextContent(CONFIDENT)
  })

  it('⭐ a WITHHELD run (identities stripped) does not say it looks fairly confident', () => {
    render(<V5AnalysisResultBlock block={block({ leadingOptionId: null, nearTie: withheldProjection(), robustnessLevel: 'high' })} />)
    expect(screen.queryByText(CONFIDENT)).toBeNull()
    expect(screen.queryByTestId(COPY_ID)).toBeNull()
  })

  it('a NEAR-TIE run (the producer denies a leader) does not say it looks fairly confident', () => {
    render(
      <V5AnalysisResultBlock
        block={block({ leadingOptionId: 'opt_raise', nearTie: { ...permitting(), is_tie: true }, robustnessLevel: 'high' })}
      />,
    )
    expect(screen.queryByText(CONFIDENT)).toBeNull()
  })

  it('a hedged tier still renders on a withheld run — doubt names no winner', () => {
    render(<V5AnalysisResultBlock block={block({ leadingOptionId: null, nearTie: withheldProjection(), robustnessLabel: 'fragile' })} />)
    const copy = screen.getByTestId(COPY_ID)
    expect(copy).not.toHaveTextContent(CONFIDENT)
    expect(copy.textContent?.length ?? 0).toBeGreaterThan(0)
  })
})
