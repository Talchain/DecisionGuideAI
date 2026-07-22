/**
 * WhatChangedChip — F2 CHANGE B follow-up: the CEE send fires on EVERY click,
 * UNCONDITIONALLY (server owns freshness/mode honesty).
 *
 * The catch-22 this fixes: #423 wired the send inside the click handler, but the
 * click handler only exists when the chip renders its button, and the chip only
 * rendered when a LOCAL structural diff was available (both runs carry an
 * alignable graph snapshot AND the delta is non-empty). So in the two live
 * failure states —
 *   • two SAME-graph runs  → zero local delta (parts.length === 0), and
 *   • two runs where a snapshot is missing → non-comparable (!graph),
 * — the chip self-hid, the button never rendered, and clicking fired NOTHING:
 * no wire request AND no pulse. Yet the CEE contract is proven live (a typed
 * what_changed chip_click returns a real compared-mode answer), so the send was
 * unreachable behind the LOCAL-diff availability gate.
 *
 * Ruling (2026-07-22): the SERVER owns freshness/mode honesty (its four-way gate
 * answers compared / insufficient_runs / stale / unconfirmed / incomparable).
 * Therefore:
 *   1. the CEE send fires on every click, unconditionally;
 *   2. the canvas pulse STAYS gated on local-diff availability (it needs an
 *      alignable local pair to highlight anything);
 *   3. the resting accessible name is the ACTION ("What changed?"), never a
 *      disability claim.
 *
 * These specs are RED-first: written to assert the corrected behaviour, run
 * against the unfixed component (where the dispatch never fires because the chip
 * self-hides), then GREEN after the gate is lifted off the send.
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
const run = (graph?: { nodes: Node[]; edges: Edge[] }) => ({
  id: `run-${++runSeq}`,
  ts: 1000 - runSeq,
  ...(graph ? { graph } : {}),
})

/** Two runs whose graphs are IDENTICAL → zero local delta (the live
 * "two same-graph runs" failure). Local highlight unavailable; server can
 * still answer. */
function seedIdenticalRuns() {
  const g = { nodes: [node('a', 'A')], edges: [edge('e1', 0.5)] }
  loadRunsMock.mockReturnValue([run(g), run(g)])
}

/** Two runs where the PREVIOUS one predates graph snapshots → non-comparable
 * locally (the live "two different-graph runs / no alignable snapshot"
 * failure). Local highlight unavailable; server can still answer. */
function seedMissingSnapshot() {
  loadRunsMock.mockReturnValue([
    run({ nodes: [node('a', 'A'), node('b', 'B')], edges: [] }),
    run(), // legacy run, no graph snapshot
  ])
}

/** A real delta (added node + modified edge) → local highlight IS available. */
function seedRunsWithDelta() {
  loadRunsMock.mockReturnValue([
    run({ nodes: [node('a', 'A'), node('c', 'C')], edges: [edge('e1', 0.9)] }),
    run({ nodes: [node('a', 'A')], edges: [edge('e1', 0.5)] }),
  ])
}

const EXPECTED_DISPATCH = {
  action_type: 'what_changed',
  label: WHAT_CHANGED_CHIP_MESSAGE,
  message: 'What changed since the last run?',
  source: 'chip',
}

beforeEach(() => {
  loadRunsMock.mockReset()
  pulseMock.mockReset()
  ctxMock.mockReset()
})
afterEach(() => cleanup())

describe('WhatChangedChip — the CEE send fires on every click, unconditionally', () => {
  it('LOCAL DIFF UNAVAILABLE (identical runs): the chip is still actionable and the send fires — pulse does NOT', () => {
    // RED against the unfixed component: the chip self-hides (parts.length === 0
    // → return null), so getByTestId throws and the dispatch never fires. This
    // is exactly the live catch-22: no wire request, no pulse.
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedIdenticalRuns()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    // The send fired — the server owns the honest answer (compared / stale /
    // incomparable / insufficient_runs), NOT this local gate.
    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(dispatchMock).toHaveBeenCalledWith(EXPECTED_DISPATCH)
    // The pulse stays gated on local-diff availability: nothing alignable to
    // highlight, so it must NOT fire (and must not crash).
    expect(pulseMock).not.toHaveBeenCalled()
  })

  it('LOCAL DIFF UNAVAILABLE (missing snapshot): the chip is still actionable and the send fires — pulse does NOT', () => {
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedMissingSnapshot()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(dispatchMock).toHaveBeenCalledWith(EXPECTED_DISPATCH)
    expect(pulseMock).not.toHaveBeenCalled()
  })

  it('LOCAL DIFF AVAILABLE (real delta): BOTH the send AND the pulse fire', () => {
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    expect(dispatchMock).toHaveBeenCalledTimes(1)
    expect(dispatchMock).toHaveBeenCalledWith(EXPECTED_DISPATCH)
    expect(pulseMock).toHaveBeenCalledTimes(1)
  })

  it('does NOT hand-build a chip_click source in the unavailable state — it passes chip and lets the gate promote', () => {
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedIdenticalRuns()

    render(<WhatChangedChip />)
    fireEvent.click(screen.getByTestId('what-changed-chip'))

    expect(dispatchMock.mock.calls[0][0].source).toBe('chip')
  })
})

describe('WhatChangedChip — resting accessible name is the action, not a disability claim', () => {
  it('names the ACTION "What changed?" when no local highlight is available', () => {
    ctxMock.mockReturnValue({ dispatchAction: vi.fn().mockResolvedValue(undefined) })
    seedIdenticalRuns()

    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    // The accessible name is the action — never "(not available for this run)".
    expect(chip).toHaveAccessibleName('What changed?')
    expect(chip.getAttribute('aria-label') ?? '').not.toMatch(/not available/i)
    expect(chip.textContent).not.toMatch(/not available/i)
  })

  it('does NOT fabricate a local delta count when a snapshot is missing', () => {
    ctxMock.mockReturnValue({ dispatchAction: vi.fn().mockResolvedValue(undefined) })
    seedMissingSnapshot()

    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    // Anti-fabrication contract from #423 survives: no everything-added "+N".
    expect(chip.textContent).not.toMatch(/[+~-]\d/)
    expect(chip.textContent).toMatch(/what changed\?/i)
  })
})

describe('WhatChangedChip — FAIL-SAFE holds in the unavailable state too', () => {
  it('no conversation hook: click does not throw, no dispatch, no pulse', () => {
    ctxMock.mockReturnValue(null)
    seedIdenticalRuns()

    render(<WhatChangedChip />)
    expect(() => fireEvent.click(screen.getByTestId('what-changed-chip'))).not.toThrow()
    expect(pulseMock).not.toHaveBeenCalled()
  })

  it('a rejected send in the unavailable state does not break the chip', () => {
    const dispatchMock = vi.fn().mockRejectedValue(new Error('transport'))
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    seedIdenticalRuns()

    render(<WhatChangedChip />)
    expect(() => fireEvent.click(screen.getByTestId('what-changed-chip'))).not.toThrow()
    expect(dispatchMock).toHaveBeenCalledTimes(1)
  })
})
