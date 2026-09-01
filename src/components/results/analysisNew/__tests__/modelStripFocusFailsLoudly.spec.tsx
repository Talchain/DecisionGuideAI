/**
 * The strip's canvas-focus controls cannot fail silently.
 *
 * ⭐ THE DEFECT, IN TWO PLACES. `focusModelTarget` is fail-CLOSED — it returns
 * `false` when the target is no longer on the canvas, and moves nothing. Both
 * of this file's call sites discarded it: activating a mark (`:636`) and the
 * detail's own "Show on canvas" (`:810`). On a model that has moved on since the
 * run, each did nothing, silently.
 *
 * ⚠ REPORTED BY A LANE WORKING ONE FILE OVER, which hit the same class, declined
 * to replicate it, and named it rather than working around it. It is the third
 * instance of one defect: `#1078` fixed `StrengthenTheReasoning`,
 * `OptionsComparison.tsx:159` was built correctly from the start, and this is
 * the remaining pair.
 *
 * ⚠ WHY DRIVING DID NOT CATCH IT. I pressed both of these on the deployed build
 * tonight and both worked — because the targets existed. The failure arm is
 * invisible to any drive that only exercises a live target, which is why it
 * needs a test rather than a witness.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: unknown[] = []
const setHighlightedNodes = vi.fn()
const showToast = vi.fn()

type MockState = { nodes: unknown; setHighlightedNodes: unknown }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, setHighlightedNodes })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => showToast }))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'
import { ModelStrip } from '../sections/ModelStrip'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'

const TID = 'analysis-new-model-strip'

const node = (id: string, type: string, label: string, data: Record<string, unknown> = {}) => ({
  id,
  type,
  data: { label, ...data },
})

const CANVAS = [
  node('g1', 'goal', 'Replace the customer data platform within budget'),
  node('o1', 'option', 'Adopt Segment'),
  node('f1', 'factor', 'Vendor licensing cost', {
    observed_state: { value: 0.7, source: 'cee_inference' },
  }),
]

const mark = (nodeId: string) =>
  screen.getAllByTestId(`${TID}-mark`).find((el) => el.getAttribute('data-node-id') === nodeId)!

const renderOpen = () => {
  const r = render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
  return r
}

beforeEach(() => {
  nodes.length = 0
  nodes.push(...CANVAS)
  showToast.mockClear()
  vi.mocked(focusModelTarget).mockReset()
})
afterEach(() => cleanup())

describe('activating a mark', () => {
  it('says so when the node is no longer on the canvas', () => {
    vi.mocked(focusModelTarget).mockReturnValue(false)
    renderOpen()

    fireEvent.click(mark('f1'))

    expect(focusModelTarget).toHaveBeenCalledWith('f1')
    // The sentence already existed and is imported, never respelled, so this
    // surface cannot drift from the two that already use it.
    expect(showToast).toHaveBeenCalledWith(STRENGTHEN_COPY.focusFailedNotice)
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. Without it the fix could fire the notice
   * unconditionally — turning a silent failure into a lie about a focus that
   * genuinely worked — and the case above would still pass.
   */
  it('says nothing when the focus genuinely worked', () => {
    vi.mocked(focusModelTarget).mockReturnValue(true)
    renderOpen()

    fireEvent.click(mark('f1'))

    expect(focusModelTarget).toHaveBeenCalledTimes(1)
    expect(showToast).not.toHaveBeenCalled()
  })
})

describe("the detail's own Show on canvas", () => {
  /**
   * ⚠ A SECOND CALL SITE, ASSERTED SEPARATELY. One test covering "the strip"
   * would pass with either site fixed, so a single case cannot show that BOTH
   * were repaired — which is the whole content of this change.
   */
  it('says so when the node is gone', () => {
    vi.mocked(focusModelTarget).mockReturnValue(true)
    renderOpen()
    fireEvent.click(mark('f1')) // pins the detail open
    vi.mocked(focusModelTarget).mockReturnValue(false)
    showToast.mockClear()

    fireEvent.click(screen.getByTestId(`${TID}-detail-focus`))

    expect(showToast).toHaveBeenCalledWith(STRENGTHEN_COPY.focusFailedNotice)
  })

  it('says nothing when it worked', () => {
    vi.mocked(focusModelTarget).mockReturnValue(true)
    renderOpen()
    fireEvent.click(mark('f1'))
    showToast.mockClear()

    fireEvent.click(screen.getByTestId(`${TID}-detail-focus`))

    expect(showToast).not.toHaveBeenCalled()
  })
})
