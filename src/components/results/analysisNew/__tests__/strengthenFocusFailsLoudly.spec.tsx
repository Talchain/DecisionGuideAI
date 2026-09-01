/**
 * "Show on canvas" says so when it cannot.
 *
 * ⭐⭐ THE DEFECT. `focusModelTarget` is fail-CLOSED — it returns `false` when the
 * target is no longer on the canvas, and moves nothing. This surface discarded
 * that return, so on a model that has moved on since the finding was raised the
 * button did nothing, said nothing, and changed nothing: indistinguishable from
 * a broken build, and the estate's signature defect.
 *
 * ⚠ WHY IT SURVIVED A LIVE DRIVE. I pressed this button on the deployed build
 * earlier tonight and it worked — because the target existed. The failure arm is
 * invisible to any test, and any drive, that only exercises a live target. That
 * is exactly the class this spec exists to pin.
 *
 * ⚠ IT WAS FOUND BY THE LANE BUILDING THE SIBLING SECTION, which declined to
 * replicate the pattern and reported it rather than quietly working around it.
 * `OptionsComparison.tsx:159` is the correct shape, and the honest sentence had
 * already been written — `strengthenCopy.ts:51` — and was going unused.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { StrengthenTheReasoning } from '../sections/StrengthenTheReasoning'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'

const showToast = vi.fn()
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => showToast }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../modals', () => ({ openDefineSuccess: vi.fn(), openDecisionRecord: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))
vi.mock('../nodeMarks', async (orig) => ({
  ...(await orig<typeof import('../nodeMarks')>()),
  markKindForTarget: () => null,
}))
vi.mock('../../../../canvas/stores/strengthenStore', async (orig) => ({
  ...(await orig<typeof import('../../../../canvas/stores/strengthenStore')>()),
  useStrengthenStore: (sel: (s: unknown) => unknown) =>
    sel({ records: {}, priorityOrder: [], dismiss: vi.fn(), restoreDismissed: vi.fn(), dispute: vi.fn(), seedIfAbsent: vi.fn() }),
}))

import { focusModelTarget } from '../../../../canvas/utils/focusHelpers'

/** A finding with a canvas target, so the button renders at all. */
const rec = (over: Partial<Recommendation> = {}): Recommendation =>
  ({
    id: 'strengthen:flip:edge_9',
    helpType: 'challenge',
    title: 'Test the assumption most likely to change the leader',
    signal: 's',
    whyNow: 'w',
    tryThis: 't',
    sourceLine: 'Source: robustness analysis.',
    action: { kind: 'ai-dialogue', label: 'Work through this', prompt: 'p' },
    targetId: 'edge_9',
    priority: 100,
    ...over,
  }) as Recommendation

const renderOpen = () => {
  const r = render(<StrengthenTheReasoning interventions={[rec()]} />)
  fireEvent.click(screen.getByTestId('analysis-new-strengthen-toggle'))
  return r
}

beforeEach(() => {
  showToast.mockClear()
  vi.mocked(focusModelTarget).mockReset()
})

describe('the canvas focus control cannot fail silently', () => {
  it('tells the user when the element is no longer on the canvas', () => {
    vi.mocked(focusModelTarget).mockReturnValue(false)
    renderOpen()

    fireEvent.click(screen.getByTestId('analysis-new-strengthen-focus'))

    expect(focusModelTarget).toHaveBeenCalledWith('edge_9', expect.anything())
    // The sentence already existed and was unused. It is not respelled here.
    expect(showToast).toHaveBeenCalledWith(STRENGTHEN_COPY.focusFailedNotice)
  })

  /**
   * ⭐ THE DISCRIMINATING TWIN. Without it the fix could have fired the notice
   * unconditionally — turning a silent failure into a lie about a focus that
   * genuinely worked — and the test above would still pass.
   */
  it('says nothing when the focus genuinely worked', () => {
    vi.mocked(focusModelTarget).mockReturnValue(true)
    renderOpen()

    fireEvent.click(screen.getByTestId('analysis-new-strengthen-focus'))

    expect(focusModelTarget).toHaveBeenCalledTimes(1)
    expect(showToast).not.toHaveBeenCalled()
  })
})
