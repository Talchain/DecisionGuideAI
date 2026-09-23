/**
 * `pass2.needs_user_input` KEEPS A READER — in the inspector, where the ruling
 * puts AI-review disagreement.
 *
 * Experience Design, 23 Sep 2026: orange on the canvas is a SIGN disagreement
 * only, and every other review disagreement is shown in the connection's
 * inspector. Until this change the flag's ONE non-test reader was the canvas
 * rule that turned the line full-strength orange (`contested_needs_user_input`,
 * `edgePresentation.ts`). Deleting that rule without moving the reader would
 * leave "Olumi's review could not settle this without you" computed by the
 * producer and read by nothing — the product could no longer tell it from "the
 * two passes differ a little" (purpose audit of the banked draft, DRIFT-RISK).
 *
 * The heading now branches on the flag, using the two headings this surface
 * already owns — no new strings:
 *   · true  → `EDGE_COPY.needsYourJudgement` ("Needs your judgement");
 *   · false → `EDGE_REVIEW_COPY.heading` ("Our two reviews disagree here").
 *
 * Bound by test id (`edge-review-heading`) and by the imported constants, never
 * by a re-typed literal (trap 12).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EdgeReviewDisagreement } from '../shared/EdgeReviewDisagreement'
import { EDGE_COPY, EDGE_REVIEW_COPY } from '../inspectorStrings'

function validation(needsUserInput: boolean, reasons: string[] = ['strength_band_change']) {
  return {
    status: 'contested',
    contested_reasons: reasons,
    pass1: { strength_mean: 0.3, strength_std: 0.1, exists_probability: 0.8 },
    pass2: {
      strength_mean: 0.7, strength_std: 0.15, exists_probability: 0.9,
      reasoning: 'The review read this as stronger.', basis: 'domain_prior',
      needs_user_input: needsUserInput,
    },
    max_divergence: 0.6,
    distance_to_goal: 1,
    evoi_rank: null,
    evoi_impact: null,
    was_shown: true,
    user_action: 'pending',
    resolved_value: null,
  } as any
}

describe('EdgeReviewDisagreement — the heading reads needs_user_input', () => {
  it('when Olumi\'s review asked for the person, the heading asks for their judgement', () => {
    render(<EdgeReviewDisagreement validation={validation(true)} techMode={false} />)
    expect(screen.getByTestId('edge-review-heading').textContent).toBe(EDGE_COPY.needsYourJudgement)
  })

  it('when it did not, the heading says only that the two reviews differ — not that the person must judge', () => {
    render(<EdgeReviewDisagreement validation={validation(false)} techMode={false} />)
    const heading = screen.getByTestId('edge-review-heading')
    expect(heading.textContent).toBe(EDGE_REVIEW_COPY.heading)
    expect(heading.textContent).not.toBe(EDGE_COPY.needsYourJudgement)
  })

  it('an absent flag (a payload that cannot say) reads as NOT asked — the quieter heading', () => {
    const v = validation(false)
    delete v.pass2.needs_user_input
    render(<EdgeReviewDisagreement validation={v} techMode={false} />)
    expect(screen.getByTestId('edge-review-heading').textContent).toBe(EDGE_REVIEW_COPY.heading)
  })

  it('CONTROL: the reasons and the review\'s own sentence render in both branches', () => {
    for (const needs of [true, false]) {
      const { unmount } = render(<EdgeReviewDisagreement validation={validation(needs)} techMode={false} />)
      expect(screen.getByText(/The review read this as stronger/)).toBeTruthy()
      unmount()
    }
  })
})
