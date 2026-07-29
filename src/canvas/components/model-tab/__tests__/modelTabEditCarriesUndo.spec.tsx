/**
 * ROADMAP 2.129 (b), panel half — the Model-tab commit must HAND THE DISPATCHER
 * THE UNDO, captured from the state as it was BEFORE the optimistic write.
 *
 * The revert itself lives in the dispatcher (a refusal resolves, so no `.catch`
 * at this layer can see it, and a DEFERRED edit's promise resolves before the
 * reply exists — see conversation/__tests__/optimisticFactorEditRevert.spec.ts).
 * What only a panel spec can prove is the half the dispatcher cannot: that the
 * snapshot handed over is the PRE-EDIT state. A snapshot taken one line later
 * would be the optimistic value itself, and every revert built on it would
 * "restore" the number CEE refused — a fix that passes its own tests and changes
 * nothing on screen.
 *
 * Kept OUT of the #522 parity suite deliberately: that suite pins slice 1 and
 * stays untouched.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module — a `vi.mock` factory REPLACES it.
vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent }) }
})

import { FactorsSection } from '../FactorsSection'
import { useCanvasStore } from '../../../store'

const FACTOR_ID = 'fac_delivery_time'
const CAP = 6

beforeAll(() => { Element.prototype.scrollIntoView = vi.fn() })

function factorNode(): Node {
  return {
    id: FACTOR_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Estimated Delivery Time',
      kind: 'factor',
      category: 'controllable',
      display_value: '3 months',
      observedState: {
        value: 3 / CAP,
        raw_value: 3,
        cap: CAP,
        unit: 'months',
        source: 'cee_inference',
      },
    },
  } as unknown as Node
}

function commitInline(testId: string, next: string) {
  fireEvent.click(screen.getByTestId(`${testId}-display`))
  const input = screen.getByTestId(testId)
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

describe('a Model-tab value commit carries its own undo', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    useCanvasStore.setState({ nodes: [factorNode()], edges: [], results: { status: 'idle', report: null } } as never, false)
  })
  afterEach(() => cleanup())

  it('passes the PRE-EDIT observed state and display prose to the dispatcher', () => {
    render(<FactorsSection factorNodes={[factorNode()]} />)
    commitInline(`factor-${FACTOR_ID}-raw-value`, '25')

    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const [, opts] = sendSystemEvent.mock.calls[0]
    const undo = (opts as { optimisticFactorEdit?: Record<string, unknown> })?.optimisticFactorEdit

    // RED before the fix: no second argument at all — the send was fire-and-
    // forget with nothing to undo it.
    expect(undo, 'the commit must hand over an undo').toBeTruthy()
    expect(undo!.nodeId).toBe(FACTOR_ID)
    // The number whose fate the reply decides — model scale, as sent.
    expect(undo!.sentValue).toBe(25 / CAP)
    // ...and the state to restore is the one from BEFORE the write.
    const prev = undo!.prevObservedState as Record<string, unknown>
    expect(prev.raw_value).toBe(3)
    expect(prev.value).toBe(3 / CAP)
    expect(prev.source).toBe('cee_inference')
    expect(undo!.prevDisplayValue).toBe('3 months')

    // Control: the optimistic write DID land — the undo is not a substitute for
    // the responsive local update, it is its safety net.
    const obs = (useCanvasStore.getState().nodes[0].data as Record<string, unknown>)
      .observedState as Record<string, unknown>
    expect(obs.raw_value).toBe(25)
    expect(obs.source).toBe('user')
  })
})
