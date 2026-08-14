/**
 * THE CITATION ON THE APPLY — "use Grace's number, because of Ada's challenge".
 *
 * ── WHAT THIS LINK IS FOR ─────────────────────────────────────────────────
 * CEE can already verify a citation (binding (f)) and stamp it onto the graph
 * (`observed_state.elicited_from.evidence_event_id`). Until this file's subject
 * existed, NOTHING COULD SEND ONE: the apply button posted the two ids it always
 * had, so the verified-and-stamped half was unreachable through the product's
 * own click path. That is the estate's chronic failure — build it, never plug
 * it in — and it is why the affordance, not the verifier, is the acceptance
 * link.
 *
 * ── THE RULE BEING PINNED, AND WHY IT IS NOT "CITE WHATEVER IS THERE" ─────
 * The stamp asserts that the model changed BECAUSE OF that evidence. With two
 * or more notes on a target, choosing one would be the product inventing the
 * owner's reason and writing it into the graph as a server-verified fact. So:
 *
 *   0 evidence  → no sentence, no claim
 *   1 evidence  → the sentence NAMES it, and the click claims exactly it
 *   2+ evidence → no sentence, no claim (honestly uncited, never dishonestly
 *                 cited) — the explicit picker is the follow-up
 *
 * ⭐ THE SENTENCE AND THE CLAIM ARE ONE DECISION. Every case below asserts BOTH
 * halves together, because the failure that matters is not "no citation" — it is
 * a screen and a wire that disagree about what the model is about to record.
 *
 * BINDING BY IDENTITY (trap 19): the claimed id is asserted to be the event_id
 * of the evidence the screen named, never merely "some string" — two evidence
 * rows in the multi case carry DIFFERENT ids so that a wrong-object pick could
 * not satisfy the assertion.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

vi.mock('../../canvas/hooks/useBeliefElicitation', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../canvas/hooks/useBeliefElicitation')>()
  return {
    ...actual,
    useBeliefElicitation: vi.fn(() => ({
      suggestion: null,
      loading: false,
      error: null,
      request: vi.fn(),
      reset: vi.fn(),
    })),
  }
})

import { RevealBody, type RevealApplyState } from '../../pages/ParticipantPacketPage'
import type { DisagreementEvidence, DisagreementView, RevealView } from '../collabService'
import {
  forgetPendingApply,
  readPendingApply,
  rememberPendingApply,
} from '../panelApplyHandoff'

const ROUND = 'rnd-citation-7777'
const TARGET = 'factor-churn-risk'
const LABEL = 'Churn risk after a price rise'
const GRACE = 'p-grace-4444'
const ADA = 'p-ada-5555'

/** Sentinels — nothing this bundle could compose would produce these ids. */
const ADA_EVIDENCE_ID = 'evt-ADA-CHALLENGE-SENTINEL'
const SECOND_EVIDENCE_ID = 'evt-SECOND-NOTE-SENTINEL'

function evidence(over: Partial<DisagreementEvidence> = {}): DisagreementEvidence {
  return {
    event_id: ADA_EVIDENCE_ID,
    authored_by: ADA,
    author_label: 'Ada',
    stance: 'challenges',
    stance_phrase: 'challenges',
    kind: 'note',
    body: 'SERVED-EVIDENCE-BODY-SENTINEL',
    url: null,
    about_participant_id: null,
    about_label: null,
    created_at: '2026-08-14T11:00:00.000Z',
    ...over,
  }
}

function revealView(): RevealView {
  return {
    round_id: ROUND,
    status: 'closed',
    graph_version_ref: 'gv-1',
    per_target: [
      {
        target: { kind: 'factor', id: TARGET },
        label: LABEL,
        model_value_at_version: 0.5,
        responses: [
          {
            participant_id: GRACE,
            display_label: 'Grace',
            value: 0.85,
            expression_raw: 'GRACE-BASIS',
            confidence: null,
            kind: 'belief_submitted',
          },
        ],
      },
    ],
  }
}

function disagreementWith(rows: DisagreementEvidence[]): DisagreementView {
  return {
    round_id: ROUND,
    graph_version_ref: 'gv-1',
    standing_note: 'SERVED-STANDING-NOTE-SENTINEL',
    per_target: [
      {
        target: { kind: 'factor', id: TARGET },
        label: LABEL,
        model_value_at_version: 0.5,
        shape: 'split',
        answering_participants: 2,
        distinct_values: 2,
        spread: { low: 0.2, high: 0.85, width: 0.65 },
        positions: [],
        positions_with_stated_basis: 0,
        evidence: rows,
        headline: 'SERVED-HEADLINE-SENTINEL',
        question: 'SERVED-QUESTION-SENTINEL',
      },
    ],
  }
}

/** Render the owner's reveal and capture exactly what a click claims. */
function renderWithEvidence(rows: DisagreementEvidence[] | null): {
  calls: Array<Record<string, unknown>>
} {
  const calls: Array<Record<string, unknown>> = []
  const apply: RevealApplyState = {
    onApply: (args) => calls.push({ ...args }),
    applyingKey: null,
    appliedKey: null,
    applyError: null,
  }
  render(
    <RevealBody
      reveal={revealView()}
      apply={apply}
      disagreement={rows === null ? null : disagreementWith(rows)}
    />,
  )
  return { calls }
}

describe('the apply affordance — the citation is disclosed, then claimed', () => {
  it('⭐⭐ ONE piece of evidence: the sentence NAMES it and the click claims THAT id', () => {
    const { calls } = renderWithEvidence([evidence()])

    // The disclosure exists and names the author — the owner is consenting to a
    // stated fact, not having an inference recorded for them.
    const line = screen.getByTestId(`reveal-apply-citation-${TARGET}`)
    expect(line.textContent).toContain('Ada')
    expect(line.textContent).toContain('note')

    fireEvent.click(screen.getByTestId(`reveal-apply-${TARGET}-${GRACE}`))

    expect(calls).toHaveLength(1)
    // ⭐ THE ASYMMETRY THIS WHOLE HOP EXISTS FOR: the value applied is GRACE's,
    // and the reason cited is ADA's. Bound by identity to both, so a build that
    // tied the citation to the applied participant would fail here.
    expect(calls[0]?.participantId).toBe(GRACE)
    expect(calls[0]?.value).toBe(0.85)
    expect(calls[0]?.evidenceEventId).toBe(ADA_EVIDENCE_ID)
  })

  it('⭐⭐ TWO pieces of evidence: no sentence, and the click claims NOTHING', () => {
    // The honest refusal. Two ids that DIFFER, so a "pick the first" build
    // cannot satisfy this by coincidence — it would produce one of them and the
    // absence assertion would fail naming which.
    const { calls } = renderWithEvidence([
      evidence(),
      evidence({ event_id: SECOND_EVIDENCE_ID, author_label: 'Ben', authored_by: 'p-ben-6666' }),
    ])

    expect(screen.queryByTestId(`reveal-apply-citation-${TARGET}`)).toBeNull()

    fireEvent.click(screen.getByTestId(`reveal-apply-${TARGET}-${GRACE}`))

    expect(calls).toHaveLength(1)
    expect(
      'evidenceEventId' in (calls[0] as object),
      `the affordance INVENTED a citation (${String(calls[0]?.evidenceEventId)}) where the ` +
        'owner was shown no reason — the stamp would record a motive nobody stated',
    ).toBe(false)
    // The apply itself still works: refusing to cite must not refuse to apply.
    expect(calls[0]?.participantId).toBe(GRACE)
  })

  it('NO evidence on the target: no sentence, no claim, apply unaffected', () => {
    const { calls } = renderWithEvidence([])
    expect(screen.queryByTestId(`reveal-apply-citation-${TARGET}`)).toBeNull()
    fireEvent.click(screen.getByTestId(`reveal-apply-${TARGET}-${GRACE}`))
    expect('evidenceEventId' in (calls[0] as object)).toBe(false)
    expect(calls[0]?.value).toBe(0.85)
  })

  it('NO disagreement view at all: the pre-0.41.0 path, byte-identical', () => {
    // The view is a SECOND request whose failure is swallowed to null, so this
    // is a reachable production state and not a synthetic one. It must degrade
    // to the old behaviour rather than to a broken button.
    const { calls } = renderWithEvidence(null)
    expect(screen.queryByTestId(`reveal-apply-citation-${TARGET}`)).toBeNull()
    fireEvent.click(screen.getByTestId(`reveal-apply-${TARGET}-${GRACE}`))
    expect(calls[0]).toEqual({ targetId: TARGET, participantId: GRACE, value: 0.85 })
  })

  it('evidence on ANOTHER target does not leak onto this one', () => {
    // Binding by target id, not "the round has evidence somewhere". A build that
    // read the first per_target row regardless of id would pass every case
    // above and fail only here.
    const view = disagreementWith([evidence()])
    view.per_target[0]!.target = { kind: 'factor', id: 'factor-something-else' }
    const calls: Array<Record<string, unknown>> = []
    render(
      <RevealBody
        reveal={revealView()}
        apply={{
          onApply: (args) => calls.push({ ...args }),
          applyingKey: null,
          appliedKey: null,
          applyError: null,
        }}
        disagreement={view}
      />,
    )
    expect(screen.queryByTestId(`reveal-apply-citation-${TARGET}`)).toBeNull()
    fireEvent.click(screen.getByTestId(`reveal-apply-${TARGET}-${GRACE}`))
    expect('evidenceEventId' in (calls[0] as object)).toBe(false)
  })

  it('a blank evidence id is NOT citable — an id is what gets claimed', () => {
    const { calls } = renderWithEvidence([evidence({ event_id: '   ' })])
    expect(screen.queryByTestId(`reveal-apply-citation-${TARGET}`)).toBeNull()
    fireEvent.click(screen.getByTestId(`reveal-apply-${TARGET}-${GRACE}`))
    expect('evidenceEventId' in (calls[0] as object)).toBe(false)
  })
})

describe('the handoff — the citation survives the hop the apply actually takes', () => {
  const SCENARIO = 'scn-citation-8888'

  beforeEach(() => {
    forgetPendingApply(SCENARIO)
  })

  it('⭐ round-trips the citation through localStorage', () => {
    // The apply does not send from the panel page: it records an intent that
    // the CANVAS drains. A citation lost at this hop would be invisible on both
    // screens and would reach CEE as an uncited apply.
    rememberPendingApply({
      scenarioId: SCENARIO,
      roundId: ROUND,
      participantId: GRACE,
      targetId: TARGET,
      value: 0.85,
      evidenceEventId: ADA_EVIDENCE_ID,
    })
    expect(readPendingApply(SCENARIO)?.evidence_event_id).toBe(ADA_EVIDENCE_ID)
  })

  it('⭐ an UNCITED intent carries NO key — absence stays absence', () => {
    rememberPendingApply({
      scenarioId: SCENARIO,
      roundId: ROUND,
      participantId: GRACE,
      targetId: TARGET,
      value: 0.85,
    })
    const read = readPendingApply(SCENARIO)
    expect(read).not.toBeNull()
    // `in`, not a value check: a present-but-undefined key would read as PRESENT
    // downstream and arrive at a `.strict()` parse as a member nobody sent.
    expect('evidence_event_id' in (read as object)).toBe(false)
  })

  it('⭐ REFUSES a corrupt stored citation rather than draining it uncited', () => {
    // Hand-written into storage, because this is what a tampered or
    // half-migrated record looks like — the case a round-trip test cannot reach.
    window.localStorage.setItem(
      `olumi.collab.pending-apply.${SCENARIO}`,
      JSON.stringify({
        scenario_id: SCENARIO,
        round_id: ROUND,
        participant_id: GRACE,
        target_id: TARGET,
        value: 0.85,
        evidence_event_id: '',
        recorded_at: new Date().toISOString(),
      }),
    )
    // Refusing costs one more click. Draining it uncited would apply the value
    // and silently discard the reason the owner was shown — unrecoverable,
    // because no reader downstream can tell that absence from an honest one.
    expect(readPendingApply(SCENARIO)).toBeNull()
  })

  it('POSITIVE CONTROL — the same record WITHOUT the corrupt member is accepted', () => {
    // Without this, the refusal above would also pass if `readPendingApply` had
    // started rejecting every record for an unrelated reason.
    window.localStorage.setItem(
      `olumi.collab.pending-apply.${SCENARIO}`,
      JSON.stringify({
        scenario_id: SCENARIO,
        round_id: ROUND,
        participant_id: GRACE,
        target_id: TARGET,
        value: 0.85,
        recorded_at: new Date().toISOString(),
      }),
    )
    expect(readPendingApply(SCENARIO)?.value).toBe(0.85)
  })
})
