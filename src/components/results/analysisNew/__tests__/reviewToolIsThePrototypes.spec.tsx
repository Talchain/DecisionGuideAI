/**
 * ⭐ B6 OF THE 25 SEP DESIGN AUDIT — THE REVIEW TOOL IS THE V2 PROTOTYPE'S
 * `review-shell` (`reviewHTML()`), BUILT ONLY FROM FIELDS THE QUEUE ALREADY HOLDS.
 *
 * Prototype, in order:
 *   ── divider ──
 *   Review the thinking (12px, light)                 ‹ 1 / 5 › ×
 *   [ 1. Is hiring the only route?            ▾ ]   ← the item select, numbered
 *   ⌗ Framing · Draft framing                       ← kind icon + "kind · source"
 *   • A staffing change is the main route…          ← the belief bullet
 *   why line (11px light)                        ⓘ
 *   ✎  ⌖ "Inspect this item in the Model view"  ✦             ✓ Mark reviewed
 *   🔗 Add evidence or context
 *
 * What is built here, and what is deliberately NOT (the report lists each):
 *   · the select, the kind icon, the "kind · source" line, the focus control's
 *     prototype name, the 12px untinted "Add evidence or context" — built;
 *   · the belief bullet — built for an item about a FACTOR, whose value IS the
 *     belief the prototype shows for its cost factor; a finding carries no
 *     belief field (`Recommendation` has title / signal / whyNow / tryThis /
 *     sourceLine), so it renders NOTHING rather than a sentence the UI wrote
 *     (PRODUCER GAP);
 *   · "✓ Mark reviewed" and its "· reviewed" marks — NOT built: no store field
 *     persists a review state (PRODUCT DECISION; `ModelReviewTool.spec.tsx`
 *     keeps pinning its absence).
 *
 * ⭐ AND THE ROUTING SEAM: a census mark about a node the queue holds opens THIS
 * tool at that item (prototype `gotoReview`), which needs two narrow props —
 * `request` in, `onQueueTargets` out. Both are pinned here by identity.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

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
    proposeFactorConfirmation: vi.fn(() => 'committed'),
  }),
}))
vi.mock('../useFactorValueCommit', () => ({ useFactorValueCommit: () => ({ commit: vi.fn() }) }))
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }),
}))

import { ModelReviewTool } from '../sections/ModelReviewTool'
import { REVIEW_KIND_LABEL, REVIEW_TOOL_COPY } from '../buildReviewQueue'
import { buildModelStrip } from '../buildModelStrip'
import { typography } from '../../../../styles/typography'
import type { Recommendation } from '../../strengthen/strengthenTypes'

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
const FRAMING = rec({ id: 'strengthen:success-measure', title: 'Say what success means', targetId: 'g1' })
const RELATIONSHIP = rec({ id: 'strengthen:flip:e1', title: 'A fragile link', targetId: 'e1', helpType: 'evaluate' })

const openTool = () => fireEvent.click(screen.getByTestId(`${TID}-toggle`))
const itemKey = () => screen.getByTestId(`${TID}-item`).getAttribute('data-review-key')
const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  nodes.length = 0
  nodes.push(...CANVAS)
  edges.length = 0
  showToast.mockReset()
})
afterEach(cleanup)

describe('the shell and its header', () => {
  it('opens under a divider, with "Review the thinking" as the prototype’s quiet 12px label', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    const item = screen.getByTestId(`${TID}-item`)
    expect(item.className.split(' ')).toContain('border-t')
    const heading = screen.getByTestId(`${TID}-heading`)
    expect(heading.textContent).toBe(REVIEW_TOOL_COPY.heading)
    for (const t of typography.panelBody.split(' ')) expect(heading.className.split(' ')).toContain(t)
    expect(heading.className.split(' ')).toContain('text-text-light')
    // CONTRAST: not the 14px/600 section header it was.
    expect(heading.className.split(' ')).not.toContain('font-semibold')
    // The prototype's own name for the ×.
    expect(screen.getByTestId(`${TID}-close`)).toHaveAccessibleName('Close review tool')
  })
})

describe('the item select — a numbered list of the whole queue', () => {
  it('lists every item as "n. name", selects the one on screen, and navigates on change', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE, ROBUSTNESS]} onAsk={vi.fn()} />)
    openTool()
    const select = screen.getByRole('combobox', { name: 'Choose a review item' }) as HTMLSelectElement
    expect(select).toBe(screen.getByTestId(`${TID}-select`))
    expect(Array.from(select.options).map((o) => o.textContent)).toEqual([
      `1. ${ABOUT_MINE.title}`,
      `2. ${ROBUSTNESS.title}`,
      '3. Vendor cost',
      '4. Lead time',
    ])
    expect(select.value).toBe('0')
    fireEvent.change(select, { target: { value: '3' } })
    expect(itemKey()).toBe('factor:f_bare')
    expect(screen.getByTestId(`${TID}-pager`)).toHaveTextContent(REVIEW_TOOL_COPY.pager(4, 4))
    expect((screen.getByTestId(`${TID}-select`) as HTMLSelectElement).value).toBe('3')
  })
})

describe('the context line — a kind icon, then "kind · source"', () => {
  it('an assumption about a factor: ○ "Assumption · Your value"', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    const line = screen.getByTestId(`${TID}-context`)
    expect(line.textContent).toBe(`${REVIEW_KIND_LABEL.assumption}·${REVIEW_TOOL_COPY.yourValue}`)
    expect(screen.getByTestId(`${TID}-kind-icon`)).toHaveAttribute('data-kind-icon', 'circle')
  })

  it('framing reads ⌗ and a relationship reads 🔗 — the icon follows the kind the queue READ', () => {
    edges.push({ id: 'e1' })
    render(<ModelReviewTool interventions={[FRAMING, RELATIONSHIP]} onAsk={vi.fn()} />)
    openTool()
    expect(screen.getByTestId(`${TID}-kind`)).toHaveAttribute('data-kind', 'framing')
    expect(screen.getByTestId(`${TID}-kind-icon`)).toHaveAttribute('data-kind-icon', 'frame')
    fireEvent.click(screen.getByTestId(`${TID}-next`))
    expect(screen.getByTestId(`${TID}-kind`)).toHaveAttribute('data-kind', 'relationship')
    expect(screen.getByTestId(`${TID}-kind-icon`)).toHaveAttribute('data-kind-icon', 'link')
  })
})

describe('the belief bullet — only from a field the item carries', () => {
  it('an item about a factor states its value as the bullet, exactly as the strip renders it', () => {
    render(<ModelReviewTool interventions={[]} onAsk={vi.fn()} />)
    openTool()
    expect(itemKey()).toBe('factor:f_ai')
    const stripText = buildModelStrip(CANVAS).rows.find((r) => r.kind === 'factor')?.nodes[0]?.valueText
    expect(stripText).toBeTruthy()
    const belief = screen.getByTestId(`${TID}-belief`)
    expect(belief.tagName).toBe('LI')
    expect(belief.textContent).toBe(stripText)
    // The value editor stays — the standing rule.
    expect(screen.getByTestId(`${TID}-value-edit`)).toHaveAttribute('data-node-id', 'f_ai')
  })

  it('⛔ PRODUCER GAP: a finding about no factor carries no belief field, so no bullet is written for it', () => {
    render(<ModelReviewTool interventions={[ROBUSTNESS]} onAsk={vi.fn()} />)
    openTool()
    expect(itemKey()).toBe(ROBUSTNESS.id)
    expect(screen.queryByTestId(`${TID}-belief`)).toBeNull()
    // CONTRAST: the finding's own reason still renders, verbatim.
    expect(screen.getByTestId(`${TID}-reason`).textContent).toBe(ROBUSTNESS.whyNow)
  })
})

describe('the acts', () => {
  it('the focus control carries the prototype’s name and routes to the Model view', () => {
    const onInspect = vi.fn()
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} onInspect={onInspect} />)
    openTool()
    const focus = screen.getByTestId(`${TID}-inspect`)
    expect(focus).toHaveAccessibleName('Inspect this item in the Model view')
    fireEvent.click(focus)
    expect(onInspect).toHaveBeenCalledWith('f_mine')
  })

  it('"Add evidence or context" is the prototype’s 12px text button: no underline', () => {
    render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    const add = screen.getByTestId(`${TID}-add-context`)
    expect(add.textContent).toBe(REVIEW_TOOL_COPY.addContext)
    const cls = add.className.split(' ')
    for (const t of typography.panelBody.split(' ')) expect(cls).toContain(t)
    expect(cls).not.toContain('underline')
  })
})

describe('the success slot sits between the utilities row and the open item', () => {
  it('prototype order: "N to review" row → success line → review shell', () => {
    render(
      <ModelReviewTool
        interventions={[ABOUT_MINE]}
        onAsk={vi.fn()}
        successSlot={<div data-testid="success-slot" />}
      />,
    )
    openTool()
    const slot = screen.getByTestId('success-slot')
    expect(before(screen.getByTestId(`${TID}-toggle`), slot)).toBe(true)
    expect(before(slot, screen.getByTestId(`${TID}-item`))).toBe(true)
  })
})

describe('the routing seam — a census mark can open the tool at its item', () => {
  it('reports the node ids its queue holds an item about', () => {
    const onQueueTargets = vi.fn()
    render(<ModelReviewTool interventions={[ABOUT_MINE, ROBUSTNESS]} onAsk={vi.fn()} onQueueTargets={onQueueTargets} />)
    expect(onQueueTargets).toHaveBeenLastCalledWith(['f_mine', 'f_ai', 'f_bare'])
  })

  it('an open request for a held node opens the tool AT that item, without the toggle', () => {
    const { rerender } = render(<ModelReviewTool interventions={[ABOUT_MINE, ROBUSTNESS]} onAsk={vi.fn()} />)
    expect(screen.queryByTestId(`${TID}-item`)).toBeNull()
    rerender(
      <ModelReviewTool
        interventions={[ABOUT_MINE, ROBUSTNESS]}
        onAsk={vi.fn()}
        request={{ kind: 'open', targetId: 'f_bare', seq: 1 }}
      />,
    )
    expect(itemKey()).toBe('factor:f_bare')
    expect(screen.getByTestId(`${TID}-pager`)).toHaveTextContent(REVIEW_TOOL_COPY.pager(4, 4))
  })

  it('CONTRAST: a request for a node the queue does not hold opens nothing', () => {
    render(
      <ModelReviewTool
        interventions={[ABOUT_MINE]}
        onAsk={vi.fn()}
        request={{ kind: 'open', targetId: 'g1', seq: 1 }}
      />,
    )
    expect(screen.queryByTestId(`${TID}-item`)).toBeNull()
  })

  it('a close request closes an open tool', () => {
    const { rerender } = render(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} />)
    openTool()
    expect(screen.getByTestId(`${TID}-item`)).toBeInTheDocument()
    rerender(<ModelReviewTool interventions={[ABOUT_MINE]} onAsk={vi.fn()} request={{ kind: 'close', seq: 2 }} />)
    expect(screen.queryByTestId(`${TID}-item`)).toBeNull()
  })
})
