/**
 * ⭐⭐ A GOAL TARGET IS A NUMBER, A UNIT **AND A BOUND** — and the bound was
 * hardcoded, so this surface could only ever record a floor.
 *
 * ## Where this came from
 *
 * The founder's own brief, 14 Sep 2026: *"Given our goal of reaching £20k MRR
 * within 12 months **while keeping monthly churn under 4%** …"*. A ceiling. The
 * product replied on turn one *"You set a limit of 4% in your brief and I could
 * not match it to anything on the model"*, and the Model tab — the one surface
 * with a durable goal-target writer — dispatched `'at_least'` unconditionally
 * (`ModelTabV2Panel.confirmEdit`) beneath a review line that read *"At least
 * {draft} {unit}"*. The words and the wire agreed, and for a ceiling both were
 * wrong.
 *
 * ## Why this is a two-line change rather than a carrier build
 *
 * `buildManualGoalTarget` has taken a REQUIRED `direction: ConstraintType`
 * since 10 Sep, and both values were measured routing through CEE's real
 * `add_constraint` handler at `staging dcebc360`, with `'exactly'` refused as a
 * negative control (`manualGoalTarget.ts:56-67`). The carrier was already
 * there. Only this call site was pinned shut, under a comment that said so:
 * *"Offering the choice here … is NOT in this change's scope"*.
 *
 * ## What these tests are for
 *
 * The valuable mutant is not "does a select exist" — it is **does the chosen
 * bound reach the dispatch, or does something downstream quietly restore the
 * floor**. So the binding tests below assert the VALUE HANDED OUT, and the
 * contrast test asserts the other value is handed out on the other choice. One
 * alone would pass on a component that emits a constant.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { Node } from '@xyflow/react'

/**
 * ⚠ THIS FILE CARRIES ITS OWN MOCK, AND THAT IS THE POINT RATHER THAN A
 * DUPLICATION. `ModelTabV2Panel.spec.tsx` deliberately supplies only
 * `sendSystemEvent`, so `goalTargetDispatchAvailable` — which is literally
 * `typeof dispatchAction === 'function'` (`useModelEditAuthority.ts:814`) — is
 * false there and the goal row has no editor at all. Adding `dispatchAction` to
 * that shared mock would change the world 19 existing tests are asserting
 * against. A goal-target editor needs a dispatcher; this file gives it one.
 */
const dispatchAction = vi.fn(() => true)
const sendSystemEvent = vi.fn()
vi.mock('../../conversation/ConversationContext', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>()
  return { ...actual, useOptionalConversationContext: () => ({ sendSystemEvent, dispatchAction }) }
})
vi.mock('../../utils/focusHelpers', () => ({ focusNodeById: vi.fn(), focusEdgeById: vi.fn() }))

import { ModelRowView } from '../ModelRowView'
import { ModelTabV2Panel } from '../ModelTabV2Panel'
import { useCanvasStore } from '../../store'
import { openOutlineGroups } from './openOutlineGroups'
import type { ModelRow } from '../types'
import { goalTargetBoundPhrase } from '../../conversation/manualGoalTarget'

const GOAL_ID = 'goal_arr'
function goalNode(): Node {
  return { id: GOAL_ID, type: 'goal', position: { x: 0, y: 0 },
    data: { label: 'Hit ARR target', kind: 'goal' } } as unknown as Node
}

function goalRow(over: Partial<ModelRow> = {}): ModelRow {
  return {
    id: 'g1',
    kind: 'goal',
    group: 'goal',
    label: 'Reach £20k MRR Within 12 Months',
    primaryValue: 'Not set',
    attention: [],
    editable: true,
    ...over,
  } as ModelRow
}

/** The editor only renders with the three callbacks its host supplies. */
function renderEditor(direction?: 'at_least' | 'at_most') {
  const onDraftChange = vi.fn()
  render(
    <ModelRowView
      row={goalRow()}
      tier="plain"
      commit={{ phase: 'editing', draft: '4', unit: '%', ...(direction ? { direction } : {}) }}
      onDraftChange={onDraftChange}
      onProposeEdit={vi.fn()}
      onDiscardEdit={vi.fn()}
    />,
  )
  return { onDraftChange }
}

describe('the goal target can carry a CEILING, not only a floor', () => {
  it('offers both bounds, and shows which one is currently selected', () => {
    renderEditor('at_least')
    const select = screen.getByLabelText('Target bound for Reach £20k MRR Within 12 Months')
    expect(select).toHaveValue('at_least')
    // Both, by the producer's own vocabulary — not a free-text pair.
    expect(select).toHaveTextContent('at least')
    expect(select).toHaveTextContent('at most')
  })

  it('⭐ hands the host `at_most` when the reader chooses a ceiling', () => {
    const { onDraftChange } = renderEditor('at_least')
    fireEvent.change(
      screen.getByLabelText('Target bound for Reach £20k MRR Within 12 Months'),
      { target: { value: 'at_most' } },
    )
    expect(onDraftChange).toHaveBeenCalledTimes(1)
    // (rowId, draft, unit, direction) — the draft and unit must ride along
    // unchanged, or choosing a bound would silently clear the number.
    expect(onDraftChange).toHaveBeenCalledWith('g1', '4', '%', 'at_most')
  })

  /**
   * ⛔ THE DISCRIMINATING TWIN. Without it, a component hardcoded to emit
   * `'at_most'` would pass the test above — which is the same defect one
   * direction over, and exactly what this change exists to remove.
   */
  it('⛔ CONTRAST: hands the host `at_least` when the reader chooses a floor', () => {
    const { onDraftChange } = renderEditor('at_most')
    fireEvent.change(
      screen.getByLabelText('Target bound for Reach £20k MRR Within 12 Months'),
      { target: { value: 'at_least' } },
    )
    expect(onDraftChange).toHaveBeenCalledWith('g1', '4', '%', 'at_least')
  })

  it('the unit input does not clear the bound it did not touch', () => {
    const { onDraftChange } = renderEditor('at_most')
    fireEvent.change(
      screen.getByLabelText('Target unit for Reach £20k MRR Within 12 Months'),
      { target: { value: '£' } },
    )
    // Omitted-means-unchanged is the host's rule; the row must still SEND the
    // bound, or the spread has nothing to preserve.
    expect(onDraftChange).toHaveBeenCalledWith('g1', '4', '£', 'at_most')
  })

  /**
   * ⚠ THE WORDS AND THE WIRE COME FROM ONE MAP. `goalTargetBoundPhrase` is the
   * sibling of the `at_least → '>=' / at_most → '<='` map CEE's operator comes
   * from. A second vocabulary here is how a review line ends up attesting a
   * direction the payload does not carry.
   */
  it('names the bounds with the producer’s own vocabulary', () => {
    expect(goalTargetBoundPhrase('at_least')).toBe('at least')
    expect(goalTargetBoundPhrase('at_most')).toBe('at most')
  })
})


/**
 * ⭐⭐ THE HOST MUST CARRY THE BOUND THE ROW HANDED IT.
 *
 * The row tests above pin that the select offers both bounds and emits the
 * chosen one. A mutant that made `changeDraft` DROP `direction` survived every
 * one of them: the row emits `at_most`, the host keeps `at_least`, and the
 * reader's ceiling silently becomes a floor. That is precisely the defect this
 * change exists to remove, so it is pinned here, at the host, where the review
 * line is composed.
 *
 * ⚠ IT ASSERTS THE REVIEW LINE, NOT THE STATE. The sentence is what the reader
 * sees before Confirm, and it is derived from `edit.direction` through
 * `goalTargetBoundPhrase` — the same map CEE's operator comes from. Asserting
 * the rendered words proves the derivation end to end; asserting a state field
 * would prove only that something was stored.
 */
describe('the chosen bound survives the host, not just the row', () => {
  beforeEach(() => {
    dispatchAction.mockClear()
    useCanvasStore.setState({ nodes: [goalNode()], edges: [] } as never, false)
  })

  function openGoalEditor() {
    render(<ModelTabV2Panel nodes={[goalNode()]} edges={[]} goalThreshold={null} />)
    openOutlineGroups()
    fireEvent.click(screen.getByTestId(`model-row-v2-${GOAL_ID}-value`))
    fireEvent.change(screen.getByLabelText('Target unit for Hit ARR target'), { target: { value: '%' } })
    fireEvent.change(screen.getByTestId(`model-row-v2-${GOAL_ID}-value-input`), { target: { value: '4' } })
  }

  it('⭐ a CEILING reaches the review line — it is not silently re-floored', () => {
    openGoalEditor()
    fireEvent.change(screen.getByLabelText('Target bound for Hit ARR target'), { target: { value: 'at_most' } })
    fireEvent.keyDown(screen.getByTestId(`model-row-v2-${GOAL_ID}-value-input`), { key: 'Enter' })
    const row = screen.getByTestId(`model-row-v2-${GOAL_ID}`)
    expect(row).toHaveTextContent('At most 4 % (absolute level)')
    // ⛔ The discriminating half: a line printing both phrases, or one ignoring
    // the choice that happened to contain the substring, would otherwise pass.
    expect(row).not.toHaveTextContent('At least 4 %')
  })

  it('⛔ CONTRAST: a FLOOR still reads as a floor — the default did not move', () => {
    openGoalEditor()
    // No bound chosen. `beginEdit` seeded `at_least`, and this surface has
    // always recorded a floor; opening the choice must not change that.
    fireEvent.keyDown(screen.getByTestId(`model-row-v2-${GOAL_ID}-value-input`), { key: 'Enter' })
    expect(screen.getByTestId(`model-row-v2-${GOAL_ID}`)).toHaveTextContent('At least 4 % (absolute level)')
  })
})
