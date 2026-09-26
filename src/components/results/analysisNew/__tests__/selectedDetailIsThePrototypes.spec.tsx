/**
 * ⭐ B12 OF THE 25 SEP DESIGN AUDIT — A CENSUS MARK'S DETAIL IS THE V2
 * PROTOTYPE'S `inline-detail` (`selectedHTML()`), AND A MARK ABOUT A NODE THE
 * REVIEW QUEUE HOLDS OPENS THE REVIEW TOOL INSTEAD (prototype `gotoReview`).
 *
 * Prototype:
 *   ── divider ──
 *   Hire One Senior Developer (h4)                           ×
 *   · What would have to be true for this option to help?
 *   ✎  ⌖  ✦                                                  (icon-only)
 *
 * Live before this change: a tinted card under the census, "name + shape",
 * "Option" / "Factor · What matters most", an "Estimate not yet confirmed"
 * chip, three TEXT pills ("Show on canv…" at 280px), "Also in …" pointers or
 * "Nothing else on this panel refers to this node.", no close, opened on HOVER.
 *
 * What stays, and why:
 *   · the engine's own findings for the node, verbatim, now as the bullet
 *     (a node with none gets no bullet — the reflective question is a
 *     PRODUCER GAP, never a sentence this surface writes);
 *   · a factor's value line and its value editor (standing rule: the value
 *     editor is never removed).
 *
 * Bound by identity: testids, `data-node-id`, exact accessible names.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []
const setHighlightedNodes = vi.fn()

type MockState = Record<string, unknown>
vi.mock('../../../../canvas/store', () => {
  const read = (): MockState => ({
    nodes,
    edges: [],
    setHighlightedNodes,
    setGoalThresholdAndUpdateNode: vi.fn(),
    goalThreshold: null,
    goalThresholdRepresentation: null,
    currentScenarioId: 'scn_1',
  })
  const useCanvasStore = (select: (s: MockState) => unknown) => select(read())
  ;(useCanvasStore as unknown as { getState: () => MockState }).getState = read
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn(() => true) }))
vi.mock('../../../../canvas/utils/highlightHelpers', () => ({
  highlightNode: vi.fn(),
  clearHighlight: vi.fn(),
}))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../../../canvas/hooks/useModelEditAuthority', () => ({
  useModelEditAuthority: () => ({
    goalTargetDispatchAvailable: true,
    captureScenarioId: () => 'scn_1',
    proposeGoalTarget: vi.fn(() => 'dispatched'),
    proposeFactorValue: vi.fn(() => 'dispatched'),
    proposeOptionIntervention: vi.fn(),
    proposeFactorConfirmation: vi.fn(() => 'committed'),
  }),
}))
vi.mock('../useFactorValueCommit', () => ({ useFactorValueCommit: () => ({ commit: vi.fn(() => 'dispatched') }) }))
vi.mock('../../../../canvas/conversation/ConversationContext', () => ({
  useOptionalConversationContext: () => ({ sendSystemEvent: vi.fn() }),
}))

import { ModelStrip } from '../sections/ModelStrip'
import { ModelReviewTool } from '../sections/ModelReviewTool'
import { buildNodeInsights } from '../nodeInsights'
import { highlightNode } from '../../../../canvas/utils/highlightHelpers'
import { UNCONFIRMED_ESTIMATE_LABEL } from '../../../../canvas/domain/vocabulary'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'
import type { Recommendation } from '../../strengthen/strengthenTypes'

const TID = 'analysis-new-model-strip'
const RID = 'analysis-new-review'

const node = (id: string, type: string, label: string, data: Record<string, unknown> = {}) => ({
  id,
  type,
  data: { label, ...data },
})

const CANVAS = [
  node('g1', 'goal', 'Replace the customer data platform within budget'),
  node('o1', 'option', 'Adopt Segment'),
  node('o2', 'option', 'Adopt RudderStack'),
  node('f7', 'factor', 'Vendor licensing cost', {
    observedState: { value: 0.49, raw_value: 49, unit: '£', source: 'cee_inference' },
  }),
  node('f8', 'factor', 'Migration effort', { observedState: { value: 0.3, source: 'user_override' } }),
  node('r1', 'risk', 'Migration delay'),
]

const rec = (over: Partial<Recommendation> & { id: string }): Recommendation =>
  ({
    helpType: 'challenge',
    title: 'Pressure-test this',
    signal: 'A signal.',
    whyNow: 'Why now.',
    tryThis: null,
    sourceLine: 'Source: Olumi model review.',
    action: { kind: 'ai-dialogue', label: 'Work through with Olumi', prompt: 'Go.' },
    targetId: null,
    priority: 10,
    ...over,
  }) as Recommendation

const ON_O1 = rec({ id: 'strengthen:robustness:o1', targetId: 'o1', title: 'Pressure-test Adopt Segment' })

/** Every kind of data the OLD detail rendered for o1 and r1 — so absence below is not vacuous. */
const RICH_INSIGHTS = buildNodeInsights({
  interventions: [ON_O1],
  drivers: [{ id: 'd1', label: 'Adopt Segment', fraction: 1, targetId: 'o1' } as never],
  mentionSections: [
    { section: 'keyInsights', findings: [{ id: 'k1', targetId: 'o1', headline: 'Adopt Segment is the hinge' }] },
  ] as never,
})

const mark = (nodeId: string) =>
  screen.getAllByTestId(`${TID}-mark`).find((el) => el.getAttribute('data-node-id') === nodeId)!
const before = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

beforeEach(() => {
  nodes.length = 0
  nodes.push(...CANVAS)
  vi.mocked(highlightNode).mockClear()
})
afterEach(cleanup)

describe('the detail is the prototype’s inline-detail', () => {
  it('a heading with the name alone, and a × that closes it', () => {
    render(<ModelStrip isPreRun={false} openAtRest insights={RICH_INSIGHTS} />)
    fireEvent.click(mark('o1'))
    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail).toHaveAttribute('data-node-id', 'o1')
    const title = screen.getByTestId(`${TID}-detail-title`)
    expect(title.tagName).toBe('H4')
    expect(title.textContent).toBe('Adopt Segment')
    const close = screen.getByTestId(`${TID}-detail-close`)
    expect(close).toHaveAccessibleName('Close item details')
    fireEvent.click(close)
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
  })

  it('under a divider, not in a tinted card', () => {
    render(<ModelStrip isPreRun={false} openAtRest insights={RICH_INSIGHTS} />)
    fireEvent.click(mark('o1'))
    const cls = screen.getByTestId(`${TID}-detail`).className.split(' ')
    expect(cls).toContain('border-t')
    expect(cls.some((c) => c.startsWith('bg-'))).toBe(false)
  })

  it('three ICON-ONLY acts in the prototype order ✎ ⌖ ✦, named for what they do', () => {
    render(<ModelStrip isPreRun={false} openAtRest insights={RICH_INSIGHTS} />)
    fireEvent.click(mark('r1'))
    const propose = screen.getByTestId(`${TID}-detail-propose`)
    const focus = screen.getByTestId(`${TID}-detail-focus`)
    const ask = screen.getByTestId(`${TID}-detail-ask`)
    expect(propose).toHaveAccessibleName('Propose a change to this element')
    expect(focus).toHaveAccessibleName(COPY.modelStrip.showOnCanvas)
    expect(ask).toHaveAccessibleName('Ask Olumi about this item')
    for (const b of [propose, focus, ask]) expect((b.textContent ?? '').trim()).toBe('')
    expect(before(propose, focus) && before(focus, ask)).toBe(true)
  })

  it('the engine’s own finding is the bullet, verbatim', () => {
    render(<ModelStrip isPreRun={false} openAtRest insights={RICH_INSIGHTS} />)
    fireEvent.click(mark('o1'))
    const finding = screen.getByTestId(`${TID}-detail-finding`)
    expect(finding.tagName).toBe('LI')
    expect(screen.getByTestId(`${TID}-detail-finding-title`).textContent).toBe(ON_O1.title)
  })

  it('⛔ PRODUCER GAP: a node with no finding gets NO bullet — nothing the UI wrote stands in for the question', () => {
    render(<ModelStrip isPreRun={false} openAtRest insights={RICH_INSIGHTS} />)
    fireEvent.click(mark('r1'))
    expect(screen.getByTestId(`${TID}-detail`)).toBeInTheDocument()
    expect(screen.queryByTestId(`${TID}-detail-finding`)).toBeNull()
    expect(screen.getByTestId(`${TID}-detail`).querySelector('li')).toBeNull()
    // …and no denial stands in for it either: the absence line is gone.
    expect(screen.queryByTestId(`${TID}-detail-empty`)).toBeNull()
    expect(screen.getByTestId(`${TID}-detail`)).not.toHaveTextContent(COPY.modelStrip.noInsight)
    expect(screen.getByTestId(`${TID}-detail`)).not.toHaveTextContent(COPY.modelStrip.noInsightPreRun)
  })

  it('⛔ none of the strings the prototype lacks, even where the data for them exists', () => {
    render(<ModelStrip isPreRun={false} openAtRest insights={RICH_INSIGHTS} />)
    fireEvent.click(mark('o1'))
    const text = screen.getByTestId(`${TID}-detail`).textContent ?? ''
    // CONTRAST: this node HAS a driver label and a mention in the index.
    expect(RICH_INSIGHTS.get('o1')?.driverLabel).toBe('Adopt Segment')
    expect(RICH_INSIGHTS.get('o1')?.mentions.length).toBe(1)
    for (const gone of [
      COPY.glance.whatMattersMost,
      'Also in',
      COPY.modelStrip.noInsight,
      COPY.modelStrip.kindNoun.option,
    ]) {
      expect(text, gone).not.toContain(gone)
    }
    for (const id of ['detail-kind', 'detail-driver', 'detail-mentions', 'detail-empty', 'detail-verify']) {
      expect(screen.queryByTestId(`${TID}-${id}`), id).toBeNull()
    }
  })

  it('⛔ a factor carrying an unconfirmed estimate shows no amber chip — but keeps its value editor', () => {
    render(<ModelStrip isPreRun={false} openAtRest insights={RICH_INSIGHTS} />)
    fireEvent.click(mark('f7'))
    const detail = screen.getByTestId(`${TID}-detail`)
    expect(detail.textContent).not.toContain(UNCONFIRMED_ESTIMATE_LABEL)
    expect(screen.getByTestId(`${TID}-detail-value-edit`)).toHaveAttribute('data-node-id', 'f7')
  })
})

describe('a mark opens its detail on CLICK, as the prototype’s does', () => {
  it('pointing at a mark rings the node on the canvas but opens nothing', () => {
    render(<ModelStrip isPreRun={false} openAtRest insights={RICH_INSIGHTS} />)
    fireEvent.mouseEnter(mark('o2'))
    expect(highlightNode).toHaveBeenCalledWith('o2')
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
    fireEvent.focus(mark('o2'))
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
    // CONTRAST: the click opens it.
    fireEvent.click(mark('o2'))
    expect(screen.getByTestId(`${TID}-detail`)).toHaveAttribute('data-node-id', 'o2')
  })
})

describe('placement and routing — census → utilities → success line → review tool → detail', () => {
  const INTERVENTIONS = [ON_O1]
  const renderWithReview = () =>
    render(
      <ModelStrip
        isPreRun={false}
        openAtRest
        insights={RICH_INSIGHTS}
        reviewSlot={(slot) => (
          <ModelReviewTool interventions={INTERVENTIONS} onAsk={vi.fn()} {...slot} />
        )}
      />,
    )

  it('the detail sits after the success line and after the review tool', () => {
    renderWithReview()
    fireEvent.click(mark('r1'))
    fireEvent.click(screen.getByTestId(`${RID}-toggle`))
    const detail = screen.getByTestId(`${TID}-detail`)
    const success = screen.getByTestId(`${TID}-target`)
    const review = screen.getByTestId(`${RID}-item`)
    expect(before(screen.getByTestId(`${RID}-toggle`), success)).toBe(true)
    expect(before(success, review)).toBe(true)
    expect(before(review, detail)).toBe(true)
  })

  it('⭐ a mark about a node the queue holds opens the REVIEW TOOL at that item, and no detail', () => {
    renderWithReview()
    fireEvent.click(mark('f7'))
    const item = screen.getByTestId(`${RID}-item`)
    expect(item).toHaveAttribute('data-review-key', 'factor:f7')
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
  })

  it('…and a finding’s own target routes the same way', () => {
    renderWithReview()
    fireEvent.click(mark('o1'))
    expect(screen.getByTestId(`${RID}-item`)).toHaveAttribute('data-review-key', ON_O1.id)
    expect(screen.queryByTestId(`${TID}-detail`)).toBeNull()
  })

  it('CONTRAST: a mark about a node the queue does not hold opens its detail, and closes the review tool', () => {
    renderWithReview()
    fireEvent.click(mark('f7'))
    expect(screen.getByTestId(`${RID}-item`)).toBeInTheDocument()
    // f8 is the user's own value: not in the queue.
    fireEvent.click(mark('f8'))
    expect(screen.getByTestId(`${TID}-detail`)).toHaveAttribute('data-node-id', 'f8')
    expect(screen.queryByTestId(`${RID}-item`)).toBeNull()
    // The value editor is still on every factor's detail.
    expect(screen.getByTestId(`${TID}-detail-value-edit`)).toHaveAttribute('data-node-id', 'f8')
  })
})
