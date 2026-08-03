/**
 * ROADMAP 2.391 — "say it in words" reaches the POST-ANALYSIS surface.
 *
 * WHY THIS FILE EXISTS (the measurement that forced it). ROADMAP 2.364 shipped
 * the elicitation affordance on `CalibrateDrillIn` only, and that surface
 * UNMOUNTS the moment "Analyse first pass" is clicked — measured on deployed
 * build `1730c6c5` (L55 §10.7) and reproduced independently on `33594598`
 * (L58 §2): post-run, `[data-testid="pre-analysis-v3"]` is null and no "… in
 * words" affordance survives anywhere in the document. So a staleness pill
 * (which needs an analysis to already exist) and the elicitation loop (which
 * needed the pre-run drill-in) were MUTUALLY EXCLUSIVE in one session, and the
 * chain "elicit in words → Use this → analysis goes stale" could not be
 * witnessed at all.
 *
 * WHAT THIS FILE PINS, and the CLAIM TYPE of each:
 *   1. REACHABILITY — the affordance renders on the inspector panel while a
 *      COMPLETED analysis is in the store. This is the claim that is RED at
 *      pristine: the panel has no such control.
 *   2. THE GATE, both ways — offered on a capless/unitless factor, HIDDEN (not
 *      disabled) on the two shapes `acceptsElicitedBelief` refuses: a
 *      cap-bearing factor, and the uncapped unit-bearing MAGNITUDE shape that
 *      was the #572 review's BLOCKER (£40,000 → £0.70).
 *   3. THE GATE IS REACTIVE — changing the factor's shape underneath an OPEN
 *      field unmounts the affordance. This is what makes the absence of an
 *      accept-time re-check honest rather than an omission (see
 *      `CalibrateDrillIn`'s `acceptElicited` comment, and mutant A1-d in
 *      `l43-elicitation-build.md`).
 *   4. THE COMMIT — accepting dispatches EXACTLY ONE `factor_value_edit` for
 *      THAT node id, carrying the probability VERBATIM as `value` with NO
 *      `raw_value` and NO `unit`: the shape CEE's `resolveUserUnitInput`
 *      inverts with the factor's own stored cap.
 *   5. THE WIRE IS NOT OPTIONAL — deleting `sendSystemEvent` from the accept
 *      path must go RED (the 2.365 silent-local-commit class).
 *   6. THE EXISTING TYPED PATH IS UNMOVED — on a factor where the affordance is
 *      not offered at all, a typed commit still emits the 1.346 event with its
 *      `raw_value` + `unit` + cap-derived model value, unchanged.
 *   7. THE POST-ACCEPT NUMBER FIELD IS CONSISTENT — after an accept, blurring
 *      the number input emits NOTHING. Without the draft sync this is a real
 *      regression, not a nicety: the field still held the PREVIOUS number, so
 *      the next blur would have committed it and silently undone the accept.
 *   8. THE STALENESS CHAIN — with a completed-but-not-fresh analysis, accepting
 *      surfaces the panel's own "Re-run to see how this affects the results"
 *      prompt. Control: with no analysis in the store, it does not.
 *
 * IDENTITY, NOT VALUE (CLAUDE.md trap 19). Every assertion about a dispatched
 * event binds it by `target_id` to the node under test; no assertion finds an
 * event "by value" where another event could satisfy the predicate.
 *
 * MOCKS: only the two TRANSPORTS — the conversation's `sendSystemEvent` and
 * `CEEClient.elicitBelief` — and both by `importOriginal`-spread, never a
 * hand-listed factory (trap 12). The scale module, the gate, the hook and the
 * panel are the shipped code.
 *
 * RED-first at pristine `33594598`: no elicitation affordance exists on this
 * panel, so every test except the two controls fails at `getByLabelText`.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent, cleanup, act } from '@testing-library/react'
import type { Node } from '@xyflow/react'

/** Every system event that reached the conversation transport, in order. */
const sendSystemEvent = vi.fn()
/** Elicitation replies the mocked CEE client answers with, in order. */
const elicitReplies: Array<Record<string, unknown>> = []
/** Every elicitation request body, in order — the request contract at the seam. */
const elicitRequests: Array<Record<string, unknown>> = []

vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

vi.mock('../../../../adapters/cee/client', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../../adapters/cee/client')>()
  class MockCEEClient extends actual.CEEClient {
    async elicitBelief(input: Parameters<InstanceType<typeof actual.CEEClient>['elicitBelief']>[0]) {
      elicitRequests.push(input as unknown as Record<string, unknown>)
      const reply = elicitReplies.shift()
      if (!reply) throw new Error('no elicitation reply queued')
      return reply as unknown as Awaited<
        ReturnType<InstanceType<typeof actual.CEEClient>['elicitBelief']>
      >
    }
  }
  return { ...actual, CEEClient: MockCEEClient }
})

import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'
import { normaliseRawFactorValue } from '../../../utils/observedStateHelpers'
import { BELIEF_ELICITATION_DEBOUNCE_MS } from '../../../hooks/useBeliefElicitation'
import {
  describeInWordsToggleLabel,
  describeInWordsFieldLabel,
} from '../../../components/BeliefElicitationField'

// ── the four witnessed factor shapes (same fixtures as calibrateDrillInElicit) ──

/** The 2026-08-03 journey-walk row: capless, unitless, model value in [0,1]. */
const WALK_ID = 'fac_content_marketing'
const WALK_LABEL = 'Content Marketing Investment'
const WALK_OBSERVED = {
  value: 0,
  display_value: 'Low (0)',
  source: 'cee_inference',
  extractionType: 'inferred',
}

/**
 * ⭐ A capless/unitless factor that ALREADY CARRIES `raw_value` — the state this
 * very panel leaves a factor in after ONE accept (the display anchor is written
 * locally), and therefore the shape a SECOND accept meets.
 *
 * It exists because of a VACUITY I found in my own battery. On `WALK_OBSERVED`
 * there is no `raw_value`, so the DEFAULT seed basis resolves to
 * `{inUserUnits: false}` and emits exactly the same payload as `'model_scale'`
 * — deleting `seedBasis: 'model_scale'` from the accept SURVIVED. Here it does
 * not: with a `raw_value` present the default basis reports `inUserUnits: true`
 * and attaches a `raw_value` the client has no business asserting. This fixture
 * is what makes the "no raw_value" assertion bind the BASIS rather than the
 * fixture's silence.
 */
const ANCHORED_ID = 'fac_brand_trust'
const ANCHORED_LABEL = 'Brand trust'
const ANCHORED_OBSERVED = {
  value: 0.3,
  raw_value: 0.3,
  source: 'user_override',
}

/** A cap-bearing factor — CEE's own draft fixtures carry exactly this shape. */
const CAPPED_ID = 'fac_team_size'
const CAPPED_LABEL = 'Team Size'
const CAPPED_CAP = 20
const CAPPED_OBSERVED = {
  value: 0.4,
  raw_value: 8,
  unit: 'engineers',
  cap: CAPPED_CAP,
  source: 'brief_extraction',
}

/**
 * ⭐ THE #572 BLOCKER SHAPE: staging-witnessed uncapped unit-bearing factor.
 * Model scale IS the magnitude here, so a verbatim 0.7 would turn £40,000 into
 * £0.70 with a "checked by you" stamp on it.
 */
const MAGNITUDE_ID = 'fac_monthly_spend'
const MAGNITUDE_LABEL = 'Monthly spend'
const MAGNITUDE_OBSERVED = {
  value: 40000,
  unit: '£',
  raw_value: 40000,
  source: 'brief_extraction',
}

/** The witnessed live reply for "pretty likely" (staging BFF, 2026-08-03). */
const PRETTY_LIKELY = {
  suggested_value: 0.7,
  confidence: 'high',
  reasoning:
    'Interpreted "pretty likely" as approximately 70% probability based on common usage.',
  needs_clarification: false,
  provenance: 'cee',
}

/** The witnessed clarification branch for "good". */
const AMBIGUOUS_GOOD = {
  suggested_value: 0.75,
  confidence: 'low',
  reasoning: '"good" could mean several things.',
  needs_clarification: true,
  clarifying_question: 'When you say "good", how likely do you mean?',
  options: [
    { label: 'Very likely', value: 0.9 },
    { label: 'Quite likely', value: 0.75 },
    { label: 'More likely than not', value: 0.6 },
  ],
  provenance: 'cee',
}

/** `needs_clarification` with NO options — must suppress the offer entirely. */
const UNSURE_NO_OPTIONS = {
  suggested_value: 0.5,
  confidence: 'low',
  reasoning: 'ambiguous',
  needs_clarification: true,
  provenance: 'cee',
}

const noop = () => {}

/**
 * A COMPLETED analysis whose freshness is not confirmably current — the state a
 * user is in the moment they edit something after a run. `results.status` is
 * what the panel reads for results mode; `analysisFreshness` is what
 * `useEditConfirmation` reads for the re-run prompt.
 */
const ANALYSED = {
  results: { status: 'complete', report: null },
  analysisFreshness: { freshness: 'stale', freshnessReason: 'graph_hash_mismatch' },
  analysisFreshnessDirty: false,
}

/** No analysis at all — the control for every "post-analysis" claim. */
const NOT_ANALYSED = {
  results: { status: 'idle', report: null },
  analysisFreshness: null,
  analysisFreshnessDirty: false,
}

function seed(
  id: string,
  label: string,
  observed: Record<string, unknown>,
  phase: Record<string, unknown> = ANALYSED,
): void {
  useCanvasStore.setState(
    {
      nodes: [
        {
          id,
          type: 'factor',
          position: { x: 0, y: 0 },
          data: { kind: 'factor', label, observedState: observed },
        } as unknown as Node,
      ],
      edges: [],
      ...phase,
    } as never,
    false,
  )
}

function renderPanel(id: string) {
  return render(
    <FactorControllablePanel nodeId={id} techMode={false} onClose={noop} onNavigate={noop} />,
  )
}

/** Open the words field and type a phrase, letting the debounce fire. */
async function askInWords(label: string, phrase: string): Promise<void> {
  fireEvent.click(screen.getByLabelText(describeInWordsToggleLabel(label)))
  fireEvent.change(screen.getByLabelText(describeInWordsFieldLabel(label)), {
    target: { value: phrase },
  })
  await act(async () => {
    vi.advanceTimersByTime(BELIEF_ELICITATION_DEBOUNCE_MS + 1)
    await Promise.resolve()
    await Promise.resolve()
  })
}

/** Every dispatched event for THIS node id — identity-bound, never by value. */
function eventsFor(nodeId: string): Array<Record<string, unknown>> {
  return sendSystemEvent.mock.calls
    .map(c => c[0] as { type: string; payload: Record<string, unknown> })
    .filter(e => e.type === 'factor_value_edit' && e.payload.target_id === nodeId)
    .map(e => e.payload)
}

describe('FactorControllablePanel — belief elicitation post-analysis (ROADMAP 2.391)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    sendSystemEvent.mockClear()
    elicitReplies.length = 0
    elicitRequests.length = 0
  })
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  // ── 1. REACHABILITY — the claim that is RED at pristine ──────────────────

  it('offers the "in words" affordance on the inspector panel WITH A COMPLETED ANALYSIS in the store', () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED, ANALYSED)
    renderPanel(WALK_ID)

    // The affordance exists on the post-analysis surface. Before 2.391 the ONLY
    // host was pre-analysis-v3, which is unmounted by then.
    expect(screen.getByLabelText(describeInWordsToggleLabel(WALK_LABEL))).toBeInTheDocument()
    // …and the panel really is in results mode, not a pre-run panel that merely
    // happens to render: the store carries a completed analysis.
    expect(useCanvasStore.getState().results?.status).toBe('complete')
  })

  it('addresses the elicit request by NODE ID, not by label', async () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED)
    renderPanel(WALK_ID)
    elicitReplies.push(PRETTY_LIKELY)
    await askInWords(WALK_LABEL, 'pretty likely')

    expect(elicitRequests).toHaveLength(1)
    expect(elicitRequests[0].node_id).toBe(WALK_ID)
    expect(elicitRequests[0].node_id).not.toBe(WALK_LABEL)
    expect(elicitRequests[0].user_expression).toBe('pretty likely')
    expect(elicitRequests[0].target_type).toBe('prior')
  })

  // ── 2. THE GATE, both ways ───────────────────────────────────────────────

  it('HIDES the affordance on the uncapped unit-bearing MAGNITUDE shape (the #572 blocker)', () => {
    seed(MAGNITUDE_ID, MAGNITUDE_LABEL, MAGNITUDE_OBSERVED)
    renderPanel(MAGNITUDE_ID)

    // Hidden, not disabled: a disabled control with no explanation is a mystery.
    expect(screen.queryByLabelText(describeInWordsToggleLabel(MAGNITUDE_LABEL))).toBeNull()
    // POSITIVE CONTROL for the absence — the panel itself IS rendered, so the
    // null above is the gate refusing, not an empty tree.
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument()
  })

  it('HIDES the affordance on a cap-bearing factor (the accepted number could not be displayed)', () => {
    seed(CAPPED_ID, CAPPED_LABEL, CAPPED_OBSERVED)
    renderPanel(CAPPED_ID)

    expect(screen.queryByLabelText(describeInWordsToggleLabel(CAPPED_LABEL))).toBeNull()
    expect(screen.getByPlaceholderText('Enter value')).toBeInTheDocument()
  })

  // ── 3. THE GATE IS REACTIVE ──────────────────────────────────────────────

  it('is REACTIVE: a factor that stops being a chance loses the affordance underneath an OPEN field', async () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED)
    renderPanel(WALK_ID)
    elicitReplies.push(PRETTY_LIKELY)
    await askInWords(WALK_LABEL, 'pretty likely')
    expect(screen.getByText(/That reads as about 70%/)).toBeInTheDocument()

    // The factor acquires a unit (a CEE graph_patch can do exactly this).
    act(() => {
      useCanvasStore.setState(
        {
          nodes: [
            {
              id: WALK_ID,
              type: 'factor',
              position: { x: 0, y: 0 },
              data: {
                kind: 'factor',
                label: WALK_LABEL,
                observedState: { ...WALK_OBSERVED, unit: '£', value: 40000 },
              },
            } as unknown as Node,
          ],
        } as never,
        false,
      )
    })

    // The whole affordance is gone — there is no "Use this" left to click, which
    // is WHY an accept-time re-check would be unreachable and is not written.
    expect(screen.queryByLabelText(describeInWordsToggleLabel(WALK_LABEL))).toBeNull()
    expect(screen.queryByText(/That reads as/)).toBeNull()
  })

  // ── 4 + 5. THE COMMIT, and the wire ──────────────────────────────────────

  it('accepting commits the probability VERBATIM through the same factor_value_edit lane', async () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED)
    renderPanel(WALK_ID)
    elicitReplies.push(PRETTY_LIKELY)
    await askInWords(WALK_LABEL, 'pretty likely')

    fireEvent.click(screen.getByLabelText(`Use about 70% for ${WALK_LABEL}`))

    const events = eventsFor(WALK_ID)
    expect(events).toHaveLength(1)
    // VERBATIM: the elicited probability IS the model-scale value.
    expect(events[0].value).toBe(PRETTY_LIKELY.suggested_value)
    // And NOT the design's retired ×100 form, nor a cap-normalised number.
    expect(events[0].value).not.toBe(70)
    // ABSENCE IS THE CONTRACT: no client-asserted magnitude, no client-asserted
    // unit — CEE derives both from `value` and its own stored cap.
    expect(events[0]).not.toHaveProperty('raw_value')
    expect(events[0]).not.toHaveProperty('unit')
    expect(events[0].field).toBe('value')
    // The wire is not optional (2.365 class): the transport was actually called.
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)

    // A2 — the accepted number is still DISPLAYED. Without the local display
    // anchor, `setObservedValue` clears both `display_value` copies, the row and
    // the canvas node show NO NUMBER where "Low (0)" was, and the factor then
    // reads as scale-ambiguous — which takes the affordance itself away.
    expect(screen.getByTestId('factor-display-text')).toHaveTextContent('0.7')
  })

  it('binds the model_scale BASIS: no raw_value even when the factor already carries one', async () => {
    seed(ANCHORED_ID, ANCHORED_LABEL, ANCHORED_OBSERVED)
    renderPanel(ANCHORED_ID)
    elicitReplies.push(PRETTY_LIKELY)
    await askInWords(ANCHORED_LABEL, 'pretty likely')

    fireEvent.click(screen.getByLabelText(`Use about 70% for ${ANCHORED_LABEL}`))

    const events = eventsFor(ANCHORED_ID)
    expect(events).toHaveLength(1)
    expect(events[0].value).toBe(PRETTY_LIKELY.suggested_value)
    // THE ASSERTION THE WALK FIXTURE COULD NOT MAKE. With a stored `raw_value`,
    // the DEFAULT basis would read the probability as a user-unit magnitude and
    // attach `raw_value: 0.7` — a magnitude the user never gave, which CEE would
    // then take at face value instead of inverting with its own cap.
    expect(events[0]).not.toHaveProperty('raw_value')
    expect(events[0]).not.toHaveProperty('unit')
  })

  it('a clarification chip commits THAT chip\'s value, not the first one', async () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED)
    renderPanel(WALK_ID)
    elicitReplies.push(AMBIGUOUS_GOOD)
    await askInWords(WALK_LABEL, 'good')

    // The ENGINE's own question, verbatim.
    expect(screen.getByText(AMBIGUOUS_GOOD.clarifying_question)).toBeInTheDocument()
    // The THIRD chip — a handler that always commits options[0] passes if we
    // click the first one.
    fireEvent.click(screen.getByText('More likely than not'))

    const events = eventsFor(WALK_ID)
    expect(events).toHaveLength(1)
    expect(events[0].value).toBe(0.6)
    expect(events[0].value).not.toBe(AMBIGUOUS_GOOD.options[0].value)
    expect(events[0].value).not.toBe(AMBIGUOUS_GOOD.suggested_value)
  })

  it('needs_clarification with NO options offers no number at all', async () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED)
    renderPanel(WALK_ID)
    elicitReplies.push(UNSURE_NO_OPTIONS)
    await askInWords(WALK_LABEL, 'good')

    // No offer of a number the engine just said it was unsure about.
    expect(screen.queryByText(/That reads as/)).toBeNull()
    expect(screen.queryByText('Use this')).toBeNull()
    expect(
      screen.getByText(/I couldn't pin that down\. Try another wording, or type the number\./),
    ).toBeInTheDocument()
    expect(eventsFor(WALK_ID)).toHaveLength(0)
  })

  // ── 6. THE EXISTING TYPED PATH IS UNMOVED ────────────────────────────────

  it('CONTROL: the existing typed commit is unchanged on a factor where the affordance is not offered', () => {
    seed(CAPPED_ID, CAPPED_LABEL, CAPPED_OBSERVED)
    renderPanel(CAPPED_ID)

    const input = screen.getByPlaceholderText('Enter value')
    fireEvent.change(input, { target: { value: '12' } })
    fireEvent.blur(input)

    const events = eventsFor(CAPPED_ID)
    expect(events).toHaveLength(1)
    // The 1.346 shape, intact: user-unit magnitude + unit + cap-derived model
    // value, computed from the fixture's OWN cap rather than a hard-coded bound.
    expect(events[0].raw_value).toBe(12)
    expect(events[0].unit).toBe('engineers')
    expect(events[0].value).toBe(normaliseRawFactorValue(12, CAPPED_CAP))
  })

  it('CONTROL: an unchanged typed value still emits nothing (the negative control survives the mount)', () => {
    seed(CAPPED_ID, CAPPED_LABEL, CAPPED_OBSERVED)
    renderPanel(CAPPED_ID)

    const input = screen.getByPlaceholderText('Enter value')
    fireEvent.change(input, { target: { value: '8' } })
    fireEvent.blur(input)

    expect(eventsFor(CAPPED_ID)).toHaveLength(0)
  })

  // ── 7. THE POST-ACCEPT NUMBER FIELD ──────────────────────────────────────

  it('after an accept, blurring the number field emits NOTHING (it would otherwise undo the accept)', async () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED)
    renderPanel(WALK_ID)
    elicitReplies.push(PRETTY_LIKELY)
    await askInWords(WALK_LABEL, 'pretty likely')
    fireEvent.click(screen.getByLabelText(`Use about 70% for ${WALK_LABEL}`))
    expect(eventsFor(WALK_ID)).toHaveLength(1)

    // The number input was seeded with the PREVIOUS value (0). Blurring it now,
    // with no typing at all, must not commit that stale 0 back over the 0.7 the
    // user just accepted.
    fireEvent.blur(screen.getByPlaceholderText('Enter value'))

    expect(eventsFor(WALK_ID)).toHaveLength(1)
  })

  // ── 8. THE STALENESS CHAIN ───────────────────────────────────────────────

  it('accepting on a POST-ANALYSIS panel surfaces the re-run prompt', async () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED, ANALYSED)
    renderPanel(WALK_ID)
    // Nothing edited yet: the prompt must be quiet.
    expect(screen.queryByTestId('inline-rerun')).toBeNull()

    elicitReplies.push(PRETTY_LIKELY)
    await askInWords(WALK_LABEL, 'pretty likely')
    fireEvent.click(screen.getByLabelText(`Use about 70% for ${WALK_LABEL}`))

    expect(screen.getByTestId('inline-rerun')).toBeInTheDocument()
    expect(screen.getByText('Re-run to see how this affects the results')).toBeInTheDocument()
  })

  it('CONTROL: with NO analysis in the store, accepting surfaces no re-run prompt', async () => {
    seed(WALK_ID, WALK_LABEL, WALK_OBSERVED, NOT_ANALYSED)
    renderPanel(WALK_ID)
    elicitReplies.push(PRETTY_LIKELY)
    await askInWords(WALK_LABEL, 'pretty likely')
    fireEvent.click(screen.getByLabelText(`Use about 70% for ${WALK_LABEL}`))

    // The commit still happened — this control is about the PROMPT, not the edit.
    expect(eventsFor(WALK_ID)).toHaveLength(1)
    expect(screen.queryByTestId('inline-rerun')).toBeNull()
  })
})
