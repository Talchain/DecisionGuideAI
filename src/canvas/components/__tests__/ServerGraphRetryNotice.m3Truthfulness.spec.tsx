/**
 * ServerGraphRetryNotice — M3: the notice that blamed the server for a client bug.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * THE DEFECT (deployed build, fresh isolated context, fresh signup, fresh
 * scenario, CEE `d7dcdd0`, 2026-08-26)
 * ═══════════════════════════════════════════════════════════════════════════
 *   STREAM  : 15 chunks · 110,343 bytes · ENDED=TRUE · lastMs=71,532
 *   STAGES  : DRAFTING → GRAPH_READY → COACHING_READY → COMPLETE  (all four)
 *   RENDERED: nodes = 0
 *   UI SAYS : "Olumi did not return a model for this decision."
 *
 * Direct HTTP to the same server completed 14/14 at 47.9–64.0 s. The sentence
 * is FACTUALLY FALSE: a complete 110 KB draft reached COMPLETE in the browser.
 *
 * The notice's evidence is the boot re-ask ONLY — `absentGraphRetry`, seven
 * reads of the scenario-graph route over 100 s. That transport is blind to the
 * DRAFT STREAM, which carries the same model by another route. So the notice
 * could watch a model arrive and still assert that Olumi had not sent one.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * WHAT THESE TESTS PIN, AND WHY EACH ARM EXISTS
 * ═══════════════════════════════════════════════════════════════════════════
 * ⭐ A test that only checked "an error string is shown" CANNOT SEE THIS
 * DEFECT — the string was shown correctly, for a case that did not occur. So
 * every test below asserts WHICH CLAIM is made, never merely that a strip
 * rendered.
 *
 * The discriminating pair is the point:
 *   · a DELIVERED-but-undrawable model must stop asserting a server failure;
 *   · a genuinely EMPTY answer must STILL say so, with the reload that works.
 * Fixing M3 by making the component silent would be a different defect, and
 * the second arm is what forbids it.
 *
 * Identity binding (trap 19): a delivery recorded for ANOTHER decision must
 * not change THIS decision's words. Bound by scenario id, not by a value
 * predicate another object could satisfy.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  ServerGraphRetryNotice,
  SERVER_GRAPH_RETRY_NOTICE_TESTID,
  SERVER_GRAPH_RETRY_EXHAUSTED_COPY,
  SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY,
  SERVER_GRAPH_RETRY_ACTION_COPY,
} from '../ServerGraphRetryNotice'
import { useServerGraphRetryStore } from '../../stores/serverGraphRetryStore'
import { useDraftStore, draftStreamGraphDeliveredFor } from '../../stores/draftStore'
import { useCanvasStore } from '../../store'

const A = '11111111-2222-4333-8444-555555555555'
const B = '22222222-3333-4444-8555-666666666666'

function setCanvas(scenarioId: string | null, nodeCount: number): void {
  useCanvasStore.setState({
    currentScenarioId: scenarioId,
    nodes: Array.from({ length: nodeCount }, (_, i) => ({
      id: `n${i}`,
      position: { x: 0, y: 0 },
      data: {},
    })),
  } as never)
}

/** The M3 state: the re-ask gave up, the canvas is empty, this decision is live. */
function armExhaustedOnEmptyCanvas(): void {
  useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
  setCanvas(A, 0)
}

beforeEach(() => {
  useServerGraphRetryStore.getState().clear()
  useDraftStore.setState({ draftStreamGraphDeliveredScenarioId: null })
  setCanvas(A, 0)
})

describe('ServerGraphRetryNotice — M3: it must not blame the server for a client fault', () => {
  /**
   * ⭐ THE M3 CONDITION, BOUND EXACTLY: the draft stream DELIVERED a model for
   * this decision, the canvas is showing ZERO nodes, and the re-ask exhausted.
   */
  it('STOPS asserting that Olumi returned no model once a model was delivered on the stream', () => {
    armExhaustedOnEmptyCanvas()
    useDraftStore.getState().markDraftStreamGraphDelivered(A)

    // PRECONDITIONS — pinned in-test so this cannot pass by accident (13b).
    expect(
      draftStreamGraphDeliveredFor(useDraftStore.getState(), A),
    ).toBe(true)
    expect(useCanvasStore.getState().nodes).toHaveLength(0)

    render(<ServerGraphRetryNotice />)
    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)

    // THE DEFECT: this exact sentence is false in M3 and must be gone.
    expect(el).not.toHaveTextContent('did not return a model')
    // And it must not have gone SILENT or VAGUE — it states the true thing.
    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY)
    expect(el.getAttribute('data-model-delivered')).toBe('true')
  })

  it('still offers the reload — the user has no model on screen either way', () => {
    armExhaustedOnEmptyCanvas()
    useDraftStore.getState().markDraftStreamGraphDelivered(A)

    render(<ServerGraphRetryNotice />)
    expect(
      screen.getByTestId(`${SERVER_GRAPH_RETRY_NOTICE_TESTID}-action`),
    ).toHaveTextContent(SERVER_GRAPH_RETRY_ACTION_COPY)
  })

  /**
   * The copy must not swing from one falsehood to another. It states a CLIENT
   * failure; it may not imply the model is on screen, nor that all is well.
   */
  it('the delivered-case copy asserts a CLIENT failure, not a server one and not success', () => {
    const copy = SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY.toLowerCase()
    expect(copy).toContain('could not display')
    expect(copy).not.toContain('did not return a model')
    // No storage claim — all three of these are measured falsehoods for a guest.
    for (const banned of ['saved locally', 'only in this browser', 'sign in to save']) {
      expect(copy).not.toContain(banned)
    }
    // No "your work is gone" register, and no false reassurance.
    for (const banned of ['your work is gone', 'successfully', 'all set']) {
      expect(copy).not.toContain(banned)
    }
  })
})

describe('ServerGraphRetryNotice — the discriminating twin: a genuinely empty answer', () => {
  /**
   * ⭐ THE OTHER HALF OF THE PAIR. M3 must NOT be fixed by making the component
   * silent or vague. When nothing was delivered, the original sentence is the
   * true one and must survive untouched.
   *
   * A mutant that removes the delivery distinction must RED the M3 test above
   * and LEAVE THIS ONE GREEN — that pairing is what proves the fix binds to the
   * delivered case specifically rather than just changing the words.
   */
  it('still says Olumi did not return a model when nothing was delivered', () => {
    armExhaustedOnEmptyCanvas()

    expect(draftStreamGraphDeliveredFor(useDraftStore.getState(), A)).toBe(false)

    render(<ServerGraphRetryNotice />)
    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)

    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)
    expect(el).not.toHaveTextContent(SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY)
    expect(el.getAttribute('data-model-delivered')).toBe('false')
    expect(
      screen.getByTestId(`${SERVER_GRAPH_RETRY_NOTICE_TESTID}-action`),
    ).toHaveTextContent(SERVER_GRAPH_RETRY_ACTION_COPY)
  })
})

describe('ServerGraphRetryNotice — the delivery claim is bound by IDENTITY', () => {
  /**
   * Trap 19: bind by identity, never by a predicate another object could
   * satisfy. A model delivered for decision B says nothing about decision A —
   * and `contextIntegrityStore`'s header records the P0 that follows from
   * getting this wrong on a neighbouring surface.
   */
  it("another decision's delivery does not change this decision's words", () => {
    armExhaustedOnEmptyCanvas()
    useDraftStore.getState().markDraftStreamGraphDelivered(B)

    // PRECONDITION — a delivery really is recorded, just not for this decision.
    expect(useDraftStore.getState().draftStreamGraphDeliveredScenarioId).toBe(B)
    expect(draftStreamGraphDeliveredFor(useDraftStore.getState(), A)).toBe(false)

    render(<ServerGraphRetryNotice />)
    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)

    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)
    expect(el.getAttribute('data-model-delivered')).toBe('false')
  })

  it('an unattributable delivery is never claimed', () => {
    expect(draftStreamGraphDeliveredFor({ draftStreamGraphDeliveredScenarioId: null }, A)).toBe(
      false,
    )
    expect(draftStreamGraphDeliveredFor({ draftStreamGraphDeliveredScenarioId: A }, null)).toBe(
      false,
    )
    // The positive control for the two assertions above — without it they
    // could both pass against a function that always returns false.
    expect(draftStreamGraphDeliveredFor({ draftStreamGraphDeliveredScenarioId: A }, A)).toBe(true)
  })
})

describe('ServerGraphRetryNotice — the delivery record does not defeat the existing gates', () => {
  it('GATE 3 still wins: nothing renders over a canvas that has the work on screen', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
    useDraftStore.getState().markDraftStreamGraphDelivered(A)
    setCanvas(A, 14)

    render(<ServerGraphRetryNotice />)
    expect(screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeNull()
  })

  it('while RETRYING the words are unchanged, delivered or not', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'retrying' })
    useDraftStore.getState().markDraftStreamGraphDelivered(A)
    setCanvas(A, 0)

    render(<ServerGraphRetryNotice />)
    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
    expect(el.getAttribute('data-stage')).toBe('retrying')
    expect(el).not.toHaveTextContent(SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY)
    expect(el).not.toHaveTextContent(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)
  })
})
