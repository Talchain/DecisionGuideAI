/** U7: ordinary coaching renders as full cards. Category semantics remain covered. */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { InlineBlocks } from '../InlineBlocks'
import { guidanceCategoryIcon, guidanceCategoryTone } from '../../stores/guidanceStore'
import type { GuidanceCategory } from '../../stores/guidanceStore'
import type { ConversationBlock, GraphPatchBlock, V5CoachingBlock } from '../types'

vi.mock('../../../flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../flags')>()
  return { ...actual, isCompactCoachingLinesEnabled: () => flagState.enabled }
})
const flagState = { enabled: true }

beforeEach(() => { flagState.enabled = true })
afterEach(() => { flagState.enabled = true })

function coaching(n: number, over: Partial<V5CoachingBlock> = {}): V5CoachingBlock {
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

/** Pinned: never collapses, so it is always a CARD and must always keep its dot. */
function graphPatch(): GraphPatchBlock {
  return {
    type: 'graph_patch',
    patch_id: 'patch_1',
    summary: 'Add a competitor-response factor',
    status: 'proposed',
    operations: [],
  } as unknown as GraphPatchBlock
}

const renderBlocks = (blocks: ConversationBlock[]) =>
  render(<InlineBlocks blocks={blocks} turnId="turn_1" patchBlockStates={new Map()} />)

const glyphClassesIn = (blockId: string): string =>
  Array.from(
    document.querySelector(`[data-block-id="${blockId}"]`)!.querySelectorAll('svg'),
  )
    .map((svg) => svg.getAttribute('class') ?? '')
    .join(' ')

// ---------------------------------------------------------------------------
// 1. The glyph resolves all FOUR producer categories, not two tones
// ---------------------------------------------------------------------------

const EXPECTED_GLYPH: Record<GuidanceCategory, string> = {
  must_fix: 'lucide-alert-triangle',
  should_fix: 'lucide-alert-circle',
  could_fix: 'lucide-wrench',
  technique: 'lucide-graduation-cap',
}

describe('the category glyph separates all four producer categories by SHAPE', () => {
  it('maps each of the four categories to a DISTINCT glyph', () => {
    const cats = Object.keys(EXPECTED_GLYPH) as GuidanceCategory[]
    expect(cats, 'the producer taxonomy is four-valued').toHaveLength(4)
    const glyphs = cats.map((c) => guidanceCategoryIcon(c).Icon)
    expect(
      new Set(glyphs).size,
      'two categories sharing a glyph is the binary defect returning',
    ).toBe(4)
  })

  it.each(Object.entries(EXPECTED_GLYPH))(
    'renders %s as %s on the full card',
    (category, expectedGlyph) => {
      renderBlocks([coaching(1, { category } as Partial<V5CoachingBlock>)])
      expect(glyphClassesIn('co_1')).toContain(expectedGlyph)
    },
  )

  it('keeps TINT derived from tone, so colour still means urgency and shape means kind', () => {
    // Not a re-derivation: this asserts the icon's tint AGREES with the tone
    // authority rather than restating a colour table of its own.
    for (const cat of Object.keys(EXPECTED_GLYPH) as GuidanceCategory[]) {
      const { tintClass } = guidanceCategoryIcon(cat)
      const expected = guidanceCategoryTone(cat) === 'danger' ? 'text-danger' : 'text-info'
      expect(tintClass, `${cat} must ride its tone's colour channel`).toBe(expected)
    }
  })

  it('CONTROL — an UNCATEGORISED item still shows the info Lightbulb (honest absence)', () => {
    // Preserved deliberately: absence is its own state and must never be
    // dressed as one of the four. This is the arm that stops the four-glyph
    // change from inventing a category for items the producer never sent one.
    const { Icon, tintClass } = guidanceCategoryIcon(undefined)
    expect(Icon).toBe(guidanceCategoryIcon(undefined).Icon)
    expect(tintClass).toBe('text-info')
    renderBlocks([coaching(9, { category: undefined } as Partial<V5CoachingBlock>)])
    expect(glyphClassesIn('co_9')).toContain('lucide-lightbulb')
  })

  it.each([undefined, '', 'a_category_from_next_year'])(
    'falls back to the honest Lightbulb for the unrecognised category %p',
    (cat) => {
      // ⚠ FOUND WHILE WRITING THE FIX, NOT AFTER. The first cut read
      // `(cat && CATEGORY_GLYPH[cat]) ?? Lightbulb`, and `??` catches only
      // null/undefined — so a `''` category would have been returned AS the
      // icon and React would have rendered nothing. The lookup MISS is the
      // fallback now, which also covers a category the producer adds later.
      const { Icon, tintClass } = guidanceCategoryIcon(cat as GuidanceCategory | undefined)
      expect(typeof Icon, 'an unrecognised category must still yield a component').not.toBe(
        'string',
      )
      expect(Icon).toBe(guidanceCategoryIcon(undefined).Icon)
      expect(tintClass).toBe('text-info')
    },
  )

  it('CONTROL — no category reuses the uncategorised Lightbulb', () => {
    const lightbulb = guidanceCategoryIcon(undefined).Icon
    for (const cat of Object.keys(EXPECTED_GLYPH) as GuidanceCategory[]) {
      expect(
        guidanceCategoryIcon(cat).Icon,
        `${cat} must not be indistinguishable from an uncategorised item`,
      ).not.toBe(lightbulb)
    }
  })
})

// ---------------------------------------------------------------------------
// 2. Expanded cards retain the card badge
// ---------------------------------------------------------------------------

describe('the full card retains its badge', () => {
  it('renders its card badge with general compaction switched off', () => {
    renderBlocks([coaching(1, { category: 'could_fix' } as Partial<V5CoachingBlock>)])
    expect(screen.queryByTestId('coaching-line-co_1'), 'U7: no general compact line').toBeNull()
    expect(
      screen.queryByTestId('block-badge-dot'),
      'the full card keeps its badge',
    ).not.toBeNull()
  })

  it('CONTROL — the same block renders a badge dot as a CARD when the flag is off', () => {
    flagState.enabled = false
    renderBlocks([coaching(1, { category: 'could_fix' } as Partial<V5CoachingBlock>)])
    expect(screen.queryByTestId('coaching-line-co_1'), 'precondition: NOT a line').toBeNull()
    expect(
      screen.queryByTestId('block-badge-dot'),
      'the card keeps its §21.2 badge — this is the matcher firing',
    ).not.toBeNull()
  })

  it('CONTROL — a PINNED block keeps its badge dot even with the flag on', () => {
    renderBlocks([graphPatch()])
    expect(
      screen.queryByTestId('block-badge-dot'),
      'pinned blocks never collapse, so they are always cards',
    ).not.toBeNull()
  })
})

// ---------------------------------------------------------------------------
// 3. Visible category text remains accessible on the full card
// ---------------------------------------------------------------------------

describe('the full card keeps its visible category', () => {
  it('renders the category on the full card', () => {
    renderBlocks([coaching(1, { category: 'could_fix' } as Partial<V5CoachingBlock>)])
    expect(screen.queryByTestId('coaching-line-co_1'), 'U7: no general compact line').toBeNull()
    expect(screen.getByText('Could fix')).toBeVisible()
  })

  it('CONTROL — the pill is still rendered on the full CARD with the flag off', () => {
    // The pill is not deleted from the product; it is removed from the LINE.
    // Without this control, "no pill" would pass if the category stopped
    // reaching the component at all.
    flagState.enabled = false
    renderBlocks([coaching(1, { category: 'could_fix' } as Partial<V5CoachingBlock>)])
    expect(screen.getByText('Could fix')).toBeInTheDocument()
  })

  it.each([
    ['must_fix', 'Must fix'],
    ['should_fix', 'Should fix'],
    ['could_fix', 'Could fix'],
    ['technique', 'Technique'],
  ])('keeps the %s category "%s" accessible as card text', (category, label) => {
    // The decorative glyph is hidden from assistive technology; visible text names the category.
    renderBlocks([coaching(1, { category } as Partial<V5CoachingBlock>)])
    const card = document.querySelector('[data-block-id="co_1"]') as HTMLElement
    expect(within(card).getByText(label)).toBeVisible()
  })
})
