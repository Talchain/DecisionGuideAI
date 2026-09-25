/**
 * ONE review affordance for the whole model: a count, a pager, and the acts a
 * reader needs on each item — every one routed to an EXISTING owner.
 *
 * Bound by identity: testids, the item's `data-review-key`, and the copy
 * constants the component renders, never a value another element could match.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []
const edges: Array<{ id: string }> = []
const showToast = vi.fn()
const proposeFactorConfirmation = vi.fn()
const authorityFor = vi.fn()

type MockState = { nodes: unknown; edges: unknown; currentScenarioId: string | null }
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({ nodes, edges, currentScenarioId: 'scn_1' })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => showToast }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: (id: string | null) => {
    authorityFor(id)
    return {
      proposeFactorValue: vi.fn(),
      proposeOptionIntervention: vi.fn(),
      proposeFactorConfirmation,
    }
  },
}))
// The inline value editor's own write hook, mocked apart so every call the
// authority mock records is THIS component's confirmation authority.
vi.mock('../useFactorValueCommit', () => ({ useFactorValueCommit: () => ({ commit: vi.fn() }) }))
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }),
}))

import { ModelReviewTool } from '../sections/ModelReviewTool'
import { REVIEW_TOOL_COPY as COPY, WHOLE_FRAMING_ASK } from '../buildReviewQueue'
import { buildModelStrip, stripNodeValueSignature } from '../buildModelStrip'
import { STRENGTHEN_COPY } from '../../strengthen/strengthenCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'
import { recordKey, useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

const TID = 'analysis-new-review'

const CANVAS = [
  { id: 'g1', type: 'goal', data: { label: 'Grow margin' } },
  { id: 'f_ai', type: 'factor', data: { label: 'Vendor cost', observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' } } },
  { id: 'f_mine', type: 'factor', data: { label: 'Team size', observedState: { value: 0.3, source: 'user_override' } } },
  { id: 'f_bare', type: 'factor', data: { label: 'Lead time', observedState: { value: 0.7, source: 'cee_inference' } } },
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

const openTool = () => fireEvent.click(screen.getByTestId(`${TID}-toggle`))
const itemKey = () => screen.getByTestId(`${TID}-item`).getAttribute('data-review-key')

beforeEach(() => {
  nodes.length = 0
  nodes.push(...CANVAS)
  edges.length = 0
  showToast.mockReset()
  authorityFor.mockReset()
  proposeFactorConfirmation.mockReset().mockReturnValue('committed')
  useStrengthenStore.setState({ records: {} })
})
afterEach(cleanup)

describe('the collapsed row', () => {
  it('counts the whole queue: findings plus the factors to verify', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE, ROBUSTNESS]} onAsk={vi.fn()} />)
    // 2 findings + 2 cee_inference factors with a number (f_ai, f_bare).
    expect(screen.getByTestId(`${TID}-count`)).toHaveTextContent(COPY.toReview(4))
    expect(screen.getByTestId(`${TID}-toggle`)).toHaveAttribute('aria-label', COPY.toReviewName(4))
    // CONTRAST: a non-empty queue shows its count, not the empty label.
    expect(screen.queryByTestId(`${TID}-empty`)).toBeNull()
  })

  it('CONTRAST: an empty queue offers no count, and the framing ask stays', () => {
    nodes.length = 0
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    expect(screen.queryByTestId(`${TID}-toggle`)).toBeNull()
    expect(screen.getByTestId(`${TID}-ask-framing`)).toBeInTheDocument()
    // The row says its state, so the framing ask is never a lone icon.
    expect(screen.getByTestId(`${TID}-empty`)).toHaveTextContent(COPY.nothingToReview)
  })

  it('the framing ask sends the estate\'s shared review-the-brief payload', () => {
    const onAsk = vi.fn()
    render(<ModelReviewTool interventions={[]} onAsk={onAsk} />)
    const ask = screen.getByTestId(`${TID}-ask-framing`)
    expect(ask).toHaveAttribute('aria-label', COPY.askFraming)
    expect(ask).toHaveAttribute('data-ai', 'true')
    fireEvent.click(ask)
    expect(onAsk).toHaveBeenCalledWith(WHOLE_FRAMING_ASK)
  })

  it('the excluded card is not counted', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE, ROBUSTNESS]} excludeId={ROBUSTNESS.id} onAsk={vi.fn()} />)
    expect(screen.getByTestId(`${TID}-count`)).toHaveTextContent(COPY.toReview(3))
  })

  /**
   * ⭐⭐ H3 (design-b1w2-header-structure): ONE WORKLIST COUNT, IN INFO BLUE —
   * the prototype's own "🔍 5 to review" (`Olumi_Reasoning_Prototype_V2.html`).
   * On the deployed build this toggle rendered `text-text-body`, indistinguishable
   * from plain prose, while the strip's SEPARATE amber "N to verify" line sat
   * above it on the same first screen — two counts, two colours, the same
   * worklist. Amber now lives ONLY inside the strip's own disclosure
   * (`ModelStrip.tsx`'s `{open ? ... : null}`), never on the closed first
   * screen, so this is the one count a reader meets before opening anything.
   */
  it('⭐⭐ H3: the toggle reads in info blue, never amber or plain body text', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE, ROBUSTNESS]} onAsk={vi.fn()} />)
    const toggle = screen.getByTestId(`${TID}-toggle`)
    expect(toggle.className).toMatch(/\btext-info\b/)
    expect(toggle.className).not.toMatch(/\btext-warning/)
    expect(toggle.className).not.toMatch(/\btext-text-body\b/)
  })
})

describe('the pager', () => {
  it('opens on the first item and walks the queue in order', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE, ROBUSTNESS]} onAsk={vi.fn()} />)
    expect(screen.queryByTestId(`${TID}-item`)).toBeNull()
    openTool()
    expect(screen.getByTestId(`${TID}-pager`)).toHaveTextContent(COPY.pager(1, 4))
    expect(itemKey()).toBe(ABOUT_MINE.id)
    expect(screen.getByTestId(`${TID}-name`)).toHaveTextContent(ABOUT_MINE.title)
    expect(screen.getByTestId(`${TID}-prev`)).toBeDisabled()
    fireEvent.click(screen.getByTestId(`${TID}-next`))
    expect(itemKey()).toBe(ROBUSTNESS.id)
    fireEvent.click(screen.getByTestId(`${TID}-next`))
    fireEvent.click(screen.getByTestId(`${TID}-next`))
    expect(itemKey()).toBe('factor:f_bare')
    expect(screen.getByTestId(`${TID}-next`)).toBeDisabled()
    fireEvent.click(screen.getByTestId(`${TID}-close`))
    expect(screen.queryByTestId(`${TID}-item`)).toBeNull()
  })

  it('says the kind, and the reason verbatim with its source behind the info control', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    const kind = screen.getByTestId(`${TID}-kind`)
    expect(kind).toHaveTextContent('Assumption')
    expect(kind).toHaveAttribute('data-kind-basis', 'signal-code')
    expect(screen.getByTestId(`${TID}-reason`)).toHaveTextContent(ABOUT_MINE.whyNow)
    const info = screen.getByTestId(`${TID}-source-info`)
    expect(info).toHaveAttribute('aria-label', ABOUT_MINE.sourceLine)
    expect(screen.queryByTestId(`${TID}-source`)).toBeNull()
    fireEvent.click(info)
    expect(screen.getByTestId(`${TID}-source`)).toHaveTextContent(ABOUT_MINE.sourceLine)
  })

  it('offers no "Mark reviewed": nothing would keep it', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    expect(screen.queryByText(/mark(ed)? reviewed/i)).toBeNull()
    expect(screen.queryByText(/^reviewed$/i)).toBeNull()
  })
})

describe('a factor shows its value and whose it is', () => {
  it('an Olumi estimate: the value as the strip renders it, and Confirm offered', () => {
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    openTool()
    expect(itemKey()).toBe('factor:f_ai')
    const stripText = buildModelStrip(CANVAS).rows.find((r) => r.kind === 'factor')?.nodes[0]?.valueText
    expect(stripText).toBeTruthy()
    expect(screen.getByTestId(`${TID}-value-text`)).toHaveTextContent(stripText as string)
    expect(screen.getByTestId(`${TID}-provenance`)).toHaveTextContent(COPY.olumiEstimate)
    expect(screen.getByTestId(`${TID}-confirm`)).toHaveTextContent(COPY.confirm)
    // The inline value editor is the existing control, keyed to this factor.
    expect(screen.getByTestId(`${TID}-value-edit`)).toHaveAttribute('data-node-id', 'f_ai')
  })

  it('CONTRAST: the user\'s own value says so, and offers nothing to confirm', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    expect(itemKey()).toBe(ABOUT_MINE.id)
    expect(screen.getByTestId(`${TID}-provenance`)).toHaveTextContent(COPY.yourValue)
    expect(screen.queryByTestId(`${TID}-confirm`)).toBeNull()
    // …and the write authority is not even keyed to it.
    expect(authorityFor).toHaveBeenLastCalledWith(null)
  })

  it('CONTRAST: a finding about no factor has no value line and no inline editor', () => {
    render(<ModelReviewTool interventions={[ROBUSTNESS]} onAsk={vi.fn()} />)
    openTool()
    expect(itemKey()).toBe(ROBUSTNESS.id)
    expect(screen.queryByTestId(`${TID}-value`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-value-edit`)).toBeNull()
    expect(screen.queryByTestId(`${TID}-provenance`)).toBeNull()
  })
})

describe('Confirm as my estimate', () => {
  it('goes through the write authority keyed to THIS factor, and says what it did not do', () => {
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    openTool()
    expect(authorityFor).toHaveBeenLastCalledWith('f_ai')
    fireEvent.click(screen.getByTestId(`${TID}-confirm`))
    expect(proposeFactorConfirmation).toHaveBeenCalledTimes(1)
    expect(showToast).toHaveBeenCalledWith(COPY.confirmed)
  })

  it('a refusal is reported as nothing changed', () => {
    proposeFactorConfirmation.mockReturnValue('not_encodable')
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-confirm`))
    expect(showToast).toHaveBeenCalledWith(COPY.confirmRefused)
  })

  it('CONTRAST: on an item with nothing to confirm the authority is keyed to nothing', () => {
    render(<ModelReviewTool interventions={[ROBUSTNESS]} onAsk={vi.fn()} />)
    openTool()
    expect(authorityFor).toHaveBeenLastCalledWith(null)
  })

  it('keeps reviewed and verified apart, in words a touch reader can reach', () => {
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    openTool()
    const info = screen.getByTestId(`${TID}-confirm-info`)
    expect(info).toHaveAttribute('aria-label', COPY.confirmTip)
    fireEvent.click(info)
    expect(screen.getByTestId(`${TID}-confirm-note`)).toHaveTextContent(COPY.confirmTip)
  })

  it('when the confirmed factor leaves the queue, the next item takes its place', () => {
    const { rerender } = render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    openTool()
    expect(itemKey()).toBe('factor:f_ai')
    // The authority's stamp, as the store would hold it after the write.
    nodes[1] = { id: 'f_ai', type: 'factor', data: { label: 'Vendor cost', observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'user_confirmed' } } }
    rerender(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    expect(itemKey()).toBe('factor:f_bare')
    expect(screen.getByTestId(`${TID}-pager`)).toHaveTextContent(COPY.pager(1, 1))
  })
})

describe('a label-only rename reaches the mounted readers (Codex 5808182879)', () => {
  it('the review item and its Ask and Disagree name the factor by its NEW label', () => {
    const onAsk = vi.fn()
    // ONE stable interventions array: a fresh [] per render would rebuild the
    // queue by identity and hide the stale-signature defect this pins.
    const NONE: never[] = []
    const { rerender } = render(<ModelReviewTool interventions={NONE} onAsk={onAsk} />)
    openTool()
    expect(itemKey(), 'PRECONDITION').toBe('factor:f_ai')
    expect(screen.getByTestId(`${TID}-name`)).toHaveTextContent('Vendor cost')
    // Rename ONLY the label: same id, type, value and source.
    const i = nodes.findIndex((n) => n.id === 'f_ai')
    const before = nodes[i] as { id: string; type: string; data: Record<string, unknown> }
    nodes[i] = { ...before, data: { ...before.data, label: 'Annual platform cost' } }
    rerender(<ModelReviewTool interventions={NONE} onAsk={onAsk} />)
    expect(screen.getByTestId(`${TID}-name`)).toHaveTextContent('Annual platform cost')
    fireEvent.click(screen.getByTestId(`${TID}-ask`))
    expect(onAsk.mock.calls.at(-1)?.[0].draft).toBe(COPY.askFactorDraft('Annual platform cost'))
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    fireEvent.click(screen.getByTestId(`${TID}-disagree`))
    expect(onAsk.mock.calls.at(-1)?.[0].draft).toBe(COPY.disagreeDraft('Annual platform cost'))
  })
})

describe('the shared mounted-reader signature (strip AND review tool)', () => {
  const base = { id: 'f1', type: 'factor', position: { x: 0, y: 0 }, data: { label: 'Vendor cost', observedState: { value: 0.49, source: 'cee_inference' } } }
  it('changes on a label-only rename', () => {
    expect(stripNodeValueSignature({ ...base, data: { ...base.data, label: 'Annual platform cost' } } as never))
      .not.toBe(stripNodeValueSignature(base as never))
  })
  it('CONTRAST: does NOT change on a drag (position only), so dragging never rebuilds the readers', () => {
    expect(stripNodeValueSignature({ ...base, position: { x: 400, y: 120 } } as never)).toBe(stripNodeValueSignature(base as never))
  })
  it('CONTRAST: still changes on a value or source change', () => {
    expect(stripNodeValueSignature({ ...base, data: { ...base.data, observedState: { value: 0.49, source: 'user_confirmed' } } } as never))
      .not.toBe(stripNodeValueSignature(base as never))
  })
})

describe('the acts route to their existing owners', () => {
  it('Inspect in Model hands the target to the caller, and is absent without a handler', () => {
    const onInspect = vi.fn()
    const { unmount } = render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} onInspect={onInspect} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-inspect`))
    expect(onInspect).toHaveBeenCalledWith('f_mine')
    unmount()
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    expect(screen.queryByTestId(`${TID}-inspect`)).toBeNull()
  })

  it('Focus on canvas: a failed focus says so', () => {
    const onFocus = vi.fn().mockReturnValue(false)
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} onFocus={onFocus} />)
    openTool()
    // V2: behind More, so the row keeps three icons with the pencil in it.
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    fireEvent.click(screen.getByTestId(`${TID}-focus`))
    expect(onFocus).toHaveBeenCalledWith('f_mine')
    expect(showToast).toHaveBeenCalledWith(STRENGTHEN_COPY.focusFailedNotice)
  })

  it('CONTRAST: a successful focus is silent, and an untargeted item offers no focus', () => {
    const onFocus = vi.fn().mockReturnValue(true)
    const { unmount } = render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} onFocus={onFocus} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    fireEvent.click(screen.getByTestId(`${TID}-focus`))
    expect(showToast).not.toHaveBeenCalled()
    unmount()
    render(<ModelReviewTool interventions={[ROBUSTNESS]} onAsk={vi.fn()} onFocus={onFocus} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    expect(screen.getByTestId(`${TID}-menu`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-focus`)).toBeNull()
  })

  it('Ask carries the finding\'s block_id', () => {
    const onAsk = vi.fn()
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={onAsk} />)
    openTool()
    const ask = screen.getByTestId(`${TID}-ask`)
    expect(ask).toHaveAttribute('data-ai', 'true')
    fireEvent.click(ask)
    expect(onAsk).toHaveBeenCalledWith(
      expect.objectContaining({ parameters: { block_id: 'blk_mine' }, targetId: 'f_mine' }),
    )
  })

  it('at most three icon acts sit in the row; the rest are behind More', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} onInspect={vi.fn()} />)
    openTool()
    const row = screen.getByTestId(`${TID}-acts`)
    const icons = Array.from(row.querySelectorAll('button')).filter(
      (b) => b.getAttribute('data-testid') !== `${TID}-more`,
    )
    expect(icons.length).toBeLessThanOrEqual(3)
    expect(screen.getByTestId(`${TID}-more`)).toHaveAttribute('aria-haspopup', 'menu')
  })

  it('Add evidence or context captures inline, then goes to Olumi as one ask', () => {
    const onAsk = vi.fn()
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={onAsk} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-add-context`))
    // Opening the form asks nothing yet.
    expect(onAsk).not.toHaveBeenCalled()
    fireEvent.change(screen.getByTestId(`${TID}-editor-evidence`), { target: { value: 'Two hires are signed' } })
    fireEvent.click(screen.getByTestId(`${TID}-editor-send`))
    expect(onAsk).toHaveBeenCalledWith(
      expect.objectContaining({ label: COPY.addContext, parameters: { block_id: 'blk_mine' } }),
    )
    expect(onAsk).toHaveBeenCalledTimes(1)
    expect(screen.queryByTestId(`${TID}-editor`)).toBeNull()
  })

  it('"I disagree" continues into the conversation about THIS finding: same block_id and target, a started draft, nothing stored', () => {
    const onAsk = vi.fn()
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={onAsk} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    fireEvent.click(screen.getByTestId(`${TID}-disagree`))
    expect(onAsk).toHaveBeenCalledTimes(1)
    const payload = onAsk.mock.calls[0][0]
    expect(payload.label).toBe(COPY.disagree)
    expect(payload.parameters).toEqual({ block_id: 'blk_mine' })
    expect(payload.draft).toBe(COPY.disagreeDraft(ABOUT_MINE.title))
    // CONTRAST: it is not the item editor's review message with a new label.
    expect(payload.draft).not.toContain(COPY.editReviewing(ABOUT_MINE.title))
    expect(document.querySelector('textarea')).toBeNull()
  })

  it('a relationship finding is edited in place through the pencil, not a menu entry nothing handles', () => {
    const onAsk = vi.fn()
    edges.push({ id: 'e1' })
    const onEdge = rec({ id: 'strengthen:flip:e1', helpType: 'evaluate', targetId: 'e1' })
    render(<ModelReviewTool interventions={[onEdge]} onAsk={onAsk} />)
    openTool()
    expect(screen.getByTestId(`${TID}-kind`)).toHaveTextContent('Relationship')
    fireEvent.click(screen.getByTestId(`${TID}-edit`))
    fireEvent.change(screen.getByTestId(`${TID}-editor-belief`), { target: { value: 'This link is weaker than shown' } })
    fireEvent.click(screen.getByTestId(`${TID}-editor-send`))
    expect(onAsk).toHaveBeenCalledWith(expect.objectContaining({ targetId: 'e1', label: COPY.editBelief }))
  })

  it('Escape closes the menu', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    expect(screen.getByTestId(`${TID}-menu`)).toBeInTheDocument()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByTestId(`${TID}-menu`)).toBeNull()
  })
})

describe('Not relevant writes the lifecycle store the Strengthen cards write, with an undo', () => {
  it('dismisses the finding under this decision, and undo restores it', () => {
    render(<ModelReviewTool interventions={[ROBUSTNESS]} onAsk={vi.fn()} analysisHash="run_x" />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    fireEvent.click(screen.getByTestId(`${TID}-dismiss`))
    const key = recordKey('scn_1', ROBUSTNESS.id)
    expect(useStrengthenStore.getState().records[key]?.status).toBe('dismissed')
    expect(screen.getByTestId(`${TID}-dismissed-notice`)).toHaveTextContent(ROBUSTNESS.title)
    act(() => {
      fireEvent.click(screen.getByTestId(`${TID}-dismissed-undo`))
    })
    expect(useStrengthenStore.getState().records[key]?.status).not.toBe('dismissed')
  })

  it('CONTRAST: a verify-list factor is not a finding, so it cannot be dismissed', () => {
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    openTool()
    fireEvent.click(screen.getByTestId(`${TID}-more`))
    expect(screen.queryByTestId(`${TID}-dismiss`)).toBeNull()
  })
})
