/**
 * ⭐⭐⭐ THE UNIT BELONGS TO THE GOAL. THE PANEL WAS READING IT OFF THE TARGET.
 *
 * ⚠⚠ THE DEFECT, DERIVED AT THE BYTES. `SuccessTargetLine` resolved the unit
 * the dispatch requires with `const unit = fromNode?.unit ?? ''`, where
 * `fromNode = resolveGoalTarget(goalData)`. That resolver answers *"what
 * TARGET is set?"* and returns `null` when none is — **even when the node
 * carries a perfectly good `goal_threshold_unit`** (`goalTarget.ts`: it reads
 * the unit, then returns `null` unless a raw value survives).
 *
 * So on the one journey this control exists for — a reader with NO target
 * clicking "Set a target" — the unit read `''` and the panel refused with
 * *"This goal has no unit yet"* about a goal that HAS one. The file's own
 * docblock called it "THE UNIT THE DISPATCH REQUIRES, FROM THE ONE RESOLVER
 * THIS FILE ALREADY READS" — one resolver, two questions (CLAUDE.md trap 21),
 * and the borrowed one cannot answer this one.
 *
 * ⭐ AND THE SECOND HALF, WHICH IS WHY THE REFUSAL WAS UNACTIONABLE. Where the
 * goal genuinely carries no unit, the sentence told the reader to *"Add a unit
 * to the goal first"* and named no place. The only unit writer in the product
 * is the Model tab's goal-target editor, whose `Unit` field mounts only once
 * that row's editor is open (`ModelRowView.tsx`, `row.kind === 'goal' &&
 * commit?.phase === 'editing'`) — so the instruction was true and unfollowable
 * from here. This control already dispatches `proposeGoalTarget(raw, unit, …)`;
 * it was passing `''`. It now COLLECTS the unit it has to send.
 *
 * ⛔ THE FIELD IS OFFERED ONLY WHERE THE GOAL DECLARES NO UNIT. A second unit
 * control beside a CEE-supplied one would let this surface silently contradict
 * the producer, which is a different and worse defect than the refusal.
 *
 * ⚠ BOUND BY IDENTITY, never by a value predicate: every arm names
 * `proposeGoalTarget`'s exact arguments or a named copy constant.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: unknown[] = []
const showToast = vi.fn()
const setGoalThresholdAndUpdateNode = vi.fn()
const proposeGoalTarget = vi.fn()
const captureScenarioId = vi.fn(() => 'scenario-7' as string | null)
let goalTargetDispatchAvailable = true

type MockState = {
  nodes: unknown
  setHighlightedNodes: unknown
  setGoalThresholdAndUpdateNode: unknown
  goalThreshold: number | null
  goalThresholdRepresentation: string | null
  currentScenarioId: string | null
}
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({
    nodes,
    setHighlightedNodes: vi.fn(),
    setGoalThresholdAndUpdateNode,
    goalThreshold: null,
    goalThresholdRepresentation: null,
    currentScenarioId: 'scenario-7',
  })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => showToast }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable,
    captureScenarioId,
    proposeGoalTarget,
    proposeFactorValue: vi.fn(() => 'dispatched'),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

import { ModelStrip } from '../sections/ModelStrip'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

const TID = 'analysis-new-model-strip'
const TARGET = `${TID}-target`

/** A goal that DECLARES A UNIT and has NO TARGET — the journey "Set a target" exists for. */
const UNIT_NO_TARGET = [
  { id: 'g1', type: 'goal', data: { label: 'Protect net revenue retention', goal_threshold_unit: '%' } },
  { id: 'o1', type: 'option', data: { label: 'A full switch at renewal' } },
]

/** A goal that declares NO unit and has no target. */
const NO_UNIT_NO_TARGET = [
  { id: 'g1', type: 'goal', data: { label: 'Protect net revenue retention' } },
  { id: 'o1', type: 'option', data: { label: 'A full switch at renewal' } },
]

/** A goal that already carries BOTH — the arm that must NOT gain a second unit control. */
const UNIT_AND_TARGET = [
  {
    id: 'g1',
    type: 'goal',
    data: { label: 'Protect net revenue retention', goal_threshold_raw: 110, goal_threshold_unit: '%' },
  },
  { id: 'o1', type: 'option', data: { label: 'A full switch at renewal' } },
]

/**
 * ⚠ 26 Sep (design audit B5): on the Reasoning tab the form opens as the V2
 * prototype's does — "In words" first when no target is stated — so the number
 * arm this file drives is one radio away. Choosing it is the reader's own
 * gesture; nothing below changes what that arm dispatches.
 */
const openEditor = () => {
  render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TARGET}-edit`))
  fireEvent.click(screen.getByTestId(`${TARGET}-mode-number`))
}

beforeEach(() => {
  nodes.length = 0
  showToast.mockReset()
  setGoalThresholdAndUpdateNode.mockReset()
  captureScenarioId.mockClear().mockReturnValue('scenario-7')
  proposeGoalTarget.mockReset().mockReturnValue('dispatched')
  goalTargetDispatchAvailable = true
})
afterEach(cleanup)

describe('the unit is read from the goal, not from a target that does not exist', () => {
  /**
   * ⭐⭐ THE LOAD-BEARING CASE, AND THE ONE PAUL DROVE. At the defect this FAILS
   * because `proposeGoalTarget` is never called: `resolveGoalTarget` returned
   * `null` for want of a target, the borrowed unit read `''`, and the control
   * refused with `noUnit`.
   */
  it('dispatches the goal\'s declared unit when no target is set yet', () => {
    nodes.push(...UNIT_NO_TARGET)
    openEditor()
    fireEvent.change(screen.getByTestId(`${TARGET}-input`), { target: { value: '125' } })
    fireEvent.click(screen.getByTestId(`${TARGET}-save`))
    // A fifth argument (`{ onSendSettled }`) now always rides along — see
    // `successTargetDispatches.spec.tsx`'s note on the same change.
    expect(proposeGoalTarget).toHaveBeenCalledWith('125', '%', 'scenario-7', 'at_least', {
      onSendSettled: undefined,
    })
    expect(showToast).not.toHaveBeenCalledWith(COPY.successTarget.noUnit)
  })

  /**
   * ⛔ THE NEGATIVE TWIN, and it is what stops the fix being "always send
   * something". A goal declaring no unit must still not reach the authority
   * with an empty one — `buildManualGoalTarget` refuses it, so a send would be
   * reported and nothing recorded.
   */
  it('still refuses, by name, when neither the goal nor the reader supplies a unit', () => {
    nodes.push(...NO_UNIT_NO_TARGET)
    openEditor()
    fireEvent.change(screen.getByTestId(`${TARGET}-input`), { target: { value: '125' } })
    fireEvent.click(screen.getByTestId(`${TARGET}-save`))
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.noUnit)
  })
})

describe('where the goal declares no unit, the control collects one', () => {
  it('offers a unit field, and sends what the reader typed', () => {
    nodes.push(...NO_UNIT_NO_TARGET)
    openEditor()
    fireEvent.change(screen.getByTestId(`${TARGET}-unit`), { target: { value: '£' } })
    fireEvent.change(screen.getByTestId(`${TARGET}-input`), { target: { value: '125' } })
    fireEvent.click(screen.getByTestId(`${TARGET}-save`))
    expect(proposeGoalTarget).toHaveBeenCalledWith('125', '£', 'scenario-7', 'at_least', {
      onSendSettled: undefined,
    })
  })

  /**
   * ⛔ NO SECOND WRITER OVER THE PRODUCER'S OWN UNIT. Where the goal declares
   * one, this surface must not offer a field that could contradict it.
   */
  it('offers NO unit field where the goal already declares one', () => {
    nodes.push(...UNIT_AND_TARGET)
    openEditor()
    expect(screen.queryByTestId(`${TARGET}-unit`)).not.toBeInTheDocument()
  })

  it('offers no unit field where the goal declares one and no target is set', () => {
    nodes.push(...UNIT_NO_TARGET)
    openEditor()
    expect(screen.queryByTestId(`${TARGET}-unit`)).not.toBeInTheDocument()
  })

  /**
   * ⚠ THE LOCAL ARM KEEPS IT TOO. With no dispatcher mounted the store write is
   * all there is, and it already accepts `{ unit }` — it was being called
   * without one, so a reader's unit was discarded on exactly the path where
   * nothing else could recover it.
   */
  it('carries the collected unit into the local write when no dispatcher is mounted', () => {
    goalTargetDispatchAvailable = false
    nodes.push(...NO_UNIT_NO_TARGET)
    openEditor()
    fireEvent.change(screen.getByTestId(`${TARGET}-unit`), { target: { value: 'points' } })
    fireEvent.change(screen.getByTestId(`${TARGET}-input`), { target: { value: '9' } })
    fireEvent.click(screen.getByTestId(`${TARGET}-save`))
    expect(setGoalThresholdAndUpdateNode).toHaveBeenCalledWith('g1', 9, { unit: 'points' })
  })
})

describe('the refusal names something the reader can do from here', () => {
  /**
   * ⚠ A COPY ASSERTION WITH A REASON. The old sentence sent the reader to "the
   * goal" for a field that exists only inside another tab's row editor. It must
   * now name the field that is on screen — and the ONLY way to keep this honest
   * is to bind it to the label the control actually renders.
   */
  it('names the on-screen unit field rather than a place the reader cannot reach', () => {
    /**
     * ⛔ BOUND TO THE PLACEHOLDER, NOT TO A WORD. My first rewrite said "the
     * Unit box", borrowing the Model tab's VISIBLE label for a field that
     * carries none here — the same defect one level down. The examples the
     * sentence quotes must be the ones the empty box is showing, so the
     * assertion reads the placeholder the control actually renders.
     */
    expect(COPY.successTarget.noUnit).toContain(COPY.successTarget.unitPlaceholder)
    expect(COPY.successTarget.noUnit).not.toContain('to the goal first')
    expect(COPY.successTarget.noUnit).not.toContain('Unit box')
  })

  it('⛔ CONTRAST: the placeholder the refusal quotes is the one the box renders', () => {
    nodes.push(...NO_UNIT_NO_TARGET)
    openEditor()
    expect(screen.getByTestId(`${TARGET}-unit`)).toHaveAttribute(
      'placeholder',
      COPY.successTarget.unitPlaceholder,
    )
  })
})
