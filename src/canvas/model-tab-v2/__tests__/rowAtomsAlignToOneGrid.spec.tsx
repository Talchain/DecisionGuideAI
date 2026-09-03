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
    expect(hasClass(ul, 'grid-cols-[auto_minmax(0,1fr)_auto_auto]')).toBe(true)

    // The identity track must carry an explicit 0 floor. `1fr` alone resolves
    // its automatic minimum to `min-content`, so a long label would push the
    // value column off-axis and reintroduce the whole defect. This is the one
    // token whose absence looks harmless and is not.
    expect(classes(ul).some(c => c.includes('minmax(0,1fr)'))).toBe(true)

    // No row may declare tracks of its own — that is the defect, restated.
    for (const r of rowsIn(ul)) {
      expect(classes(r).some(c => /^grid-cols-\[/.test(c))).toBe(false)
    }
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
