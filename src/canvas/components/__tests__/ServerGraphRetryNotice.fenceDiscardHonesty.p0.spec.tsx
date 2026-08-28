/**
 * P0 — THE PRODUCT MUST NOT BLAME THE SERVER FOR WHAT THIS CLIENT DID.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT: THE HONESTY FIX WAS DEFEATED BY THE KEY IT WAS KEYED ON
 * ═══════════════════════════════════════════════════════════════════════════
 * M3 shipped `SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY` for the case where a model
 * arrived and could not be shown, chosen by `draftStreamGraphDeliveredFor`.
 *
 * That predicate is keyed on the DISPATCHING scenario. The scenario fence fires
 * ONLY when the dispatching id and the live id disagree. So on precisely the
 * turns the honest sentence was written for, the predicate answers FALSE and the
 * surface falls through to `SERVER_GRAPH_RETRY_EXHAUSTED_COPY` — "Olumi did not
 * return a model for this decision" — about a turn in which the server delivered
 * a complete model and THIS CLIENT threw it away.
 *
 * Measured, run 33214479408 (staging build `e8252496`): two discards, both
 * `carriedGraph: true`, live `46609760…`, dispatch `7957639a…`, and that
 * sentence on screen.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⚠ WHAT THIS SPEC DRIVES, AND WHY IT IS NOT THE STORE
 * ═══════════════════════════════════════════════════════════════════════════
 * It calls the REAL `recordScenarioFenceDiscard` — the funnel every one of the
 * four fence sites passes through — rather than setting the store field. Setting
 * the field would assert that the notice reads a value, which is a tautology;
 * calling the funnel asserts that a DISCARD produces the honest sentence, which
 * is the actual guarantee. If the recording is ever removed from the funnel this
 * REDs, which a store-level test could not do.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import { ServerGraphRetryNotice, SERVER_GRAPH_RETRY_NOTICE_TESTID, SERVER_GRAPH_RETRY_EXHAUSTED_COPY, SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY } from '../ServerGraphRetryNotice'
import { recordScenarioFenceDiscard } from '../../conversation/scenarioResponseFence'
import { useCanvasStore } from '../../store'
import { useDraftStore } from '../../stores/draftStore'
import { useServerGraphRetryStore } from '../../stores/serverGraphRetryStore'

/** The decision on screen — the live id, as in the measured trace. */
const LIVE_ID = '46609760-7dfe-4ab1-960e-1176ab4ca7a6'
/** The id the turn actually went out under, after the mint. */
const DISPATCH_ID = '7957639a-9230-401d-9d86-5878b212ffd8'

beforeEach(() => {
  useDraftStore.getState().resetDraft()
  useCanvasStore.setState({ currentScenarioId: LIVE_ID, nodes: [] })
  // The surface only speaks at all once the re-ask has given up (GATE 1), and
  // only for its own decision (GATE 2).
  useServerGraphRetryStore.getState().setRetryStage({ scenarioId: LIVE_ID, stage: 'exhausted' })
})

describe('P0: a fence discard must not produce the server-blaming sentence', () => {
  it('says the page could not display the model — NOT that the server returned none', () => {
    // The exact event from the trace, through the real funnel.
    recordScenarioFenceDiscard({
      site: 'graph_ready_preview',
      liveScenarioId: LIVE_ID,
      scenarioIdAtDispatch: DISPATCH_ID,
      carriedGraph: true,
    })

    render(<ServerGraphRetryNotice />)
    const strip = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)

    expect(
      strip.textContent,
      '[P0] the product told the user the SERVER returned no model, on a turn where the ' +
      'server delivered one and this client discarded it. That is the sentence measured ' +
      'on screen in run 33214479408.',
    ).not.toContain(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)

    expect(
      strip.textContent,
      '[P0] the honest sentence — a CLIENT failure — did not appear',
    ).toContain(SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY)
  })

  it('a discard that carried NO graph leaves the server-blaming sentence intact', () => {
    // THE OPPOSITE-DIRECTION TWIN (trap 22b). A fix that closes the lie must not
    // open a new one by suppressing a sentence that is TRUE. Discarding a
    // response that carried no model is not evidence a model ever arrived, so
    // this turn's honest verdict is unchanged.
    recordScenarioFenceDiscard({
      site: 'terminal_response',
      liveScenarioId: LIVE_ID,
      scenarioIdAtDispatch: DISPATCH_ID,
      carriedGraph: false,
    })

    render(<ServerGraphRetryNotice />)
    const strip = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)

    expect(
      strip.textContent,
      '[P0] `carriedGraph: false` was treated as evidence a model arrived — the notice now ' +
      'claims a delivery this client never observed, which is a new lie in the other direction.',
    ).toContain(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)
  })

  it('a discard belonging to ANOTHER decision does not speak for this one', () => {
    // Attribution. The record is keyed on the live id; this asserts the key is
    // load-bearing rather than incidental — a discard observed while a different
    // decision was on screen must not colour this decision's sentence.
    recordScenarioFenceDiscard({
      site: 'graph_ready_preview',
      liveScenarioId: DISPATCH_ID, // some OTHER decision was on screen
      scenarioIdAtDispatch: DISPATCH_ID,
      carriedGraph: true,
    })

    render(<ServerGraphRetryNotice />)
    const strip = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)

    expect(
      strip.textContent,
      '[P0] a discard recorded against a DIFFERENT decision changed this decision\'s sentence',
    ).toContain(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)
  })
})
