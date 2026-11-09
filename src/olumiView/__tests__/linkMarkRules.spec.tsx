/**
 * Core's link chips on V11 (noA 347604a7 / 65d43a31 rules, ported): the hover says core's strings whole and in order; one chip per link,
 * on the first line holding it; no part said as null or '' alike; a mark without words is never drawn. On core's capacity fixture
 * (fixtures/disagree x2-stances: the morale link, "Bea doubts this link", with core's status and closing question).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View } from '../client'
import { LinkMarkCardChip, linkMarkOf } from '../LinkMarkChip'
import { lineMarkAt, markHover, type LinkMark } from '../linkMarkRules'

const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/disagree', 'x2-stances.view3.json'), 'utf8')) as View
const mark = view.collab.link_marks![0]! as LinkMark
const MORALE = { record: 'morale_link', part: null }
/** The same View with the morale mark on its line and two lines that hold the morale link (indices 0 and 1). */
function onLines(marks: LinkMark[]): View {
  const v = structuredClone(view)
  const line = { ...v.model!.links[0]!, holds: MORALE }
  v.model!.links = [line, { ...line }, ...v.model!.links.slice(1)]
  v.collab.link_marks = marks
  return v
}
const lineMark = (over: Partial<LinkMark> = {}) => ({ ...structuredClone(mark), line: true, card: null, ...over }) as LinkMark
afterEach(cleanup)

describe('the chip\'s hover is core\'s strings, whole, in order', () => {
  it('LM1 precondition: core gives the mark its stances, its status and its closing question', () => {
    expect([typeof mark.title, typeof mark.status_text, typeof mark.question]).toEqual(['string', 'string', 'string'])
  })
  it('LM2 catch: stances, then what the model cannot calculate, then the question; nothing composed', () => {
    expect(markHover(mark)).toBe([mark.title, mark.status_text, mark.question].join('\n'))
    const chip = render(<LinkMarkCardChip mark={mark} />).container.querySelector('[data-link-mark-card]')!
    expect(chip.getAttribute('title')).toBe(markHover(mark))
    expect(chip.getAttribute('aria-label')).toBe(mark.label) // its name stays core's label
  })
  it('LM3 must not change: a mark with only its stances hovers its stances alone', () => {
    expect(markHover({ ...mark, status_text: null, question: null, reading: null } as LinkMark)).toBe(mark.title)
  })
})

describe('one chip per link', () => {
  it('LM4 catch: two lines hold the morale link; only the first draws its chip', () => {
    const v = onLines([lineMark()])
    expect(lineMarkAt(v, 0, MORALE)?.text).toBe(mark.text)
    expect(lineMarkAt(v, 1, MORALE)).toBeNull()
  })
  it('LM5 catch: core says no part as \'\'; the line says null; one and the same link', () => {
    const v = onLines([lineMark({ link: { record: 'morale_link', part: '' } } as Partial<LinkMark>)])
    expect(linkMarkOf(v, { holds: MORALE })?.text).toBe(mark.text)
  })
  it('LM6 catch: a mark with no words is never drawn; core\'s next mark for the link is', () => {
    const v = onLines([lineMark({ text: '' }), lineMark({ text: 'Ada keeps this link' })])
    expect(lineMarkAt(v, 0, MORALE)?.text).toBe('Ada keeps this link')
  })
  it('LM7 contrast: a mark kept off the line is no line\'s chip; another record\'s line has none', () => {
    const v = onLines([lineMark({ line: false, card: 'add_one' })])
    expect(lineMarkAt(v, 0, MORALE)).toBeNull()
    expect(lineMarkAt(onLines([lineMark()]), 0, { record: 'total_def', part: 'existing_capacity' })).toBeNull()
  })
})
