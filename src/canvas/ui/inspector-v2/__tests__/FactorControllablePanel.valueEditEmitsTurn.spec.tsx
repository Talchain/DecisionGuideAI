/**
 * ROADMAP 1.346 — the inspector value-commit must become a REAL TURN.
 *
 * THE DEFECT THIS PINS (live-probed 2026-07-28, `docs-designs/V7-RENDER-CHECK-2026-07-28.md`
 * addendum): an inspector value edit terminated client-side in `store.ts`'s
 * `updateNode` and emitted ZERO network requests. CEE's `graph_hash` was
 * byte-identical across the edit, so the rerun the UI invited could not
 * possibly reflect it — while the freshness strip said "Model changed —
 * re-run", then affirmed "reflects the current model" over unchanged numbers.
 * Alarm → futile action → false reassurance.
 *
 * WHAT THIS FILE PINS, and why each assertion is load-bearing:
 *
 *   1. The commit EMITS — a `factor_value_edit` system event reaches
 *      `sendSystemEvent`. This is the assertion that was RED before the fix
 *      (nothing was emitted at all).
 *   2. It is ID-ADDRESSED — `target_id` is the node id, never the label. A
 *      label match silently retargets on any duplicate or renamed label.
 *   3. The SCALE CONTRACT holds — `raw_value` carries the USER-UNIT magnitude
 *      the user typed, and `value` carries the MODEL-scale number derived from
 *      the node's OWN `cap` via the canonical `normaliseRawFactorValue`. These
 *      are not interchangeable: the live defect wrote the display magnitude
 *      (300000) into the 0-1 model-scale field, which CEE's validator refuses.
 *      NO HARD-CODED BOUND appears here — the expectation is computed from the
 *      fixture's own cap, so a fixture with a different scale still passes for
 *      the right reason.
 *   4. The NEGATIVE CONTROL — committing the SAME value emits nothing. Without
 *      this, assertion 1 could be satisfied by an emitter that fires on every
 *      blur, which would spam turns and manufacture false "model changed"
 *      claims. (The server's noop dedup is a backstop, not the mechanism.)
 *   5. ONE turn per commit, not per keystroke.
 *
 * Companion wire-level coverage (the same event's payload shape as it is
 * serialised for CEE) lives in `src/v5/__tests__/factorValueEdit.wire.test.ts`.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12 (the hand-maintained mirror): spread the real module rather than
// hand-listing its exports. A `vi.mock` factory REPLACES the module, so a
// hand-listed factory silently drops every export added since it was written.
vi.mock('../../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return {
    ...actual,
    useOptionalConversationContext: () => ({ sendSystemEvent }),
  }
})

import { FactorControllablePanel } from '../panels/FactorControllablePanel'
import { useCanvasStore } from '../../../store'
import { normaliseRawFactorValue } from '../../../utils/observedStateHelpers'

const NODE_ID = 'fac_monthly_eng_cost'
const CAP = 30000
const COMMITTED_RAW = 30000
const NEW_RAW = 20000

const noop = () => {}

function factorNode(): Node {
  return {
    id: NODE_ID,
    type: 'factor',
    position: { x: 0, y: 0 },
    data: {
      label: 'Monthly Engineering Cost',
      kind: 'factor',
      factor_type: 'lever',
      observedState: {
        // The live-defect shape: `value` is MODEL scale (raw/cap), `raw_value`
        // is the user-unit magnitude, `cap` is the factor's own scale.
        value: COMMITTED_RAW / CAP,
        raw_value: COMMITTED_RAW,
        cap: CAP,
        unit: '£',
        display_value: '£30k',
      },
    },
  } as unknown as Node
}

function seed() {
  useCanvasStore.setState(
    { nodes: [factorNode()], edges: [], results: { status: 'idle', report: null } } as any,
    false,
  )
}

function renderPanel() {
  return render(
    <FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
  )
}

function valueInput(): HTMLInputElement {
  return screen.getByPlaceholderText('Enter value') as HTMLInputElement
}

/** Commit = type into the input, then blur (Enter blurs, per the panel's onKeyDown). */
function commit(next: string) {
  const input = valueInput()
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

describe('inspector value-commit emits a factor_value_edit turn (ROADMAP 1.346)', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    seed()
  })
  afterEach(() => cleanup())

  it('emits a factor_value_edit system event on commit — the edit becomes a real turn', () => {
    renderPanel()
    commit(String(NEW_RAW))

    // THE assertion that was RED: before the fix, nothing was emitted at all.
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
    const event = sendSystemEvent.mock.calls[0][0]
    expect(event.type).toBe('factor_value_edit')
  })

  it('is ID-ADDRESSED — target_id is the node id, never the label', () => {
    renderPanel()
    commit(String(NEW_RAW))

    const payload = sendSystemEvent.mock.calls[0][0].payload
    expect(payload.target_id).toBe(NODE_ID)
    // Explicitly refuse the label: a label-addressed mutation retargets
    // silently on any duplicate or renamed label.
    expect(payload.target_id).not.toBe('Monthly Engineering Cost')
  })

  it('carries the scale contract: raw_value = typed magnitude, value = model scale derived from the node cap', () => {
    renderPanel()
    commit(String(NEW_RAW))

    const payload = sendSystemEvent.mock.calls[0][0].payload

    // raw_value is the USER-UNIT magnitude exactly as typed.
    expect(payload.raw_value).toBe(NEW_RAW)
    expect(payload.unit).toBe('£')

    // value is MODEL scale, DERIVED from this fixture's own cap via the
    // canonical helper — never a hard-coded bound. This is the assertion the
    // live defect failed: it shipped the display magnitude in this field.
    expect(payload.value).toBe(normaliseRawFactorValue(NEW_RAW, CAP))
    expect(payload.value).not.toBe(NEW_RAW)
    expect(payload.value).toBeGreaterThan(0)
    expect(payload.value).toBeLessThanOrEqual(1)
  })

  it('NEGATIVE CONTROL: committing the SAME value emits nothing (no spurious change claim)', () => {
    renderPanel()
    // Re-commit the value already on the node. A blur-fires-always emitter
    // would pass every other test in this file and still be wrong.
    commit(String(COMMITTED_RAW))

    expect(sendSystemEvent).not.toHaveBeenCalled()
  })

  it('emits ONE turn per committed edit, not one per keystroke', () => {
    renderPanel()
    const input = valueInput()
    // Three keystrokes, one commit.
    fireEvent.change(input, { target: { value: '2' } })
    fireEvent.change(input, { target: { value: '20' } })
    fireEvent.change(input, { target: { value: String(NEW_RAW) } })
    expect(sendSystemEvent).not.toHaveBeenCalled()

    fireEvent.blur(input)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)

    // A second blur with no further change must not re-emit (the committed
    // value is now the node's value; re-emitting would be a phantom turn).
    fireEvent.blur(input)
    expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  })
})
