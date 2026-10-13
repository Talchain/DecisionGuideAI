/** U7 retires the general compact fold. Keep content, category, identity and consent coverage. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type {
  ConversationBlock,
  GraphPatchBlock,
  V5CoachingBlock,
  V5EvidenceBlock,
  V5ReviewCardBlock,
} from '../types'

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

/**
 * A legacy flag override must not restore the retired general fold.
 * Both values render full cards; consent-specific disclosure is tested separately.
 */
vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isCompactCoachingLinesEnabled: () => flagState.enabled }
})
const flagState = { enabled: true }

beforeEach(() => { flagState.enabled = true })
afterEach(() => { flagState.enabled = true })

// ── Producer fixtures ───────────────────────────────────────────────────────
// Titles are the real strings from the reported turn, so a truncation defect
// shows up as the sentence the user actually lost.

const ANCHORING_TITLE = 'Anchoring'
const TECHNIQUE_TITLE = 'Give Pro Feature Release Quality a level'
const NARROW_TITLE = 'Narrow framing'

function coaching(
  n: number,
  over: Partial<V5CoachingBlock> = {},
): V5CoachingBlock {
  return {
    type: 'v5_coaching',
    block_id: `co_${n}`,
    title: `Coaching card ${n}`,
    body: `Coaching body ${n}`,
    coaching_kind: 'assumption_check',
    source: 'decision_review',
    target_refs: [],
    priority_rank: 10 + n,
    freshness: 'fresh',
    ...over,
  }
}

function reviewCard(n: number): V5ReviewCardBlock {
  return {
    type: 'v5_review_card',
    block_id: `rc_${n}`,
    title: `Review card ${n}`,
    body: `Review body ${n}`,
    severity: 'info',
    card_kind: 'narrative',
    target_refs: [],
    priority_rank: n,
    freshness: 'fresh',
  }
}

/** Carries NO `title` field at all — the live fail-closed instance. */
function evidence(n: number, over: Partial<Record<string, unknown>> = {}): V5EvidenceBlock {
  return {
    type: 'v5_evidence',
    block_id: `ev_${n}`,
    // `factor_label` is what this renderer actually puts on screen — checked at
    // V5EvidenceBlock.tsx rather than guessed, so the assertion below binds to
    // rendered output and not to a field the component ignores.
    factor_label: `Evidence factor ${n}`,
    current_confidence: 0.6,
    severity: 'info',
    target_refs: [],
    priority_rank: n,
    freshness: 'fresh',
    ...over,
  } as unknown as V5EvidenceBlock
}

function graphPatch(): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch_consent_1',
    summary: 'Add a competitor-response factor',
    status: 'proposed',
    operations: [],
  } as unknown as GraphPatchBlock
}

const renderBlocks = (blocks: ConversationBlock[]) =>
  render(<InlineBlocks blocks={blocks} turnId="turn_1" patchBlockStates={new Map()} />)

/** The summary line for one producer block, found by that block's own id. */
const lineFor = (blockId: string) => screen.queryByTestId(`coaching-line-${blockId}`)

const cardFor = (id: string) => document.querySelector(`[data-block-id="${id}"]`) as HTMLElement

describe('U7: ordinary coaching stays expanded', () => {
  it('keeps every producer title and body verbatim', () => {
    renderBlocks([
      coaching(1, { title: NARROW_TITLE }),
      coaching(2, { title: TECHNIQUE_TITLE }),
      coaching(3, { title: ANCHORING_TITLE }),
    ])
    for (const title of [NARROW_TITLE, TECHNIQUE_TITLE, ANCHORING_TITLE]) {
      expect(screen.getByRole('heading', { name: title, exact: true })).toBeVisible()
    }
    for (const n of [1, 2, 3]) {
      expect(lineFor(`co_${n}`)).toBeNull()
      expect(within(cardFor(`co_${n}`)).getByText(`Coaching body ${n}`)).toBeVisible()
    }
  })

  it('keeps the category without inventing one for an uncategorised card', () => {
    renderBlocks([coaching(1, { category: 'should_fix' }), coaching(2)])
    expect(within(cardFor('co_1')).getByText('Should fix')).toBeVisible()
    for (const label of ['Must fix', 'Should fix', 'Could fix', 'Technique']) {
      expect(within(cardFor('co_2')).queryByText(label)).toBeNull()
    }
  })

  it.each([false, true])('keeps bodies visible even with legacy compact flag=%s', (enabled) => {
    flagState.enabled = enabled
    renderBlocks([coaching(1), coaching(2)])
    expect(lineFor('co_1')).toBeNull()
    expect(lineFor('co_2')).toBeNull()
    expect(screen.getByText('Coaching body 1')).toBeVisible()
    expect(screen.getByText('Coaching body 2')).toBeVisible()
  })

  it('does not lose a body whose producer title is blank', () => {
    renderBlocks([coaching(1, { title: '   ', body: 'BLANK TITLE BODY' })])
    expect(lineFor('co_1')).toBeNull()
    expect(screen.getByText('BLANK TITLE BODY')).toBeVisible()
  })

  it('keeps evidence factor labels and evidence gaps visible', () => {
    renderBlocks([evidence(1, { evidence_gap: 'Check demand' })])
    expect(lineFor('ev_1')).toBeNull()
    expect(screen.getByText('Evidence factor 1')).toBeVisible()
    expect(screen.getByText(/Check demand/)).toBeVisible()
  })

  it('keeps evidence with no title or factor label', () => {
    renderBlocks([evidence(2, { factor_label: '   ', evidence_gap: 'NO LABEL BODY' })])
    expect(lineFor('ev_2')).toBeNull()
    expect(screen.getByText(/NO LABEL BODY/)).toBeVisible()
  })

  it('keeps graph-patch consent visible beside expanded coaching', () => {
    renderBlocks([graphPatch(), coaching(1)])
    expect(lineFor('co_1')).toBeNull()
    expect(screen.getByText('Coaching body 1')).toBeVisible()
    expect(lineFor('patch_consent_1')).toBeNull()
    expect(screen.getByText(/Add a competitor-response factor/)).toBeVisible()
  })

  it('keeps review titles and bodies visible', () => {
    renderBlocks([reviewCard(1)])
    expect(lineFor('rc_1')).toBeNull()
    expect(screen.getByText('Review card 1')).toBeVisible()
    expect(screen.getByText('Review body 1')).toBeVisible()
  })

  it.each([
    [[], []],
    [[{ id: 'f1', kind: 'factor', label: 'Churn' }], [{ id: 'f1', kind: 'factor', label: 'Churn' }]],
    [[{ id: 'f1', kind: 'factor', label: 'Churn' }], [{ id: 'f2', kind: 'factor', label: 'Revenue' }]],
  ])('keeps same-title blocks distinct by their bodies and identities (%j, %j)', (firstRefs, secondRefs) => {
    renderBlocks([
      coaching(1, { title: 'An assumption to check', target_refs: firstRefs }),
      coaching(2, { title: 'An assumption to check', target_refs: secondRefs }),
    ] as ConversationBlock[])
    for (const n of [1, 2]) {
      expect(lineFor(`co_${n}`)).toBeNull()
      const card = within(cardFor(`co_${n}`))
      expect(card.getByText('An assumption to check')).toBeVisible()
      expect(card.getByText(`Coaching body ${n}`)).toBeVisible()
    }
  })
})
