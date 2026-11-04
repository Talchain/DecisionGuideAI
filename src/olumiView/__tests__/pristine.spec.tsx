/**
 * R3 "pristine" (DL 4 Nov, from the R2-vs-Paul's-staging gap list): a card title is one block of inline words, so a wrapped title returns
 * to the card's left edge; core's reason and the outcome band's line wrap to two lines before an ellipsis; the lens bar draws icon-only,
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
import { LENS_COPY } from '../../canvas/artefacts/lenses'

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
      const number = block.querySelector('[data-card-number]')
      if (number !== null) expect(number.nextSibling?.textContent, card.id).toBe(' ') // a word space, not a gap
      cleanup()
    }
  })
})

describe('core\'s words wrap to two lines before an ellipsis (R3 pristine 4)', () => {
  it('a card\'s reason line', () => {
    const card = golden('european').model!.cards.find((c) => c.reason !== null && c.figure === null && c.rows.length === 0)!
    const p = render(<ViewCard card={card} />).container.querySelector(`[data-view="${card.id}.reason"]`)!
    expect(p.textContent).toBe(card.reason) // the probe draws a real reason line
    expect(p.className).toContain('line-clamp-2')
    expect(p.className).not.toContain('line-clamp-1')
  })

  it('the outcome band\'s line', () => {
    const at = 'x.rows.0.outcome.text'
    const p = render(<ViewOptionBand id="x" band={{ at, text: 'between 272 and 2,020 hours of engineering effort, in this model', title: '', leftPct: 10, widthPct: 70, medianPct: 40 }} />).container.querySelector(`[data-view="${at}"]`)!
    expect(p.className).toContain('line-clamp-2')
    expect(p.className).not.toContain('line-clamp-1')
  })
})

describe('the lens bar keeps the top row: icon-only when its labels do not fit beside the pill (R3 pristine 5)', () => {
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

  it('no room for the labels (1440, pill to 860): each label is hidden but named, and on hover; the bar stays on the top row', async () => {
    const done = draw(600, 160) // run beside the pill: 1440 − 12 − (860 + 12) = 556
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    const bar = screen.getByTestId('lens-bar')
    expect(bar.getAttribute('data-compact')).toBe('true')
    for (const b of screen.getAllByRole('radio')) {
      const id = b.getAttribute('data-testid')!.slice('lens-bar-'.length) as keyof typeof LENS_COPY.label
      expect(b.querySelector('[data-lens-label]')!.className, id).toContain('sr-only')
      if (b.getAttribute('aria-disabled') !== 'true') expect(b.getAttribute('title'), id).toBe(LENS_COPY.label[id])
      expect(b.getAttribute('aria-label'), id).toContain(LENS_COPY.label[id])
    }
    expect(parseFloat(bar.style.top)).toBeLessThan(40) // the pill's row, not the row under it
    done()
  })

  it('room for the labels: the bar is labelled as before', async () => {
    const done = draw(300, 160)
    await act(async () => { window.dispatchEvent(new Event('resize')) })
    expect(screen.getByTestId('lens-bar').hasAttribute('data-compact')).toBe(false)
    for (const b of screen.getAllByRole('radio')) expect(b.querySelector('[data-lens-label]')!.className).not.toContain('sr-only')
    done()
  })
})
