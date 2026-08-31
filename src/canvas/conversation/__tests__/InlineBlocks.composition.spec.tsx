/**
 * InlineBlocks — the COMPOSITION render contract (PX-B, Paul's 15 Aug ruling).
 *
 * ## What this file supersedes, and why it is one file instead of three
 *
 * It replaces the render halves of three specs that pinned the OLD exposure
 * rules, all of which are now dead code paths rather than failing assertions:
 *
 *   · InlineBlocks.phase3Pacing.spec.tsx  — pinned PHASE3_DEFAULT_EXPANDED = 6
 *       cards default-expanded. The cap is now 3 TOP-LEVEL items (MAX_POINTS).
 *   · InlineBlocks.companionSlot.spec.tsx — pinned ROADMAP 2.242's reservation
 *       at a cap of 6. The reservation is CARRIED FORWARD inside the new cap;
 *       its unit-level pins live in messageComposition.spec.ts, and its render
 *       behaviour is pinned below.
 *   · InlineBlocks.biasSignalBudget.spec.tsx — pinned bias-signal coaching as
 *       exempt from BOTH old budgets. There is now ONE budget, and bias
 *       coaching is a point candidate like any other card, in producer order.
 *
 * The pure-function specs those files depended on are UNTOUCHED and still run:
 * phase3Pacing.companionSlot.spec.ts and the phase3Pacing module itself.
 *
 * ⚠ Two of the three superseded rulings were founder rulings (2.211-② and the
 * review-folds C1 bias exemption). They are superseded DELIBERATELY by the
 * 15 Aug ruling, not lost — flagged in the handback for adjudication rather
 * than quietly rewritten.
 *
 * Assertions bind blocks by their own titles/testids — identity — never by a
 * count another block could satisfy (platform trap 19).
 */
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import { MAX_POINTS } from '../messageComposition'
import type {
  ConversationBlock,
  FactBlock,
  GraphPatchBlock,
  ReviewCardBlock,
  V5CoachingBlock,
  V5EvidenceBlock,
  V5ExerciseBlock,
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
/**
 * LEGACY `review_card` — a point candidate that is NOT a phase-3 card type.
 * The only block shape that can occupy a top-level slot without satisfying
 * `isPhase3CardBlock`, which makes it the only way to exercise the C13 legend
 * gate (see the legend describe at the foot of this file).
 */
function legacyReviewCard(n: number): ReviewCardBlock {
  return {
    type: 'review_card', title: `Legacy review ${n}`,
    body: `Legacy review body ${n}`, variant: 'info',
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
function lensCompanion(): V5ExerciseBlock {
  return {
    type: 'v5_exercise', block_id: 'ex_lens', exercise_kind: 'pre_mortem',
    failure_scenario: 'The pilot stalls at procurement.',
    target_refs: [], freshness: 'fresh',
  } as unknown as V5ExerciseBlock
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

const detailToggle = () => screen.getByTestId('block-detail-toggle')

describe('InlineBlocks — top-level exposure is capped at MAX_POINTS', () => {
  it('a 10-card flood exposes exactly 3 cards, not 6 and not 12', () => {
    render(<InlineBlocks blocks={floodBlocks()} />)
    expect(screen.getByText('Review card 1')).toBeInTheDocument()
    expect(screen.getByText('Review card 2')).toBeInTheDocument()
    expect(screen.getByText('Review card 3')).toBeInTheDocument()
    // Card 4 onwards is demoted — bound by identity, not by a count.
    expect(screen.queryByText('Review card 4')).not.toBeInTheDocument()
    expect(screen.queryByText('Coaching card 1')).not.toBeInTheDocument()
    expect(screen.queryByText('Evidence factor 1')).not.toBeInTheDocument()
  })

  it('the remainder sits behind exactly ONE affordance carrying the count', () => {
    render(<InlineBlocks blocks={floodBlocks()} />)
    const toggles = screen.getAllByTestId('block-detail-toggle')
    expect(toggles).toHaveLength(1)
    expect(toggles[0]).toHaveAttribute('aria-label', 'Show 7 more supporting items')
    expect(toggles[0]).toHaveAttribute('aria-expanded', 'false')
  })

  it('ONE interaction reveals every demoted block, in producer order', () => {
    render(<InlineBlocks blocks={floodBlocks()} />)
    fireEvent.click(detailToggle())
    const body = screen.getByTestId('block-detail-body')
    for (const label of [
      'Review card 4', 'Review card 5',
      'Coaching card 1', 'Coaching card 2', 'Coaching card 3', 'Coaching card 4',
      'Evidence factor 1',
    ]) {
      expect(within(body).getByText(label)).toBeInTheDocument()
    }
    // Producer order preserved inside the disclosure.
    const rendered = within(body).getAllByText(/Review card|Coaching card|Evidence factor/)
      .map((el) => el.textContent)
    expect(rendered).toEqual([
      'Review card 4', 'Review card 5',
      'Coaching card 1', 'Coaching card 2', 'Coaching card 3', 'Coaching card 4',
      'Evidence factor 1',
    ])
  })

  it('nothing is dropped — every block is on screen once the disclosure is open', () => {
    const blocks = floodBlocks()
    render(<InlineBlocks blocks={blocks} />)
    fireEvent.click(detailToggle())
    for (const label of [
      'Review card 1', 'Review card 2', 'Review card 3', 'Review card 4', 'Review card 5',
      'Coaching card 1', 'Coaching card 2', 'Coaching card 3', 'Coaching card 4',
      'Evidence factor 1',
    ]) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
  })

  it('closing the disclosure hides the demoted blocks again', () => {
    render(<InlineBlocks blocks={floodBlocks()} />)
    fireEvent.click(detailToggle())
    expect(screen.getByText('Review card 4')).toBeInTheDocument()
    fireEvent.click(detailToggle())
    expect(screen.queryByText('Review card 4')).not.toBeInTheDocument()
  })

  it('a turn at the cap renders no affordance at all', () => {
    render(<InlineBlocks blocks={[reviewCard(1), reviewCard(2), reviewCard(3)]} />)
    expect(screen.queryByTestId('block-detail-toggle')).not.toBeInTheDocument()
    expect(screen.getByText('Review card 3')).toBeInTheDocument()
  })

  it('the card one past the cap is the first to be demoted', () => {
    render(<InlineBlocks blocks={[reviewCard(1), reviewCard(2), reviewCard(3), reviewCard(4)]} />)
    expect(detailToggle()).toHaveAttribute('aria-label', 'Show 1 more supporting item')
    expect(screen.queryByText('Review card 4')).not.toBeInTheDocument()
  })

  it('exposes at most MAX_POINTS non-pinned cards for every flood size', () => {
    for (const n of [4, 8, 14]) {
      const { unmount } = render(
        <InlineBlocks blocks={Array.from({ length: n }, (_, i) => reviewCard(i + 1))} />,
      )
      const visible = [...Array(n)].filter((_, i) =>
        screen.queryByText(`Review card ${i + 1}`) !== null).length
      expect(visible).toBe(MAX_POINTS)
      unmount()
    }
  })
})

describe('InlineBlocks — a small turn is never hidden behind the disclosure', () => {
  it('renders a lone fact block at top level with no affordance', () => {
    render(<InlineBlocks blocks={[factBlock]} />)
    expect(screen.getByTestId('block-fact')).toBeInTheDocument()
    expect(screen.queryByTestId('block-detail-toggle')).not.toBeInTheDocument()
  })

  it('never leaves the top level empty while anything is demoted', () => {
    render(<InlineBlocks blocks={[factBlock, reviewCard(1)]} />)
    const container = screen.getByTestId('block-container')
    expect(screen.queryByTestId('block-detail-body')).not.toBeInTheDocument()
    expect(within(container).getByText('Review card 1')).toBeInTheDocument()
    expect(within(container).getByTestId('block-fact')).toBeInTheDocument()
  })
})

describe('InlineBlocks — pinned blocks survive the cap (consent stays visible)', () => {
  it('keeps a proposed graph patch top-level behind a full flood', () => {
    render(<InlineBlocks blocks={[...floodBlocks(), patchBlock]} />)
    // The patch is pinned: present WITHOUT opening the disclosure.
    expect(screen.queryByTestId('block-detail-body')).not.toBeInTheDocument()
    expect(document.querySelector('[data-patch-id="p_1"]')).not.toBeNull()
  })

  it('a pinned patch does not consume a point slot', () => {
    render(<InlineBlocks blocks={[patchBlock, reviewCard(1), reviewCard(2), reviewCard(3)]} />)
    expect(screen.queryByTestId('block-detail-toggle')).not.toBeInTheDocument()
    expect(screen.getByText('Review card 3')).toBeInTheDocument()
  })
})

describe('InlineBlocks — ROADMAP 2.242 lens companion, carried into the new cap', () => {
  it('promotes an overflowed companion into the top level', () => {
    // 4 review cards then the companion: without the reservation the companion
    // would be demoted (it is 5th of 5 candidates).
    render(<InlineBlocks blocks={[reviewCard(1), reviewCard(2), reviewCard(3), reviewCard(4), lensCompanion()]} />)
    expect(screen.getByText(/The pilot stalls at procurement/)).toBeInTheDocument()
    expect(screen.queryByTestId('block-detail-body')).not.toBeInTheDocument()
  })

  it('promotes by DISPLACING a card, never by opening a fourth slot', () => {
    render(<InlineBlocks blocks={[reviewCard(1), reviewCard(2), reviewCard(3), reviewCard(4), lensCompanion()]} />)
    // Card 3 is displaced to make room; cards 1 and 2 keep their slots.
    expect(screen.getByText('Review card 1')).toBeInTheDocument()
    expect(screen.getByText('Review card 2')).toBeInTheDocument()
    expect(screen.queryByText('Review card 3')).not.toBeInTheDocument()
  })

  it('demotes the displaced card rather than dropping it', () => {
    render(<InlineBlocks blocks={[reviewCard(1), reviewCard(2), reviewCard(3), reviewCard(4), lensCompanion()]} />)
    fireEvent.click(detailToggle())
    const body = screen.getByTestId('block-detail-body')
    expect(within(body).getByText('Review card 3')).toBeInTheDocument()
    expect(within(body).getByText('Review card 4')).toBeInTheDocument()
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

  it('demotes — never drops — bias cards the producer put after the cap', () => {
    render(<InlineBlocks blocks={[...floodBlocks(), biasCoaching(9)]} />)
    expect(screen.queryByText('Bias card 9')).not.toBeInTheDocument()
    fireEvent.click(detailToggle())
    expect(within(screen.getByTestId('block-detail-body')).getByText('Bias card 9')).toBeInTheDocument()
  })
})

describe('InlineBlocks — accessibility of the single disclosure', () => {
  it('announces the demoted count as static sr-only text, not a live region', () => {
    const { container } = render(<InlineBlocks blocks={floodBlocks()} />)
    expect(screen.getByText(/7 more supporting items available/i)).toBeInTheDocument()
    expect(container.querySelector('[role="status"]')).toBeNull()
    expect(container.querySelector('[aria-live]')).toBeNull()
  })

  it('reflects expansion in aria-expanded and the accessible name', () => {
    render(<InlineBlocks blocks={floodBlocks()} />)
    fireEvent.click(detailToggle())
    expect(detailToggle()).toHaveAttribute('aria-expanded', 'true')
    expect(detailToggle()).toHaveAttribute('aria-label', 'Hide supporting detail')
  })

  it('singularises the count for a single demoted item', () => {
    render(<InlineBlocks blocks={[reviewCard(1), reviewCard(2), reviewCard(3), reviewCard(4)]} />)
    expect(screen.getByText(/1 more supporting item available/i)).toBeInTheDocument()
  })
})

describe('InlineBlocks — demotion is presentational only', () => {
  it('renders a demoted block through its own renderer, unchanged', () => {
    // The fact block's own renderer (block-fact, with its value) must appear
    // inside the disclosure exactly as it would at top level.
    render(<InlineBlocks blocks={[...floodBlocks(), factBlock]} />)
    fireEvent.click(detailToggle())
    const body = screen.getByTestId('block-detail-body')
    expect(within(body).getByTestId('block-fact')).toBeInTheDocument()
    expect(within(body).getByText('12%')).toBeInTheDocument()
    expect(within(body).getByText('Expected lift')).toBeInTheDocument()
  })

  it('keeps citation targets bound to the ORIGINAL block index after demotion', () => {
    const blocks = floodBlocks()
    render(<InlineBlocks blocks={blocks} />)
    fireEvent.click(detailToggle())
    // Block index 9 (evidence) keeps citation target 10 despite being demoted.
    expect(document.querySelector('[data-citation-target="10"]')).not.toBeNull()
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

  it('C13: withholds the legend while every phase-3 card is demoted, and offers it once revealed', () => {
    // ⚠ THE FIXTURE IS THE WHOLE POINT HERE, so read before simplifying it.
    // Reaching this gate requires the three top-level slots to be taken by
    // point candidates that are NOT phase-3 cards. Legacy `review_card` is the
    // only such type: every V5 phase-3 type (v5_review_card, v5_coaching,
    // v5_evidence, v5_exercise) is ALSO a point candidate, and candidates take
    // first claim on the slots — so on an all-V5 turn a phase-3 card is always
    // exposed and this arm cannot fire. An earlier draft of this test used
    // [fact, v5_review_card] and was VACUOUS: with 2 blocks and MAX_POINTS = 3
    // nothing was demoted at all, and it passed for the wrong reason until the
    // control below caught it.
    const blocks: ConversationBlock[] = [
      legacyReviewCard(1), legacyReviewCard(2), legacyReviewCard(3), coaching(1),
    ]
    render(<InlineBlocks blocks={blocks} />)
    // Controls, both directions: the phase-3 card really IS demoted, and the
    // top level really IS occupied. Without these the withheld-legend
    // assertion below is consistent with an empty turn.
    expect(screen.queryByText('Coaching card 1')).not.toBeInTheDocument()
    expect(screen.getByText('Legacy review 1')).toBeInTheDocument()

    expect(legendToggle()).not.toBeInTheDocument()

    // Opposite-direction twin: reveal the demoted card and the primer appears.
    fireEvent.click(detailToggle())
    expect(screen.getByText('Coaching card 1')).toBeInTheDocument()
    expect(legendToggle()).toBeInTheDocument()
  })
})
