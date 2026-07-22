/**
 * WhatChangedChip — F8 (Codex): honesty of the device-local comparison copy,
 * and removal of the no-op click affordance.
 *
 * Two defects at the tip:
 *   1. FALSE DEVICE-LOCAL CLAIM. The visible meta line ("Compared with your
 *      previous run on this device") and the button title render UNCONDITIONALLY
 *      — even when NO local run pair exists (empty / single / missing-snapshot
 *      history), where nothing was compared on this device at all. The copy must
 *      render ONLY when a real local comparison happened (an alignable pair with
 *      a computable, non-empty delta — i.e. localHighlightAvailable).
 *   2. NO-OP CLICK. When neither a local diff (no pulse to fire) NOR a dispatcher
 *      (no CEE send) is available, the button still rendered enabled and
 *      clickable — a dead affordance. It must be disabled in that state.
 *
 * CAUTION pinned here (F2-B must not regress): whenever a dispatcher EXISTS the
 * button stays enabled and the unconditional send keeps firing — regardless of
 * local-diff availability. Only the no-dispatcher-AND-no-diff case is disabled,
 * and only the false-basis copy is gated.
 *
 * RED-first: written against the corrected behaviour, run against the unfixed
 * component (copy present with no pair → fails; button not disabled → fails),
 * GREEN after the gate + disabled land.
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

import { WhatChangedChip } from '../WhatChangedChip'

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

/** A real, non-empty local delta → localHighlightAvailable === true. */
function seedRunsWithDelta() {
  loadRunsMock.mockReturnValue([
    run({ nodes: [node('a', 'A'), node('c', 'C')], edges: [edge('e1', 0.9)] }),
    run({ nodes: [node('a', 'A')], edges: [edge('e1', 0.5)] }),
  ])
}
/** Two identical runs → an alignable pair but a ZERO delta (no highlight). */
function seedIdenticalRuns() {
  const g = { nodes: [node('a', 'A')], edges: [edge('e1', 0.5)] }
  loadRunsMock.mockReturnValue([run(g), run(g)])
}

const DEVICE_COPY = 'Compared with your previous run on this device'

beforeEach(() => {
  loadRunsMock.mockReset()
  pulseMock.mockReset()
  ctxMock.mockReset()
})
afterEach(() => cleanup())

describe('WhatChangedChip — F8: the device-local comparison copy is honest', () => {
  it('does NOT claim a device-local comparison when NO local pair exists (empty history)', () => {
    // A dispatcher is present so the chip is enabled — this isolates the COPY
    // defect from the disabled defect. Nothing was compared on this device, so
    // the "compared … on this device" basis line must not render.
    ctxMock.mockReturnValue({ dispatchAction: vi.fn().mockResolvedValue(undefined) })
    loadRunsMock.mockReturnValue([])

    render(<WhatChangedChip />)

    expect(screen.queryByText(DEVICE_COPY)).toBeNull()
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip.getAttribute('title') ?? '').not.toMatch(/on this device/i)
  })

  it('does NOT claim a device-local comparison for an identical (zero-delta) pair', () => {
    ctxMock.mockReturnValue({ dispatchAction: vi.fn().mockResolvedValue(undefined) })
    seedIdenticalRuns()

    render(<WhatChangedChip />)

    expect(screen.queryByText(DEVICE_COPY)).toBeNull()
  })

  it('DOES show the device-local basis when a real local delta was computed', () => {
    // The honest, true case survives: an alignable pair with a non-empty delta.
    ctxMock.mockReturnValue({ dispatchAction: vi.fn().mockResolvedValue(undefined) })
    seedRunsWithDelta()

    render(<WhatChangedChip />)

    expect(screen.getByText(DEVICE_COPY)).toBeInTheDocument()
    expect(screen.getByTestId('what-changed-chip')).toHaveAttribute(
      'title',
      expect.stringMatching(/on this device/i),
    )
  })
})

describe('WhatChangedChip — F8: no dead no-op affordance', () => {
  it('DISABLES the button when neither a local diff nor a dispatcher is available', () => {
    // No pulse possible AND no CEE send possible → a click does nothing. The
    // control must not present itself as actionable.
    ctxMock.mockReturnValue(null)
    loadRunsMock.mockReturnValue([])

    render(<WhatChangedChip />)

    const chip = screen.getByTestId('what-changed-chip')
    expect(chip).toBeDisabled()
    fireEvent.click(chip)
    expect(pulseMock).not.toHaveBeenCalled()
  })

  it('DISABLES for an identical (zero-delta) pair with no dispatcher', () => {
    ctxMock.mockReturnValue(null)
    seedIdenticalRuns()

    render(<WhatChangedChip />)
    expect(screen.getByTestId('what-changed-chip')).toBeDisabled()
  })

  it('F2-B NOT regressed: with a dispatcher the button stays ENABLED even with no local diff', () => {
    // The server-owned send must keep firing unconditionally when the dispatcher
    // exists — so the button must remain actionable regardless of local diff.
    const dispatchMock = vi.fn().mockResolvedValue(undefined)
    ctxMock.mockReturnValue({ dispatchAction: dispatchMock })
    loadRunsMock.mockReturnValue([])

    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip).toBeEnabled()
    fireEvent.click(chip)
    expect(dispatchMock).toHaveBeenCalledTimes(1)
  })

  it('stays ENABLED with a local diff even when no dispatcher is present (pulse is still useful)', () => {
    ctxMock.mockReturnValue(null)
    seedRunsWithDelta()

    render(<WhatChangedChip />)
    const chip = screen.getByTestId('what-changed-chip')
    expect(chip).toBeEnabled()
    fireEvent.click(chip)
    expect(pulseMock).toHaveBeenCalledTimes(1)
  })
})
