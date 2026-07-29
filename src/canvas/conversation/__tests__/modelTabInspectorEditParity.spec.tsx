/**
 * ROADMAP 2.121 slice 1 — CROSS-SURFACE PARITY: the same field, edited from two
 * surfaces, must reach CEE as the same turn.
 *
 * WHY THIS TEST EXISTS AT ALL. The defect slice 1 fixes was not "the Model tab
 * has a bug". It was "a second surface grew its own write path". #513 closed the
 * store-only-edit class for the inspector; the Model tab kept nine hand-rolled
 * `updateNode` / `updateEdge` handlers and the class stayed live through a
 * different door for eleven weeks. Per-surface tests cannot see that: each one
 * passes against its own surface's private path. Only a test that drives BOTH
 * surfaces over the SAME fixture and compares the emitted wire events can.
 *
 * WHAT IT ACTUALLY PROVES, precisely (claim-type matters — see the programme's
 * evidence-completeness rule): for a factor VALUE commit, the `factor_value_edit`
 * event emitted from the Model-tab card is DEEP-EQUAL to the one emitted from
 * the inspector panel. It does NOT prove parity for baseline / prior / edge /
 * intervention / goal edits — the contract has no value-carrying event for those
 * (`factor_value_edit.field` is the literal `'value'`), so there is no wire event
 * to compare and none is claimed. That gap is design-doc open question 1, not
 * something this file quietly covers.
 *
 * THE MUTANT THIS BITES: give either surface its own scale rule, its own
 * addressing (label instead of id), or its own event type, and the deep-equal
 * fails. That is the recurrence this file is here to stop.
 */

import { describe, it, expect, beforeEach, afterEach, beforeAll, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module — a `vi.mock` factory REPLACES it.
vi.mock('../ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

import { FactorControllablePanel } from '../../ui/inspector-v2/panels/FactorControllablePanel'
import { FactorsSection } from '../../components/model-tab/FactorsSection'
import { useCanvasStore } from '../../store'

const NODE_ID = 'fac_monthly_eng_cost'
const CAP = 30000
const COMMITTED_RAW = 30000
const NEW_RAW = 20000

const noop = () => {}

beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn()
})

/** ONE fixture, used by both surfaces — the point of the test. */
function factorNode(): Node {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Monthly Engineering Cost',
      kind: 'factor',
      category: 'controllable',
      factor_type: 'lever',
      observedState: {
        value: COMMITTED_RAW / CAP,
        raw_value: COMMITTED_RAW,
        cap: CAP,
        unit: '£',
        display_value: '£30k',
        source: 'cee_inference',
      },
    },
  } as unknown as Node
}

function seed() {
  useCanvasStore.setState(
    { nodes: [factorNode()], edges: [], results: { status: 'idle', report: null } } as never,
    false,
  )
}

/** Commit the same magnitude from the inspector panel. */
function commitFromInspector(next: number) {
  render(
    <FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
  )
  const input = screen.getByPlaceholderText('Enter value')
  fireEvent.change(input, { target: { value: String(next) } })
  fireEvent.blur(input)
}

/** Commit the same magnitude from the Model tab's factor card. */
function commitFromModelTab(next: number) {
  render(<FactorsSection factorNodes={[factorNode()]} />)
  fireEvent.click(screen.getByTestId(`factor-${NODE_ID}-raw-value-display`))
  const input = screen.getByTestId(`factor-${NODE_ID}-raw-value`)
  fireEvent.change(input, { target: { value: String(next) } })
  fireEvent.blur(input)
}

function soleEmittedEvent(): unknown {
  expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  return sendSystemEvent.mock.calls[0][0]
}

describe('Model-tab and inspector value edits are the SAME turn (2.121 slice 1)', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    seed()
  })
  afterEach(() => cleanup())

  it('emits a DEEP-EQUAL factor_value_edit event from either surface', () => {
    commitFromInspector(NEW_RAW)
    const fromInspector = soleEmittedEvent()

    cleanup()
    sendSystemEvent.mockClear()
    seed()

    commitFromModelTab(NEW_RAW)
    const fromModelTab = soleEmittedEvent()

    // Same type, same target, same scale contract, same optional fields —
    // byte-for-byte the same object, because both build it with the same
    // emitter from the same node data.
    expect(fromModelTab).toEqual(fromInspector)
  })

  it('leaves the store in the same state from either surface', () => {
    commitFromInspector(NEW_RAW)
    const afterInspector = {
      ...((useCanvasStore.getState().nodes[0].data as Record<string, unknown>)
        .observedState as Record<string, unknown>),
    }

    cleanup()
    seed()

    commitFromModelTab(NEW_RAW)
    const afterModelTab = {
      ...((useCanvasStore.getState().nodes[0].data as Record<string, unknown>)
        .observedState as Record<string, unknown>),
    }

    // The ONE honest difference: the Model-tab card stamps the value as
    // user-sourced (its provenance pill and "N to verify" count key off it) and
    // the inspector does not. Named and compared explicitly rather than papered
    // over — if the inspector later starts stamping too, this line fails and
    // someone re-reads the claim instead of inheriting it.
    expect(afterModelTab.source).toBe('user')
    expect(afterInspector.source).toBe('cee_inference')

    delete afterModelTab.source
    delete afterInspector.source
    expect(afterModelTab).toEqual(afterInspector)
  })

  it('NEGATIVE CONTROL: both surfaces stay silent on a same-value re-commit', () => {
    commitFromInspector(COMMITTED_RAW)
    expect(sendSystemEvent).not.toHaveBeenCalled()

    cleanup()
    seed()

    commitFromModelTab(COMMITTED_RAW)
    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  /**
   * Adversarial review F4 — the two surfaces must speak at the SAME MOMENTS, not
   * merely say the same thing when they do.
   *
   * The inspector's commit guard compares PARSED NUMBERS; the Model tab's
   * `InlineEdit` compared strings. `3e4` is exactly 30000, so re-typing it that
   * way was a no-op in the inspector and a full turn on the Model tab — an
   * emitted change claim over an unchanged number, plus a `source` flip to
   * 'user'. CEE's noop dedup would have absorbed the wire event, which is
   * precisely why this needed a test rather than a backstop: the divergence was
   * invisible downstream.
   */
  it('neither surface speaks when the same number is re-typed in another form (review F4)', () => {
    commitFromInspector(30000)
    expect(sendSystemEvent).not.toHaveBeenCalled()

    cleanup()
    seed()

    // Same magnitude, different lexical form, on the SAME fixture.
    render(<FactorsSection factorNodes={[factorNode()]} />)
    fireEvent.click(screen.getByTestId(`factor-${NODE_ID}-raw-value-display`))
    const input = screen.getByTestId(`factor-${NODE_ID}-raw-value`)
    fireEvent.change(input, { target: { value: '3e4' } })
    fireEvent.blur(input)

    expect(sendSystemEvent).not.toHaveBeenCalled()
  })
})
