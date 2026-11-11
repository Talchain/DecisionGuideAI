/**
 * The Analysis tab in the previous PoC's boxed sections (Paul, 6 Nov: "the right-panel tabs are completely unacceptable compared with the
 * previous PoC"; reference vision-audit-20261024 cafe-09-panel-analysis.png): the chances first, each option's chance of meeting its aim
 * (the headline, DL #87); then "Behind this result" with the worth lines, the first few shown and the rest behind "+N more"; then the
 * notes behind a closed disclosure; the coach's newest next step as the "Suggested next step" card after the chances. Every string stays
 * core's, at its own path. Fixture: the bakery View from the wire, its one worth line
 * copied to four (ids and paths of their own) so the disclosure has something to hold.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { ViewChances } from '../ViewChances'
import { BEHIND_SHOWN } from '../layout'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { typography } from '../../styles/typography'

const base = (JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View).model!
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' }); useMe.setState({ me: null, status: 'none' }) })
const worth = base.run!.science[0]!
const model: ViewModel = { ...base, run: { ...base.run!, science: [0, 1, 2, 3].map((k) => ({ ...worth, id: `W${k}`, line: `${worth.line} (${k})` })) } }
const before = (a: Element, b: Element) => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0

describe('Analysis in the previous PoC\'s sections', () => {
  it('order: the chances box, then Behind this result, then the notes; each option and the lead sit in the chances box', () => {
    const c = render(<ViewChances model={model} />).container
    const head = c.querySelector('[data-testid="view-run-headline"]')!, behind = c.querySelector('[data-testid="view-run-behind"]')!, notes = c.querySelector('[data-testid="view-run-notes"]')!
    expect([head, behind, notes].every((x) => x !== null)).toBe(true)
    expect([before(head, behind), before(behind, notes)]).toEqual([true, true])
    expect(head.querySelector('[data-view="run.lead"]')?.textContent).toBe(base.run!.lead)
    for (const o of base.cards.filter((x) => x.family === 'option' && x.status === null)) expect(head.querySelector(`[data-view-card="${o.id}"]`), o.id).not.toBeNull()
    expect(behind.querySelector('[data-view-card]')).toBeNull()
  })
  it('Behind this result shows the first worth lines and holds the rest behind "+N more", each still core\'s line at its own path', () => {
    const c = render(<ViewChances model={model} />).container
    const behind = c.querySelector('[data-testid="view-run-behind"]')!, more = behind.querySelector('details[data-testid="view-run-worth-more"]')!
    const outside = [...behind.querySelectorAll('[data-view-fact]')].filter((e) => !more.contains(e)).map((e) => e.getAttribute('data-view-fact'))
    expect(outside).toEqual(['W0', 'W1', 'W2', 'W3'].slice(0, BEHIND_SHOWN))
    expect([...more.querySelectorAll('[data-view-fact]')].map((e) => e.getAttribute('data-view-fact'))).toEqual(['W0', 'W1', 'W2', 'W3'].slice(BEHIND_SHOWN))
    expect(more.querySelector('summary')?.textContent).toBe(`+${4 - BEHIND_SHOWN} more`)
    expect(more.hasAttribute('open')).toBe(false)
    for (let k = 0; k < 4; k++) expect(c.querySelector(`[data-view="run.science.${k}.line"]`)?.textContent).toBe(`${worth.line} (${k})`)
  })
  it('the notes sit behind a closed disclosure, every note in core\'s order', () => {
    const c = render(<ViewChances model={base} />).container
    const notes = c.querySelector('details[data-testid="view-run-notes"]')!
    expect(notes.hasAttribute('open')).toBe(false)
    expect([...notes.querySelectorAll('[data-view^="run.notes."]')].map((e) => e.textContent)).toEqual(base.run!.notes.map((n) => n.text))
  })
  it('the coach\'s newest next step is the "Suggested next step" card after the chances, in core\'s words, with the conversation\'s own move as its arrow', () => {
    const v = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/capacity-v3.view.json'), 'utf8')) as View
    const next = v.chat[0]!.answer!.next
    useViewStore.setState({ sid: 's_test' })
    const c = render(<ViewChances model={v.model!} chat={v.chat} />).container
    const card = c.querySelector('[data-testid="view-run-next-step"]')!, head = c.querySelector('[data-testid="view-run-headline"]')!
    expect(card).not.toBeNull()
    expect(before(head, card)).toBe(true)
    const behind = c.querySelector('[data-testid="view-run-behind"]')
    if (behind !== null) expect(before(card, behind)).toBe(true)
    expect(card.querySelector('[data-view="chat.0.answer.next.label"]')?.textContent).toBe(next.label)
    expect(card.querySelector('[data-view="chat.0.answer.next.text.0.text"]')?.textContent).toBe((next.text[0] as { text: string }).text)
    const tap = card.querySelector('[data-testid="view-next-move"]')!
    expect([tap.getAttribute('data-move'), tap.getAttribute('aria-label')]).toEqual([next.move, next.label])
    // Only the newest: an earlier turn's step is never drawn here; no chat, no card.
    expect(render(<ViewChances model={v.model!} />).container.querySelector('[data-testid="view-run-next-step"]')).toBeNull()
    const old = { ...v.chat[0]!, answer: { ...v.chat[0]!.answer!, next: { ...next, newest: false } } }
    expect(render(<ViewChances model={v.model!} chat={[old]} />).container.querySelector('[data-testid="view-run-next-step"]')).toBeNull()
  })
  it('a worth line\'s give words and ✎ sit on their own line under it, never run on after the line as one sentence', () => {
    // The give control shows only for the person whose page it is (FigureEdit): this View, read, with its own person.
    const view = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/bakery.view.json'), 'utf8')) as View
    useViewStore.setState({ uuid: '00000000-0000-4000-8000-0123456789ab', sid: 's_test', view, status: 'ready', error: null, stale: false })
    useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
    const c = render(<ViewChances model={base} />).container
    const line = c.querySelector('[data-view="run.science.0.line"]')!, give = c.querySelector(`[data-testid="worth-give-${worth.figure!.id}"]`)!
    const block = give.closest(`[data-worth-give="${worth.id}"]`)!
    // R25 scale A (Paul 7 Nov): the lane's metadata role, 12px (was the shared 11px panelMeta).
    expect([line.parentElement!.contains(give), block !== null, block.className.includes(typography.viewPanelMeta)]).toEqual([false, true, true])
    expect(block.previousElementSibling).toBe(line.parentElement)
    expect(block.textContent).toBe(`${worth.figure!.give!.text} ✎`) // S1 (Paul 11 Nov): core's words end on the ✎, no stop of the UI's after it
  })
  it('two worth lines or fewer: no "+N more"', () => {
    const c = render(<ViewChances model={base} />).container
    expect(c.querySelector('[data-testid="view-run-worth-more"]')).toBeNull()
  })
})
