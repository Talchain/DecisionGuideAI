/**
 * ServerGraphRetryNotice — the honest interim state, and its three gates.
 *
 * Each gate is pinned SEPARATELY and by identity, so a mutant that removes one
 * reds exactly one test rather than the file. That separation is what makes the
 * discriminating mutant pair possible: loosening the scenario gate must red the
 * "another decision" test and LEAVE the empty-canvas test green, and vice versa.
 *
 * The copy tests are not decoration. A sibling probe settled on 2026-08-25 that
 * "saved locally", "only in this browser" and "sign in to save your work" are
 * all FALSE for a guest, whose graph also exists server-side. A notice shown at
 * precisely the moment a user fears their work is gone is the worst possible
 * place to assert something untrue about where it lives, so the banned claims
 * are asserted ABSENT rather than left to review.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'

import {
  ServerGraphRetryNotice,
  SERVER_GRAPH_RETRY_NOTICE_TESTID,
  SERVER_GRAPH_RETRY_LOOKING_COPY,
  SERVER_GRAPH_RETRY_EXHAUSTED_COPY,
  SERVER_GRAPH_RETRY_ACTION_COPY,
} from '../ServerGraphRetryNotice'
import { useServerGraphRetryStore } from '../../stores/serverGraphRetryStore'
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

beforeEach(() => {
  useServerGraphRetryStore.getState().clear()
  setCanvas(A, 0)
})

describe('ServerGraphRetryNotice — what it says', () => {
  it('says it is LOOKING while retrying, and offers no action yet', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'retrying' })
    render(<ServerGraphRetryNotice />)

    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_LOOKING_COPY)
    expect(el.getAttribute('data-stage')).toBe('retrying')
    expect(
      screen.queryByTestId(`${SERVER_GRAPH_RETRY_NOTICE_TESTID}-action`),
    ).toBeNull()
  })

  it('states what happened on exhaustion and offers the reload that works', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
    render(<ServerGraphRetryNotice />)

    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
    expect(el).toHaveTextContent(SERVER_GRAPH_RETRY_EXHAUSTED_COPY)
    expect(el.getAttribute('data-stage')).toBe('exhausted')
    expect(
      screen.getByTestId(`${SERVER_GRAPH_RETRY_NOTICE_TESTID}-action`),
    ).toHaveTextContent(SERVER_GRAPH_RETRY_ACTION_COPY)
  })

  it('is a polite live region, never an alert', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'retrying' })
    render(<ServerGraphRetryNotice />)

    const el = screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)
    expect(el.getAttribute('role')).toBe('status')
    expect(el.getAttribute('aria-live')).toBe('polite')
  })
})

describe('ServerGraphRetryNotice — what it must NEVER say', () => {
  /**
   * All three are measured falsehoods for a guest. `ScenarioListPage.tsx`
   * (369-380) carries the derivation; "only in this browser" is the worst
   * because it reads as a privacy claim and nothing about it is true.
   */
  it.each([
    'saved locally',
    'only in this browser',
    'sign in to save',
    'your work is gone',
    'lost',
  ])('never claims %s', (banned) => {
    const all = [
      SERVER_GRAPH_RETRY_LOOKING_COPY,
      SERVER_GRAPH_RETRY_EXHAUSTED_COPY,
      SERVER_GRAPH_RETRY_ACTION_COPY,
    ]
      .join(' ')
      .toLowerCase()
    expect(all).not.toContain(banned)
  })

  /**
   * The retrying string must not read as an unbounded wait. It is present-tense
   * about what the client is doing and carries no forecast, no "almost there",
   * and no elapsed/remaining time — the same register the narration-honesty
   * invariants enforce elsewhere.
   */
  it.each(['almost', 'usually', 'soon', 'any moment', 'shortly'])(
    'makes no completion-proximity claim (%s)',
    (banned) => {
      expect(SERVER_GRAPH_RETRY_LOOKING_COPY.toLowerCase()).not.toContain(banned)
    },
  )
})

describe('ServerGraphRetryNotice — GATE 1: stage', () => {
  it('renders NOTHING when idle', () => {
    render(<ServerGraphRetryNotice />)
    expect(screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeNull()
  })
})

describe('ServerGraphRetryNotice — GATE 2: scenario identity', () => {
  /**
   * The P0 `contextIntegrityStore`'s header records, in this surface's shape:
   * a stage recorded for decision A must never render over decision B.
   *
   * Binds by IDENTITY — the stage is present and the canvas is empty, so every
   * OTHER gate is satisfied. Only the id differs, which is what makes this test
   * sensitive to the id comparison and to nothing else.
   */
  it('never renders for another decision', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
    setCanvas(B, 0)

    render(<ServerGraphRetryNotice />)
    expect(screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeNull()
  })

  it('renders for the matching decision — the positive control for the gate above', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
    setCanvas(A, 0)

    render(<ServerGraphRetryNotice />)
    expect(screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeInTheDocument()
  })

  it('never renders when the canvas has no scenario at all', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'retrying' })
    setCanvas(null, 0)

    render(<ServerGraphRetryNotice />)
    expect(screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeNull()
  })
})

describe('ServerGraphRetryNotice — GATE 3: the canvas is empty', () => {
  /**
   * If the autosave restored the user's work it is ON SCREEN, and a strip
   * saying "Olumi did not return a model" over a populated canvas would be
   * frightening and false to experience.
   *
   * This is also what makes the notice SELF-CLEARING: when a late graph merges,
   * node count goes non-zero and this unmounts with no store write to retract.
   */
  it('never renders over a canvas that already has the work on screen', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'exhausted' })
    setCanvas(A, 14)

    render(<ServerGraphRetryNotice />)
    expect(screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeNull()
  })

  it('DISAPPEARS when the late graph lands — the fix, seen from the surface', () => {
    useServerGraphRetryStore.getState().setRetryStage({ scenarioId: A, stage: 'retrying' })
    setCanvas(A, 0)

    const { rerender } = render(<ServerGraphRetryNotice />)
    expect(screen.getByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeInTheDocument()

    // The write-back lands and the merge applies it.
    setCanvas(A, 11)
    rerender(<ServerGraphRetryNotice />)
    expect(screen.queryByTestId(SERVER_GRAPH_RETRY_NOTICE_TESTID)).toBeNull()
  })
})
