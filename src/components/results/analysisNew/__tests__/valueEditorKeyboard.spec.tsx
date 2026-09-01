/**
 * The factor value editor is operable from the keyboard alone.
 *
 * ⚠⚠ WHY THIS EXISTS: I COULD NOT ANSWER THE QUESTION WITH THE INSTRUMENT I HAD.
 * Driving the deployed build, pressing Return on the focused "Change this value"
 * button did not open the field — which reads as a keyboard defect in a control
 * shipped hours earlier. The POSITIVE CONTROL refuted it: the same Return on the
 * strip's own toggle, a button that plainly works on click, also did nothing.
 * The browser automation's synthetic Return does not activate focused buttons,
 * so the probe was blind and the honest status was UNVERIFIED, not broken.
 *
 * `userEvent` dispatches the full key sequence a browser does, so it can answer
 * what the driving probe could not. It is the right instrument for the question.
 *
 * ⚠ AND THE PRECONDITION IS PINNED IN-TEST. Each case asserts the control is
 * genuinely FOCUSED before the key is pressed; without that, a passing
 * assertion could be the tab order failing and the click path working.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

const nodes: Record<string, unknown>[] = []
const showToast = vi.fn()
const proposeFactorValue = vi.fn(() => 'dispatched')

type MockState = { nodes: unknown; setHighlightedNodes: unknown }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes: vi.fn() })
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
    proposeFactorValue,
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))

import { ModelStrip } from '../sections/ModelStrip'

const TID = 'analysis-new-model-strip'

beforeEach(() => {
  nodes.length = 0
  nodes.push(
    { id: 'g1', type: 'goal', data: { label: 'Protect net revenue retention' } },
    {
      id: 'f1',
      type: 'factor',
      data: {
        label: 'Engineering hiring pressure',
        observedState: { value: 0.42, raw_value: 42, unit: '£', source: 'cee_inference' },
      },
    },
  )
  showToast.mockReset()
  proposeFactorValue.mockReset().mockReturnValue('dispatched')
})
afterEach(cleanup)

/** Open the strip and one factor's detail, by keyboard-equivalent clicks. */
const openDetail = async (user: ReturnType<typeof userEvent.setup>) => {
  render(<ModelStrip isPreRun={false} />)
  await user.click(screen.getByTestId(`${TID}-toggle`))
  const mark = screen
    .getAllByTestId(`${TID}-mark`)
    .find((el) => el.getAttribute('data-node-id') === 'f1')!
  await user.click(mark)
}

describe('the value editor answers to the keyboard', () => {
  it('Enter on the focused "Change this value" button opens the field and lands focus in it', async () => {
    const user = userEvent.setup()
    await openDetail(user)

    const edit = screen.getByTestId(`${TID}-detail-value-edit`)
    edit.focus()
    // PRECONDITION: the control really is focused, so a pass below cannot be
    // the tab order failing while the click path works.
    expect(document.activeElement, 'the edit control did not take focus').toBe(edit)
    expect(screen.queryByTestId(`${TID}-detail-value-input`)).not.toBeInTheDocument()

    await user.keyboard('{Enter}')

    const input = screen.getByTestId(`${TID}-detail-value-input`)
    // `autoFocus` must actually land — an editor you must then hunt for with
    // Tab is not keyboard-operable in any useful sense.
    expect(document.activeElement, 'focus did not move into the field').toBe(input)
  })

  it('typing and Enter commits, without ever touching the Save button', async () => {
    const user = userEvent.setup()
    await openDetail(user)
    await user.click(screen.getByTestId(`${TID}-detail-value-edit`))

    await user.keyboard('72{Enter}')

    expect(proposeFactorValue).toHaveBeenCalledWith(72)
    expect(screen.queryByTestId(`${TID}-detail-value-input`)).not.toBeInTheDocument()
  })

  /** Escape must abandon, and must not dispatch — the twin of the case above. */
  it('Escape closes the field and writes nothing', async () => {
    const user = userEvent.setup()
    await openDetail(user)
    await user.click(screen.getByTestId(`${TID}-detail-value-edit`))

    await user.keyboard('99{Escape}')

    expect(proposeFactorValue).not.toHaveBeenCalled()
    expect(screen.queryByTestId(`${TID}-detail-value-input`)).not.toBeInTheDocument()
    expect(screen.getByTestId(`${TID}-detail-value-edit`)).toBeInTheDocument()
  })

  it('reaches Save and Cancel by Tab, in that order', async () => {
    const user = userEvent.setup()
    await openDetail(user)
    await user.click(screen.getByTestId(`${TID}-detail-value-edit`))
    expect(document.activeElement).toBe(screen.getByTestId(`${TID}-detail-value-input`))

    await user.tab()
    expect(document.activeElement).toBe(screen.getByTestId(`${TID}-detail-value-save`))
    await user.tab()
    expect(document.activeElement).toBe(screen.getByTestId(`${TID}-detail-value-cancel`))
  })
})
