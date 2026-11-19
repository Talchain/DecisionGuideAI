/**
 * One control row (19 Nov): the lens bar holds the lenses' radio group AND the team's Views and Compare views icons beside it. Olumi's note keeps
 * clear of the whole bar ([data-testid="lens-bar"]), not only its radio group, so it never sits on the new icons.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { controlBoxes } from '../OlumiAttentionCard'

const rect = (left: number, top: number, w: number, h: number) => ({ left, top, right: left + w, bottom: top + h, x: left, y: top, width: w, height: h, toJSON: () => ({}) }) as DOMRect

afterEach(() => { document.body.innerHTML = ''; vi.restoreAllMocks() })

describe('the note keeps clear of the whole top control row', () => {
  it('TR1 the lens bar\'s box reaches the icons beside its radio group. CONTRAST: the radio group alone stops short of them', () => {
    const frame = document.createElement('div'), note = document.createElement('div'), bar = document.createElement('div'), lenses = document.createElement('div'), compare = document.createElement('button')
    bar.setAttribute('data-testid', 'lens-bar'); lenses.setAttribute('role', 'radiogroup'); lenses.setAttribute('data-testid', 'lens-bar-lenses'); compare.setAttribute('data-testid', 'views-compare')
    bar.append(lenses, compare); frame.append(note); document.body.append(frame, bar)
    Object.defineProperty(note, 'offsetParent', { configurable: true, get: () => frame })
    const boxes = new Map<Element, DOMRect>([[frame, rect(0, 0, 1232, 704)], [bar, rect(300, 12, 260, 40)], [lenses, rect(304, 16, 200, 32)], [compare, rect(520, 16, 32, 32)]])
    vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function (this: Element) { return boxes.get(this) ?? rect(0, 0, 0, 0) })
    const out = controlBoxes(note)
    const icon = boxes.get(compare)!
    const covers = (b: { x: number; y: number; w: number; h: number }) => b.x <= icon.left && b.x + b.w >= icon.right && b.y <= icon.top && b.y + b.h >= icon.bottom
    expect(out.some(covers), JSON.stringify(out)).toBe(true)
    const radio = boxes.get(lenses)!
    expect(radio.right < icon.left, 'CONTRAST: the radio group alone does not reach the icon').toBe(true)
  })
})
