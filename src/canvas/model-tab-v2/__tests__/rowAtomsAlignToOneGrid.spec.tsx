/**
 * ⭐⭐ ONE GRID FOR EVERY ROW — and the contract between the two files that
 * makes it hold.
 *
 * THE DEFECT. Every row was its own `flex` context, so a value's x-position was
 * a function of THAT row's label length and nothing else. Driven as a guest on
 * staging `b7d91382` (market-entry starter, dock 280/416/480): `Not set` landed
 * at five different x-positions in one list, 6 of 8 factor labels truncated at
 * a different width each, and row heights ran 34–76px. The scan a user makes
 * here is "which of these has no value?" — a COLUMN question, and it is
 * unanswerable while the answer moves horizontally on every row.
 *
 * ⚠⚠ WHY SUBGRID AND NOT `display:contents`, WHICH IS WHAT THE SIBLING FIX USED.
 * `ModelStrip` (#1138) fixed this exact defect with grid-on-the-`<ul>` plus
 * `display:contents` on each row, and copying that here would have been a
 * REGRESSION rather than a fix. Those rows are passive `role="listitem"`.
 * THESE are `role="option"` in a `listbox`, carrying `aria-selected`, an
 * `onClick`, a selection background and a bottom border — every one of them
 * painted on the principal box. `display:contents` REMOVES the principal box.
 * The selection background and border would vanish and the click target would
 * collapse to the union of the children, leaving the gaps between cells dead.
 *
 * The two lists look identical and are semantically different. That is why
 * `theRowKeepsItsBox` below is not a nice-to-have: it is the assertion that
 * distinguishes this fix from the wrong one, and it must fail if anyone
 * "simplifies" this to match the census.
 *
 * ⚠ jsdom PERFORMS NO LAYOUT. Nothing here measures a pixel, and none of these
 * assertions would notice if the grid rendered wrongly in a browser. What this
 * file pins is the CLASS CONTRACT and, more importantly, the CROSS-FILE
 * AGREEMENT that no single-file test could see. The pixels are the business of
 * `e2e/visual/`; the browser evidence for this change is in the PR body.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { ModelOutline } from '../ModelOutline'
import type { ModelGroupId, ModelRow } from '../types'

function row(id: string, group: ModelGroupId, over: Partial<ModelRow> = {}): ModelRow {
  return {
    id,
    kind: 'factor',
    group,
    label: `Label ${id}`,
    primaryValue: '1',
    attention: [],
    editable: true,
    ...over,
  }
}

/**
 * ⚠ WHITESPACE-SPLIT, NOT `\b`. The obvious `/\bgrid-cols-subgrid\b/` is fine,
 * but `/\bgrid-cols-\[auto_minmax\(0,1fr\)_auto_auto\]\b/` NEVER MATCHES: `]`
 * is a non-word character and so is the space after it, so there is no word
 * boundary between them and the assertion fails on a class that is plainly
 * present. That is an instrument reporting a defect in code that does not have
 * one — the direction that destroys a correct fix.
 */
const classes = (el: Element) => el.className.toString().split(/\s+/).filter(Boolean)
const hasClass = (el: Element, name: string) => classes(el).includes(name)

/**
 * Split a `grid-cols-[…]` class into its tracks on TOP-LEVEL `_` only, so
 * `minmax(6rem,1fr)` stays one track. One parser, used by every track
 * assertion — the defect it replaces was two assertions about one class string
 * where only one of them actually looked at a track.
 */
function parseTracks(gridClass: string): string[] {
  const body = gridClass.slice('grid-cols-['.length, -1)
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of body) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    if (ch === '_' && depth === 0) { out.push(cur); cur = '' } else cur += ch
  }
  out.push(cur)
  return out
}

/** The `<ul>` for a group, by identity rather than by position. */
const list = (group: ModelGroupId) => screen.getByTestId(`model-outline-v2-${group}-rows`)

/** Rows, by their own testid — `data-kind` excludes the atoms underneath them. */
const rowsIn = (ul: Element) =>
  Array.from(ul.querySelectorAll('[data-testid^="model-row-v2-"]')).filter(
    el => el.getAttribute('data-kind') !== null,
  )

/** The column count the `<ul>` actually declares, parsed from its own class. */
function declaredTrackCount(ul: Element): number {
  const cls = classes(ul).find(c => c.startsWith('grid-cols-['))
  if (!cls) return 0
  // `grid-cols-[auto_minmax(0,1fr)_auto_auto]` → split the bracket body on the
  // top-level `_`, ignoring underscores that cannot occur inside `minmax(...)`.
  const body = cls.slice('grid-cols-['.length, -1)
  let depth = 0
  let n = 1
  for (const ch of body) {
    if (ch === '(') depth++
    else if (ch === ')') depth--
    else if (ch === '_' && depth === 0) n++
  }
  return n
}

/** The span each row claims, parsed from `col-span-N`. */
function claimedSpan(el: Element): number {
  const cls = classes(el).find(c => /^col-span-\d+$/.test(c))
  return cls ? Number(cls.slice('col-span-'.length)) : 0
}

const FIXTURE: ModelRow[] = [
  row('f1', 'factors'),
  row('f2', 'factors', { label: 'A very much longer label that would otherwise widen its own row' }),
  row('f3', 'factors', { primaryValue: null, attention: ['no-value'] }),
]

describe('the row atoms align to ONE grid, not 199 of them', () => {
  it('the list declares the tracks, and it is the only place that does', () => {
    render(<ModelOutline rows={FIXTURE} tier="plain" />)
    const ul = list('factors')

    expect(hasClass(ul, 'grid')).toBe(true)

    /**
     * ⚠⚠ THE PROPERTY, NOT THE LITERAL — and the property is what this test
     * always meant. It pinned `grid-cols-[auto_minmax(0,1fr)_auto_auto]`
     * exactly, with the reason stated as: "`1fr` alone resolves its automatic
     * minimum to `min-content`, so a long label would push the value column
     * off-axis". That danger is `1fr` WITHOUT an explicit minimum. An explicit
     * minimum of `6rem` bounds the track just as `0` does — it simply bounds it
     * higher — so the string moved and the guarantee did not.
     *
     * It moved for a measured reason. On a factor row carrying an estimate
     * hint the label rendered at **37px** — about four characters — because
     * `1fr` means "a share of what is LEFT after the auto tracks reach
     * max-content", so the value and attention columns were served first. A
     * floor on the TRACK is the only thing that reserves width before they are:
     * `min-w-[6rem]` on the label ITEM cannot, because these rows are
     * `grid-cols-subgrid` and the parent sizes the track across every row.
     *
     * So: the identity track must declare an explicit, FIXED minimum. Never a
     * bare `1fr`, and never `min-content`/`auto`, which are the unbounded forms
     * this test exists to keep out.
     */
    const gridClass = classes(ul).find(c => /^grid-cols-\[/.test(c))
    expect(gridClass, 'the list must declare its own tracks').toBeDefined()

    /**
     * ⚠ PARSED AND BOUND BY POSITION, BECAUSE THE FIRST CUT WAS NEITHER. It
     * regex-searched the WHOLE class string for `minmax(<x>,1fr)`, so moving the
     * floor onto a different track left the identity track a bare `auto` and the
     * assertion still green — a guard about track 2 that never looked at track 2.
     * The parser was already three lines below, used for the value track only.
     */
    const trackList = parseTracks(gridClass!)
    // PRECONDITION: four tracks, or every index below names a different column.
    expect(trackList.length, `expected four tracks, parsed ${JSON.stringify(trackList)}`).toBe(4)
    const identityTrack = /^minmax\(([^,]+),\s*1fr\)$/.exec(trackList[1]!)?.[1]
    expect(
      identityTrack,
      `track 2 must be the identity track, minmax(<fixed>, 1fr) — parsed "${trackList[1]}"`,
    ).toBeDefined()
    /**
     * ⚠⚠ `0` WAS THE FIRST ALTERNATIVE HERE, AND `0` IS THE DEFECT.
     *
     * The pattern was `/^(0|\d+(\.\d+)?(px|rem|em|ch))$/`, so the exact pre-PR
     * track `minmax(0,1fr)` captured `"0"` and PASSED. Restoring the literal
     * pre-PR grid string left this whole file GREEN (23 files / 341 passed) —
     * a guard written to hold a floor, admitting the floor-less value it was
     * written about. Found by an independent review that reverted the fix
     * rather than reading the regex.
     *
     * The property is a NON-ZERO fixed length. A zero minimum is exactly "a
     * share of what is left", spelled differently, which is how the label
     * reached 37px in the first place.
     */
    /**
     * ⚠⚠ AND THE FIRST NARROWING WAS STILL A REGEX ARMS RACE. It was
     * `/^(?!0(?:px|rem|em|ch)?$)…/`, which rejects the literal `0` and admits
     * every spelling of it: `0.0rem`, `00px`, `0.00px`, `000rem` all left this
     * spec GREEN. Found in review, and it is the same shape as the wiring pin
     * next door — five rounds of narrowing a string, each defeat moving
     * sideways within it.
     *
     * So this PARSES the value instead of matching it. A number and a unit,
     * and the number must be greater than zero. There is no spelling of zero
     * that survives `parseFloat`, which is what takes it out of the arms race.
     */
    const floor = /^(\d+(?:\.\d+)?)(px|rem|em|ch)$/.exec(identityTrack ?? '')
    expect(
      floor !== null && Number.parseFloat(floor[1]!) > 0,
      `the identity track's floor must be a NON-ZERO fixed length, not "${identityTrack}" — an unbounded (or zero) minimum lets a long label push the value column off-axis, and every spelling of zero is a zero`,
    ).toBe(true)

    /**
     * ⚠⚠ THIS ASSERTION USED TO PIN `minmax(0,auto)` ON THE VALUE TRACK, AND IT
     * WAS PINNING THE HARMFUL HALF.
     *
     * It was justified as "a long value can shrink instead of stealing the
     * identity column's width". The identity FLOOR above already secures that:
     * measured on the deployed build's own rows, the floor alone takes
     * label-over-value to zero at 416px AND at the 280px dock floor (51.6px and
     * 96px of overlap removed). What `minmax(0,auto)` added was a REGRESSION —
     * CSS Grid §6.6 grants the automatic minimum only when the min sizing
     * function is `auto`, so that spelling removes it, and at 280px with
     * "£1,250,000 per year" the value box was crushed to 44.4px against 118px
     * of content. With `auto` it sizes to 118.4px and fits.
     *
     * So the contract is now the opposite one, and it is pinned as a PROPERTY
     * rather than a spelling: the value track must keep an automatic minimum.
     * `minmax(0,…)`, `minmax(0px,…)` and every other zero spelling fail it,
     * which is the same arms-race lesson as the floor parse above.
     */
    /**
     * ⚠⚠ PARSED, NOT MATCHED — AND THE FIRST CUT OF THIS LINE WAS A REGEX
     * WRITTEN DIRECTLY BENEATH A COMMENT DECLARING THAT ARMS RACE OVER.
     *
     * It was `.not.toMatch(/^minmax\(\s*0(?:\.0+)?(?:px|rem|em|ch)?\s*,/)`, and
     * review defeated it with `minmax(0%,auto)`, `minmax(0vw,auto)` and
     * `minmax(00px,auto)` — the last of which the comment above names BY NAME as
     * a spelling that had already beaten this file once. The floor assertion two
     * blocks up had been fixed by parsing for exactly this reason; its neighbour
     * was written as a match anyway.
     *
     * The property: the value track must keep an AUTOMATIC minimum. `auto`,
     * `min-content` and `max-content` do; any zero-valued length or percentage
     * does not, in every unit and every spelling, because `parseFloat` reads
     * them all as 0 and reads a keyword as NaN.
     */
    const valueTrack = trackList[2]!
    const valueMin = /^minmax\(([^,]+),/.exec(valueTrack)?.[1]?.trim()
    const removesAutomaticMinimum = valueMin !== undefined && Number.parseFloat(valueMin) === 0
    expect(
      removesAutomaticMinimum,
      `the value track must keep its automatic minimum — "${valueTrack}" removes it (min sizing function "${valueMin}" resolves to zero), and a value with no floor is crushed under a long figure`,
    ).toBe(false)

    // No row may declare tracks of its own — that is the defect, restated.
    for (const r of rowsIn(ul)) {
      expect(classes(r).some(c => /^grid-cols-\[/.test(c))).toBe(false)
    }
  })

  /**
   * ⭐ THE VALUE AND ATTENTION TRACKS ARE CAPPED — AND THE CAP MUST NOT BE A
   * ZERO MINIMUM. Measured on the deployed build (6 Sep 2026, dock 372px):
   * with bare `auto` tracks the relationships list spent 150px on strength
   * text and 102px on attention marks and gave the identity track 96px, so
   * 0 of 13 relationship rows showed their target. `fit-content(L)` keeps the
   * automatic minimum the test above protects (a nowrap "£1,250,000 per year"
   * still sized to 118px) and caps only content that can truncate, which took
   * the identity track to 181px. The rejected `minmax(0,L)` reserved its cap
   * even for EMPTY cells and cost four fully-visible option labels.
   *
   * ⚠⚠ AND THE FIRST CUT OF THIS TEST PINNED THE SHAPE AND NOTHING ABOUT THE
   * LENGTH. It asserted only `fit-content(<non-zero length>)`, so BOTH numbers
   * the whole change rests on were free parameters. Proven by execution rather
   * than by reading it: with the tracks mutated to `fit-content(7rem)` and
   * `fit-content(3rem)` this file stayed GREEN, 8 of 8 — a guard that cannot
   * fail in the one dimension it exists for, which is the same defect as the
   * `minmax(0,1fr)` admission two blocks up.
   *
   * ⭐ SO THE CAPS ARE PINNED AS VALUES, NOT AS A SHAPE, AND THAT IS DELIBERATE
   * RATHER THAN A MIRROR. There is nothing to derive them FROM: they are
   * measurements taken on a deployed build, so the only honest guard is one
   * that REDs when the code stops agreeing with the measurement and sends the
   * next author to take a new one. Structure is still checked first, so a track
   * that is not a `fit-content` cap at all fails saying so; and the number is
   * compared numerically, not as a string, so `5.0rem` is not a false RED while
   * `7rem` is a true one.
   */
  const CAPS = [
    { index: 2, name: 'value', length: 5.5, unit: 'rem' },
    { index: 3, name: 'attention', length: 5, unit: 'rem' },
  ] as const

  it('⭐ the value and attention tracks are capped with fit-content, at the MEASURED lengths', () => {
    render(<ModelOutline rows={FIXTURE} tier="plain" />)
    const ul = list('factors')
    const trackList = parseTracks(classes(ul).find(c => /^grid-cols-\[/.test(c))!)
    // PRECONDITION: four tracks, or every index below names a different column.
    expect(trackList.length, `expected four tracks, parsed ${JSON.stringify(trackList)}`).toBe(4)
    for (const { index, name, length, unit } of CAPS) {
      const cap = /^fit-content\((\d+(?:\.\d+)?)(px|rem|em|ch)\)$/.exec(trackList[index]!)
      expect(
        cap !== null,
        `the ${name} track must be fit-content(<length>) — parsed "${trackList[index]}". A missing cap is today's defect restated; a zero-minimum \`minmax(0,L)\` is the alternative this change rejected on measurement.`,
      ).toBe(true)
      expect(
        Number.parseFloat(cap![1]!),
        `the ${name} track's cap is a MEASURED length (${length}${unit}), not a free parameter — parsed "${trackList[index]}". If this is a deliberate change, it invalidates the 6 Sep 2026 measurement recorded beside the class in ModelOutline.tsx: take a new one and replace both.`,
      ).toBe(length)
      expect(cap![2], `the ${name} track's cap must be in ${unit}`).toBe(unit)
      // Non-zero is subsumed by the pin above — 5.5 and 5 are both > 0 — but a
      // zero cap is the specific harm, so it is stated where it can be read.
      expect(Number.parseFloat(cap![1]!) > 0, `the ${name} cap must be non-zero`).toBe(true)
    }
  })

  /**
   * ⭐⭐ THE LOAD-BEARING NUMBER, WHICH NOTHING GUARDED — AND IT IS A PAIR.
   *
   * The fix works because the identity TRACK's floor and the label BUTTON's
   * `min-w-[…]` are the same length. They live in two files and were two
   * hand-maintained numbers with nothing asserting they agree, which is this
   * estate's dominant defect class.
   *
   * Review measured what that costs, in a browser rather than by inspection:
   * dropping the track floor to `1px` left 60/60 GREEN and readmitted **95px**
   * of the 95.7px defect; raising the button to `9rem` left 60/60 GREEN and
   * readmitted 48px. Either number could move alone, and every check agreed.
   *
   * So this derives BOTH from the rendered DOM — the track from the list's own
   * class, the floor from the button the list actually rendered — and asserts
   * they are the same length. Neither can drift without the other.
   */
  it('⭐ the track floor and the label button’s minimum are ONE length, derived from both', () => {
    render(<ModelOutline rows={FIXTURE} tier="plain" />)
    const ul = list('factors')

    const trackFloor = /^minmax\(([^,]+),\s*1fr\)$/.exec(
      parseTracks(classes(ul).find(c => /^grid-cols-\[/.test(c))!)[1]!,
    )?.[1]
    expect(trackFloor, 'the identity track must carry a floor to compare').toBeDefined()

    // The button the list really rendered, not a fixture's idea of it.
    const labelButton = ul.querySelector('[data-testid$="-label"]')
    expect(labelButton, 'the row must render an identity control to compare against').not.toBeNull()
    const buttonFloor = classes(labelButton!)
      .map(c => /^min-w-\[([^\]]+)\]$/.exec(c)?.[1])
      .find(Boolean)
    expect(
      buttonFloor,
      `the label control must declare its own minimum — classes were ${JSON.stringify(classes(labelButton!))}`,
    ).toBeDefined()

    expect(
      buttonFloor,
      `the identity track's floor (${trackFloor}) and the label control's minimum (${buttonFloor}) are ONE decision in two files. ` +
        'Review measured that moving either one alone readmits the overlap while every check stays green.',
    ).toBe(trackFloor)
  })

  it('every row adopts those tracks by subgrid, and spans all of them', () => {
    render(<ModelOutline rows={FIXTURE} tier="plain" />)
    const ul = list('factors')
    const rows = rowsIn(ul)

    // PRECONDITION, pinned in-test: a fixture that rendered no rows would make
    // every assertion below vacuously true.
    expect(rows.length).toBe(FIXTURE.length)

    for (const r of rows) {
      expect(hasClass(r, 'grid')).toBe(true)
      expect(hasClass(r, 'grid-cols-subgrid')).toBe(true)
      // ⚠ NOT `flex`. If this ever reads true again the row has its own
      // formatting context back and nothing aligns, which is the shipped bug.
      expect(hasClass(r, 'flex')).toBe(false)
    }
  })

  it('⭐ the span and the track count AGREE — derived from both files, not written down', () => {
    render(<ModelOutline rows={FIXTURE} tier="plain" />)
    const ul = list('factors')

    const tracks = declaredTrackCount(ul)
    // Positive control on the parser itself: an instrument that returns 0 for
    // everything would make the agreement below hold trivially.
    expect(tracks).toBe(4)
    expect(declaredTrackCount(document.createElement('div'))).toBe(0)

    // THE CONTRACT. A subgrid item adopts only the tracks it SPANS, so a fifth
    // track added to the `<ul>` without moving `col-span-4` on the row makes
    // every row silently stop aligning — no error, no red, just the old
    // behaviour back. Deriving both numbers is the only way that drift REDs.
    for (const r of rowsIn(ul)) {
      expect(claimedSpan(r)).toBe(tracks)
    }
  })

  it('⭐ the row KEEPS ITS BOX — this is what `display:contents` would have destroyed', () => {
    render(<ModelOutline rows={FIXTURE} tier="plain" />)
    const rows = rowsIn(list('factors'))
    expect(rows.length).toBeGreaterThan(0)

    for (const r of rows) {
      // `role="option"` + `aria-selected` need a principal box to be announced
      // and painted against. `display:contents` removes it.
      expect(r.getAttribute('role')).toBe('option')
      expect(r.getAttribute('aria-selected')).not.toBeNull()
      // The border and the selection background are painted on the row itself.
      expect(hasClass(r, 'border-b')).toBe(true)
      // And the box must never be dissolved.
      expect(hasClass(r, 'contents')).toBe(false)
    }
  })

  it('every row contributes exactly four cells, so no row can drift a column', () => {
    render(<ModelOutline rows={FIXTURE} tier="plain" />)
    for (const r of rowsIn(list('factors'))) {
      // Element children only — text nodes and comments are not grid items.
      expect(r.children.length).toBe(4)
    }
  })

  it('the identity cell can shrink, or the long label reopens the defect', () => {
    render(<ModelOutline rows={FIXTURE} tier="plain" />)
    const rows = rowsIn(list('factors'))
    // Bind by identity: the row whose label is deliberately long.
    const long = rows.find(r => r.getAttribute('data-testid') === 'model-row-v2-f2')
    expect(long).toBeDefined()
    const identity = long!.children[1]
    expect(hasClass(identity, 'min-w-0')).toBe(true)

    // Discriminating twin: the META cell must ALSO be able to shrink, and it is
    // a different element. Asserting only one leaves the other free to drift.
    const meta = long!.children[3]
    expect(hasClass(meta, 'min-w-0')).toBe(true)
    expect(hasClass(meta, 'justify-end')).toBe(true)
  })
})
