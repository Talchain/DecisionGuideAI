/**
 * The provenance mark is an ICON, and the words it replaced stay reachable.
 *
 * ⭐ THE DEFECT, from the founder against deployed staging `d4ff3683`: on a real
 * 14-node model, **9 of 14 cards read "AI estimate", 4 read "From brief", 1 read
 * "Set by you"**. The same three words on nearly every card is furniture, not
 * information — his standing ruling. The claim is worth making; the text pill
 * was the wrong carrier for it.
 *
 * ⛔ AND THE PILL WAS A RATIFIED-SPEC VIOLATION WHILE IT SHIPPED.
 * `DESIGN_SYSTEM.md` §"Pills and Badges (v4 §8.5)" lists
 * `className="border border-danger/30 text-danger"` as an explicit ❌ WRONG
 * example — "Text on pills is always `text-text-body` — never `text-{colour}`."
 * The mark's `BORDER` map was exactly that shape (`border-info/40 text-info`,
 * `border-warning/40 text-warning`, `border-success/40 text-success`), on every
 * card. Converting the pill to an icon RESOLVES it rather than relocating it:
 * §Iconography's colour rule governs icons, and there is no pill left to put
 * coloured text on.
 *
 * ── WHAT THIS FILE GUARDS, in one sentence each ────────────────────────────
 *  1. the mark renders a GLYPH and no words (the founder's complaint);
 *  2. the words are still reachable, and reachable WITHOUT a second tab stop
 *     (the access tension, resolved rather than silently picked);
 *  3. the glyphs DISCRIMINATE — three kinds, three different marks, so a single
 *     shared glyph cannot pass "an icon rendered";
 *  4. the mark carries no §8.5 pill anti-pattern and no fixed hue that fails
 *     SC 1.4.11;
 *  5. the icon is legible at the zoom the product itself parks the camera at —
 *     asserted as ARITHMETIC, because jsdom has no layout and a DOM assertion
 *     about size would be a lie (`zoomLegibility.renderedLabelPx`'s own header
 *     says so, and exists for exactly this).
 */
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NodeProvenanceMark } from '../NodeProvenanceMark'
import {
  VALUE_PROVENANCE_LABEL,
  classifyNodeProvenance,
  type ValueProvenanceKind,
} from '../../../domain/valueProvenance'
import {
  VALUE_PROVENANCE_ICON,
  PROVENANCE_ICON_DECLARED_PX,
  PROVENANCE_ICON_SIZE_CLASSES,
} from '../../../domain/valueProvenanceIcon'
import { LABEL_LEGIBLE_ZOOM, renderedLabelPx } from '../../../utils/zoomLegibility'

const mark = () => screen.queryByTestId('node-provenance-mark')

/**
 * ⚠ DERIVED, NOT LISTED. These are the ONLY kinds a node's `data.provenance`
 * can produce — `classifyNodeProvenance` is the authority and it recognises
 * exactly three `CEEProvenance` literals. A hand-written kind list here would
 * be the mirror this estate keeps paying for (CLAUDE.md trap 12), and it would
 * silently stop covering a literal the day one is added.
 */
const CANVAS_LITERALS = ['user_set', 'from_brief', 'ai_inferred'] as const

describe('the card shows a glyph, not the same three words on every card', () => {
  it.each(CANVAS_LITERALS)('%s renders an icon and NO text', (literal) => {
    render(<NodeProvenanceMark provenance={literal} />)
    const el = mark()
    expect(el).not.toBeNull()
    // The founder's actual complaint: the words were on the card.
    expect(el!.textContent).toBe('')
    expect(el!.querySelector('svg')).not.toBeNull()
  })

  /**
   * THE DISCRIMINATOR. "An icon rendered" is satisfied by one glyph used for
   * all three, which would replace three repeated WORDS with one repeated
   * PICTURE — the same defect wearing a nicer coat. Binding is by the rendered
   * glyph's own identity (lucide stamps `class="lucide lucide-<name>"`), never
   * by a predicate another glyph could satisfy.
   */
  it('and the three kinds render three DIFFERENT glyphs', () => {
    const seen = CANVAS_LITERALS.map((literal) => {
      const { unmount } = render(<NodeProvenanceMark provenance={literal} />)
      const svg = mark()!.querySelector('svg')!
      const name = Array.from(svg.classList).find((c) => c.startsWith('lucide-'))
      unmount()
      return name
    })
    expect(seen.every(Boolean)).toBe(true)
    expect(new Set(seen).size).toBe(CANVAS_LITERALS.length)
  })
})

describe('the words stay reachable — the icon may not hide the claim', () => {
  it.each(CANVAS_LITERALS)('%s carries the canonical label in the a11y tree', (literal) => {
    render(<NodeProvenanceMark provenance={literal} />)
    const el = mark()!
    const kind = classifyNodeProvenance(literal)!.kind
    // ⚠ Against the SHARED constant, never a string typed here — a literal
    // would pass while the canvas and the Reasoning tab called one thing two
    // names, which is the drift the shared register exists to prevent.
    expect(el.getAttribute('aria-label')).toBe(VALUE_PROVENANCE_LABEL[kind])
    expect(el.getAttribute('role')).toBe('img')
  })

  it('carries the label AND the raw producer literal on hover', () => {
    render(<NodeProvenanceMark provenance="ai_inferred" />)
    const title = mark()!.getAttribute('title') ?? ''
    expect(title).toContain(VALUE_PROVENANCE_LABEL.ai)
    expect(title).toContain('ai_inferred')
  })

  /**
   * ⭐ THE TENSION, RESOLVED EXPLICITLY RATHER THAN SILENTLY.
   *
   * `NodeProvenanceMark` and `EstimateMarker` both record the same decision:
   * NOT a button, NOT focusable, because a second tab stop on every node costs
   * more than it gives and the detail is reachable through the quick actions
   * and the inspector. A hover-only tooltip on a non-focusable element is
   * unreachable by keyboard AND by touch — so the resolution is to put the full
   * label in the ACCESSIBLE NAME (asserted above), which needs no focus at all,
   * and to key the glyphs in the canvas legend (a real, keyboard- and
   * touch-reachable button) rather than to add the tab stop.
   *
   * This assertion is what stops the decision drifting: if a later change makes
   * the mark focusable, the two markers have silently diverged and this goes
   * red so the divergence is a DECISION rather than an accident.
   */
  it('does NOT add a second tab stop per node (matching EstimateMarker)', () => {
    render(<NodeProvenanceMark provenance="from_brief" />)
    const el = mark()!
    expect(el.getAttribute('tabindex')).toBeNull()
    expect(el.tagName.toLowerCase()).not.toBe('button')
    expect(el.querySelector('button')).toBeNull()
  })
})

describe('⛔ DESIGN_SYSTEM.md compliance — the pill anti-pattern does not come back', () => {
  it.each(CANVAS_LITERALS)('%s carries no coloured-text-on-a-pill and no fill', (literal) => {
    render(<NodeProvenanceMark provenance={literal} />)
    const cls = mark()!.className
    // §8.5: "No filled backgrounds. Ever."
    expect(cls).not.toMatch(/\bbg-(?!transparent\b)[a-z]/)
    // §8.5's ❌ WRONG example is a coloured border paired with coloured text.
    // Neither channel belongs on this mark any more: it is not a pill.
    expect(cls).not.toMatch(/\bborder-(info|warning|success|danger|option|factor|goal)\b/)
    expect(cls).not.toMatch(/\brounded-full\b/)
  })

  /**
   * ⚠ MEASURED, NOT ASSUMED, and it is why the glyphs are neutral rather than
   * semantic. §Iconography says status icons may take `text-warning` /
   * `text-success`. Against `--bg-panel` #FEFEFE those tokens measure
   * **1.92:1** and **2.02:1** — SC 1.4.11 asks 3:1 for a graphic that carries
   * meaning. The old pill got away with the hue because the WORD carried the
   * meaning and the colour was decoration; an icon has no word behind it, so
   * hue-as-meaning at 1.92:1 would be a new access defect introduced by a
   * readability fix. `text-text-light` measures 5.23:1 and the SHAPE carries
   * the meaning, which is also the channel a colour-blind reader keeps.
   * (§Iconography: "`text-text-light` at rest for neutral contexts".)
   */
  it('uses the neutral rest colour, so hue is never the only carrier', () => {
    render(<NodeProvenanceMark provenance="ai_inferred" />)
    const cls = mark()!.className
    expect(cls).toContain('text-text-light')
    expect(cls).not.toMatch(/\btext-(info|warning|success|danger)\b/)
  })
})

describe('the glyph is legible at the zoom the product parks the camera at', () => {
  /**
   * ⚠ A DOM ASSERTION CANNOT PROVE THIS — jsdom has no layout. What CAN be
   * proven here is the arithmetic the canvas actually applies, which is the
   * same thing `zoomLegibility` exports `renderedLabelPx` for.
   *
   * `w-3.5` (14px, the DS canvas-node-badge size) is a FIXED px size, and node
   * DOM sits inside React Flow's viewport transform — so at the auto-fit floor
   * the ratified 14px would reach the user as **7px**. The counter-scale is
   * what makes the ratified size TRUE on the canvas rather than nominal, which
   * is precisely why the type tokens carry it (`typography.ts` §canvas).
   */
  it('declares the DS canvas-badge size and carries the canvas counter-scale', () => {
    expect(PROVENANCE_ICON_DECLARED_PX).toBe(14)
    for (const axis of PROVENANCE_ICON_SIZE_CLASSES.split(' ')) {
      expect(axis).toContain('calc(14px*var(--canvas-label-scale,1))')
    }
    render(<NodeProvenanceMark provenance="from_brief" />)
    const svgCls = mark()!.querySelector('svg')!.getAttribute('class') ?? ''
    for (const axis of PROVENANCE_ICON_SIZE_CLASSES.split(' ')) {
      expect(svgCls).toContain(axis)
    }
  })

  it('renders at its declared size at the auto-fit floor, not at half of it', () => {
    // The floor is where a post-draft auto-fit parks (`useFitViewOnLayoutVersion`
    // passes it as `minZoom`), so it IS the worst case for a whole-model view.
    expect(renderedLabelPx(PROVENANCE_ICON_DECLARED_PX, LABEL_LEGIBLE_ZOOM)).toBe(
      PROVENANCE_ICON_DECLARED_PX,
    )
    // The control: WITHOUT the counter-scale the same declared size reaches the
    // user at half. If this ever equals the line above, the counter-scale has
    // stopped doing anything and the assertion above has gone vacuous.
    expect(PROVENANCE_ICON_DECLARED_PX * LABEL_LEGIBLE_ZOOM).toBeLessThan(
      PROVENANCE_ICON_DECLARED_PX,
    )
  })
})

describe('one glyph vocabulary, total and distinct', () => {
  it('is TOTAL over every provenance kind the product can classify', () => {
    // Total by construction (`Record<ValueProvenanceKind, …>` is a type error
    // when short), asserted here so the two registers cannot drift in SIZE
    // either — the labels are the canonical list and the icons must match it.
    expect(Object.keys(VALUE_PROVENANCE_ICON).sort()).toEqual(
      Object.keys(VALUE_PROVENANCE_LABEL).sort(),
    )
  })

  it('gives every kind its OWN glyph — no two kinds share a mark', () => {
    const kinds = Object.keys(VALUE_PROVENANCE_ICON) as ValueProvenanceKind[]
    const glyphs = kinds.map((k) => VALUE_PROVENANCE_ICON[k])
    expect(new Set(glyphs).size).toBe(kinds.length)
  })
})

describe('⛔ it still never invents an attribution', () => {
  it.each([
    ['undefined', undefined],
    ['a literal no producer writes', 'somebody_elses_guess'],
    ['a non-string', 42],
  ])('renders NOTHING for %s', (_label, value) => {
    render(<NodeProvenanceMark provenance={value as unknown} />)
    expect(mark()).toBeNull()
  })
})
