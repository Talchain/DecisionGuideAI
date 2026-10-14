/** U7: every block renders in producer order, including repeats; consent stays reachable. */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type {
  ConversationBlock,
  FactBlock,
  GraphPatchBlock,
  V5CoachingBlock,
  V5EvidenceBlock,
  V5ReviewCardBlock,
} from '../types'
import { DECISION_NODE_LABEL } from '../../domain/vocabulary'

vi.mock('../../store', () => {
  const mockState = {
    nodes: [] as Array<{ id: string }>,
    selectNodeWithoutHistory: vi.fn(),
    selectNodes: vi.fn(),
    setShowInspectorPanel: vi.fn(),
    setHighlightedNodes: vi.fn(),
    setHighlightedEdges: vi.fn(),
  }
  return {
    useCanvasStore: Object.assign(
      (selector: (s: unknown) => unknown) => selector(mockState),
      { getState: () => mockState },
    ),
  }
})

function reviewCard(n: number): V5ReviewCardBlock {
  return {
    type: 'v5_review_card', block_id: `rc_${n}`, title: `Review card ${n}`,
    body: `Review body ${n}`, severity: 'info', card_kind: 'narrative',
    target_refs: [], priority_rank: n, freshness: 'fresh',
  }
}
function coaching(n: number): V5CoachingBlock {
  return {
    type: 'v5_coaching', block_id: `co_${n}`, title: `Coaching card ${n}`,
    body: `Coaching body ${n}`, coaching_kind: 'assumption_check',
    source: 'decision_review', target_refs: [], priority_rank: 10 + n, freshness: 'fresh',
  }
}
function biasCoaching(n: number): V5CoachingBlock {
  return { ...coaching(n), block_id: `bias_${n}`, title: `Bias card ${n}`, coaching_kind: 'bias_signal' }
}
function evidence(n: number): V5EvidenceBlock {
  return {
    type: 'v5_evidence', block_id: `ev_${n}`, factor_label: `Evidence factor ${n}`,
    target_refs: [], current_confidence: 'low', evidence_gap: `Gap ${n}`,
    suggested_technique: `Technique ${n}`, impact_if_gathered: `Impact ${n}`,
    priority_rank: 20 + n, severity: 'info', freshness: 'fresh',
  }
}
const factBlock: FactBlock = { type: 'fact', label: 'Expected lift', value: '12%' }
const patchBlock: GraphPatchBlock = {
  type: 'graph_patch', patch_id: 'p_1', status: 'proposed',
  operations: [{ op: 'add_node', node: { id: 'n1', label: 'New factor', type: 'factor' } }],
} as unknown as GraphPatchBlock

/** The live flood shape: 5 review + 4 coaching + 1 evidence in one turn. */
const floodBlocks = (): ConversationBlock[] => [
  reviewCard(1), reviewCard(2), reviewCard(3), reviewCard(4), reviewCard(5),
  coaching(1), coaching(2), coaching(3), coaching(4), evidence(1),
]


describe('U7: full block rendering', () => {
  it('all ten cards render at rest in producer order, without a detail fold', () => {
    const { container } = render(<InlineBlocks blocks={floodBlocks()} />)
    expect(Array.from(container.querySelectorAll('[data-citation-target]')).map(el => el.getAttribute('data-citation-target')))
      .toEqual(Array.from({ length: 10 }, (_, i) => String(i + 1)))
    expect(screen.getByText('Review body 5')).toBeVisible()
    expect(screen.getByText('Coaching body 4')).toBeVisible()
    expect(screen.queryByTestId('block-detail-toggle')).toBeNull()
    expect(container.querySelector('[data-testid^="coaching-line-"]')).toBeNull()
  })

  it('keeps repeated producer prose in each block, even when already in the reply', () => {
    const repeated = 'The range reflects an untested assumption.'
    const blocks = floodBlocks().map(block => block.type === 'v5_coaching' ? { ...block, body: repeated } : block)
    const { container } = render(<InlineBlocks blocks={blocks} alreadyRendered={[repeated]} />)
    for (const index of [6, 7, 8, 9]) {
      expect(container.querySelector(`[data-citation-target="${index}"]`)).toHaveTextContent(repeated)
    }
  })
})

describe('InlineBlocks — a small turn is never hidden behind the disclosure', () => {
  it('renders a lone fact block at top level with no affordance', () => {
    render(<InlineBlocks blocks={[factBlock]} />)
    expect(screen.getByTestId('block-fact')).toBeInTheDocument()
    expect(screen.queryByTestId('block-detail-toggle')).not.toBeInTheDocument()
  })
})

describe('InlineBlocks — pinned blocks survive the cap (consent stays visible)', () => {
  it('keeps a proposed graph patch top-level behind a full flood', () => {
    render(<InlineBlocks blocks={[...floodBlocks(), patchBlock]} />)
    // The patch is pinned: present WITHOUT opening the disclosure.
    expect(screen.queryByTestId('block-detail-body')).not.toBeInTheDocument()
    expect(document.querySelector('[data-patch-id="p_1"]')).not.toBeNull()
  })
})

describe('InlineBlocks — bias-signal coaching under the single budget', () => {
  /**
   * SUPERSEDED RULING, stated rather than hidden: review-folds C1 made
   * bias-signal cards exempt from both old budgets so they always rendered.
   * Under ONE cap they are ordinary point candidates in producer order — which
   * means a bias card the producer emits FIRST is exposed, and one it emits
   * after three other cards is demoted. Nothing is dropped either way.
   */
  it('exposes bias cards the producer put first', () => {
    render(<InlineBlocks blocks={[biasCoaching(1), biasCoaching(2), ...floodBlocks()]} />)
    expect(screen.getByText('Bias card 1')).toBeInTheDocument()
    expect(screen.getByText('Bias card 2')).toBeInTheDocument()
  })
})

/**
 * MIGRATED from the deleted InlineBlocks.phase3Pacing.spec.tsx (its two legend
 * cases). The legend is NOT part of the superseded budget mechanics — it is a
 * live affordance `InlineBlocks` still renders, and deleting the pacing spec
 * took its only coverage with it. Both original cases are carried over intact.
 *
 * ⚠ AND ITS GATING CHANGED IN THIS BRANCH, which is why re-pinning it matters
 * rather than being tidy-up. The legend gates on `phase3Rendered` — a phase-3
 * card being CURRENTLY RENDERED, not merely present in the turn. Under the old
 * cap of 6 the distinction was nearly unobservable; under a cap of 3 the flood
 * turn routinely puts cards inside a CLOSED disclosure, so a presence-based
 * gate would offer a vocabulary primer for cards the user cannot see. The third
 * case below is the arm that did not exist before and pins exactly that.
 */
describe('InlineBlocks — graph-vocabulary legend affordance (F16, migrated)', () => {
  const legendToggle = () => screen.queryByRole('button', { name: /what do these terms mean/i })

  it('offers "What do these terms mean?" near phase-3 cards and reveals the legend on demand', () => {
    render(<InlineBlocks blocks={floodBlocks()} />)
    const toggle = legendToggle()
    expect(toggle).toHaveAttribute('aria-expanded', 'false')
    fireEvent.click(toggle!)
    expect(toggle).toHaveAttribute('aria-expanded', 'true')
    // Every canvas node kind must be defined: 'Outcome' was once missing while
    // the canvas's own "How to read this" key listed it, so a card pointing at
    // an outcome node referred to vocabulary this primer did not define.
    // The node-type word comes from the vocabulary constant — see
    // `canvas/domain/vocabulary.ts`. A literal here would be a second mirror.
    for (const term of [DECISION_NODE_LABEL, 'Factor', 'Option', 'Outcome', 'Goal', 'Risk', 'Constraint', 'Link']) {
      expect(screen.getByText(term)).toBeInTheDocument()
    }
  })

  it('renders no legend affordance when the turn has no phase-3 cards', () => {
    render(<InlineBlocks blocks={[factBlock]} />)
    expect(legendToggle()).not.toBeInTheDocument()
  })
})
