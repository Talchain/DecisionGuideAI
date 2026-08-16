/**
 * WhatChangedChip — the honest server answer must land on a surface the user
 * can SEE.
 *
 * THE DEFECT (derived at 9a8b84c6, read-only). Clicking the chip dispatches a
 * real CEE turn (`action_type: 'what_changed'`, WhatChangedChip.tsx:222-232)
 * and CEE answers honestly — `insufficient_runs` when there is only one run.
 * But the reply lands in the Olumi thread, which may be on a hidden dock tab or
 * behind a minimised panel, and nothing brought it into view. The user pressed
 * a button and, as far as the screen was concerned, nothing happened.
 *
 * WHY THIS CHIP AND NOT THE OTHERS. `guidanceStore.ts:209-221` wraps the
 * registration seam in `withOlumiReveal`, so `_sendMessage`, `_sendChip`,
 * `_prefillChat` and `_dispatchAction` all reveal automatically (`:592-603`) —
 * deliberately, to avoid the hand-maintained list of call sites this codebase
 * pays for most often. This chip reads
 * `useOptionalConversationContext()?.dispatchAction` (:150) — the RAW context
 * value — so it bypasses that wrapped seam entirely and is the one dispatch
 * site with no reveal.
 *
 * THE TREATMENT is the one already applied at AnalysisHeroContainer.tsx:111-116
 * (`send(text); revealOlumiSurface()`), InspectorCoaching.tsx:79, useFocusNow.ts:75
 * and useConversationActions.ts:59-91.
 *
 * ⚠ SCOPE: this pins REVEAL-ON-DISPATCH only. It deliberately adds NO run-count
 * gate — `WhatChangedChip.tsx:35-45` records that `#425`'s `runs.length < 2`
 * mount gate was removed on 2026-07-22 because `runHistory` stays empty on the
 * live guest path, and the server owns comparison honesty. Making the honest
 * answer VISIBLE is the fix; suppressing the question is not.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const { loadRunsMock, pulseMock, ctxMock, revealMock } = vi.hoisted(() => ({
  loadRunsMock: vi.fn(),
  pulseMock: vi.fn(),
  ctxMock: vi.fn(),
  revealMock: vi.fn(),
}))
vi.mock('../../store/runHistory', () => ({ loadRuns: loadRunsMock }))
vi.mock('../../utils/appliedEditPulse', () => ({
  pulseAppliedTargets: pulseMock,
  __resetAppliedEditPulseForTests: vi.fn(),
  PULSE_COALESCE_MS: 100,
  PULSE_DURATION_MS: 2000,
}))
vi.mock('../../conversation/ConversationContext', () => ({
  useOptionalConversationContext: ctxMock,
}))
vi.mock('../../conversation/revealOlumi', () => ({
  revealOlumiSurface: revealMock,
}))

import { WhatChangedChip } from '../WhatChangedChip'

const node = (id: string, label: string): Node =>
  ({ id, type: 'factor', position: { x: 0, y: 0 }, data: { label } }) as Node
const edge = (id: string, weight: number): Edge =>
  ({ id, source: 'a', target: 'b', data: { weight, belief: 0.7 } }) as Edge

let runSeq = 0
const run = (graph: { nodes: Node[]; edges: Edge[] }) => ({
  id: `run-${++runSeq}`,
  ts: 1000 - runSeq,
  graph,
})

function seedRunsWithDelta() {
  loadRunsMock.mockReturnValue([
    run({ nodes: [node('a', 'A'), node('c', 'C')], edges: [edge('e1', 0.9)] }),
    run({ nodes: [node('a', 'A')], edges: [edge('e1', 0.5)] }),
  ])
}

/** The state the defect is actually about: ONE stored run, nothing to compare
 *  locally. The chip still renders and still sends — CEE answers
 *  `insufficient_runs` — and that answer is exactly what must become visible. */
function seedSingleRun() {
  loadRunsMock.mockReturnValue([
    run({ nodes: [node('a', 'A')], edges: [edge('e1', 0.5)] }),
  ])
}

beforeEach(() => {
  loadRunsMock.mockReset()
  pulseMock.mockReset()
  ctxMock.mockReset()
  revealMock.mockReset()
})
afterEach(() => cleanup())

describe('WhatChangedChip — the dispatched turn is revealed, not sent into a hidden tab', () => {
  it('reveals the Olumi surface when the click dispatches a turn', () => {
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    // Bound to THIS handler: the same click that issued the dispatch is the one
    // that revealed. Asserting the reveal alone would not distinguish a reveal
    // fired from a mount effect or an unrelated handler.
    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(dispatchMock.mock.calls[0][0].action_type).toBe('what_changed')
    expect(revealMock).toHaveBeenCalledTimes(1)
  })

  it('reveals on the SINGLE-RUN click — the case where the answer is "nothing to compare yet"', () => {
    // The whole point: with one run CEE replies `insufficient_runs`, and that
    // honest reply is worthless if the user is not looking at the thread.
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedSingleRun()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(revealMock).toHaveBeenCalledTimes(1)
  })

  it('reveals even though no local pulse was available', () => {
    // Reveal is tied to the DISPATCH, not to the pulse. A single run has no
    // alignable pair, so the pulse is skipped — the reveal must not be.
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedSingleRun()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    expect(pulseMock).not.toHaveBeenCalled()
    expect(revealMock).toHaveBeenCalledTimes(1)
  })

  it('still reveals when the send REJECTS — the user must see the failure notice too', () => {
    const dispatchMock = vi.fn().mockRejectedValue(new Error('transport'))
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    expect(() => fireEvent.click(screen.getByTestId('what-changed-chip'))).not.toThrow()
    expect(revealMock).toHaveBeenCalledTimes(1)
  })
})

describe('WhatChangedChip — reveal discrimination controls', () => {
  it('does NOT reveal when there is no dispatcher (pulse-only degrade)', () => {
    // The RED/GREEN pair's other half. Removing the reveal call for ALL clicks
    // REDs the tests above; this one proves the reveal is bound to the DISPATCH
    // branch specifically, not fired unconditionally on any click. A reveal
    // here would drag the user to an empty thread no message was sent to.
    ctxMock.mockReturnValue(null)
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(revealMock).not.toHaveBeenCalled()
  })

  it('does not reveal on mount, only on click', () => {
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    expect(revealMock).not.toHaveBeenCalled()

    fireEvent.click(screen.getByTestId('what-changed-chip'))
    expect(revealMock).toHaveBeenCalledTimes(1)
  })

  it('a throwing reveal never breaks a delivered send', () => {
    // guidanceStore.ts:200-202 states the contract: the reveal is best-effort
    // and must never turn a delivered message into a thrown error.
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    revealMock.mockImplementation(() => {
      throw new Error('dock unavailable')
    })
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    expect(() => fireEvent.click(screen.getByTestId('what-changed-chip'))).not.toThrow()
    expect(dispatchMock).toHaveBeenCalledTimes(1)
  })
})
