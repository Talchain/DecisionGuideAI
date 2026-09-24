/**
 * E7 + E8 — edit a review item (prototype `review-edit`, `review-context`,
 * `reviewEditorHTML` P:538, submit P:668-673).
 *
 * Every finding in the review tool has an at-rest pencil, "Edit this belief",
 * opening one inline form: belief or proposed wording, evidence or context, and
 * an optional source. "Add evidence or context" sits at rest under the acts and
 * opens the same form on its evidence field. Submit composes the prototype's
 * review message and hands it to the tab's ask route with the finding's own
 * `block_id`, so Olumi knows WHICH finding it is about.
 *
 * ⚠ NOTHING IS STORED. There is no model-level evidence store and no writer for
 * a finding's wording (editability map E8 / E15b). The form's note says so, and
 * nothing here writes a store.
 *
 * ⚠ A FACTOR'S VALUE KEEPS ITS OWN EDITOR. "Change this value" stays on every
 * factor (Paul's ruling); the form never offers a second value field.
 *
 * Bound by identity: testids, the item's `data-review-key`, and the copy
 * constants the component renders.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []
const edges: Array<{ id: string }> = []
const showToast = vi.fn()

type MockState = { nodes: unknown; edges: unknown; currentScenarioId: string | null }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, edges, currentScenarioId: 'scn_1' })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => showToast }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    proposeFactorValue: vi.fn(),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(),
  }),
}))
vi.mock('../useFactorValueCommit', () => ({ useFactorValueCommit: () => ({ commit: vi.fn() }) }))
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }),
}))

import { ModelReviewTool } from '../sections/ModelReviewTool'
import { REVIEW_TOOL_COPY as COPY } from '../buildReviewQueue'
import { buildModelStrip } from '../buildModelStrip'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

const TID = 'analysis-new-review'

const CANVAS = [
  { id: 'g1', type: 'goal', data: { label: 'Grow margin' } },
  { id: 'f_ai', type: 'factor', data: { label: 'Vendor cost', observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' } } },
  { id: 'f_mine', type: 'factor', data: { label: 'Team size', observedState: { value: 0.3, source: 'user_override' } } },
]

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Pressure-test this result',
    signal: 'This result does not hold up strongly under stress-testing.',
    whyNow: 'A fragile result can shift with small changes.',
    tryThis: null,
    sourceLine: 'Source: robustness analysis.',
    action: { kind: 'ai-dialogue', label: 'Challenge this result', prompt: 'Build the strongest case against it.' },
    targetId: null,
    priority: 130,
    ...over,
  }) as Recommendation

const ROBUSTNESS = rec({ id: 'strengthen:robustness' })
const ABOUT_MINE = rec({
  id: 'strengthen:phase3:blk_mine',
  helpType: 'clarify',
  title: 'A load-bearing assumption',
  signal: 'Team size is assumed fixed.',
  whyNow: 'Team size is assumed fixed.',
  sourceLine: 'Source: Olumi model review.',
  signalCode: 'ASSUMPTION_CHECK',
  action: { kind: 'ai-dialogue', label: 'Work through with Olumi', prompt: 'A load-bearing assumption', parameters: { block_id: 'blk_mine' } },
  targetId: 'f_mine',
  priority: 10,
})

const stripValue = (id: string) =>
  buildModelStrip(CANVAS).rows.find((r) => r.kind === 'factor')?.nodes.find((n) => n.id === id)?.valueText as string
const openTool = () => fireEvent.click(screen.getByTestId(`${TID}-toggle`))
const itemKey = () => screen.getByTestId(`${TID}-item`).getAttribute('data-review-key')
const editor = () => screen.queryByTestId(`${TID}-editor`)
const field = (label: string) => within(screen.getByTestId(`${TID}-editor`)).getByLabelText(label)
const type = (label: string, value: string) => fireEvent.change(field(label), { target: { value } })

beforeEach(() => {
  nodes.length = 0
  nodes.push(...CANVAS)
  edges.length = 0
  showToast.mockReset()
  useStrengthenStore.setState({ records: {} })
})
afterEach(cleanup)

describe('"Edit this belief": an at-rest pencil on every finding', () => {
  it('sits in the acts row and opens belief, evidence and source, with the belief focused', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    const pencil = within(screen.getByTestId(`${TID}-acts`)).getByTestId(`${TID}-edit`)
    expect(pencil).toHaveAttribute('aria-label', COPY.editBelief)
    expect(editor()).toBeNull()
    fireEvent.click(pencil)
    expect(pencil).toHaveAttribute('aria-expanded', 'true')
    expect(field(COPY.beliefLabel)).toBe(document.activeElement)
    expect(field(COPY.evidenceLabel)).toBeInTheDocument()
    expect(field(COPY.sourceLabel)).toBeInTheDocument()
    // The producer's finding is not re-presented as the reader's belief.
    expect((field(COPY.beliefLabel) as HTMLTextAreaElement).value).toBe('')
  })

  it('also on a finding about no factor', () => {
    render(<ModelReviewTool interventions={[ROBUSTNESS]} onAsk={vi.fn()} />)
    openTool()
    expect(screen.getByTestId(`${TID}-edit`)).toBeInTheDocument()
  })

  it('CONTRAST: a verify-list factor has no pencil — its value keeps "Change this value"', () => {
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    openTool()
    expect(itemKey()).toBe('factor:f_ai')
    expect(screen.queryByTestId(`${TID}-edit`)).toBeNull()
    expect(screen.getByTestId(`${TID}-value-edit`)).toHaveAttribute('data-node-id', 'f_ai')
  })

  it('submit hands the composed review message to the ask route, with this finding\'s block_id and target', () => {
    const onAsk = vi.fn()
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={onAsk} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-edit`))
    type(COPY.beliefLabel, ' Team size will grow by two ')
    type(COPY.evidenceLabel, 'Hiring plan approved in March')
    type(COPY.sourceLabel, 'Board minutes')
    fireEvent.click(screen.getByTestId(`${TID}-editor-send`))
    expect(onAsk).toHaveBeenCalledTimes(1)
    const payload = onAsk.mock.calls[0][0]
    // The finding is about a factor, so its value rides along exactly as the
    // item's value line shows it.
    const valueText = screen.getByTestId(`${TID}-value-text`).textContent as string
    expect(valueText).toBe(stripValue('f_mine'))
    expect(payload.draft).toBe(
      [
        'Reviewing: A load-bearing assumption',
        `Current value: ${valueText}`,
        'Proposed belief: Team size will grow by two',
        'Evidence or context: Hiring plan approved in March',
        'Source: Board minutes',
        'Help me examine this; do not treat it as verified evidence.',
      ].join('\n'),
    )
    expect(payload.parameters).toEqual({ block_id: 'blk_mine' })
    expect(payload.targetId).toBe('f_mine')
    expect(editor()).toBeNull()
  })

  it('an empty form sends nothing and stays open', () => {
    const onAsk = vi.fn()
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={onAsk} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-edit`))
    type(COPY.evidenceLabel, '   ')
    fireEvent.click(screen.getByTestId(`${TID}-editor-send`))
    expect(onAsk).not.toHaveBeenCalled()
    expect(editor()).toBeInTheDocument()
  })

  it('Cancel and Escape close it without asking', () => {
    const onAsk = vi.fn()
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={onAsk} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-edit`))
    fireEvent.click(screen.getByTestId(`${TID}-editor-cancel`))
    expect(editor()).toBeNull()
    fireEvent.click(screen.getByTestId(`${TID}-edit`))
    fireEvent.keyDown(field(COPY.evidenceLabel), { key: 'Escape' })
    expect(editor()).toBeNull()
    expect(onAsk).not.toHaveBeenCalled()
  })

  it('paging to another item closes it', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE, ROBUSTNESS]} onAsk={vi.fn()} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-edit`))
    expect(editor()).toBeInTheDocument()
    fireEvent.click(screen.getByTestId(`${TID}-next`))
    expect(itemKey()).toBe(ROBUSTNESS.id)
    expect(editor()).toBeNull()
  })

  it('says where the words go, and that nothing is stored as verified evidence', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-edit`))
    expect(screen.getByTestId(`${TID}-editor-note`)).toHaveTextContent(COPY.editNote)
    expect(within(screen.getByTestId(`${TID}-editor`)).getByText(COPY.sourceMeta)).toBeInTheDocument()
  })
})

describe('"Add evidence or context": at rest, not behind More', () => {
  it('sits under the acts and opens the form on its evidence field', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    const link = screen.getByTestId(`${TID}-add-context`)
    expect(link).toHaveTextContent(COPY.addContext)
    expect(within(screen.getByTestId(`${TID}-acts`)).queryByTestId(`${TID}-add-context`)).toBeNull()
    fireEvent.click(link)
    expect(field(COPY.evidenceLabel)).toBe(document.activeElement)
    // The editor takes the link's place, as in the prototype.
    expect(screen.queryByTestId(`${TID}-add-context`)).toBeNull()
  })

  it('CONTRAST: the More menu no longer carries it', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    expect(within(screen.getByTestId(`${TID}-menu`)).queryByTestId(`${TID}-add-context`)).toBeNull()
    expect(within(screen.getByTestId(`${TID}-menu`)).getByTestId(`${TID}-disagree`)).toBeInTheDocument()
  })

  it('on a verify-list factor: evidence and source only, the value as the strip shows it, and no invented block_id', () => {
    const onAsk = vi.fn()
    render(<ModelReviewTool interventions={[]} onAsk={onAsk} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-add-context`))
    const form = screen.getByTestId(`${TID}-editor`)
    expect(within(form).queryByLabelText(COPY.beliefLabel)).toBeNull()
    type(COPY.evidenceLabel, 'The vendor quoted £52 last week')
    fireEvent.click(screen.getByTestId(`${TID}-editor-send`))
    const payload = onAsk.mock.calls[0][0]
    const valueText = stripValue('f_ai')
    expect(valueText).toBeTruthy()
    expect(payload.draft).toBe(
      [
        'Reviewing: Vendor cost',
        `Current value: ${valueText}`,
        'Evidence or context: The vendor quoted £52 last week',
        'Help me examine this; do not treat it as verified evidence.',
      ].join('\n'),
    )
    expect(payload.targetId).toBe('f_ai')
    expect(payload).not.toHaveProperty('parameters')
  })
})

describe('the acts row keeps at most three icons, and nothing dead', () => {
  it('pencil, inspect and ask in the row; Focus on canvas moves behind More', () => {
    const onFocus = vi.fn().mockReturnValue(true)
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} onInspect={vi.fn()} onFocus={onFocus} />)
    openTool()
    const row = screen.getByTestId(`${TID}-acts`)
    const icons = Array.from(row.querySelectorAll('button'))
      .map((b) => b.getAttribute('data-testid'))
      .filter((t) => t !== `${TID}-more`)
    expect(icons).toEqual([`${TID}-edit`, `${TID}-inspect`, `${TID}-ask`])
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    fireEvent.click(within(screen.getByTestId(`${TID}-menu`)).getByTestId(`${TID}-focus`))
    expect(onFocus).toHaveBeenCalledWith('f_mine')
  })

  it('the menu has no "Edit this item" entry that nothing handles', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    expect(within(screen.getByTestId(`${TID}-menu`)).queryByText('Edit this item')).toBeNull()
    expect(within(screen.getByTestId(`${TID}-menu`)).queryByTestId(`${TID}-edit`)).toBeNull()
  })
})
