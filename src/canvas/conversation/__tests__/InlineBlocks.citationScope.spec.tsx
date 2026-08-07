/**
 * Citation scope — a citation click must resolve within its OWN turn.
 *
 * `data-citation-target` is emitted 1-based PER TURN (InlineBlocks renders
 * `data-citation-target={i + 1}` over that turn's own block list), so in a
 * thread with several assistant turns on screen EVERY turn carries a
 * `data-citation-target="1"`, a `"2"`, and so on. The click handler used to
 * resolve the target with an UNSCOPED `document.querySelector(...)`, which
 * returns the FIRST match in document order — i.e. the OLDEST turn's block.
 * A citation clicked in turn 5 scrolled the user to turn 1.
 *
 * The lookup is now scoped to the emitting InlineBlocks instance's own block
 * container, so a citation resolves within its turn or not at all.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import type {
  BriefBlock,
  CommentaryBlock,
  ConversationBlock,
  FactBlock,
  FramingBlock,
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

function factBlock(label: string): FactBlock {
  return { type: 'fact', value: '42%', label, fact_type: 'simple' }
}

function citing(index: number, text: string): CommentaryBlock {
  return {
    type: 'commentary',
    text: `${text} [${index}]`,
    citations: [{ index, source: `Source ${index}` }],
  }
}

const framing: FramingBlock = { type: 'framing', goal: 'A goal', options: [] }
const brief: BriefBlock = { type: 'brief', title: 'A brief', summary: 'Summary.' }

/** Elements whose scrollIntoView was invoked, in call order. */
let scrolled: Element[]

beforeEach(() => {
  scrolled = []
  Element.prototype.scrollIntoView = function (this: Element) {
    scrolled.push(this)
  } as unknown as typeof Element.prototype.scrollIntoView
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('citation scope — the lookup is scoped to the emitting turn', () => {
  it('a citation clicked in the SECOND turn scrolls that turn\'s block, not the first turn\'s same-index block', () => {
    // Both turns emit a block at data-citation-target="2". Pre-fix the
    // unscoped document query resolved turn one's.
    const turnOne: ConversationBlock[] = [
      citing(2, 'Turn one commentary.'),
      factBlock('Turn one fact'),
    ]
    const turnTwo: ConversationBlock[] = [
      citing(2, 'Turn two commentary.'),
      factBlock('Turn two fact'),
    ]

    render(
      <div>
        <div data-testid="turn-1"><InlineBlocks blocks={turnOne} turnId="t1" /></div>
        <div data-testid="turn-2"><InlineBlocks blocks={turnTwo} turnId="t2" /></div>
      </div>,
    )

    // Sanity: the ambiguity this test is about genuinely exists in the DOM.
    expect(document.querySelectorAll('[data-citation-target="2"]')).toHaveLength(2)

    const turn2 = screen.getByTestId('turn-2')
    fireEvent.click(within(turn2).getByRole('button', { name: /citation 2/i }))

    expect(scrolled).toHaveLength(1)
    expect(scrolled[0].textContent).toContain('Turn two fact')
    expect(scrolled[0].textContent).not.toContain('Turn one fact')
    // And the scrolled node really is inside turn two's subtree.
    expect(turn2.contains(scrolled[0])).toBe(true)
  })

  it('a citation whose index exists only in an EARLIER turn is a silent no-op, never a cross-turn scroll', () => {
    // Turn one has four blocks (target "4" = the brief); turn two has two, so
    // its citation [4] is dangling WITHIN its own turn. Pre-fix the unscoped
    // query happily found turn one's brief and scrolled there.
    const turnOne: ConversationBlock[] = [
      citing(2, 'Turn one commentary.'),
      factBlock('Turn one fact'),
      framing,
      brief,
    ]
    const turnTwo: ConversationBlock[] = [
      citing(4, 'Turn two commentary.'),
      factBlock('Turn two fact'),
    ]

    render(
      <div>
        <div data-testid="turn-1"><InlineBlocks blocks={turnOne} turnId="t1" /></div>
        <div data-testid="turn-2"><InlineBlocks blocks={turnTwo} turnId="t2" /></div>
      </div>,
    )

    // The cross-turn target the unscoped query used to reach really is present.
    expect(document.querySelectorAll('[data-citation-target="4"]')).toHaveLength(1)

    const turn2 = screen.getByTestId('turn-2')
    fireEvent.click(within(turn2).getByRole('button', { name: /citation 4/i }))

    expect(scrolled).toHaveLength(0)
  })

  it('a within-turn citation in the FIRST turn still scrolls (scoping does not break the happy path)', () => {
    const turnOne: ConversationBlock[] = [
      citing(2, 'Turn one commentary.'),
      factBlock('Turn one fact'),
    ]
    const turnTwo: ConversationBlock[] = [
      citing(2, 'Turn two commentary.'),
      factBlock('Turn two fact'),
    ]

    render(
      <div>
        <div data-testid="turn-1"><InlineBlocks blocks={turnOne} turnId="t1" /></div>
        <div data-testid="turn-2"><InlineBlocks blocks={turnTwo} turnId="t2" /></div>
      </div>,
    )

    const turn1 = screen.getByTestId('turn-1')
    fireEvent.click(within(turn1).getByRole('button', { name: /citation 2/i }))

    expect(scrolled).toHaveLength(1)
    expect(scrolled[0].textContent).toContain('Turn one fact')
    expect(turn1.contains(scrolled[0])).toBe(true)
  })
})
