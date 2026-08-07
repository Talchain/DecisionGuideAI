/**
 * WhatChangedChip — F2 CHANGE B send half (AUGMENT, not replace).
 *
 * Ruled decision: the canvas pulse (structural graph diff) STAYS, and the click
 * ADDITIONALLY dispatches a real CEE turn (outcome delta) through the existing
 * chip dispatch mechanism (useConversation.dispatchAction). These specs pin:
 *
 *  - AUGMENT: one click fires BOTH the pulse AND dispatchAction, with the exact
 *    typed intent + message + source:'chip' that the send gate then promotes to
 *    chip_click (buildV5Payload). The dispatch opts are asserted from the REAL
 *    call, not reconstructed.
 *  - FAIL-SAFE: when no conversation hook is in scope
 *    (useOptionalConversationContext() === null), the click still pulses and
 *    NEVER throws — the chip degrades to today's pulse-only behaviour.
 *  - a rejected send does not break the chip (the pulse has already fired).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { Node, Edge } from '@xyflow/react'

const { loadRunsMock, pulseMock, ctxMock } = vi.hoisted(() => ({
  loadRunsMock: vi.fn(),
  pulseMock: vi.fn(),
  ctxMock: vi.fn(),
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

import { WhatChangedChip, WHAT_CHANGED_CHIP_MESSAGE } from '../WhatChangedChip'

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

/** A delta with an added node + a modified edge → the chip renders and the
 * pulse has real ids to fire on. */
function seedRunsWithDelta() {
  loadRunsMock.mockReturnValue([
    run({ nodes: [node('a', 'A'), node('c', 'C')], edges: [edge('e1', 0.9)] }),
    run({ nodes: [node('a', 'A')], edges: [edge('e1', 0.5)] }),
  ])
}

beforeEach(() => {
  loadRunsMock.mockReset()
  pulseMock.mockReset()
  ctxMock.mockReset()
})
afterEach(() => cleanup())

describe('WhatChangedChip — AUGMENT: pulse STAYS and the CEE send fires alongside it', () => {
  it('one click pulses the canvas AND dispatches the typed what_changed turn', () => {
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    // Pulse STILL fires (augment-not-replace) — the structural answer.
    expect(pulseMock).toHaveBeenCalledTimes(1)

    // The CEE send fires alongside it — the outcome answer, through the real
    // dispatch mechanism, carrying the typed intent, verbatim message, and
    // source:'chip' (the send gate promotes to chip_click downstream).
    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(dispatchMock).toHaveBeenCalledWith({
      action_type: 'what_changed',
      label: WHAT_CHANGED_CHIP_MESSAGE,
      message: 'What changed since the last run?',
      source: 'chip',
    })
  })

  it('does NOT hand-build a chip_click source — it passes chip and lets the gate promote', () => {
    // Guards against a future regression that hardcodes source:'chip_click'
    // here and bypasses the sendability gate that promotes it.
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    expect(dispatchMock.mock.calls[0][0].source).toBe('chip')
  })
})

describe('WhatChangedChip — FAIL-SAFE: no conversation hook degrades to pulse-only', () => {
  it('pulses and does not throw when useOptionalConversationContext() is null', () => {
    ctxMock.mockReturnValue(null)
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    expect(() =>
      fireEvent.click(screen.getByTestId('what-changed-chip')),
    ).not.toThrow()
    expect(pulseMock).toHaveBeenCalledTimes(1)
  })

  it('a rejected CEE send does not break the chip — the pulse has already fired', () => {
    const dispatchMock = vi.fn().mockRejectedValue(new Error('transport'))
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    expect(() =>
      fireEvent.click(screen.getByTestId('what-changed-chip')),
    ).not.toThrow()
    expect(pulseMock).toHaveBeenCalledTimes(1)
    expect(dispatchMock).toHaveBeenCalledTimes(1)
  })
})
