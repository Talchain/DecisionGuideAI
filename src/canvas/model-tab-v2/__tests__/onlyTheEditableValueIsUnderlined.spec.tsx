/**
 * The edit affordance marks the value it edits, and nothing else.
 *
 * ── THE WITNESSED DEFECT (Paul, deployed `a9c2e050`, 5 Sep 2026) ────────────
 * Two strings on one row were underlined and neither was a link:
 *
 *     Not set        Olumi: Low (0)
 *     ‾‾‾‾‾‾‾        ‾‾‾‾‾‾‾‾‾‾‾‾‾‾
 *
 * One `underline decoration-dotted` sat on the wrapping `<button>`, and
 * `text-decoration` propagates, so it painted BOTH the editable value and the
 * secondary "Olumi:" estimate hint beside it. The hint is not editable and not
 * a link; underlining it promises a click that does nothing to it.
 *
 * ── WHY THE UNDERLINE IS NOT SIMPLY DELETED ────────────────────────────────
 * It is the only resting signal that a value can be clicked. DS §8.7 reserves
 * resting underlines for links, but deleting this one outright would make
 * editing undiscoverable — trading a small honesty defect for a capability
 * nobody can find. So it MOVES onto the value leaf: the mark now sits exactly
 * on the thing the click edits, which is both what DS asks and what the
 * affordance actually means.
 */
import '@testing-library/jest-dom/vitest'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { ModelRowView } from '../ModelRowView'
import type { ModelRow } from '../types'

const ROW: ModelRow = {
  id: 'f1',
  kind: 'factor',
  group: 'factors',
  label: 'Monthly Engineering Cost',
  primaryValue: null,
  estimateText: 'Low (0)',
  attention: [],
  editable: true,
}

function renderRow(over: Partial<ModelRow> = {}) {
  cleanup()
  render(
    <ul>
      <ModelRowView tier="plain"
        row={{ ...ROW, ...over }}
        editConnected
        onBeginEdit={vi.fn()}
        onSelect={vi.fn()}
        onFocusOnCanvas={vi.fn()}
      />
    </ul>,
  )
}

/** Every element between `node` and the row, inclusive, that sets an underline. */
const underliningAncestors = (node: Element): Element[] => {
  const out: Element[] = []
  for (let el: Element | null = node; el; el = el.parentElement) {
    if (/(^|\s)underline(\s|$)/.test(el.className?.toString?.() ?? '')) out.push(el)
    if (el.tagName === 'LI') break
  }
  return out
}

describe('the edit underline marks the value, not its neighbours', () => {
  it('CONTROL: the probe can SEE an underline where one exists', () => {
    // Without this every assertion below could pass by the detector reading
    // nothing at all — the shape that makes an absence claim vacuous.
    renderRow()
    const value = screen.getByText('Not set')
    expect(underliningAncestors(value).length, 'the value must keep its affordance').toBeGreaterThan(
      0,
    )
  })

  it('the "Olumi:" estimate hint is NOT underlined', () => {
    renderRow()
    const hint = screen.getByText(/Olumi:/)
    expect(
      underliningAncestors(hint).map((el) => el.tagName),
      'a non-editable hint inherited the button underline',
    ).toEqual([])
  })

  it('DISCRIMINATOR: a row with no estimate still underlines its value', () => {
    // Proves the fix did not simply delete the affordance for everyone — the
    // cheapest way to make the assertion above pass, and the wrong one.
    renderRow({ estimateText: undefined })
    expect(underliningAncestors(screen.getByText('Not set')).length).toBeGreaterThan(0)
  })

  it('a NON-editable row underlines nothing at all', () => {
    cleanup()
    render(
      <ul>
        <ModelRowView tier="plain" row={{ ...ROW, editable: false, primaryValue: '£12,000' }} onSelect={vi.fn()} />
      </ul>,
    )
    expect(underliningAncestors(screen.getByText('£12,000'))).toEqual([])
  })
})
