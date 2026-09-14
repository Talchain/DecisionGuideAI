/**
 * ONE ROW, ONE CHANNEL PER MEANING — the compact line stops saying the same
 * thing three times, and stops stamping a card's badge on something that is
 * not a card.
 *
 * ## The defect, photographed on deployed staging (b7c8c74e)
 *
 * A live coaching row rendered as: a blue DOT, a lightbulb ICON drawn on top
 * of it, a "Could fix" PILL, then the producer's title. Three ornaments before
 * a single word of content, in a 416px dock.
 *
 * ⛔ THE DOT WAS NOT MERELY REDUNDANT, IT WAS COLLIDING. `.blockBadgeDot` is
 * `position:absolute; top:8px; left:8px`, and its clearance is reserved by
 * `.blockWithBadge > div { padding-left: 24px }` — a CHILD selector that only
 * matches a `div`. When the card became a compact line the child became
 * `<details>`, the selector silently stopped matching, no clearance was
 * reserved, and the dot landed on the summary's first item — the glyph, which
 * sits at the row's own `padding: 4px 8px`. No error, no failing test: a CSS
 * selector that stops matching is silent by construction.
 *
 * ⭐ AND THE DOT IS A CARD'S BADGE. DS v5 §21.2 defines it as part of a BLOCK:
 * "Base block: `bg-panel`, `rounded-[20px]`, 24px padding, `shadow-1`.
 * Type-specific top borders (3px). Block type badges are small coloured dots
 * (8px diameter, main colour fill) top-left." The line correctly dropped the
 * panel, the radius, the padding and the top border — every other limb of that
 * treatment. The dot survived only because it is painted by the PARENT
 * (`InlineBlocks`), where `suppressHeader` could not reach it. So this is not
 * "hide the dot to fix an overlap"; it is the line finishing the job of not
 * being a card.
 *
 * ## Why the pill goes, and why that needed the glyphs first
 *
 * `guidanceCategoryIcon` was BINARY — `guidanceCategoryTone` collapses four
 * producer categories onto two tones, and the glyph was chosen from the tone.
 * So `could_fix` and `technique` both drew `Lightbulb`/`text-info`: on the
 * photographed row the glyph distinguished NOTHING, and the pill was the only
 * element resolving which of the four a row actually was.
 *
 * ⛔ THAT IS WHY THE PILL COULD NOT SIMPLY BE DELETED, and an earlier pass in
 * this lane said so and stopped there: dropping it while the glyph stayed
 * binary would have left a four-value distinction carried by TINT ALONE, which
 * is WCAG 1.4.1 (Use of Colour) failing at Level A. The fix is not to keep the
 * pill — it is to make the glyph carry the category in SHAPE, which is a
 * non-colour channel, and then the pill is genuinely redundant.
 *
 * ⚠ SHAPE CARRIES THE CATEGORY; TONE STILL CARRIES URGENCY. The two danger-
 * tinted categories take two different alert shapes, the two info-tinted ones
 * take two different non-alert shapes. Tint is NOT re-derived here — it stays
 * `guidanceCategoryTone`'s answer, so colour keeps meaning "how urgent" and
 * shape now means "which kind". That is the estate's own three-channel rule
 * (shape = what it is, colour = how it's doing) applied rather than restated.
 *
 * ⚠⚠ AND THE PILL WAS THE ROW'S ONLY ACCESSIBLE NAME FOR THE CATEGORY. The
 * glyph shipped `aria-hidden="true"`, so deleting the pill without naming the
 * glyph would remove the category from assistive technology ENTIRELY — trading
 * a visual defect for an accessibility one. The last arm pins that.
 *
 * ## Instrument notes
 *
 * Every absence assertion is paired with a positive control that fires on the
 * SAME matcher, because an absence assertion whose matcher is inert passes by
 * testing nothing. The dot arms carry two such controls (a pinned block, which
 * never collapses, and the flag-off card) so "no dot on a line" cannot pass
 * merely because the dot stopped rendering everywhere.
 */
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
    screen.getByTestId(`coaching-line-summary-${blockId}`).querySelectorAll('svg'),
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
    'renders %s as %s on the compact line',
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
// 2. A line is not a card, so it carries no card badge
// ---------------------------------------------------------------------------

describe('the block badge dot belongs to the CARD and never to the line', () => {
  it('renders NO badge dot when a coaching block renders as a compact line', () => {
    renderBlocks([coaching(1, { category: 'could_fix' } as Partial<V5CoachingBlock>)])
    expect(screen.queryByTestId('coaching-line-co_1'), 'precondition: it IS a line').not.toBeNull()
    expect(
      screen.queryByTestId('block-badge-dot'),
      'an 8px absolutely-positioned dot lands on the glyph at the same 8px',
    ).toBeNull()
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
// 3. The pill goes, and the glyph keeps the category reachable
// ---------------------------------------------------------------------------

describe('the category pill is retired now the glyph carries the category', () => {
  it('renders NO category pill on the compact line', () => {
    renderBlocks([coaching(1, { category: 'could_fix' } as Partial<V5CoachingBlock>)])
    expect(screen.queryByTestId('coaching-line-co_1'), 'precondition: it IS a line').not.toBeNull()
    expect(screen.queryByTestId('coaching-line-category-co_1')).toBeNull()
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
  ])('names the %s glyph "%s" for assistive technology', (category, label) => {
    // ⚠⚠ THE ROW'S ONLY ACCESSIBLE NAME. The pill carried this text; with the
    // pill gone the glyph must carry it, or the category is visible to sighted
    // users and absent for everyone else.
    renderBlocks([coaching(1, { category } as Partial<V5CoachingBlock>)])
    const named = within(
      screen.getByTestId('coaching-line-summary-co_1'),
    ).getByLabelText(label)
    expect(named).toBeInTheDocument()
    expect(named.tagName.toLowerCase(), 'the NAME belongs to the glyph').toBe('svg')
  })
})
