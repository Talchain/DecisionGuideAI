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
import { holdLeaderForCard } from '../../../canvas/runView/__tests__/helpers/leaderTestView'

const RAISE = 'Raise Pro to £59'
const HOLD = 'Hold Pro at £49'
const CONFIDENT = "Under this model's assumptions, the result held in most simulated futures. It is only as sound as the inputs it rests on."
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

/** FAIL CLOSED (15 Oct): the card's Run as CEE serves it, with CEE's matched view holding `licence` and `leader`. */
const served = (b: V5AnalysisResultBlockType, licence: 'permitted' | 'withheld', leader: string | null) =>
  holdLeaderForCard(b, licence, leader)

describe('the confident tier needs a licensed leader', () => {
  it('PRECONDITION: these robustness inputs calibrate to the confident tier', () => {
    expect(calibrateUncertaintyCopy({ robustnessLevel: 'high', robustnessLabel: null, p10: 0.1, p90: 0.4 } as never)?.tier)
      .toBe('confident')
  })

  it('CONTRAST: a permitted run says it looks fairly confident', () => {
    // FAIL CLOSED (15 Oct): CEE's matched view names opt_raise, as served.
    render(<V5AnalysisResultBlock block={served(block({ leadingOptionId: 'opt_raise', nearTie: permitting(), robustnessLevel: 'high' }), 'permitted', 'opt_raise')} />)
    expect(screen.getByTestId(COPY_ID)).toHaveTextContent(CONFIDENT)
  })

  it('⭐ a WITHHELD run (identities stripped) does not say it looks fairly confident', () => {
    // FAIL CLOSED (15 Oct): CEE withheld this Run, so its matched view says 'withheld' (names none), as served.
    render(<V5AnalysisResultBlock block={served(block({ leadingOptionId: null, nearTie: withheldProjection(), robustnessLevel: 'high' }), 'withheld', null)} />)
    expect(screen.queryByText(CONFIDENT)).toBeNull()
    expect(screen.queryByTestId(COPY_ID)).toBeNull()
  })

  it('a NEAR-TIE run (the producer denies a leader) does not say it looks fairly confident', () => {
    render(
      <V5AnalysisResultBlock
        // FAIL CLOSED (15 Oct): CEE's matched view names opt_raise, as served; the near tie is what withholds.
        block={served(block({ leadingOptionId: 'opt_raise', nearTie: { ...permitting(), is_tie: true }, robustnessLevel: 'high' }), 'permitted', 'opt_raise')}
      />,
    )
    expect(screen.queryByText(CONFIDENT)).toBeNull()
  })

  it('the tentative tier still renders on a withheld run — it states doubt and names no winner', () => {
    // FAIL CLOSED (15 Oct): CEE withheld this Run, so its matched view says 'withheld' (names none), as served.
    render(<V5AnalysisResultBlock block={served(block({ leadingOptionId: null, nearTie: withheldProjection(), robustnessLabel: 'fragile' }), 'withheld', null)} />)
    const copy = screen.getByTestId(COPY_ID)
    expect(copy).not.toHaveTextContent(CONFIDENT)
    expect(copy.textContent?.length ?? 0).toBeGreaterThan(0)
  })

  // ⭐ MODERATE is not a statement of doubt: it opens "This result appears to
  // hold". On a run that may not name a leader that reads as an endorsement,
  // so it is withheld with CONFIDENT (served defect: R&C bw-89716c13-8a2f291,
  // pinned from the producer's bytes in withheldModerateIsNotEndorsement.spec).
  it('a NEAR-TIE run does not say the result appears to hold either', () => {
    expect(calibrateUncertaintyCopy({ robustnessLevel: 'moderate', robustnessLabel: null, p10: 0.1, p90: 0.4 } as never)?.tier)
      .toBe('moderate')
    render(
      <V5AnalysisResultBlock
        // FAIL CLOSED (15 Oct): CEE's matched view names opt_raise, as served; the near tie is what withholds.
        block={served(block({ leadingOptionId: 'opt_raise', nearTie: { ...permitting(), is_tie: true }, robustnessLevel: 'moderate' }), 'permitted', 'opt_raise')}
      />,
    )
    expect(screen.queryByTestId(COPY_ID)).toBeNull()
  })

  it('CONTRAST: a permitted run with a moderate band still says it appears to hold', () => {
    // FAIL CLOSED (15 Oct): CEE's matched view names opt_raise, as served.
    render(<V5AnalysisResultBlock block={served(block({ leadingOptionId: 'opt_raise', nearTie: permitting(), robustnessLevel: 'moderate' }), 'permitted', 'opt_raise')} />)
    expect(screen.getByTestId(COPY_ID).textContent ?? '').toMatch(/^Under this model's assumptions, the result held in many simulated futures/)
  })
})
