/**
 * R18 (core 958337d0): a chance that rests on a risk Olumi suggested keeps a short face. Core's row `value` is the headline only; its
 * `companion` ("about 50% without Olumi's suggested risk") is drawn as a small second line under the chance, one line, truncated, with
 * `companion_title` (the full sentence naming the risk) on hover. Core's once-only deadline fact (`run.shared_blockers`), the
 * "This comparison depends on Olumi's assumed option effects" note (A1) and "Assumption to check: ..." notes (E1) (`run.notes`) are drawn
 * verbatim. Every word is core's: nothing is composed here. Words below are core's own (r18-consistency.test.ts, R13 model).
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'
import { ViewChances } from '../ViewChances'
import { ViewBriefBody } from '../ViewBrief'

afterEach(cleanup)
const DIR = path.resolve('src/olumiView/golden')
const base = (JSON.parse(readFileSync(path.join(DIR, 'european.view.json'), 'utf8')) as View).model!
const COMPANION = "about 50% without Olumi's suggested risk"
const TITLE = "about 50% without Olumi's suggested risk assumption 'Unplanned launch rework diverts delivery capacity'"
const A1 = "This comparison depends on Olumi's assumed option effects." // already in core's european golden (run.notes)
const E1 = "Assumption to check: 'Rework share' is one figure Olumi proposed for an effect, not a range."
const DEADLINE = "‘Meet the urgent launch date’ is your deadline, kept as you wrote it. Completion is not modelled."

const optionWith = (companion: string | null) => {
  const card = base.cards.find((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance'))!
  const at = card.rows.findIndex((r) => r.kind === 'chance')
  const row = { ...card.rows[at]!, value: 'about 39% chance', companion, companion_title: companion === null ? null : TITLE } as typeof card.rows[number]
  const c = { ...card, rows: card.rows.map((r, i) => (i === at ? row : r)) }
  const model: ViewModel = { ...base, cards: base.cards.map((x) => (x.id === card.id ? c : x)),
    run: { ...base.run!, notes: [...base.run!.notes, { text: E1, title: E1 }], shared_blockers: [{ aim_id: 'launch_deadline', options: [], text: DEADLINE }] } }
  return { card: c, at, model }
}

describe('R18 fix 1: the companion is a small second line under the chance, never in the value', () => {
  it('catch: the face value is the headline only; the companion is its own muted, one-line, truncated element with the full sentence on hover', () => {
    const { card, at } = optionWith(COMPANION)
    const { container } = render(<ViewCard card={card} />)
    const key = `${card.id}.rows.${at}`
    expect(container.querySelector(`[data-view="${key}.value"]`)!.textContent).toBe('about 39% chance')
    const line = container.querySelector(`[data-row-companion="${key}"]`)!
    expect(line.textContent).toBe(COMPANION)
    expect(line.getAttribute('title')).toBe(TITLE)
    expect(line.className).toContain('truncate')
    expect(line.className).toContain('block')
    expect(container.querySelector(`[data-view="${key}.value"]`)!.textContent).not.toContain('without')
  })
  it('negative: a chance with no companion draws no companion element, and the value is unchanged', () => {
    const { card, at } = optionWith(null)
    const { container } = render(<ViewCard card={card} />)
    expect(container.querySelector('[data-row-companion]')).toBeNull()
    expect(container.querySelector(`[data-view="${card.id}.rows.${at}.value"]`)!.textContent).toBe('about 39% chance')
  })
  it('the Analysis tab and the Summary draw it too (core words, hover = the full sentence)', () => {
    const { model, card, at } = optionWith(COMPANION)
    const a = render(<ViewChances model={model} />).container
    const el = a.querySelector(`[data-view="${card.id}.rows.${at}.companion"]`)!
    expect([el.textContent, el.getAttribute('title')]).toEqual([COMPANION, TITLE])
    cleanup()
    const b = render(<ViewBriefBody model={model} />).container.querySelector(`[data-view-brief-companion="${card.id}.${at}"]`)!
    expect([b.textContent!.trim(), b.getAttribute('title')]).toEqual([COMPANION, TITLE])
  })
})

describe('R18 fixes 2 and 4: the once-only deadline fact and the A1 / E1 notes are drawn verbatim, once', () => {
  it('catch: the deadline sits once in the run block, A1 and E1 in the notes, each exactly once on screen', () => {
    const { model } = optionWith(COMPANION)
    const c = render(<ViewChances model={model} />).container
    const blocker = c.querySelector('[data-testid="view-run-shared-blocker"]')!
    expect([blocker.textContent, blocker.getAttribute('data-aim')]).toEqual([DEADLINE, 'launch_deadline'])
    const notes = [...c.querySelectorAll('[data-view^="run.notes."]')].map((n) => n.textContent)
    expect(notes.filter((t) => t === A1)).toHaveLength(1)
    expect(notes.filter((t) => t === E1)).toHaveLength(1)
    expect(c.textContent!.split(DEADLINE).length - 1).toBe(1)
  })
})
