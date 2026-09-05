/**
 * Two things needing attention on one row look like two DIFFERENT things.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ────────────
 * A row carried two warning marks and no legend. Measured: the renderer maps
 * over `row.attention` emitting the SAME `⚠` character, in the same colour, at
 * the same size, once per reason — and two reasons co-occur on two producible
 * paths (`contested` + `fragile` on a relationship; `no-value` +
 * `unconfirmed-estimate` on a factor, from two different fields). Five distinct
 * meanings existed and all five rendered as one indistinguishable mark, with
 * the words available only on hover.
 *
 * ── WHY A LEGEND IS NOT THE FIX ────────────────────────────────────────────
 * The estate HAS a legend component — `EntityBar` — and it sits inside the
 * `LEGACY_DETAILED_EDITOR_MOUNTED = false` block, i.e. the one thing that
 * taught the vocabulary was switched off while the glyphs that needed it stayed
 * on. A legend is also a hand-maintained mirror of the mark set. Making the
 * MARK carry the meaning needs no legend to stay true.
 *
 * ── AND WHY NOT `⚠` AT ALL ─────────────────────────────────────────────────
 * DS v5 §9.9 names `'⚠'` explicitly among the unicode characters that may not
 * stand in for an icon. The `emoji-icon` CI guard is report-only AND its
 * detector needs an icon key on the same line, so a bare JSX text node was
 * invisible to it — the rule was real and unenforced, which is why this file
 * asserts it directly.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import { ATTENTION_LABEL } from '../rowPresentation'
import type { AttentionReason, ModelRow } from '../types'

const ROW: ModelRow = {
  id: 'e1',
  kind: 'relationship',
  group: 'relationships',
  label: 'Tech Lead Hired → Delivery Throughput',
  primaryValue: 'Moderate positive effect',
  attention: [],
  editable: false,
}

function renderRow(attention: readonly AttentionReason[]) {
  cleanup()
  render(
    <ul>
      <ModelRowView tier="plain" row={{ ...ROW, attention }} onSelect={vi.fn()} />
    </ul>,
  )
}

const markFor = (reason: AttentionReason) =>
  screen.getByTestId(`model-row-v2-e1-attention-${reason}`)

/** What the mark actually draws — the icon's own identity, not its wrapper's. */
const shapeOf = (el: HTMLElement) => {
  const svg = el.querySelector('svg')
  return svg?.getAttribute('class')?.replace(/\s+/g, ' ').trim() ?? el.textContent?.trim() ?? ''
}

const ALL: AttentionReason[] = [
  'no-value',
  'unconfirmed-estimate',
  'contested',
  'fragile',
  'missing-intervention',
]

describe('an attention mark says WHICH', () => {
  it('CONTROL: the probe can see a mark, and its accessible name survives', () => {
    // Without this every assertion below could pass by finding nothing.
    renderRow(['fragile'])
    const mark = markFor('fragile')
    expect(mark).toBeVisible()
    expect(mark).toHaveAccessibleName(ATTENTION_LABEL.fragile)
  })

  it('THE WITNESSED PAIR: contested + fragile do not draw the same mark', () => {
    renderRow(['contested', 'fragile'])
    expect(shapeOf(markFor('contested')), 'two reasons, one indistinguishable mark').not.toBe(
      shapeOf(markFor('fragile')),
    )
  })

  it('THE OTHER PRODUCIBLE PAIR: no-value + unconfirmed-estimate differ too', () => {
    renderRow(['no-value', 'unconfirmed-estimate'])
    expect(shapeOf(markFor('no-value'))).not.toBe(shapeOf(markFor('unconfirmed-estimate')))
  })

  it('DISCRIMINATOR: every reason has its own mark, not just the two witnessed', () => {
    // Written against the ENUM, not against the pair I happened to be shown —
    // a corpus drawn from the failure in hand cannot see the class next to it.
    renderRow(ALL)
    const shapes = ALL.map((r) => shapeOf(markFor(r)))
    expect(new Set(shapes).size, `marks collapsed: ${shapes.join(' | ')}`).toBe(ALL.length)
  })

  it('no mark is a bare unicode glyph', () => {
    renderRow(ALL)
    for (const reason of ALL) {
      const mark = markFor(reason)
      expect(mark.querySelector('svg'), `${reason} has no icon element`).not.toBeNull()
      expect(
        mark.textContent ?? '',
        `${reason} still renders a unicode character as its icon`,
      ).not.toMatch(/[⚠⛔ℹ✕✓△▲!]/)
    }
  })

  it('every reason still carries its sentence as an accessible name', () => {
    renderRow(ALL)
    for (const reason of ALL) {
      expect(markFor(reason)).toHaveAccessibleName(ATTENTION_LABEL[reason])
    }
  })
})
