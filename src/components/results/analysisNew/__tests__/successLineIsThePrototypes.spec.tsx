/**
 * ⭐ B5 OF THE 25 SEP DESIGN AUDIT — THE REASONING TAB'S SUCCESS LINE IS THE
 * V2 PROTOTYPE'S `successrow` + `goal-form`, AND NOTHING ELSE CHANGED UNDER IT.
 *
 * Prototype (`Olumi_Reasoning_Prototype_V2.html`, `goalHTML()`):
 *   at rest   ◎ "What would success look like?" | "Success: …"   ✎  ✦   (icon-only, ✎ first)
 *   form      "How would you recognise success?"  (•) In words  ( ) A target
 *             "Your success criterion" [textarea]   |   a LABELLED number field + unit + help line
 *             Not sure yet                                   Send to Olumi ➤
 *
 * Live before this change (audit B5): "Target 20,000 GBP MRR · From brief · ✦ · ✎ Change";
 * the form replaced the row, had no question label, an unlabelled number box,
 * Save / Cancel / Not sure yet.
 *
 * ⚠⚠ THE WRITE PATH IS NOT PART OF THIS CHANGE, AND TWO CASES PIN THAT. The
 * number arm still commits through `proposeGoalTarget` with the exact
 * arguments it always sent, and with no dispatcher mounted it still writes
 * locally — where its button says "Save", never "Send to Olumi", because
 * nothing is sent (`COPY.successTarget.changedLocally`).
 *
 * ⚠ SCOPED TO THE REASONING TAB. `SuccessTargetLine` is also the Inspector's
 * goal control (`GoalPanel.tsx`); the last block pins that its default mount
 * still renders the old row, so this change does not cross surfaces.
 *
 * Bound by identity: testids, exact accessible names, exact copy constants.
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
  edges: unknown
  setHighlightedNodes: unknown
  setGoalThresholdAndUpdateNode: unknown
  goalThreshold: number | null
  goalThresholdRepresentation: string | null
  currentScenarioId: string | null
}
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({
    nodes,
    edges: [],
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
import { SuccessTargetLine } from '../sections/SuccessTargetLine'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import { VALUE_PROVENANCE_LABEL } from '../../../../canvas/domain/valueProvenance'

const TID = 'analysis-new-model-strip'
const T = `${TID}-target`

const goal = (data: Record<string, unknown> = {}) => ({
  id: 'g1',
  type: 'goal',
  data: { label: 'Protect net revenue retention', ...data },
})
const REST = [
  { id: 'o1', type: 'option', data: { label: 'A full switch at renewal' } },
  { id: 'f1', type: 'factor', data: { label: 'Competitive pressure' } },
]
const seed = (goalData: Record<string, unknown>) => {
  nodes.length = 0
  nodes.push(goal(goalData), ...REST)
}
const UNSET_WITH_UNIT = { goal_threshold_unit: '%' }
const SET = { goal_threshold_raw: 110, goal_threshold_unit: '%' }

const PROTOTYPE_EDIT_NAME = 'Describe success in words or set an optional target'
const PROTOTYPE_ASK_NAME = 'Ask Olumi to help define success'

const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  showToast.mockReset()
  setGoalThresholdAndUpdateNode.mockReset()
  proposeGoalTarget.mockReset().mockReturnValue('dispatched')
  captureScenarioId.mockClear().mockReturnValue('scenario-7')
  goalTargetDispatchAvailable = true
})
afterEach(cleanup)

describe('at rest — the prototype row', () => {
  it('UNSET: the row is the question, then ✎ then ✦, both icon-only, with the prototype names', () => {
    seed(UNSET_WITH_UNIT)
    render(<ModelStrip isPreRun={false} />)
    expect(screen.getByTestId(`${T}-none`).textContent).toBe('What would success look like?')
    const edit = screen.getByTestId(`${T}-edit`)
    const ask = screen.getByTestId(`${T}-ask`)
    expect(edit).toHaveAccessibleName(PROTOTYPE_EDIT_NAME)
    expect(ask).toHaveAccessibleName(PROTOTYPE_ASK_NAME)
    expect(before(edit, ask), 'prototype order: ✎ then ✦').toBe(true)
    expect((edit.textContent ?? '').trim(), 'icon-only ✎').toBe('')
    expect((ask.textContent ?? '').trim(), 'icon-only ✦').toBe('')
  })

  it('SET: "Success: …" — no "Target" label, no provenance word, no "Change" text', () => {
    seed(SET)
    render(<ModelStrip isPreRun={false} />)
    const value = screen.getByTestId(`${T}-value`).textContent ?? ''
    // CONTRAST: a value really rendered, so the absences below are not vacuous.
    expect(value.length).toBeGreaterThan(0)
    expect(screen.getByTestId(`${T}-text`).textContent).toBe(`Success: ${value}`)
    const row = screen.getByTestId(T)
    expect(row.textContent).not.toMatch(/\bTarget\b/)
    expect(row.textContent).not.toContain(VALUE_PROVENANCE_LABEL.brief)
    expect(row.textContent).not.toContain(VALUE_PROVENANCE_LABEL.human)
    expect(screen.queryByTestId(`${T}-source`)).toBeNull()
    const edit = screen.getByTestId(`${T}-edit`)
    expect((edit.textContent ?? '').trim(), 'no "Change" text').toBe('')
    expect(edit).toHaveAccessibleName(PROTOTYPE_EDIT_NAME)
    expect(before(edit, screen.getByTestId(`${T}-ask`))).toBe(true)
  })

  it('⚠ DEFERRED, PINNED: the number and unit text are exactly what the old row printed', () => {
    seed(SET)
    render(<ModelStrip isPreRun={false} />)
    const reasoning = screen.getByTestId(`${T}-value`).textContent
    cleanup()
    render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={vi.fn()} testId="inspector" />)
    expect(reasoning).toBe(screen.getByTestId('inspector-value').textContent)
  })
})

describe('the form — the prototype goal-form, under the row rather than in place of it', () => {
  it('opens under the row: the question label, In words first, a labelled textarea, Not sure yet and Send to Olumi — no Cancel, no Save', () => {
    seed(UNSET_WITH_UNIT)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${T}-edit`))
    // The row stays, as the prototype's does.
    expect(screen.getByTestId(`${T}-none`).textContent).toBe('What would success look like?')
    const form = screen.getByTestId(`${T}-editor`)
    expect(before(screen.getByTestId(`${T}-row`), form), 'the form sits under the row').toBe(true)
    expect(screen.getByTestId(`${T}-form-label`).textContent).toBe('How would you recognise success?')
    expect(screen.getByRole('radiogroup')).toHaveAccessibleName('How would you recognise success?')
    expect(screen.getByLabelText('In words')).toBeChecked()
    expect(screen.getByLabelText('A target')).not.toBeChecked()
    expect(screen.getByLabelText('Your success criterion')).toBe(screen.getByTestId(`${T}-words-input`))
    expect(screen.getByTestId(`${T}-defer`).textContent).toBe('Not sure yet')
    /*
     * ⚠ PRODUCT DECISION, PINNED: the words arm keeps today's name. It opens
     * the Olumi drawer with an EDITABLE draft (`openAskOlumi`) and sends
     * nothing, so the prototype's "Send to Olumi" would claim a send that does
     * not happen. The prototype's send LAYOUT is kept; the word is not.
     */
    const wordsSend = screen.getByTestId(`${T}-words-send`)
    expect(wordsSend).toHaveAccessibleName('Discuss with Olumi')
    expect(wordsSend.className.split(' '), 'the prototype’s round send control').toContain('rounded-full')
    expect(screen.queryByTestId(`${T}-cancel`)).toBeNull()
    expect(form.textContent).not.toMatch(/\bCancel\b/)
    expect(form.textContent).not.toMatch(/\bSave\b/)
  })

  it('A target: a LABELLED number field carrying the goal’s own unit, and a help line', () => {
    seed(UNSET_WITH_UNIT)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${T}-edit`))
    fireEvent.click(screen.getByLabelText('A target'))
    expect(screen.getByLabelText('Your target (%)')).toBe(screen.getByTestId(`${T}-input`))
    expect(screen.getByTestId(`${T}-help`).textContent).toBe(COPY.successTarget.helpDispatch)
    // With a dispatcher mounted the number arm DOES send (`proposeGoalTarget`
    // → `add_constraint`), so the prototype's word is true here.
    const send = screen.getByTestId(`${T}-save`)
    expect(send).toHaveAccessibleName('Send to Olumi')
    expect(send.className.split(' ')).toContain('rounded-full')
  })

  it('⛔ WRITE PATH UNCHANGED: Send to Olumi dispatches exactly what Save dispatched', () => {
    seed(UNSET_WITH_UNIT)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${T}-edit`))
    fireEvent.click(screen.getByLabelText('A target'))
    fireEvent.change(screen.getByTestId(`${T}-input`), { target: { value: '125' } })
    fireEvent.click(screen.getByTestId(`${T}-save`))
    expect(proposeGoalTarget).toHaveBeenCalledWith('125', '%', 'scenario-7', 'at_least', {
      onSendSettled: undefined,
    })
    expect(setGoalThresholdAndUpdateNode).not.toHaveBeenCalled()
    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.dispatched)
  })

  it('⛔ HONESTY CONTRAST: with no dispatcher nothing is sent, so the button says "Save", not "Send to Olumi"', () => {
    goalTargetDispatchAvailable = false
    seed(UNSET_WITH_UNIT)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${T}-edit`))
    fireEvent.click(screen.getByLabelText('A target'))
    const save = screen.getByTestId(`${T}-save`)
    expect(save).toHaveAccessibleName(COPY.modelStrip.saveValue)
    expect(screen.getByTestId(`${T}-help`).textContent).toBe(COPY.successTarget.helpLocalOnly)
    fireEvent.change(screen.getByTestId(`${T}-input`), { target: { value: '125' } })
    fireEvent.click(save)
    expect(proposeGoalTarget).not.toHaveBeenCalled()
    expect(setGoalThresholdAndUpdateNode).toHaveBeenCalledWith('g1', 125, { unit: '%' })
    expect(showToast).toHaveBeenCalledWith(COPY.successTarget.changedLocally)
  })

  it('a goal with no declared unit gets a VISIBLY labelled unit field beside the number', () => {
    seed({})
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${T}-edit`))
    fireEvent.click(screen.getByLabelText('A target'))
    expect(screen.getByLabelText('Your target')).toBe(screen.getByTestId(`${T}-input`))
    expect(screen.getByLabelText('Unit')).toBe(screen.getByTestId(`${T}-unit`))
  })

  it('SET: the form opens on "A target", seeded with the stated figure', () => {
    seed(SET)
    render(<ModelStrip isPreRun={false} />)
    fireEvent.click(screen.getByTestId(`${T}-edit`))
    expect(screen.getByLabelText('A target')).toBeChecked()
    expect((screen.getByTestId(`${T}-input`) as HTMLInputElement).value).toBe('110')
  })

  it('the pencil closes what it opened, and so does Escape — the prototype has no Cancel', () => {
    seed(UNSET_WITH_UNIT)
    render(<ModelStrip isPreRun={false} />)
    const edit = screen.getByTestId(`${T}-edit`)
    fireEvent.click(edit)
    expect(edit).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(edit)
    expect(screen.queryByTestId(`${T}-editor`)).toBeNull()
    expect(edit).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(edit)
    fireEvent.keyDown(screen.getByTestId(`${T}-words-input`), { key: 'Escape' })
    expect(screen.queryByTestId(`${T}-editor`)).toBeNull()
  })
})

describe('⛔ CONTRAST — the Inspector’s goal control is a different surface and is unchanged', () => {
  it('its default mount still reads "Target · value · provenance · ✦ ✎ Change"', () => {
    seed(SET)
    render(<SuccessTargetLine goalNodeId="g1" onCommitOutcome={vi.fn()} testId="inspector" />)
    const row = screen.getByTestId('inspector')
    expect(row.textContent).toContain(COPY.successTarget.label)
    expect(screen.getByTestId('inspector-source').textContent).toBe(VALUE_PROVENANCE_LABEL.brief)
    expect(screen.getByTestId('inspector-edit')).toHaveTextContent(COPY.successTarget.change)
    expect(before(screen.getByTestId('inspector-ask'), screen.getByTestId('inspector-edit'))).toBe(true)
  })
})
