/**
 * ⛔⛔ THIS SPEC WAS ITSELF THE DEFECT IT WAS WRITTEN TO CATCH, AND A REVIEWER
 * PROVED IT BY EXECUTION.
 *
 * Its first version asserted only STRING CONSTANTS. github-a4 withdrew the
 * control (`{awaitingStatedStrength ? (` → `{false ? (`) in an isolated worktree
 * — sentinel asserted landed, applied-check exactly 1 — and the whole
 * `inspector-v2` suite stayed **855 passed / 83 files GREEN**. ⇒ It bound COPY
 * TO COPY: the precondition asserted a label EXISTS, and withdrawing a control
 * leaves its label untouched.
 *
 * ⭐ That is the shape this file's own header names — *a guard aimed at the door
 * the change does not use* — committed one level in, by me, in the guard written
 * because ROADMAP 2.1416's guard had the same fault. **Three instances of one
 * shape in one night, the third inside the fix for the second.**
 *
 * SO IT NOW BINDS TO THE RENDERED CONTROL, by identity, THROUGH `InspectorRouter`
 * — never `EdgePanel` directly. That boundary is not incidental: this directory's
 * own `EdgeStrengthReachable.spec.tsx` records that EdgePanel's specs could not
 * see a real defect *"because they render `EdgePanel` directly and never cross
 * the Router boundary"*. Withdraw the control and these RED.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

import { InspectorRouter } from '../InspectorRouter'
import {
  INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON,
  INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON,
} from '../useInspectorMutations'
import { STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE } from '../../../mutations/structuralAddEdge'
import { INLINE_LABELS } from '../inspectorStrings'
import { useCanvasStore } from '../../../store'

vi.mock('@xyflow/react', () => ({ useViewport: () => ({ x: 0, y: 0, zoom: 1 }) }))

const NODES = [
  { id: '2891dabb', type: 'factor', data: { label: 'Marketing' }, position: { x: 0, y: 0 } },
  { id: 'c12af5de', type: 'goal', data: { label: 'Revenue' }, position: { x: 0, y: 0 } },
]

/**
 * EXACTLY what `onConnect` leaves behind once the capture has stood down:
 * `USER_EDGE_DEFAULTS`-shaped weight, NO provenance stamp, and the receipt.
 * The `0.3` is the point — it is the constant `captureStructuralAddEdge` refuses
 * to put on the wire, and the one this UI must refuse to propose.
 */
const DRAWN_LINK = [
  {
    id: 'e1',
    source: '2891dabb',
    target: 'c12af5de',
    data: { weight: 0.3, direction: 'positive', structuralAddStandDown: 'strength_not_stated' },
  },
]

/** A link the server holds: no receipt, and a server-stated strength. */
const SERVER_HELD = [
  {
    id: 'e1',
    source: '2891dabb',
    target: 'c12af5de',
    data: { weight: 0.5, direction: 'positive', serverStrength: { mean: 0.5, effect_direction: 'positive' } },
  },
]

function seed(edges: unknown[]) {
  useCanvasStore.setState({
    nodes: NODES as never[],
    edges: edges as never[],
    results: { status: 'idle' },
    selection: { nodeIds: new Set(), edgeIds: new Set(['e1']), anchorPosition: null },
    goalThreshold: null,
    confirmedNodeIds: new Set(),
    _internal: {},
  } as never)
}

const addControl = () => screen.queryByTestId('edge-state-strength-for-save')
const pressedBands = () =>
  screen.queryAllByRole('button').filter((b) => b.getAttribute('aria-pressed') === 'true')

beforeEach(() => {
  vi.clearAllMocks()
  cleanup()
})

describe('a link the user drew is offered a control to state its strength', () => {
  beforeEach(() => seed(DRAWN_LINK))

  it('⭐ THE CONTROL RENDERS — bound by identity, through the Router that actually mounts it', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(addControl()).not.toBeNull()
  })

  it('⛔ AND IT PROPOSES NO NUMBER — no band is pre-selected on a link nobody has valued', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    // ⛔ FLOOR FIRST. Both this assertion and the contrast below PASSED on an
    // EMPTY DOM when the Router was rendered without its props — `queryAll`
    // returns `[]` and `queryByTestId` returns `null` whether the control is
    // absent or the panel never mounted at all. An empty document satisfies
    // every "nothing is pressed" claim vacuously.
    expect(screen.getAllByRole('button').length, 'panel did not mount at all').toBeGreaterThan(0)
    // `USER_EDGE_DEFAULTS.weight` is 0.3, which lands squarely in a band. If any
    // button comes up pressed, the UI is offering a fabricated strength for the
    // user to accept — and accepting it would stamp `weightSource: 'user'` on a
    // number nobody supplied. That is the wire defect arriving through pixels.
    expect(pressedBands()).toHaveLength(0)
  })

  it('the notice for this population points at THIS surface and does not delegate', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    expect(screen.getByTestId('inspector-authority-notice').textContent).toBe(
      INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON,
    )
  })
})

describe('a link the server holds is unaffected', () => {
  beforeEach(() => seed(SERVER_HELD))

  it('⭐ CONTRAST — no add-control, so the assertions above discriminate rather than always passing', () => {
    render(<InspectorRouter nodeId={null} edgeId="e1" onClose={vi.fn()} />)
    // Same floor: a contrast arm that renders nothing agrees with everything.
    expect(screen.getAllByRole('button').length, 'panel did not mount at all').toBeGreaterThan(0)
    expect(addControl()).toBeNull()
  })
})

describe('the two populations keep two sentences', () => {
  it('the server-held reason correctly still delegates, and they never converge', () => {
    expect(INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON).toMatch(/ask olumi to set/i)
    expect(INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON).not.toMatch(/ask olumi to (set|add)/i)
    expect(INSPECTOR_EDGE_AWAITING_STATED_STRENGTH_REASON).not.toBe(INSPECTOR_EDGE_NO_STRENGTH_BASIS_REASON)
  })

  it('⚠ neither the label nor the toast claims the user cannot act', () => {
    const DENIES = /you can'?t set|cannot be set|not editable|no way to set/i
    expect(INLINE_LABELS.strengthQuestionForSave).not.toMatch(DENIES)
    expect(STRUCTURAL_ADD_EDGE_NEEDS_STRENGTH_NOTICE).not.toMatch(DENIES)
  })

  it('⛔ the label says SENT, never REACHED or SAVED — dispatch is not arrival', () => {
    expect(INLINE_LABELS.strengthQuestionForSave).toMatch(/be sent to the model/i)
    expect(INLINE_LABELS.strengthQuestionForSave).not.toMatch(/reach the model|saved to the model/i)
  })
})
