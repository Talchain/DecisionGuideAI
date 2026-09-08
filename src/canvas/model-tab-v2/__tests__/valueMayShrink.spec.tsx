/**
 * `valueMayShrink` + `ValueLeaf` — the whole of commit `1d6e528b`, which
 * shipped with NO coverage of any kind.
 *
 * An independent review proved it by reversion rather than by grep: both
 * `<ValueLeaf/>` call sites returned to bare `{display ?? …}` and both
 * classNames back to their pre-PR form left **52 files / 808 tests green**.
 * A fix whose full removal turns nothing red is, by this repo's own standing
 * rule, not merge-ready — and this predicate is a pure function of a string
 * with a bare magic boundary, so jsdom's inability to lay anything out is no
 * excuse. The layout claim is untestable here; the DECISION and the PLACEMENT
 * are not, and both are what regressed.
 *
 * ── THE CORPUS IS DERIVED, NOT PASTED ───────────────────────────────────────
 *
 * The Model tab's relationship value comes from `getDirectionalStrengthLabel`
 * (`model-tab-v2/adapters.ts:381,384`), so this file CALLS that producer over
 * its own band boundaries instead of hardcoding its outputs. A pasted string
 * corpus goes stale the moment the producer's copy changes, and it silently
 * encodes the test author's model of the producer rather than the producer —
 * which is exactly how a comment in `ModelRowView.tsx` came to cite
 * "Very strong effect, direction not stated" as producer-real when
 * `StrengthBand` is `strong | moderate | weak | negligible` and no such band
 * exists on this path.
 */
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { getDirectionalStrengthLabel } from '../../components/model-tab/strengthBands'
import { resolveEdgeDirectionDisplay } from '../../domain/edgeValueProvenance'
import { ModelRowView, valueMayShrink } from '../ModelRowView'
import type { ModelRow } from '../types'

/** Every value this producer can put in the column, derived by calling it. */
function producerCorpus(): string[] {
  const stated = resolveEdgeDirectionDisplay({ direction: 'positive', direction_source: 'user' })
  const statedNegative = resolveEdgeDirectionDisplay({ direction: 'negative', direction_source: 'user' })
  const withheld = resolveEdgeDirectionDisplay({ effect_direction: 'unknown' })
  // One magnitude either side of each band boundary, plus the negligible floor.
  const means = [0.9, 0.7, 0.5, 0.3, 0.15, 0.01]
  return [
    ...means.map(m => getDirectionalStrengthLabel(m, stated)),
    ...means.map(m => getDirectionalStrengthLabel(m, statedNegative)),
    ...means.map(m => getDirectionalStrengthLabel(m, withheld)),
  ]
}

describe('valueMayShrink — which values may lose characters, and which may not', () => {
  it('the corpus this test relies on is really the producer’s (anti-vacuity)', () => {
    const corpus = producerCorpus()
    // PRECONDITION: if the producer ever stops emitting distinct phrases, every
    // assertion below would still pass while measuring almost nothing.
    expect(new Set(corpus).size).toBeGreaterThanOrEqual(4)
    expect(corpus.every(s => s.length > 0)).toBe(true)
    // …and the withheld-direction family, the longest one, is present.
    expect(corpus.some(s => /direction not stated$/.test(s))).toBe(true)
  })

  it('EVERY value this producer can emit is allowed to shrink', () => {
    // The point of the fix: these are multi-word qualitative phrases that keep
    // their meaning when clipped, and the identity track is the only flexible
    // one — so 100% of an immovable value cell comes out of the row's label.
    for (const value of producerCorpus()) {
      expect(valueMayShrink(value), `producer value ${JSON.stringify(value)}`).toBe(true)
    }
  })

  /**
   * ⭐ THE OPPOSITE-DIRECTION TWIN. Without it, `valueMayShrink` could be
   * `() => true` and every assertion above would still pass — and `() => true`
   * is the defect that broke a number away from its unit.
   */
  it.each([
    ['a bare percentage', '35 %'],
    // ⚠ THE DIGIT GUARD'S ONLY COVERAGE, AND IT HAD NONE. Every other
    // digit-bearing member here is <= 12 characters, so the LENGTH clause
    // decided all of them and deleting `if (/\d/.test(text)) return false` left
    // the whole file green. This one is 19 characters WITH a space, so the
    // length clause says "may shrink" and only the digit guard can say no. It
    // is also the exact value that crushed the value track to 44.4px against
    // 118px of content when the grid carried `minmax(0,auto)`.
    ['a long currency figure with a unit', '£1,250,000 per year'],
    ['a long numeric range', '0.25 to 0.75 per quarter'],
    ['a quantity with a unit', '45 days'],
    ['a signed number', '-0.8'],
    ['a currency figure', '£1.2m'],
    ['a short two-word phrase', 'Not set'],
    ['a single long word', 'Uncharacterised'],
    ['no value at all', null],
  ])('%s must NEVER be clipped: %s', (_label, value) => {
    expect(valueMayShrink(value as string | null)).toBe(false)
  })

  /**
   * The boundary is a bare `> 12`, so it gets pinned from both sides. It is not
   * derived from anything and nothing else in the tree records it, which is
   * precisely why an accidental `>=` or a `14` must turn something red.
   */
  it('the length boundary is exactly "longer than 12", pinned from both sides', () => {
    expect('ab cdefghijk'.length).toBe(12)
    expect(valueMayShrink('ab cdefghijk')).toBe(false)
    expect('ab cdefghijkl'.length).toBe(13)
    expect(valueMayShrink('ab cdefghijkl')).toBe(true)
  })

  it('surrounding whitespace does not buy a value past the boundary', () => {
    // The predicate trims first; without that, padding alone could flip it.
    expect(valueMayShrink('  ab cdefghijk  ')).toBe(false)
  })
})

/**
 * ── THE PLACEMENT, WHICH IS THE REGRESSION `1d6e528b` EXISTS TO PREVENT ─────
 *
 * `truncate` on the flex CONTAINER is a separate, measured defect (it caused
 * text-over-text); on a text LEAF it is correct. jsdom cannot tell us whether
 * anything visually clips — but WHICH ELEMENT carries the class is a structural
 * fact it can see, and nothing saw it before.
 */
describe('ValueLeaf — the ellipsis sits on the text leaf, never on the flex box', () => {
  /**
   * ⚠⚠ RENDERED THROUGH THE REAL `ModelRowView`, AND THE FIRST CUT WAS NOT.
   * It re-declared a local `Leaf` with the same JSX and asserted THAT — a guard
   * agreeing with its own copy of the code, which would have stayed green with
   * `truncate` moved back onto the container in the component this file names.
   * Binding by `model-row-v2-<id>-value` is the identity binding this
   * directory's own header requires.
   */
  const longValue = 'Moderate effect, direction not stated'

  function relationshipRow(id: string, primaryValue: string | null): ModelRow {
    return {
      id,
      kind: 'relationship',
      group: 'relationships',
      label: `A \u2192 B (${id})`,
      primaryValue,
      attention: [],
      editable: true,
    }
  }

  it('a shrinkable value puts `truncate` on a leaf span, and NOT on the value cell', () => {
    render(<ModelRowView row={relationshipRow('r1', longValue)} tier="plain" />)
    const cell = screen.getByTestId('model-row-v2-r1-value')
    // PRECONDITION: this really is a value the predicate lets shrink — else the
    // assertions below are about a branch this fixture never reaches.
    expect(valueMayShrink(longValue), 'fixture must reach the shrinkable branch').toBe(true)
    expect(cell).toHaveTextContent(longValue)
    expect(
      cell.className,
      '`truncate` on the flex CONTAINER is the separate, measured defect (text over text)',
    ).not.toMatch(/\btruncate\b/)
    const clipped = Array.from(cell.querySelectorAll('span')).filter(el =>
      /\btruncate\b/.test(el.className),
    )
    expect(clipped.length, 'exactly one clipping leaf inside the value cell').toBe(1)
    expect(clipped[0]?.textContent).toBe(longValue)
  })

  /**
   * ⚠⚠ THE EDITABLE BUTTON BRANCH — WHICH THE GUARD ABOVE NEVER REACHED.
   *
   * `relationshipRow` is named `editable: true`, and that is NOT what opens the
   * editor: `editorAvailable` also needs `onBeginEdit`, which the renders above
   * do not pass. So every assertion above landed on the read-only SPAN, and
   * deleting `ValueLeaf` from the BUTTON branch — the live relationships path
   * this change headlines — left 57/57 green.
   *
   * The precondition is pinned in-test by asserting the tag, so this cannot
   * quietly drift back onto the span it was written to escape.
   */
  it('the EDITABLE value renders a button, and the ellipsis still sits on the leaf', () => {
    render(
      <ModelRowView
        row={relationshipRow('r3', longValue)}
        tier="plain"
        editConnected
        onBeginEdit={() => {}}
      />,
    )
    const cell = screen.getByTestId('model-row-v2-r3-value')
    // PRECONDITION: this is the button branch, not the span the other tests hit.
    expect(cell.tagName, 'fixture must reach the EDITABLE branch').toBe('BUTTON')
    expect(cell).toHaveTextContent(longValue)
    expect(
      cell.className,
      '`truncate` on the flex CONTAINER is the measured text-over-text defect',
    ).not.toMatch(/\btruncate\b/)
    const clipped = Array.from(cell.querySelectorAll('span')).filter(el =>
      /\btruncate\b/.test(el.className),
    )
    expect(clipped.length, 'exactly one clipping leaf inside the editable value cell').toBe(1)
    expect(clipped[0]?.textContent).toBe(longValue)
  })

  it('a value that must not shrink carries no clipping class anywhere in its cell', () => {
    const bare = '35 %'
    render(<ModelRowView row={relationshipRow('r2', bare)} tier="plain" />)
    const cell = screen.getByTestId('model-row-v2-r2-value')
    // PRECONDITION: the opposite branch, pinned the same way.
    expect(valueMayShrink(bare), 'fixture must reach the non-shrinkable branch').toBe(false)
    expect(cell).toHaveTextContent(bare)
    expect(cell.className).not.toMatch(/\btruncate\b/)
    expect(
      Array.from(cell.querySelectorAll('span')).some(el => /\btruncate\b/.test(el.className)),
      'a bare measurement must never be cut — that is how a number was broken from its unit',
    ).toBe(false)
  })
})
