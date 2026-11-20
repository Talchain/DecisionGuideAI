/**
 * SURFACES STEP B (18 Nov): the lane's one Tip. On the lane it stands in for the right-click menu's own tooltip (a second look, which the older look keeps). Bound here: what a menu row's tip says
 * (a label the row cut is said whole, then the row's own note), the one look, and that where it stands is two custom properties, never an inline
 * left/top. The menu's use of it (hover a row, 300 ms) is in canvas/contextMenu/__tests__/CanvasContextMenu.spec.tsx.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { Tip, TIP_GAP, TIP_DELAY, rowTipOf } from '../Tip'

afterEach(() => { cleanup() })

/** A menu row as the menu draws it: its label in `[data-menu-label]`, drawn `shown` px wide while its words need `needs` px. */
const row = (label: string, shown: number, needs: number): HTMLElement => {
  const r = document.createElement('button'), l = document.createElement('span')
  l.setAttribute('data-menu-label', 'x'); l.textContent = label
  Object.defineProperty(l, 'clientWidth', { value: shown }); Object.defineProperty(l, 'scrollWidth', { value: needs })
  r.appendChild(l)
  return r
}
const rect = (left: number, top: number, width: number, height: number) => ({ left, top, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect

describe('what a menu row\'s tip says', () => {
  const LONG = 'Undo: put back the idea you kept about the second market before the pilot'
  it('a label the row cut is said WHOLE, then the row\'s own note. CONTRAST: a label that fits is not repeated, the note alone is said', () => {
    expect(rowTipOf(row(LONG, 200, 520), LONG, 'Takes back the last saved change')).toBe(`${LONG}\nTakes back the last saved change`)
    expect(rowTipOf(row('Rename', 200, 60), 'Rename', 'Change this card\'s name')).toBe('Change this card\'s name')
  })
  it('a cut label with no note of its own still has its whole words; a label that fits and has no note has no tip at all', () => {
    expect(rowTipOf(row(LONG, 200, 520), LONG, undefined)).toBe(LONG)
    expect(rowTipOf(row(LONG, 200, 520), LONG, '')).toBe(LONG)
    expect(rowTipOf(row('Rename', 200, 60), 'Rename', undefined)).toBeNull()
  })
  it('a note that already says the label (the menu\'s own whole-label note) is said once, not after the label again', () => {
    expect(rowTipOf(row(LONG, 200, 520), LONG, LONG)).toBe(LONG)
    expect(rowTipOf(row(LONG, 200, 520), LONG, `${LONG}. Not available on an earlier version.`)).toBe(`${LONG}. Not available on an earlier version.`)
  })
})

describe('the one Tip', () => {
  it('one look (the panel\'s ground and border, the small radius, 240 px at most, read only) and its place in two custom properties, with no inline left or top', () => {
    render(<Tip id="tooltip-x" text={'A row\'s whole words\nand its note'} anchorRect={rect(100, 200, 220, 32)} />)
    const tip = screen.getByRole('tooltip')
    expect(tip).toHaveAttribute('id', 'tooltip-x')
    expect(tip.textContent).toBe('A row\'s whole words\nand its note')
    for (const c of ['rounded-sm', 'border', 'border-panel-border', 'bg-panel', 'max-w-[240px]', 'pointer-events-none', 'whitespace-pre-line', 'shadow-1']) expect(tip.classList.contains(c), c).toBe(true)
    expect([...tip.classList].filter((c) => /^rounded(-|$)/.test(c)), 'one radius').toEqual(['rounded-sm'])
    expect([tip.style.left, tip.style.top], 'no inline position').toEqual(['', ''])
    expect([tip.style.getPropertyValue('--tip-x'), tip.style.getPropertyValue('--tip-y')], 'right of its row, level with it').toEqual([`${100 + 220 + TIP_GAP}px`, '200px'])
  })
  it('one layout: the first line is the title, the rest the body, and the words still read as one string; a lone line is plain', () => {
    const { unmount } = render(<Tip text={'Title\nBody line'} anchorRect={rect(0, 0, 10, 10)} />)
    expect([screen.getByRole('tooltip').querySelector('[data-tip-title]')!.textContent, screen.getByRole('tooltip').querySelector('[data-tip-body]')!.textContent]).toEqual(['Title', 'Body line'])
    expect(screen.getByRole('tooltip').querySelector('[data-tip-title]')!.className).toContain('font-medium')
    unmount()
    render(<Tip text="Just words" anchorRect={rect(0, 0, 10, 10)} />)
    expect([screen.getByRole('tooltip').querySelector('[data-tip-body]'), screen.getByRole('tooltip').querySelector('[data-tip-title]')!.className]).toEqual([null, ''])
  })
  it('the delay is 150 ms, and the tip stays inside the window: left of its anchor at the right edge, and up from the foot', () => {
    expect(TIP_DELAY).toBe(150)
    Object.defineProperty(window, 'innerWidth', { value: 1000, configurable: true }); Object.defineProperty(window, 'innerHeight', { value: 800, configurable: true })
    const spy = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue(rect(0, 0, 200, 60))
    render(<Tip text="Edge" anchorRect={rect(900, 790, 80, 30)} />)
    const tip = screen.getByRole('tooltip')
    expect([tip.style.getPropertyValue('--tip-x'), tip.style.getPropertyValue('--tip-y')]).toEqual([`${900 - 200 - TIP_GAP}px`, `${800 - 60 - TIP_GAP}px`])
    spy.mockRestore()
  })
  it('nothing is drawn with no words or no row to stand beside', () => {
    render(<><Tip text="" anchorRect={rect(0, 0, 10, 10)} /><Tip text="words" anchorRect={null} /></>)
    expect(screen.queryByRole('tooltip')).toBeNull()
  })
})
