/**
 * ServerGraphRetryNotice — GATE 4: never "Looking for your model…" over a
 * FIRST draft that is still streaming (contract v3.1 gap U14, Paul 24 Sep).
 *
 * The code path (traced, not yet witnessed on the deployed build): a guest's
 * first Send mints the scenario id, `useServerGraphHydration` keys on it and
 * fires the boot read, the turn has already provisioned the CEE row, the read
 * answers `absent`, and the re-ask arms `retrying`. The notice then sat over
 * the empty canvas of a draft that was simply still in flight. The notice was
 * designed for the RETURNING-guest window only.
 *
 * Bound by identity: the draft phase is written through the store's own action
 * with an owning scenario id, and the gate is read through `draftStreamPhaseFor`.
 * Each contrast below reds a different wrong implementation:
 *   · no draft in flight            → present (the returning-guest case survives)
 *   · a draft for ANOTHER decision  → present (an unkeyed read would hide it)
 *   · `unsettled` (terminal)        → present (a `!== 'idle'` read would hide it)
 *   · the stream ends               → the notice comes back, exhaustion copy intact
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'

import {
  ServerGraphRetryNotice,
  SERVER_GRAPH_RETRY_NOTICE_TESTID,
  SERVER_GRAPH_RETRY_LOOKING_COPY,
  SERVER_GRAPH_RETRY_EXHAUSTED_COPY,
  SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY,
} from '../ServerGraphRetryNotice'
import { useServerGraphRetryStore } from '../../stores/serverGraphRetryStore'
import {
  useDraftStore,
  draftStreamInFlight,
  draftStreamPhaseFor,
} from '../../stores/draftStore'
import { useCanvasStore } from '../../store'

const A = '11111111-2222-4333-8444-555555555555'
const B = '22222222-3333-4444-8555-666666666666'
const TURN = 'turn-first-draft'

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

/** The U14 state: the minted id is live, the boot re-ask armed, nothing drawn yet. */
function armRetryingOnEmptyCanvas(): void {
  useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'retrying' })
  setCanvas(A, 0)
}

const notice = () => screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)

beforeEach(() => {
  useServerGraphRetryStore.getState().clear()
  useDraftStore.getState().resetDraft()
  setCanvas(A, 0)
})

describe('ServerGraphRetryNotice — GATE 4: this page is drafting this decision (U14)', () => {
  it('renders NOTHING while the first draft for this decision is streaming (drafting)', () => {
    armRetryingOnEmptyCanvas()
    useDraftStore.getState().setDraftStreamPhase('drafting', TURN, A)

    // PRECONDITIONS — every other gate is satisfied, so only GATE 4 can hide it.
    expect(draftStreamInFlight(draftStreamPhaseFor(useDraftStore.getState(), A))).toBe(true)
    expect(useCanvasStore.getState().nodes).toHaveLength(0)
    expect(useServerGraphRetryStore.getState().stage).toBe('retrying')

    render(<ServerGraphRetryNotice />)
    expect(notice()).toBeNull()
    expect(screen.queryByText(SERVER_GRAPH_RETRY_LOOKING_COPY)).toBeNull()
  })

  it('renders NOTHING while settling on an empty canvas — the turn is still in flight', () => {
    armRetryingOnEmptyCanvas()
    useDraftStore.getState().setDraftStreamPhase('settling', TURN, A)

    render(<ServerGraphRetryNotice />)
    expect(notice()).toBeNull()
  })

  it('does not put the exhaustion sentence over a draft that is still streaming', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
    setCanvas(A, 0)
    useDraftStore.getState().setDraftStreamPhase('drafting', TURN, A)

    render(<ServerGraphRetryNotice />)
    expect(notice()).toBeNull()
    expect(screen.queryByText(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)).toBeNull()
  })
})

describe('ServerGraphRetryNotice — GATE 4 contrasts: what must STILL render', () => {
  it('CONTRAST — no draft in flight (the returning-guest case): "Looking for your model…" shows', () => {
    armRetryingOnEmptyCanvas()
    expect(draftStreamPhaseFor(useDraftStore.getState(), A)).toBe('idle')

    render(<ServerGraphRetryNotice />)
    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_LOOKING_COPY)
    expect(el.getAttribute('data-stage')).toBe('retrying')
  })

  it("CONTRAST — another decision's draft does not hide this decision's notice", () => {
    armRetryingOnEmptyCanvas()
    useDraftStore.getState().setDraftStreamPhase('drafting', TURN, B)

    // PRECONDITION — a stream really is in flight, just not for this decision.
    expect(useDraftStore.getState().draftStreamPhase).toBe('drafting')
    expect(draftStreamPhaseFor(useDraftStore.getState(), A)).toBe('idle')

    render(<ServerGraphRetryNotice />)
    expect(screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toHaveTextContent(
      SERVER_GRAPH_RETRY_LOOKING_COPY,
    )
  })

  it('CONTRAST — a terminal `unsettled` phase is not in flight, so the notice shows', () => {
    armRetryingOnEmptyCanvas()
    useDraftStore.getState().setDraftStreamPhase('unsettled', TURN, A)

    render(<ServerGraphRetryNotice />)
    expect(screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeInTheDocument()
  })

  it('comes back the moment the stream ends, with the exhaustion sentence intact', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
    setCanvas(A, 0)
    useDraftStore.getState().setDraftStreamPhase('drafting', TURN, A)

    const { rerender } = render(<ServerGraphRetryNotice />)
    expect(notice()).toBeNull()

    act(() => {
      useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    })
    rerender(<ServerGraphRetryNotice />)
    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)
    expect(el.getAttribute('data-model-delivered')).toBe('false')
  })

  it('comes back with the UNDISPLAYABLE sentence when the ended stream delivered a model', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
    setCanvas(A, 0)
    useDraftStore.getState().setDraftStreamPhase('drafting', TURN, A)
    useDraftStore.getState().markDraftStreamGraphDelivered(A)

    const { rerender } = render(<ServerGraphRetryNotice />)
    expect(notice()).toBeNull()

    act(() => {
      useDraftStore.getState().setDraftStreamPhase('idle', null, null)
    })
    rerender(<ServerGraphRetryNotice />)
    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_UNDISPLAYABLE_COPY)
    expect(el.getAttribute('data-model-delivered')).toBe('true')
  })
})
