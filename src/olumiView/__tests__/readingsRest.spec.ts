/**
 * PL-1083 (1): the rest position of a held proposal's reading rows, measured on the 12:15Z layout of 452caf7a's held cut13 proposal at 1232
 * (pinned box 348 px tall, actions 116 px, two rows). Boxes are stubbed (jsdom has no layout); the rule is checked, not the browser.
 */
import { describe, expect, it } from 'vitest'
import { readingsRest, restTop } from '../readingsRest'

const at = (el: HTMLElement, top: number, height: number) => { el.getBoundingClientRect = () => ({ top, bottom: top + height, height, left: 0, right: 0, width: 0, x: 0, y: top, toJSON: () => ({}) }) as DOMRect; return el }
const setup = (scrollTop: number, rows: Array<[number, number]>) => {
  const box = document.createElement('div'), root = document.createElement('div'), foot = document.createElement('div')
  Object.defineProperty(box, 'clientHeight', { value: 348 }); Object.defineProperty(box, 'clientTop', { value: 0 }); box.scrollTop = scrollTop
  at(box, 248, 350); at(foot, 0, 116)
  // Row positions are given in scroll coordinates; on screen they sit at box top + y - scrollTop.
  for (const [y, h] of rows) { const r = document.createElement('fieldset'); r.setAttribute('data-reading-row', ''); at(r, 248 + y - scrollTop, h); root.append(r) }
  return { box, root, foot }
}

describe('readingsRest', () => {
  it('both rows whole above the actions: the range runs from the last row clear of the foot to the first row\'s top', () => {
    const { box, root, foot } = setup(0, [[300, 100], [408, 90]])
    expect(readingsRest(box, root, foot)).toEqual({ low: 498 + 8 + 116 - 348, high: 292, rows: 2, short: -18 })
    expect(restTop(0, readingsRest(box, root, foot)!, 900)).toBe(274) // the least move from rest that clears the foot
  })
  it('the range does not depend on where the box is scrolled now', () => {
    const a = setup(0, [[300, 100], [408, 90]]), b = setup(150, [[300, 100], [408, 90]])
    expect(readingsRest(b.box, b.root, b.foot)).toEqual(readingsRest(a.box, a.root, a.foot))
  })
  it('already in range: no move', () => {
    const { box, root, foot } = setup(0, [[300, 100], [408, 90]])
    expect(restTop(280, readingsRest(box, root, foot)!, 900)).toBe(280)
  })
  it('13:50Z on 7163b55b, long words: the second row does not fit, so the first rests whole above the actions; `short` is what all would need', () => {
    const { box, root, foot } = setup(0, [[300, 200], [508, 215]])
    const r = readingsRest(box, root, foot)!
    expect(r).toEqual({ low: 500 + 8 + 116 - 348, high: 292, rows: 1, short: 723 + 8 + 116 - 348 - 292 })
    expect(restTop(0, r, 900)).toBe(276)
  })
  it('the first row fits only without its gap: it gives the gap up and still rests whole', () => {
    const { box, root, foot } = setup(0, [[300, 228], [536, 100]])
    const r = readingsRest(box, root, foot)!
    expect([r.low, r.high, r.rows]).toEqual([528 + 116 - 348, 300, 1])
  })
  it('not even the first row fits: the first row\'s top, never past it; no row is said to rest whole', () => {
    const { box, root, foot } = setup(0, [[300, 238], [546, 215]])
    const r = readingsRest(box, root, foot)!
    expect([r.low, r.high, r.rows]).toEqual([292, 292, 0])
    expect(r.short).toBeGreaterThan(0)
    expect(restTop(0, r, 900)).toBe(292)
  })
  it('CONTRAST: no reading row held: nothing to place', () => {
    const { box, root, foot } = setup(0, [])
    expect(readingsRest(box, root, foot)).toBeNull()
  })
  it('never past the end of the box\'s scroll, never below 0', () => {
    expect(restTop(0, { low: 500, high: 600 }, 420)).toBe(420)
    expect(restTop(0, { low: -40, high: -8 }, 420)).toBe(0)
  })
})

describe('PL-1083 (1), new look, DL 12:5xZ (A): what yields while the proposal holds readings', async () => {
  const { readFileSync } = await import('node:fs')
  const css = readFileSync('src/olumiView/look/olumiLook.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const rule = (sel: string) => { const i = css.indexOf(sel + ' {'); return i < 0 ? null : css.slice(i, css.indexOf('}', i) + 1) }
  it('first More ways hides', () => expect(rule("[data-testid='view-chat']:has(.ok-pinned [data-reading-row]) > [data-testid='view-more-ways']")).toMatch(/display: none/))
  it('then the thread may shrink below its floor', () => expect(rule("[data-testid='view-chat']:has(.ok-pinned [data-reading-row]) > [data-thread-wrap]")).toMatch(/min-height: 0/))
  it('the box shrinks rather than run past the composer', () => expect(rule('.ok-pinned:has([data-reading-row])')).toMatch(/flex-shrink: 1/))
  it('CONTRAST: every such rule is keyed on a held reading row, so nothing changes when none is held', () => {
    const lines = css.split('\n').filter((l) => /view-more-ways|data-thread-wrap/.test(l) && l.includes('{'))
    expect(lines.length).toBeGreaterThan(0)
    for (const line of lines) expect(line).toContain(':has(.ok-pinned [data-reading-row])')
  })
})
