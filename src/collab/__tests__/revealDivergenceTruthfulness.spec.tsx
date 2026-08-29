/**
 * COLLAB — THE REVEAL'S DIVERGENCE SENTENCE MUST BE TRUE OF THE ANSWERS ABOVE IT.
 *
 * ── THE DEFECT THIS PINS ──────────────────────────────────────────────────
 * `RevealBody` gated its divergence sentence on a HEADCOUNT:
 *
 *     row.responses.filter((r) => r.value !== null).length > 1
 *       → "2 people gave different answers here."
 *
 * so two participants who gave the SAME number were told they had disagreed —
 * directly above CEE's own `aligned` headline ("2 people answered, and gave the
 * same number"), which says the opposite on the very same screen. The comment
 * above the code said it showed "how many distinct views there are"; the code
 * counted heads. For a product whose whole claim is that it never over-states
 * what it knows, this was the sentence that over-stated.
 *
 * ── WHY THE SUITE DID NOT SEE IT ──────────────────────────────────────────
 * `reveal-disagreement` had exactly ONE occurrence in `src/` at `04c7c8c4` —
 * its own definition. No test named it, so no fixture ever put two EQUAL values
 * on the screen. Every reveal fixture in the repo was built out of the split
 * case, which is CLAUDE.md trap 22 in miniature: a corpus drawn from the shape
 * the feature was written for cannot see the shape it was not.
 *
 * ── THE BINDING ───────────────────────────────────────────────────────────
 * Every case here is a DISCRIMINATING PAIR over one variable — the values —
 * with the participant count, the labels and the target held identical. A guard
 * that only asserted "the split case still says different" would pass on the
 * defect; a guard that only asserted "the aligned case says the same" would
 * pass on a component that had stopped discriminating altogether and said
 * "the same" for everything. Both directions, or neither is evidence.
 *
 * ⚠ AND THE NULL TWIN, which is the same defect one step along. The obvious
 * repair — `new Set(responses.map((r) => r.value)).size > 1` — is ALSO wrong:
 * a decline arrives as `value: null`, so one answer plus one decline gives the
 * set `{0.4, null}`, size 2, and the screen claims a disagreement between one
 * person and a person who said nothing. The nulls must go before the Set does.
 */

import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RevealBody } from '../../pages/ParticipantPacketPage'
import type { RevealResponse, RevealView } from '../collabService'

const TARGET = 'fac_churn_risk'
const LABEL = 'Churn risk after a price rise'
const GRACE = '55555555-5555-4555-8555-555555555555'
const ADA = '66666666-6666-4666-8666-666666666666'
const PRIYA = '77777777-7777-4777-8777-777777777777'

/** A second target, so every assertion binds to a target BY ID (trap 19). */
const OTHER_TARGET = 'fac_price_sensitivity'

function response(
  participantId: string,
  label: string,
  value: number | null,
  kind = 'belief_submitted',
): RevealResponse {
  return {
    participant_id: participantId,
    display_label: label,
    value,
    expression_raw: null,
    confidence: null,
    kind,
  }
}

function revealWith(
  responses: RevealResponse[],
  extra: RevealView['per_target'] = [],
): RevealView {
  return {
    round_id: 'rnd-reveal-divergence-1111',
    status: 'closed',
    graph_version_ref: 'gv-1',
    per_target: [
      {
        target: { kind: 'factor', id: TARGET },
        label: LABEL,
        model_value_at_version: null,
        responses,
      },
      ...extra,
    ],
  }
}

/** The rendered divergence sentence for the target under test, or null. */
function divergenceText(): string | null {
  const el = screen.queryByTestId(`reveal-disagreement-${TARGET}`)
  return el === null ? null : (el.textContent ?? '')
}

describe('the reveal states divergence as a fact about the ANSWERS, not the answerers', () => {
  it('two people, two different numbers: says they differ, and says how many', () => {
    render(
      <RevealBody
        reveal={revealWith([
          response(GRACE, 'Grace', 0.85),
          response(ADA, 'Ada', 0.2),
        ])}
      />,
    )

    const text = divergenceText()
    expect(text).not.toBeNull()
    // The COUNT of distinct answers is the fact being reported, so it is
    // asserted, not just the word "different".
    expect(text).toContain('2 people answered')
    expect(text).toContain('2 different answers')
  })

  it('⭐ THE DEFECT: two people, the SAME number — the screen must not claim they differed', () => {
    render(
      <RevealBody
        reveal={revealWith([
          response(GRACE, 'Grace', 0.4),
          response(ADA, 'Ada', 0.4),
        ])}
      />,
    )

    const text = divergenceText()
    expect(text).not.toBeNull()
    // The load-bearing negative. At `04c7c8c4` this read
    // "2 people gave different answers here."
    expect(text).not.toContain('different')
    expect(text).toContain('same answer')
  })

  it('three people, two distinct numbers: reports 3 answerers and 2 answers', () => {
    render(
      <RevealBody
        reveal={revealWith([
          response(GRACE, 'Grace', 0.85),
          response(ADA, 'Ada', 0.2),
          response(PRIYA, 'Priya', 0.2),
        ])}
      />,
    )

    const text = divergenceText()
    expect(text).toContain('3 people answered')
    expect(text).toContain('2 different answers')
    // The headcount and the answer count are DIFFERENT numbers here, which is
    // exactly the case a headcount-based sentence gets wrong while looking
    // right on the two-person fixture the feature was built from.
    expect(text).not.toContain('3 different answers')
  })

  it('⚠ THE NULL TWIN: one answer plus one decline is not a disagreement', () => {
    render(
      <RevealBody
        reveal={revealWith([
          response(GRACE, 'Grace', 0.4),
          response(ADA, 'Ada', null, 'declined'),
        ])}
      />,
    )

    // Nobody differed from anybody: one person answered. The sentence is about
    // divergence, so there is nothing for it to say.
    expect(divergenceText()).toBeNull()
  })

  it('everyone declined: no divergence sentence at all', () => {
    render(
      <RevealBody
        reveal={revealWith([
          response(GRACE, 'Grace', null, 'declined'),
          response(ADA, 'Ada', null, 'declined'),
        ])}
      />,
    )

    expect(divergenceText()).toBeNull()
  })

  it('binds to its own target: a split elsewhere does not make THIS one split', () => {
    render(
      <RevealBody
        reveal={revealWith(
          [response(GRACE, 'Grace', 0.4), response(ADA, 'Ada', 0.4)],
          [
            {
              target: { kind: 'factor', id: OTHER_TARGET },
              label: 'Price sensitivity',
              model_value_at_version: null,
              responses: [
                response(GRACE, 'Grace', 0.1),
                response(ADA, 'Ada', 0.9),
              ],
            },
          ],
        )}
      />,
    )

    // Same render, two targets, opposite verdicts — the discrimination this
    // component has to make, made in one DOM.
    expect(divergenceText()).toContain('same answer')
    expect(divergenceText()).not.toContain('different')
    const other = screen.getByTestId(`reveal-disagreement-${OTHER_TARGET}`)
    expect(other.textContent).toContain('2 different answers')
  })
})

describe('the reveal only promises the apply mechanism where an apply is possible', () => {
  /**
   * ⚠ The same sentence carried "applying one to your model does not remove the
   * others" on BOTH journeys. A participant has no model on this screen and no
   * apply affordance — `apply` is undefined for them, which is the component's
   * own gate for every other apply claim it makes. A promise about a mechanism
   * the reader cannot reach is the review-doctrine failure of a guarantee that
   * is dark at one end, and it is the reason CEE keeps `DISSENT_SURVIVES_APPLY`
   * and `POSITIONS_NOT_COMBINED` as two constants rather than one.
   */
  const split = [response(GRACE, 'Grace', 0.85), response(ADA, 'Ada', 0.2)]

  it('participant journey (no apply handler): no apply promise', () => {
    render(<RevealBody reveal={revealWith(split)} />)
    const text = divergenceText() ?? ''
    expect(text).toContain('2 different answers')
    expect(text).not.toContain('applying')
    expect(text).not.toContain('your model')
  })

  it('owner journey (apply handler present): the apply promise is made', () => {
    render(
      <RevealBody
        reveal={revealWith(split)}
        apply={{
          onApply: () => undefined,
          applyingKey: null,
          appliedKey: null,
          applyError: null,
        }}
      />,
    )
    const text = divergenceText() ?? ''
    expect(text).toContain('2 different answers')
    expect(text).toContain('does not remove the others')
  })
})
