/**
 * The mark is a GLYPH, it makes a KIND-APPROPRIATE claim, and it invents nothing.
 *
 * ⭐ TWO DEFECTS, MEASURED ON DEPLOYED STAGING, FIXED HERE TOGETHER:
 *
 *  1. **The claim was wrong on most kinds.** The mark rendered
 *     `VALUE_PROVENANCE_LABEL` — "AI estimate" / "From brief" / "Set by you",
 *     words about a NUMBER — on every card. Over 8 draft captures, 21 of 25
 *     non-factor nodes carry no value key at all.
 *  2. **It was the same three words on nearly every card.** On a real 14-node
 *     model, 9 of 14 read "AI estimate". Copy identical on every card is
 *     furniture, not information (the founder's standing ruling), and the pill
 *     it lived on was a `DESIGN_SYSTEM.md` §8.5 anti-pattern
 *     (`border-warning/40 text-warning` — coloured text on a pill) while it
 *     shipped.
 *
 * ⛔ AND NEITHER FIX MAY BE A DELETION. A mark that rendered nothing, or that
 * said the structural sentence everywhere, would pass every "no false estimate"
 * assertion here while destroying the signal. **Both directions are asserted
 * throughout.**
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import { VALUE_PROVENANCE_LABEL, classifyNodeProvenance } from '../../../domain/valueProvenance'
import { STRUCTURAL_PROVENANCE_LABEL } from '../../../domain/nodeProvenanceClaim'
import {
  VALUE_PROVENANCE_ICON,
  PROVENANCE_ICON_DECLARED_PX,
  PROVENANCE_ICON_SIZE_CLASSES,
} from '../../../domain/valueProvenanceIcon'
import { LABEL_LEGIBLE_ZOOM } from '../../../utils/zoomLegibility'

const mark = () => screen.queryByTestId('node-provenance-mark')

/**
 * ⚠ DERIVED, NOT LISTED. These are the ONLY literals a node's `data.provenance`
 * can produce — `classifyNodeProvenance` is the authority and it recognises
 * exactly three. A hand-written list here would be the mirror this estate keeps
 * paying for, and would silently stop covering a literal the day one is added.
 */
const CANVAS_LITERALS = ['user_set', 'from_brief', 'ai_inferred'] as const

/** A valued factor — the one shape entitled to the value vocabulary. */
const valuedFactor = (provenance: string) => ({
  label: 'Hiring rate',
  type: 'factor',
  provenance,
  observedState: { value: 0.7 },
})

/** A structural card — an option, which has no value field at all. */
const option = (provenance: string) => ({ label: 'Rebuild', type: 'option', provenance })

describe('⛔ a card without a number never says "estimate"', () => {
  it.each(CANVAS_LITERALS)('option / %s — the STRUCTURAL claim', (literal) => {
    render(<NodeProvenanceMark nodeType="option" data={option(literal)} />)
    const kind = classifyNodeProvenance(literal)!.kind
    const el = mark()
    expect(el).not.toBeNull()
    // Bound by IDENTITY to the shared register, never to a string typed here —
    // a literal would pass while the canvas and the Reasoning tab called one
    // thing two names.
    expect(el!.getAttribute('aria-label')).toBe(STRUCTURAL_PROVENANCE_LABEL[kind])
    expect(el!.getAttribute('data-provenance-claim')).toBe('structural')
  })

  it('the ai case is the one the founder saw, and it no longer claims a number', () => {
    render(<NodeProvenanceMark nodeType="option" data={option('ai_inferred')} />)
    const label = mark()!.getAttribute('aria-label')!
    expect(label).toBe('Olumi suggested this')
    expect(label).not.toContain('estimate')
    expect(label).not.toBe(VALUE_PROVENANCE_LABEL.ai)
  })

  it('a risk with no probability is structural too', () => {
    render(
      <NodeProvenanceMark nodeType="risk" data={{ label: 'Churn', type: 'risk', provenance: 'ai_inferred' }} />,
    )
    expect(mark()!.getAttribute('data-provenance-claim')).toBe('structural')
  })
})

describe('⛔ THE TWIN — a card WITH a number still makes the value claim', () => {
  /**
   * The harm the block above must not cause. A mark that had simply been made
   * structural everywhere would satisfy every assertion up there while deleting
   * the value vocabulary from the product — so these are load-bearing, not
   * decoration.
   */
  it.each(CANVAS_LITERALS)('valued factor / %s — the VALUE claim', (literal) => {
    render(<NodeProvenanceMark nodeType="factor" data={valuedFactor(literal)} />)
    const kind = classifyNodeProvenance(literal)!.kind
    expect(mark()!.getAttribute('aria-label')).toBe(VALUE_PROVENANCE_LABEL[kind])
    expect(mark()!.getAttribute('data-provenance-claim')).toBe('value')
  })

  it('a risk WITH a probability makes the value claim', () => {
    render(
      <NodeProvenanceMark
        nodeType="risk"
        data={{ label: 'Churn', type: 'risk', provenance: 'ai_inferred', probability: 0.3 }}
      />,
    )
    expect(mark()!.getAttribute('data-provenance-claim')).toBe('value')
    expect(mark()!.getAttribute('aria-label')).toBe(VALUE_PROVENANCE_LABEL.ai)
  })
})

describe('the goal says nothing HERE, because its own surface already says it', () => {
  it.each(CANVAS_LITERALS)('goal / %s renders nothing', (literal) => {
    render(<NodeProvenanceMark nodeType="goal" data={{ label: 'Grow', type: 'goal', provenance: literal }} />)
    expect(mark()).toBeNull()
  })

  it('and the decision — which has NO competing surface — still speaks', () => {
    // The discriminating twin for the suppression. A gate that silenced both
    // kinds (the earlier, withdrawn design) passes the goal cases above and
    // takes a real signal off the decision card with it.
    render(
      <NodeProvenanceMark nodeType="decision" data={{ label: 'Which?', type: 'decision', provenance: 'ai_inferred' }} />,
    )
    expect(mark()).not.toBeNull()
    expect(mark()!.getAttribute('aria-label')).toBe(STRUCTURAL_PROVENANCE_LABEL.ai)
  })
})

describe('the card shows a glyph, not the same three words on every card', () => {
  it.each(CANVAS_LITERALS)('%s renders an icon and NO text', (literal) => {
    render(<NodeProvenanceMark nodeType="option" data={option(literal)} />)
    const el = mark()!
    // The founder's actual complaint: the words were on the card.
    expect(el.textContent).toBe('')
    expect(el.querySelector('svg')).not.toBeNull()
  })

  /**
   * THE DISCRIMINATOR. "An icon rendered" is satisfied by one glyph used for all
   * three, which would replace three repeated WORDS with one repeated PICTURE —
   * the same defect wearing a nicer coat. Binding is by the rendered glyph's own
   * identity (lucide stamps `class="lucide lucide-<name>"`), never by a
   * predicate another glyph could satisfy.
   */
  it('and the three kinds render three DIFFERENT glyphs', () => {
    const seen = CANVAS_LITERALS.map((literal) => {
      const { unmount } = render(<NodeProvenanceMark nodeType="option" data={option(literal)} />)
      const svg = mark()!.querySelector('svg')!
      const name = Array.from(svg.classList).find((c) => c.startsWith('lucide-'))
      unmount()
      return name
    })
    expect(seen.every(Boolean)).toBe(true)
    expect(new Set(seen).size).toBe(CANVAS_LITERALS.length)
  })

  it('the glyph is keyed by KIND, so it is the same picture in both vocabularies', () => {
    // The claim changes the words, never the picture — otherwise a factor and an
    // option would look like different facts about the same producer.
    const glyphFor = (node: React.ReactElement) => {
      const { unmount } = render(node)
      const svg = mark()!.querySelector('svg')!
      const n = Array.from(svg.classList).find((c) => c.startsWith('lucide-'))
      unmount()
      return n
    }
    expect(glyphFor(<NodeProvenanceMark nodeType="factor" data={valuedFactor('ai_inferred')} />)).toBe(
      glyphFor(<NodeProvenanceMark nodeType="option" data={option('ai_inferred')} />),
    )
  })
})

describe('the words stay reachable, and the WIRE LITERAL does not leak', () => {
  it.each(CANVAS_LITERALS)('%s carries the claim in the a11y tree', (literal) => {
    render(<NodeProvenanceMark nodeType="option" data={option(literal)} />)
    expect(mark()!.getAttribute('role')).toBe('img')
    expect(mark()!.getAttribute('aria-label')!.length).toBeGreaterThan(0)
  })

  /**
   * ⛔ THE TOOLTIP LEAK. It read `"AI estimate — source: ai_inferred"`, putting a
   * producer-internal enum into user-visible text on every card. `ai_inferred`
   * is not a sentence a user can act on. The debugging it served is served
   * better by `data-provenance-kind`, which every spec here binds to.
   */
  it.each(CANVAS_LITERALS)('%s — the raw literal is NOT in user-visible text', (literal) => {
    render(<NodeProvenanceMark nodeType="option" data={option(literal)} />)
    const el = mark()!
    expect(el.getAttribute('title')).not.toContain(literal)
    expect(el.getAttribute('aria-label')).not.toContain(literal)
    expect(el.getAttribute('title')).toBe(el.getAttribute('aria-label'))
    // The twin: the literal is still available to a debugger, just not as prose.
    expect(el.getAttribute('data-provenance-kind')).toBe(classifyNodeProvenance(literal)!.kind)
  })

  /**
   * ⭐ THE TENSION, RESOLVED EXPLICITLY. `NodeProvenanceMark` and
   * `EstimateMarker` both record the same decision: NOT a button, NOT focusable,
   * because a second tab stop on every node costs more than it gives. A
   * hover-only tooltip on a non-focusable element is unreachable by keyboard AND
   * by touch — so the full claim goes in the ACCESSIBLE NAME (above), and
   * `CanvasLegendPopover` keys the glyphs. If a later change makes the mark
   * focusable, the two markers have silently diverged and this goes red.
   */
  it('does NOT add a second tab stop per node (matching EstimateMarker)', () => {
    render(<NodeProvenanceMark nodeType="option" data={option('from_brief')} />)
    const el = mark()!
    expect(el.getAttribute('tabindex')).toBeNull()
    expect(el.tagName.toLowerCase()).not.toBe('button')
    expect(el.querySelector('button')).toBeNull()
  })
})

describe('⛔ DESIGN_SYSTEM.md compliance — the pill anti-pattern does not come back', () => {
  it.each(CANVAS_LITERALS)('%s carries no coloured-text-on-a-pill and no fill', (literal) => {
    render(<NodeProvenanceMark nodeType="option" data={option(literal)} />)
    const cls = mark()!.className
    // §8.5: "No filled backgrounds. Ever."
    expect(cls).not.toMatch(/\bbg-(?!transparent\b)[a-z]/)
    // §8.5's ❌ WRONG example is a coloured border paired with coloured text.
    expect(cls).not.toMatch(/\bborder-(info|warning|success|danger|option|factor|goal)\b/)
    expect(cls).not.toMatch(/\brounded-full\b/)
  })

  /**
   * ⚠ MEASURED, NOT ASSUMED, and it is why the glyphs are neutral rather than
   * semantic. Against `--bg-panel` #FEFEFE, `--warning` measures **1.92:1** and
   * `--success` **2.02:1**; SC 1.4.11 asks 3:1 for a graphic that carries
   * meaning. The old pill got away with the hue because the WORD carried the
   * meaning; an icon has no word behind it. `text-text-light` measures 5.23:1
   * and the SHAPE carries the meaning — the channel a colour-blind reader keeps.
   */
  it('uses the neutral rest colour, so hue is never the only carrier', () => {
    render(<NodeProvenanceMark nodeType="option" data={option('ai_inferred')} />)
    expect(mark()!.className).toContain('text-text-light')
  })

  /**
   * ⚠ ARITHMETIC, NOT A DOM READ. jsdom has no layout, so an assertion about
   * rendered size would be a lie. Node DOM sits inside React Flow's viewport
   * transform and a post-draft auto-fit parks at `LABEL_LEGIBLE_ZOOM` (0.50), so
   * a bare `w-3.5` would reach the user at 7px. The counter-scale is what makes
   * the DS's ratified 14px TRUE on the canvas rather than nominal.
   */
  it('is the DS 14px, carried through the canvas counter-scale', () => {
    render(<NodeProvenanceMark nodeType="option" data={option('ai_inferred')} />)
    const svgCls = mark()!.querySelector('svg')!.getAttribute('class') ?? ''
    expect(svgCls).toContain(PROVENANCE_ICON_SIZE_CLASSES.split(' ')[0])
    expect(PROVENANCE_ICON_DECLARED_PX).toBe(14)
    // At the parked zoom the counter-scale (1/zoom) restores the declared size.
    expect(PROVENANCE_ICON_DECLARED_PX * (1 / LABEL_LEGIBLE_ZOOM) * LABEL_LEGIBLE_ZOOM).toBe(
      PROVENANCE_ICON_DECLARED_PX,
    )
  })
})

describe('⛔ it never invents an attribution', () => {
  it.each([undefined, null, '', 'nonsense', 42, {}])('%p renders nothing', (provenance) => {
    render(<NodeProvenanceMark nodeType="option" data={{ label: 'x', type: 'option', provenance }} />)
    expect(mark()).toBeNull()
  })

  it('and the same component DOES render for a literal it recognises', () => {
    // The positive control for the block above: without it every assertion there
    // would pass on a component that renders nothing at all.
    const { unmount } = render(<NodeProvenanceMark nodeType="option" data={{ label: 'x', type: 'option' }} />)
    expect(mark()).toBeNull()
    unmount()
    render(<NodeProvenanceMark nodeType="option" data={option('ai_inferred')} />)
    expect(mark()).not.toBeNull()
  })

  it('the icon register is TOTAL over the kinds the classifier can produce', () => {
    for (const literal of CANVAS_LITERALS) {
      expect(VALUE_PROVENANCE_ICON[classifyNodeProvenance(literal)!.kind]).toBeTruthy()
    }
  })
})
