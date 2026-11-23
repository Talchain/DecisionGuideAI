/**
 * R3 "pristine" (DL 4 Nov, from the R2-vs-Paul's-staging gap list): a card title is one block of inline words, so a wrapped title returns
 * to the card's left edge; core's reason wraps to two lines before an ellipsis (the outcome band's words are hover and reader text since option a2); the lens bar is
 * icons only, always on the pill's row, and the pill gives way to make its room (Paul, 17 Nov).
 */
import { laneTipOf } from './tipHelpers'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render, screen } from '@testing-library/react'
import { typography } from '../../styles/typography'
import type { View } from '../client'
import { useViewStore } from '../store'
import { lensBarPlace, ViewLensBar } from '../ViewLensBar'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewOptionBand } from '../v10'
import { TOP_ROW_BAR, topRowLimit } from '../TeamPresence'

const golden = (n: string): View => JSON.parse(readFileSync(path.resolve(`src/olumiView/golden/${n}.view.json`), 'utf8'))
afterEach(() => { cleanup(); vi.restoreAllMocks(); useViewStore.setState({ view: null }) })

describe('a card title wraps to the card\'s left edge (R3 pristine 3)', () => {
  it('european: the number, the heading and the marks are inline words of one block, never flex columns', () => {
    for (const card of golden('european').model!.cards) {
      const c = render(<ViewCard card={card} />).container
      const heading = c.querySelector<HTMLElement>(`[data-view="${card.id}.heading"]`)!
      const block = heading.parentElement!
      expect(block.tagName, card.id).toBe('P')
      expect(block.getAttribute('data-view-title'), card.id).toBe(card.id)
      expect(block.className, card.id).not.toMatch(/\bflex\b/)
      expect(block.querySelector('[data-card-number]'), card.id).toBeNull() // no card codes (DL 8 Nov, V11 audit)
      cleanup()
    }
  })
})

describe('core\'s words on the face are whole, never cut (R3 pristine 4; R25, Paul\'s finish line: no cut text)', () => {
  it('a card\'s reason line', () => {
    const card = golden('european').model!.cards.find((c) => c.reason !== null && c.figure === null && c.rows.length === 0)!
    const p = render(<ViewCard card={card} />).container.querySelector(`[data-view="${card.id}.reason"]`)!
    expect(p.textContent).toBe(card.reason) // the probe draws a real reason line
    expect(p.className).not.toMatch(/line-clamp|truncate/)
  })

  it('the outcome band\'s words: in the DOM whole and on hover, no longer a line on the face (option a2)', () => {
    // Option a2 (Paul's item 1, 6 Nov): the band's words left the face (they drew a two-line row on every option card) for the bar's hover
    // and label and the reader text; was a two-line line. Still whole, never cut to one line.
    const at = 'x.rows.0.outcome.text', text = 'between 272 and 2,020 hours of engineering effort, in this model'
    const c = render(<ViewOptionBand id="x" band={{ at, text, title: '', leftPct: 10, widthPct: 70, medianPct: 40, aim: null }} />).container
    const p = c.querySelector(`[data-view="${at}"]`)!
    expect(p.textContent).toBe(text)
    expect(p.className).toContain('sr-only')
    expect(p.className).not.toContain('line-clamp-1')
    expect(laneTipOf(c.querySelector<HTMLElement>('[data-testid="view-option-band-x"]')!)).toBe(text)
  })
})

// CHANGED BY DESIGN (Paul, 17 Nov: "make the top floating menu all icons so it always fits on the top of the screen and not underneath the main
// left-hand top menu"): the labelled bar and its labelled-or-icon measuring are gone; these four rows (J1 step 5, PL-155, room for the labels,
// lensBarFitsBesidePill) bound that mode. The rule now: icons only, directly right of the pill on its row, the pill making the room.
describe('the lens bar: icons only, directly right of the pill on its row, and the pill keeps its room (Paul 17 Nov; contract section 8)', () => {
  it('placed beside the pill once the pill has made room (hidden while it gives way; the row under it only at its tightest); every lens an icon named in core\'s words; the pill\'s limit counts the bar', () => {
    // 1128 at 1.33 with the dock open (317 px): the pill tightened to end at 477; the six icons and Rests on's count are 234 wide.
    const at = { pill: { left: 12, right: 477, bottom: 52 }, barWidth: 234, viewportWidth: 1128, dockInset: 317, tightest: false }
    expect(lensBarPlace(at)).toEqual({ left: 489, top: 12 })
    // CONTRAST: the pill before it gave way (it ends at 709): no room yet, so no place (hidden), never the row under the pill...
    expect(lensBarPlace({ ...at, pill: { left: 12, right: 709, bottom: 52 } })).toBeNull()
    // ...which it takes only when the pill is at its tightest and still leaves no room (a window narrower than the three sizes).
    expect(lensBarPlace({ ...at, pill: { left: 12, right: 709, bottom: 52 }, tightest: true })).toEqual({ left: 12, top: 60 })
    // Icons only: each lens's words are core's, as its name and its hover; none is drawn as a visible label.
    const v = golden('european')
    useViewStore.setState({ view: v })
    render(<ViewLensBar />)
    const bar = screen.getByTestId('lens-bar')
    expect(bar.hasAttribute(TOP_ROW_BAR)).toBe(true)
    const radios = screen.getAllByRole('radio')
    expect(radios.map((b) => b.getAttribute('data-testid'))).toEqual(['lens-bar-full', 'lens-bar-tradeoffs', 'lens-bar-rests_on', 'lens-bar-premortem', 'lens-bar-what_changes', 'lens-bar-what_if'])
    for (const b of radios) {
      const id = b.getAttribute('data-testid')!.slice('lens-bar-'.length) as keyof typeof v.lens_words.label
      expect(b.querySelector('svg'), id).not.toBeNull()
      expect(b.querySelector('[data-lens-label]')!.className, id).toBe(`sr-only ${typography.viewPanelMeta}`)
      const hover = b.getAttribute('aria-disabled') === 'true' ? v.lens_words.needsRun : v.lens_words.label[id]
      expect(laneTipOf(b), id).toBe(hover)
      expect(b.getAttribute('aria-label'), id).toBe(id === 'rests_on' ? v.lens_words.rests_on_label : v.lens_words.label[id])
    }
    // The pill's limit (the avatars and useTopBarFit read it): the dock's edge less the gap, less the bar and its gap while the bar is on the page.
    const dock = document.createElement('aside'); dock.setAttribute('aria-label', 'Outputs dock'); document.body.appendChild(dock)
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1128)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      const r = (left: number, width: number) => ({ left, right: left + width, width, top: 0, bottom: 40, height: 40, x: left, y: 0, toJSON: () => ({}) }) as DOMRect
      return this === dock ? r(811, 317) : this.hasAttribute(TOP_ROW_BAR) ? r(0, 234) : r(0, 0)
    })
    expect(topRowLimit()).toBe(1128 - 317 - 12 - (234 + 12))
    // CONTRAST: the older look's pill (no lens bar of this lane on the page) keeps only the dock's gap.
    cleanup()
    expect(topRowLimit()).toBe(1128 - 317 - 12)
    dock.remove()
  })
})

describe('a worked-out figure with a line per option is drawn a row per option, never one run-on sentence (R3 pristine: OC1)', () => {
  // A 3-option outcome: core's three lines verbatim from the capacity model of the 4 Nov witness (sys31, scenario s_f79b0d4c6864).
  const base = golden('capacity-v3').model!.cards.find((c) => c.id === 'total_capacity')!
  const card = {
    ...base,
    figure: { ...base.figure!, text: "Keep current staffing: 80 tickets/week · Add one specialist: about 100 tickets/week (93.7 to 106 tickets/week) if 'A new hire may unsettle the team' does not happen · Share a part-time specialist with another team: about 90 tickets/week (86.8 to 93.2 tickets/week)" },
    values: [
      { option: 'keep_staffing', text: '80 tickets/week', p10: 80, p50: 80, p90: 80, if_absent: [], olumi: true },
      { option: 'add_specialist', text: "about 100 tickets/week (93.7 to 106 tickets/week) if 'A new hire may unsettle the team' does not happen", p10: 93.69, p50: 100.09, p90: 106.42, if_absent: ['team_unsettled'], olumi: false },
      { option: 'share_specialist', text: 'about 90 tickets/week (86.8 to 93.2 tickets/week)', p10: 86.85, p50: 90.05, p90: 93.21, if_absent: [], olumi: true },
    ],
  } as typeof base

  it('three options: three rows in core\'s order, each core\'s line verbatim and whole, also on hover; the sentence is the rows\' hover', () => {
    const c = render(<ViewCard card={card} />).container
    const rows = [...c.querySelectorAll<HTMLElement>('[data-value-row]')]
    expect(rows.map((r) => r.getAttribute('data-value-row'))).toEqual(['keep_staffing', 'add_specialist', 'share_specialist'])
    rows.forEach((r, i) => {
      expect(r.querySelector(`[data-view="total_capacity.values.${i}.text"]`)?.textContent).toBe(card.values![i]!.text)
      // R25 (Paul's finish line, 7 Nov: no cut text; his 6 Nov test cut "6.73 months (2.61 …"): whole; was one line cut short (option a2).
      expect(r.querySelector(`[data-view="total_capacity.values.${i}.text"]`)!.className).not.toMatch(/line-clamp|truncate/)
      expect(r.getAttribute('title')).toBe(card.values![i]!.text)
    })
    expect(c.querySelector('[data-view="total_capacity.figure.text"]')).toBeNull() // not also the run-on sentence
    expect(c.querySelector('[data-view-values="total_capacity"]')!.getAttribute('title')).toContain(card.figure!.title)
  })

  it('one line (a single value, or none): the figure\'s own line as before', () => {
    for (const values of [[card.values![0]!], []]) {
      const c = render(<ViewCard card={{ ...card, values }} />).container
      expect(c.querySelector('[data-view="total_capacity.figure.text"]')?.textContent).toBe(card.figure!.text)
      expect(c.querySelector('[data-value-row]')).toBeNull()
      cleanup()
    }
  })
})
