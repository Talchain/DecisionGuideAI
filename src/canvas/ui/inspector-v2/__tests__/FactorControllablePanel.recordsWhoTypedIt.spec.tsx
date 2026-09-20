/**
 * The inspector must RECORD WHO TYPED THE NUMBER — ROADMAP 2.304, second caller.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DEFECT THIS PINS — measured on deployed `fd992149`
 * ─────────────────────────────────────────────────────────────────────────────
 * Guest, `build-vs-buy`, a factor value typed by hand and committed. The number
 * landed and survived a reload. Its authorship did not:
 *
 *     observedState.source : 'cee_inference'    ← a person typed it
 *     provenance           : 'ai_inferred'
 *
 * The mechanism is one absent argument. `captureOptimisticFactorEdit` takes the
 * receipt-gated provenance stamp as its 4th parameter;
 * `confirmOptimisticFactorEdit` opens `if (!edit.reviewedStamp) return 'no_stamp'`.
 * `CalibrateDrillIn` was the ONLY caller in the tree passing one, so this panel
 * earned an applied receipt and then claimed nothing with it. The panel's own
 * comment six lines above the call had already named the shape of this:
 * *"Fixing one twin and leaving the other armed is how this class keeps coming
 * back."* It was written about the undo and was equally true of the stamp.
 *
 * ⚠ WHY IT IS NOT COSMETIC. `isReviewedByUser` feeds the reviewed-factor
 * counters, and `material_parameters_user_stated` gates `permitted_analysis_mode`
 * upstream. A user could set a value, have the model record it as Olumi's, and
 * still be told no option can be named the leader because they had stated
 * nothing.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * THE DISCRIMINATING PAIR — both halves are load-bearing
 * ─────────────────────────────────────────────────────────────────────────────
 * Tests 1-3 are RED before the fix: no stamp travels, the receipt writes nothing,
 * the badge stays false.
 *
 * Test 4 is GREEN before AND after, deliberately, and it is the guard that stops
 * the obvious wrong fix. 2.304's ruling is that the authorship claim is
 * RECEIPT-GATED — it may never be written optimistically into
 * `setObservedValue`. So immediately after the commit and BEFORE any receipt,
 * `isReviewedByUser` must still be FALSE. A "fix" that passed the stamp to the
 * setter would satisfy tests 1-3 and RED this one. Neither half proves the
 * binding alone; the pair does.
 *
 * Companion: `canvas/domain/__tests__/valueProvenance.stamps.spec.ts` derives
 * that the stamp's literal is a member of every set that reads it.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { render, cleanup, fireEvent, screen } from '@testing-library/react'
import type { Node } from '@xyflow/react'

const sendSystemEvent = vi.fn()

// Trap 12: spread the real module. A `vi.mock` factory REPLACES it, so a
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
import { USER_VALUE_STAMP } from '../../../domain/valueProvenance'
import { confirmOptimisticFactorEdit } from '../../../conversation/optimisticFactorEdit'
import type { OptimisticFactorEdit } from '../../../conversation/optimisticFactorEdit'
import { isReviewedByUser } from '../../../components/pre-analysis/utils/isReviewedByUser'

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
        value: COMMITTED_RAW / CAP,
        raw_value: COMMITTED_RAW,
        cap: CAP,
        unit: '£',
        display_value: '£30k',
        // The PRODUCER's stamp, which is what the live board carried and what
        // the user's edit has to displace.
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

function renderPanel() {
  return render(
    <FactorControllablePanel nodeId={NODE_ID} techMode={false} onClose={noop} onNavigate={noop} />,
  )
}

/** Commit = type into the input, then blur (Enter blurs, per the panel's onKeyDown). */
function commit(next: string) {
  const input = screen.getByPlaceholderText('Enter value') as HTMLInputElement
  fireEvent.change(input, { target: { value: next } })
  fireEvent.blur(input)
}

/** The undo snapshot the panel handed to the dispatcher, by identity. */
function dispatchedUndo(): OptimisticFactorEdit {
  expect(sendSystemEvent).toHaveBeenCalledTimes(1)
  const opts = sendSystemEvent.mock.calls[0][1] as
    | { optimisticFactorEdit?: OptimisticFactorEdit }
    | undefined
  expect(opts?.optimisticFactorEdit).toBeTruthy()
  const undo = opts!.optimisticFactorEdit!
  // PIN THE PRECONDITION IN-TEST (trap 13b): assert this snapshot addresses the
  // node under test, so a later assertion cannot pass on someone else's edit.
  expect(undo.nodeId).toBe(NODE_ID)
  return undo
}

function currentNode(): Node {
  const n = useCanvasStore.getState().nodes.find((x) => x.id === NODE_ID)
  expect(n).toBeTruthy()
  return n as Node
}

describe('an inspector value edit records who typed it (ROADMAP 2.304, second caller)', () => {
  beforeEach(() => {
    sendSystemEvent.mockClear()
    seed()
  })
  afterEach(() => cleanup())

  it('1 — the undo snapshot carries the receipt-gated authorship stamp', () => {
    renderPanel()
    commit(String(NEW_RAW))
    // RED before the fix: `reviewedStamp` was absent, so the receipt had
    // nothing to write.
    expect(dispatchedUndo().reviewedStamp).toEqual(USER_VALUE_STAMP)
  })

  it('2 — an applied receipt WRITES the stamp, rather than returning no_stamp', () => {
    renderPanel()
    commit(String(NEW_RAW))
    // RED before the fix: this returned 'no_stamp'.
    expect(confirmOptimisticFactorEdit(dispatchedUndo())).toBe('stamped')
  })

  it('3 — after the receipt the value reads as the USER’s, not the producer’s', () => {
    renderPanel()
    // Precondition, asserted rather than assumed: the seeded node is the
    // producer's, so a later `true` cannot be inherited from the fixture.
    expect(isReviewedByUser(currentNode())).toBe(false)

    commit(String(NEW_RAW))
    confirmOptimisticFactorEdit(dispatchedUndo())

    // RED before the fix: still false, and `source` still read 'cee_inference'.
    expect(isReviewedByUser(currentNode())).toBe(true)
    const obs = (currentNode().data as { observed_state?: { source?: string } }).observed_state
    expect(obs?.source).toBe(USER_VALUE_STAMP.source)
  })

  it('4 — 2.304 GUARD: before the receipt the claim is NOT made (green at both heads, by design)', () => {
    renderPanel()
    commit(String(NEW_RAW))

    // The number has moved locally...
    const obs = (currentNode().data as { observedState?: { value?: number } }).observedState
    expect(obs?.value).toBeCloseTo(NEW_RAW / CAP, 10)

    // ...and the CLAIM has not. A fix that passed the stamp into
    // `setObservedValue` would make this RED, which is the whole point of it.
    expect(isReviewedByUser(currentNode())).toBe(false)
  })
})
