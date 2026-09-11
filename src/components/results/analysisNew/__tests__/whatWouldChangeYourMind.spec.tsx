/**
 * Analysis (New) — "What would change your mind about this?", the consider-the-
 * opposite act, and THE HONESTY RULE THAT MAKES IT SCIENCE RATHER THAN
 * ENCOURAGEMENT.
 *
 * ⭐⭐ THE RULE UNDER TEST, STATED AS TWO CLAIMS THAT MAY NEVER BLUR:
 *
 *   GROUNDED  the run calculated a reversal condition AND it is printable on a
 *             scale the reader can place. The act names the PRODUCER'S OWN
 *             quantity and the PRODUCER'S OWN threshold, and says the run
 *             worked them out.
 *   TECHNIQUE no such figure exists. The act may still be offered, but it must
 *             present itself as a REASONING TECHNIQUE and must never imply the
 *             system computed anything.
 *
 * ⚠ A BLURRED VERSION IS WORSE THAN A MISSING ONE, which is why the two arms
 * get a DISCRIMINATING PAIR rather than one biting mutant each. One mutant
 * proves the test is sensitive to something; the pair proves the DISTINCTION is
 * real — that the grounded arm is bound to the producer's figure by identity,
 * and that the technique arm cannot claim computation without going red.
 *
 * ⚠⚠ EVERY ASSERTION BINDS BY IDENTITY (CLAUDE.md trap 19): the exact testid,
 * the exact factor label, the exact threshold string, the exact sentence. Not
 * one of them is a value predicate another object on the card could satisfy —
 * the fixtures below deliberately seat a DECOY figure on the finding's own
 * prose so a loose matcher would pass on the wrong object.
 */

import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { ANALYSIS_NEW_COPY } from '../analysisNewCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import type { GlanceCondition } from '../analysisNewTypes'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openAskOlumi } from '../../coaching/askOlumiStore'

const ACT = 'analysis-new-strengthen-change-your-mind'
const LEAD = `${ACT}-lead`

/**
 * ⚠ THE DECOY IS THE POINT OF THIS FIXTURE. `signal` carries a DIFFERENT
 * number and a DIFFERENT factor name from the condition under test, so an
 * assertion that merely finds "a percentage on the card" or "a factor name on
 * the card" passes on the wrong object and this spec would certify nothing.
 */
const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Pressure-test the plan',
    signal: 'Delivery lead time carries 41% of the influence.',
    whyNow: 'The conclusion rests almost entirely on it.',
    tryThis: null,
    sourceLine: 'From the influence concentration check.',
    action: { kind: 'ai-dialogue', label: 'Work through it with Olumi', prompt: 'Work through it' },
    targetId: 'f_leadtime',
    priority: 1,
    ...over,
  }) as Recommendation

const findings = [rec({ id: 'strengthen:phase3:g1' })]

/** A run that DID calculate a placeable reversal condition. */
const GROUNDED: GlanceCondition = {
  text: 'Customer demand passes 12.5%',
  targetId: 'f_demand',
  quantity: { factorLabel: 'Customer demand', thresholdText: '12.5%' },
}

/**
 * A run whose reversal condition exists but could NOT be placed on a readable
 * scale — `glanceCondition`'s third arm, where the producer's number is dropped
 * because neither a printable unit nor a `current_value` survived.
 */
const UNPLACEABLE: GlanceCondition = {
  text: 'Customer demand changes materially',
  targetId: 'f_demand',
  quantity: null,
}

const renderOpen = (condition: GlanceCondition | null) => {
  const result = render(
    <StrengthenTheReasoning interventions={findings} changeYourMind={condition} />,
  )
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return result
}

beforeEach(() => {
  vi.mocked(openAskOlumi).mockClear()
})

describe('the act exists at all', () => {
  it('renders one act beside the findings when the run produced a reversal condition', () => {
    renderOpen(GROUNDED)
    expect(screen.getAllByTestId(ACT)).toHaveLength(1)
    expect(screen.getByTestId(ACT)).toHaveTextContent(
      ANALYSIS_NEW_COPY.changeYourMind.actLabel,
    )
  })

  /**
   * ⚠ NEVER RENDER A CONTROL THAT DOES NOTHING. With no reversal condition on
   * the run there is no finding for this act to sit beside, so NOTHING renders
   * — not a disabled control, and not a technique form with no subject. The
   * greyed permanently-dead Undo pair in the sidebar is the counter-example.
   */
  it('renders NO act at all when the run produced no reversal condition', () => {
    renderOpen(null)
    expect(screen.queryByTestId(ACT)).not.toBeInTheDocument()
    expect(screen.queryByTestId(LEAD)).not.toBeInTheDocument()
  })
})

describe('⭐ the honesty rule — the grounded arm names the producer’s own figure', () => {
  it('names the real quantity and the real threshold, bound by identity', () => {
    renderOpen(GROUNDED)
    const lead = screen.getByTestId(LEAD)
    // BY IDENTITY: the exact sentence the copy register composes from the
    // producer's own two strings. A substring match on "12.5%" alone would be
    // satisfied by any figure the card happens to carry.
    expect(lead).toHaveTextContent(
      ANALYSIS_NEW_COPY.changeYourMind.groundedLead('Customer demand', '12.5%'),
    )
    // And the decoy on the same card is NOT what it bound to.
    expect(lead).not.toHaveTextContent('41%')
    expect(lead).not.toHaveTextContent('Delivery lead time')
  })

  it('states the figure is the run’s own, and marks the act grounded', () => {
    renderOpen(GROUNDED)
    expect(screen.getByTestId(ACT)).toHaveAttribute('data-change-your-mind-form', 'grounded')
  })

  it('sends a question carrying the producer’s quantity and threshold verbatim', () => {
    renderOpen(GROUNDED)
    fireEvent.click(screen.getByTestId(ACT))
    expect(openAskOlumi).toHaveBeenCalledTimes(1)
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    expect(payload.draft).toBe(
      ANALYSIS_NEW_COPY.changeYourMind.groundedDraft('Customer demand', '12.5%'),
    )
    expect(payload.draft).toContain('Customer demand')
    expect(payload.draft).toContain('12.5%')
    // ⚠ REUSES THE EXISTING TECHNIQUE IDENTITY. `consider_opposite` already
    // ships in `METHOD_CATALOGUE` carrying `challenge_assumption`; minting a
    // second consider-the-opposite here would be two carriers for one concept.
    expect(payload.parameters).toEqual({ method_id: 'consider_opposite' })
    expect(payload.intent).toBe('challenge_assumption')
    // ⛔ IT ASKS. It never mutates the graph — no add, no value change.
    expect(payload.source).toBe('chip')
  })
})

describe('⭐ the honesty rule — the technique arm may not imply computation', () => {
  it('declares itself a reasoning technique', () => {
    renderOpen(UNPLACEABLE)
    expect(screen.getByTestId(ACT)).toHaveAttribute('data-change-your-mind-form', 'technique')
    expect(screen.getByTestId(LEAD)).toHaveTextContent(
      ANALYSIS_NEW_COPY.changeYourMind.techniqueLead,
    )
  })

  /**
   * ⚠ WRITTEN POSITIVELY SO IT CANNOT PASS VACUOUSLY. It asserts the act IS
   * rendered and THEN that the rendered lead carries none of the computation
   * verbs. A bare "does not contain" over an absent element is the vacuous
   * absence assertion trap 13 exists for; the presence assertion above is this
   * one's positive control.
   */
  it('says nothing the system did not do — no computed importance, no detected bias, no optimal experiment', () => {
    renderOpen(UNPLACEABLE)
    const lead = screen.getByTestId(LEAD)
    expect(lead).toBeInTheDocument()
    for (const claim of ANALYSIS_NEW_COPY.changeYourMind.COMPUTATION_CLAIMS_BANNED_IN_TECHNIQUE) {
      expect(lead.textContent?.toLowerCase()).not.toContain(claim)
    }
  })

  it('sends the technique prompt, with no invented quantity or threshold', () => {
    renderOpen(UNPLACEABLE)
    fireEvent.click(screen.getByTestId(ACT))
    const payload = vi.mocked(openAskOlumi).mock.calls[0][0]
    expect(payload.draft).toBe(ANALYSIS_NEW_COPY.changeYourMind.techniqueDraft)
    // The unplaceable condition's own prose must not be laundered into a figure.
    expect(payload.draft).not.toContain('12.5%')
    expect(payload.draft).not.toContain('changes materially')
    expect(payload.context).toBe(ANALYSIS_NEW_COPY.changeYourMind.techniqueLead)
  })
})

describe('⭐ the two arms are DIFFERENT — the pair, not one mutant', () => {
  /**
   * ⭐⭐ THIS IS THE DISCRIMINATOR AND IT PINS ITS OWN PRECONDITION.
   *
   * It asserts the two fixtures produce DIFFERENT leads and DIFFERENT drafts in
   * the same run. A guard that only checked each arm separately would stay
   * green if the implementation collapsed both arms onto one sentence — which
   * is exactly the blurring this whole change exists to prevent.
   */
  it('the grounded lead and the technique lead are not the same sentence', () => {
    const a = render(
      <StrengthenTheReasoning interventions={findings} changeYourMind={GROUNDED} />,
    )
    fireEvent.click(within(a.container).getByTestId('analysis-new-strengthen-toggle'))
    const groundedLead = within(a.container).getByTestId(LEAD).textContent
    a.unmount()

    const b = render(
      <StrengthenTheReasoning interventions={findings} changeYourMind={UNPLACEABLE} />,
    )
    fireEvent.click(within(b.container).getByTestId('analysis-new-strengthen-toggle'))
    const techniqueLead = within(b.container).getByTestId(LEAD).textContent

    // Precondition: both arms actually rendered something.
    expect(groundedLead && groundedLead.length > 0).toBe(true)
    expect(techniqueLead && techniqueLead.length > 0).toBe(true)
    // The distinction itself.
    expect(groundedLead).not.toBe(techniqueLead)
    expect(groundedLead).toContain('12.5%')
    expect(techniqueLead).not.toContain('12.5%')
  })
})

describe('copy discipline', () => {
  it('uses no em dashes and no race framing in any string this act can render', () => {
    const strings = [
      ANALYSIS_NEW_COPY.changeYourMind.actLabel,
      ANALYSIS_NEW_COPY.changeYourMind.techniqueLead,
      ANALYSIS_NEW_COPY.changeYourMind.techniqueDraft,
      ANALYSIS_NEW_COPY.changeYourMind.groundedLead('Customer demand', '12.5%'),
      ANALYSIS_NEW_COPY.changeYourMind.groundedDraft('Customer demand', '12.5%'),
    ]
    expect(strings.length).toBe(5)
    for (const s of strings) {
      expect(s).not.toContain('—')
      expect(s.toLowerCase()).not.toContain('winner')
      expect(s.toLowerCase()).not.toContain('scored highest')
      expect(s.toLowerCase()).not.toContain('leading option')
    }
  })
})
