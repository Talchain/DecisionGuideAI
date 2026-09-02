/**
 * Analysis (New) — THE CENSUS ALIGNS ITS FOUR ROWS, AND NEVER TRUNCATES ITS
 * OWN CATEGORY NAMES.
 *
 * ⚠⚠ THE DEFECT, MEASURED ON DEPLOYED `a4d6e204`. The strip's four category
 * labels sat in a grid whose first column was a literal `76px`. Options,
 * Factors and Risks fit. **Outcomes did not** — 53px of text in a 52px box,
 * with `truncate` doing exactly what it was asked to:
 *
 *     Options · Factors · Risks · Outcome…
 *
 * One pixel, on every model, at every panel width, in the panel's own census of
 * what the model contains. Corroborated independently on the CI linux runner,
 * where `e2e/visual/analysisNewLayout.visual.spec.ts:149` reports the same span
 * at 52/56px at all three dock widths.
 *
 * ⚠⚠ AND THE DEFECT THE FIRST FIX INTRODUCED, WHICH IS WHY THIS FILE WAS
 * REWRITTEN. Replacing `76px` with `auto` ON THE `<li>` fits the labels and
 * breaks the alignment: each row is then its OWN grid, column 1 sizes to that
 * row's own label, and the marks column starts at four different offsets —
 * measured in Chromium at 26px apart, 65px with translated labels. The fix has
 * to put ONE grid on the `<ul>` and dissolve each `<li>` into it with
 * `display:contents`, which is the repo's existing idiom (`DisclosureRow.tsx`,
 * `DeeperAnalysis.tsx`).
 *
 * ── WHAT THIS FILE CAN AND CANNOT CLAIM ────────────────────────────────────
 * jsdom computes no layout (CLAUDE.md trap 3), so NOTHING here asserts a pixel,
 * an alignment or a fit. What it pins is the STRUCTURE that produces them: one
 * content-sized template, owned by the element that contains all four rows,
 * with the rows dissolved into it. The numbers are owed on a real browser and
 * live in the PR.
 *
 * ⚠ The previous version of this file read the grid template out of the SOURCE
 * with an unanchored regex. That guard could not survive its own subject
 * moving: after the template shifted to the `<ul>`, all three of its assertions
 * still passed while the property under test — one grid, four rows — was no
 * longer tested at all. A guard that passes for the wrong reason is worse than
 * no guard, so it is replaced by a render test bound to the elements by
 * identity.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

const nodes: Array<{ id: string; type?: string; data?: unknown }> = []

vi.mock('../../../../canvas/store', () => {
  const useCanvasStore = (select: (s: { nodes: unknown }) => unknown) => select({ nodes })
  ;(useCanvasStore as unknown as { getState: () => { nodes: unknown } }).getState = () => ({ nodes })
  return { useCanvasStore }
})
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { ModelStrip } from '../sections/ModelStrip'

const TID = 'analysis-new-model-strip'

const node = (id: string, type: string, label?: string) => ({
  id,
  type,
  data: label === undefined ? {} : { label },
})

/** All four kinds present, so the census renders the four rows the bug was about. */
const FOUR_KINDS = [
  node('g1', 'goal', 'Replace the customer data platform within budget'),
  node('o1', 'option', 'Adopt Segment'),
  node('o2', 'option', 'Adopt RudderStack'),
  node('f1', 'factor', 'Migration effort'),
  node('f2', 'factor', 'Vendor lock-in'),
  node('r1', 'risk', 'Migration delay'),
  node('x1', 'outcome', 'Time to first insight'),
]

/**
 * ⭐ THE PREDICATE UNDER TEST. "Does this element own a grid template?" — the
 * question that separates one shared grid from four independent ones.
 */
const ownsATemplate = (el: Element) => /grid-cols-\[/.test(el.className)

const openStrip = () => {
  render(<ModelStrip isPreRun={false} />)
  fireEvent.click(screen.getByTestId(`${TID}-toggle`))
}

beforeEach(() => {
  nodes.length = 0
  nodes.push(...FOUR_KINDS)
})
afterEach(() => cleanup())

describe('the census row grid', () => {
  /**
   * ⭐ THE PREDICATE'S POSITIVE CONTROL (CLAUDE.md trap 13). Every assertion
   * below turns on `ownsATemplate`, and an absence assertion built on a
   * predicate that can never fire passes by testing nothing. This proves it
   * fires — against the EXACT class string this fix removed from the `<li>`.
   */
  it('the template predicate can see a template when there is one', () => {
    const probe = document.createElement('li')
    probe.className = 'grid grid-cols-[76px_1fr_auto] items-center gap-2'
    expect(ownsATemplate(probe)).toBe(true)

    const bare = document.createElement('li')
    bare.className = 'contents'
    expect(ownsATemplate(bare)).toBe(false)
  })

  /**
   * ⭐ THE INSTRUMENT CONTROL. Everything else asserts a relationship between
   * the rows and the list. If a wrapper is ever inserted between them, those
   * assertions would still find elements and quietly stop describing the same
   * structure — so the parentage is pinned by IDENTITY first.
   */
  it('every census row is a direct child of the one list', () => {
    openStrip()
    const list = screen.getByTestId(`${TID}-rows`)
    const rows = screen.getAllByTestId(`${TID}-row`)

    expect(rows).toHaveLength(4)
    expect(rows.map((r) => r.getAttribute('data-kind'))).toEqual([
      'option',
      'factor',
      'risk',
      'outcome',
    ])
    expect(rows.map((r) => r.parentElement)).toEqual([list, list, list, list])
  })

  /**
   * ⚠⚠ THE ACTUAL DEFECT, AND THE ONE THIS REDS ON. Four rows each owning a
   * template is four grids; `auto` then resolves per row and the columns step.
   * The rows must own NO template.
   */
  it('no row owns a grid template of its own', () => {
    openStrip()
    const rows = screen.getAllByTestId(`${TID}-row`)
    expect(rows.map(ownsATemplate)).toEqual([false, false, false, false])
  })

  /** The rows dissolve into the list's grid rather than forming boxes in it. */
  it('every row is `display:contents`, so its cells join the list grid', () => {
    openStrip()
    const rows = screen.getAllByTestId(`${TID}-row`)
    expect(rows.map((r) => r.className)).toEqual(['contents', 'contents', 'contents', 'contents'])
  })

  /**
   * ⚠ THE ORIGINAL CLAIM, RELOCATED. `auto` is always exactly as wide as its
   * widest content, which is what makes the labels fit by construction rather
   * than by a number someone has to keep correct. The second assertion is what
   * kills the "just use a wider magic number" repair.
   */
  it('the list sizes its label column to CONTENT, never to a pixel literal', () => {
    openStrip()
    const list = screen.getByTestId(`${TID}-rows`)

    expect(ownsATemplate(list)).toBe(true)
    expect(list.className).toContain('grid-cols-[auto_1fr_auto]')
    expect(list.className).not.toMatch(/grid-cols-\[\d+px/)
  })

  /**
   * ⚠⚠ `display:contents` REMOVES THE ELEMENT'S PRINCIPAL BOX, and browsers
   * have dropped `listitem` from the accessibility tree with it. Nothing else
   * in the suite queries this census by role, so that loss would be silent.
   * Bound to the same ELEMENTS, not merely the same count — a matching count
   * over different nodes would pass while the rows themselves went unnamed.
   */
  it('the list keeps its list semantics under `display:contents`', () => {
    openStrip()
    const list = screen.getByTestId(`${TID}-rows`)
    const rows = screen.getAllByTestId(`${TID}-row`)

    expect(within(list).getAllByRole('listitem')).toEqual(rows)
  })
})
