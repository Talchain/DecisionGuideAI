/**
 * R3 "pristine" (DL 4 Nov, from the R2-vs-Paul's-staging gap list): a card title is one block of inline words, so a wrapped title returns
 * to the card's left edge; core's reason wraps to two lines before an ellipsis (the outcome band's words are hover and reader text since option a2); the lens bar draws icon-only,
 * each label on hover, when its labelled width does not fit beside the pill, so it keeps the top row.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { act, cleanup, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { ViewLensBar } from '../ViewLensBar'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewOptionBand } from '../v10'
import { lensBarFitsBesidePill } from '../../canvas/artefacts/LensBar'

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
    expect(c.querySelector('[data-testid="view-option-band-x"]')!.getAttribute('title')).toBe(text)
  })
})

describe('the lens bar beside the pill when it fits; else labelled, on the row under it (R3 pristine 5; J1 step 5)', () => {
  it('fits: the run between the pill and the dock, less the gaps, holds the bar', () => {
    expect(lensBarFitsBesidePill({ viewportWidth: 1440, pillRight: 600, dockInset: 500, barWidth: 300 })).toBe(true)
    expect(lensBarFitsBesidePill({ viewportWidth: 1440, pillRight: 860, dockInset: 500, barWidth: 300 })).toBe(false)
  })

  const draw = (labelled: number, compactW: number) => {
    const banner = document.createElement('div'); banner.setAttribute('role', 'banner'); document.body.appendChild(banner)
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) {
      if (this === banner) return { left: 16, right: 860, width: 844, top: 16, bottom: 56, height: 40, x: 16, y: 16, toJSON: () => ({}) } as DOMRect
      if (this.getAttribute('data-testid') === 'lens-bar') { const w = this.hasAttribute('data-compact') ? compactW : labelled; return { left: 0, right: w, width: w, top: 0, bottom: 40, height: 40, x: 0, y: 0, toJSON: () => ({}) } as DOMRect }
      return { left: 0, right: 0, width: 0, top: 0, bottom: 0, height: 0, x: 0, y: 0, toJSON: () => ({}) } as DOMRect
    })
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1440)
    useViewStore.setState({ view: golden('european') })
    render(<ViewLensBar />)
    return () => banner.remove()
  }

  it('J1 step 5 (the prototype\'s labelled bar): no room beside the pill (1440, pill to 860): the bar keeps every label and takes the row under the pill, at its left', async () => {
    const done = draw(600, 160) // run beside the pill: 1440 − 12 − (860 + 12) = 556
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    const bar = screen.getByTestId('lens-bar')
    expect(bar.hasAttribute('data-compact')).toBe(false)
    for (const b of screen.getAllByRole('radio')) expect(b.querySelector('[data-lens-label]')!.className).not.toContain('sr-only')
    expect([parseFloat(bar.style.left), parseFloat(bar.style.top)]).toEqual([16, 56 + 8]) // the pill's left, under its bottom
    done()
  })

  it('PL-155 (900 px): the labelled bar cannot fit the canvas column beside the 352 px dock (900 − 352 − 12 − 70 = 466 < 640), so it is icon-only, every label on hover and for a reader; at 1232 it is labelled', async () => {
    const dock = document.createElement('aside'); dock.setAttribute('aria-label', 'Outputs dock'); document.body.appendChild(dock)
    const asDock = (left: number) => ({ left, right: left + 352, width: 352, top: 8, bottom: 696, height: 688, x: left, y: 8, toJSON: () => ({}) }) as DOMRect
    let width = 900
    const done = draw(640, 200)
    vi.spyOn(window, 'innerWidth', 'get').mockImplementation(() => width)
    const base = vi.mocked(Element.prototype.getBoundingClientRect).getMockImplementation()!
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) { return this === dock ? asDock(width - 352) : base.call(this) })
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    const bar = screen.getByTestId('lens-bar')
    expect(bar.hasAttribute('data-compact'), 'icon-only at 900').toBe(true)
    for (const b of screen.getAllByRole('radio')) { expect(b.querySelector('[data-lens-label]')!.className).toContain('sr-only'); expect(b.getAttribute('aria-label')).toBeTruthy() }
    width = 1232
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    expect(screen.getByTestId('lens-bar').hasAttribute('data-compact'), 'labelled again at 1232').toBe(false)
    dock.remove(); done()
  })

  it('room for the labels: the bar is labelled as before', async () => {
    const done = draw(300, 160)
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    expect(screen.getByTestId('lens-bar').hasAttribute('data-compact')).toBe(false)
    for (const b of screen.getAllByRole('radio')) expect(b.querySelector('[data-lens-label]')!.className).not.toContain('sr-only')
    done()
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
