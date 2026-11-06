/**
 * R19 time treatment on the page (core 2.x olumi.view/3 `model.run.readings`, `model.run.timing`, and each chance row's `timing` / `timing_title`).
 * Every word is core's own and drawn once, verbatim; the page formats nothing (the UI formats no model value). Words below are core's own
 * (src/run/__tests__/r19-time.test.ts; the european golden carries a real `readings` entry). Bound by identity: the aim's id, the quantity, the row's key.
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, render } from '@testing-library/react'
import { ReactFlowProvider, type NodeProps } from '@xyflow/react'
vi.mock('../../contexts/AuthContext', () => ({ useAuth: () => ({ user: null }) }))
vi.mock('../../lib/supabase', () => ({ getSessionIdentity: async () => ({ userId: null, accessToken: null }), supabase: {} }))
import type { View, ViewCard, ViewModel } from '../client'
import { ViewCard as DrawnCard, ViewCardNode } from '../../canvas/nodes/ViewCardNode'
import { useViewStore } from '../store'
import { ViewChances } from '../ViewChances'
import { ViewBriefBody } from '../ViewBrief'
import { notesBesideTiming, readingOf } from '../layout'

afterEach(() => { cleanup(); useViewStore.setState({ view: null }) })
const DIR = path.resolve('src/olumiView/golden')
const base = (JSON.parse(readFileSync(path.join(DIR, 'european.view.json'), 'utf8')) as View).model!
const READING = base.run!.readings[0]!                       // core's: "Olumi reads this at its highest within 12 months; change it if you meant …"
const TIMING_LINE = "about 41% if 'Tech lead start delay' is 1 month; under 1% if 4 months"
const TIMING_TITLE = "about 41% if 'Tech lead start delay' is 1 month; under 1% if 4 months. This is Olumi's timing assumption, not your figure: the chance with that one assumption held at each end of its own range (1 month to 4 months)."
const ASSUMPTION = "Olumi’s timing assumption, not your figure: 'Tech lead start delay' is 1 to 4 months."
const GENERIC = "Olumi's what-if for 'Tech lead start delay', not their figure: 1 to 4 months. Basis: hiring takes a while."
const OTHER_NOTE = "Olumi's what-if for 'Rework share', not their figure: 10% to 30%."

const withTiming = (extra: Partial<ViewModel['run'] & object> = {}): { model: ViewModel; card: ViewCard; at: number } => {
  const card = base.cards.find((c) => c.family === 'option' && c.rows.some((r) => r.kind === 'chance'))!
  const at = card.rows.findIndex((r) => r.kind === 'chance')
  const row = { ...card.rows[at]!, value: 'about 39% chance', timing: TIMING_LINE, timing_title: TIMING_TITLE } as ViewCard['rows'][number]
  const c = { ...card, rows: card.rows.map((r, i) => (i === at ? row : r)) }
  const timing = [{ quantity: 'tech_lead_delay', label: 'Tech lead start delay', text: ASSUMPTION, value_text: '1 to 4 months', options: [card.id], risks: [], low: 1, high: 4, unit: 'month' }]
  const run = { ...base.run!, timing, notes: [...base.run!.notes, { text: GENERIC, title: GENERIC }, { text: OTHER_NOTE, title: OTHER_NOTE }], ...extra }
  return { card: c, at, model: { ...base, cards: base.cards.map((x) => (x.id === card.id ? c : x)), run } }
}

describe('R19 readings: how the Run reads each aim, once, under the aim', () => {
  it('catch: core\'s sentence sits on its own aim\'s card, verbatim, once, in Olumi\'s colour while the reading is Olumi\'s proposal', () => {
    expect(READING.source).toBe('proposal')
    const goal = base.cards.find((c) => c.id === READING.aim_id)!
    expect(readingOf(base, goal.id)).toEqual(READING)
    const { container } = render(<DrawnCard card={goal} reading={readingOf(base, goal.id)} />)
    const el = container.querySelector(`[data-view="${goal.id}.reading"]`)!
    expect([el.textContent, el.getAttribute('title'), el.getAttribute('data-reading')]).toEqual([READING.text, READING.text, 'proposal'])
    expect(el.className).toContain('text-info')
    expect(container.textContent!.split(READING.text).length - 1).toBe(1)
  })
  it('wiring: on the canvas the aim\'s own node draws the View\'s reading for its id, from the View in the store', () => {
    const goal = base.cards.find((c) => c.id === READING.aim_id)!
    useViewStore.setState({ view: JSON.parse(readFileSync(path.join(DIR, 'european.view.json'), 'utf8')) as View })
    const c = render(<ReactFlowProvider><ViewCardNode {...({ id: goal.id, data: { card: goal, label: goal.heading }, selected: false, type: 'viewCard' } as unknown as NodeProps)} /></ReactFlowProvider>).container
    expect(c.querySelector(`[data-view="${goal.id}.reading"]`)!.textContent).toBe(READING.text)
  })
  it('catch: a reading their words state, and one that contradicts them, are quiet (not Olumi\'s colour) and still core\'s words', () => {
    const goal = base.cards.find((c) => c.id === READING.aim_id)!
    for (const source of ['words', 'contradiction'] as const) {
      const r = { ...READING, source, text: `core's ${source} sentence` }
      const el = render(<DrawnCard card={goal} reading={r} />).container.querySelector(`[data-view="${goal.id}.reading"]`)!
      expect([el.textContent, el.className.includes('text-info')]).toEqual([r.text, false]); cleanup()
    }
  })
  it('negative: another aim, an aim with no reading and a core before R19 (no `readings`) draw nothing', () => {
    const other = base.cards.find((c) => c.id !== READING.aim_id && (c.family === 'goal' || c.family === 'limit'))
    expect(other === undefined ? null : readingOf(base, other.id)).toBeNull()
    expect(readingOf({ ...base, run: { ...base.run!, readings: undefined as never } }, READING.aim_id)).toBeNull()
    expect(readingOf({ ...base, run: null }, READING.aim_id)).toBeNull()
    const goal = base.cards.find((c) => c.id === READING.aim_id)!
    expect(render(<DrawnCard card={goal} />).container.querySelector('[data-reading]')).toBeNull()
  })
})

describe('R19 timing: Olumi\'s assumptions once, the generic what-if note for the same quantity skipped', () => {
  it('catch: the Analysis tab draws core\'s assumption once, and the generic note for that quantity is not drawn beside it; another note is kept', () => {
    const { model } = withTiming()
    const c = render(<ViewChances model={model} />).container
    expect([...c.querySelectorAll('[data-testid="view-run-timing"] p')].map((p) => [p.textContent, p.getAttribute('data-timing')])).toEqual([[ASSUMPTION, 'tech_lead_delay']])
    const notes = [...c.querySelectorAll('[data-view^="run.notes."]')].map((n) => n.textContent)
    expect(notes).not.toContain(GENERIC)
    expect(notes).toContain(OTHER_NOTE)
    expect(c.textContent!.split('Tech lead start delay').length - 1).toBe(2)       // the assumption and the timing row, never the generic note as a third
    // the kept note keeps its own index into core's notes (identity, not position among the survivors)
    expect(c.querySelector(`[data-view="run.notes.${model.run!.notes.findIndex((n) => n.text === OTHER_NOTE)}.text"]`)!.textContent).toBe(OTHER_NOTE)
  })
  it('negative: with no timing assumption every note stays, and no timing block is drawn (contrast)', () => {
    const { model } = withTiming({ timing: [] })
    expect(notesBesideTiming(model.run!)).toEqual(model.run!.notes)
    const c = render(<ViewChances model={model} />).container
    expect(c.querySelector('[data-testid="view-run-timing"]')).toBeNull()
    expect([...c.querySelectorAll('[data-view^="run.notes."]')].map((n) => n.textContent)).toContain(GENERIC)
  })
  it('the Summary says the assumption once too, where the generic note was', () => {
    const { model } = withTiming()
    const c = render(<ViewBriefBody model={model} />).container
    expect([...c.querySelectorAll('[data-view-brief-timing]')].map((p) => p.textContent)).toEqual([ASSUMPTION])
    expect(c.textContent).not.toContain(GENERIC)
    expect(c.textContent).toContain(OTHER_NOTE)
  })
})

describe('R19 timing on the chance row: a small second line beside the companion', () => {
  it('catch: the face value stays the headline; the timing is its own muted, one-line, truncated element, core\'s sentence on hover', () => {
    const { card, at } = withTiming()
    const { container } = render(<DrawnCard card={card} />)
    const key = `${card.id}.rows.${at}`
    const line = container.querySelector(`[data-row-timing="${key}"]`)!
    expect([line.textContent, line.getAttribute('title')]).toEqual([TIMING_LINE, TIMING_TITLE])
    expect(line.className).toContain('truncate'); expect(line.className).toContain('block'); expect(line.className).toContain('text-text-light')
    expect(container.querySelector(`[data-view="${key}.value"]`)!.textContent).toBe('about 39% chance')
    expect(container.textContent!.split(TIMING_LINE).length - 1).toBe(1)
  })
  it('catch: with a companion too, both lines are drawn, each its own element, in that order', () => {
    const { card, at } = withTiming()
    const row = { ...card.rows[at]!, companion: "about 50% without Olumi's suggested risk", companion_title: 'the whole sentence' } as ViewCard['rows'][number]
    const c2 = { ...card, rows: card.rows.map((r, i) => (i === at ? row : r)) }
    const { container } = render(<DrawnCard card={c2} />)
    const key = `${card.id}.rows.${at}`
    const lines = [...container.querySelectorAll(`[data-row-companion="${key}"], [data-row-timing="${key}"]`)].map((e) => e.getAttribute(e.hasAttribute('data-row-companion') ? 'data-row-companion' : 'data-row-timing') && e.textContent)
    expect(lines).toEqual(["about 50% without Olumi's suggested risk", TIMING_LINE])
  })
  it('negative: a row with no timing draws no timing element, and the Analysis tab and Summary draw core\'s line with its hover where there is one', () => {
    const { card, at, model } = withTiming()
    const plain = { ...card, rows: card.rows.map((r, i) => (i === at ? ({ ...r, timing: null, timing_title: null } as typeof r) : r)) }
    expect(render(<DrawnCard card={plain} />).container.querySelector('[data-row-timing]')).toBeNull(); cleanup()
    const a = render(<ViewChances model={model} />).container.querySelector(`[data-view="${card.id}.rows.${at}.timing"]`)!
    expect([a.textContent, a.getAttribute('title')]).toEqual([TIMING_LINE, TIMING_TITLE]); cleanup()
    const b = render(<ViewBriefBody model={model} />).container.querySelector(`[data-view-brief-timing-row="${card.id}.${at}"]`)!
    expect([b.textContent!.trim(), b.getAttribute('title')]).toEqual([TIMING_LINE, TIMING_TITLE])
  })
})

describe('R20 timing on a none row: core\'s sweep line under its text, drawn like the chance row\'s', () => {
  const NONE_TEXT = 'No chance can be given for this option on the current information.'
  const NONE_TIMING = 'Under these timing assumptions: about 35% if the start is in 1 month; about 12% if in 4 months'
  const NONE_TITLE = `${NONE_TIMING}. This is Olumi's timing assumption, not your figure.`
  const noneCard = (extra: object): { card: ViewCard; at: number } => {
    const card = base.cards.find((c) => c.family === 'option')!
    const none = { kind: 'none', text: NONE_TEXT, title: 'the whole reason', ...extra } as unknown as ViewCard['rows'][number]
    return { card: { ...card, rows: [none, ...card.rows.filter((r) => r.kind !== 'none')] }, at: 0 }
  }
  it('catch: the text stays; the timing is its own muted, one-line, truncated element, title on hover, bound by its view path', () => {
    const { card, at } = noneCard({ timing: NONE_TIMING, timing_title: NONE_TITLE })
    const { container } = render(<DrawnCard card={card} />)
    const key = `${card.id}.rows.${at}`
    expect(container.querySelector(`[data-view="${key}.text"]`)!.textContent).toBe(NONE_TEXT)
    const line = container.querySelector(`[data-row-timing="${key}"]`)!
    expect([line.textContent, line.getAttribute('title')]).toEqual([NONE_TIMING, NONE_TITLE])
    expect(container.querySelector(`[data-view="${key}.timing"]`)!.textContent).toBe(NONE_TIMING)
    for (const c of ['truncate', 'block', 'text-text-light']) expect(line.className).toContain(c)
    expect(container.textContent!.split(NONE_TIMING).length - 1).toBe(1)
  })
  it('catch: a timing with no timing_title hovers with the timing itself', () => {
    const { card, at } = noneCard({ timing: NONE_TIMING })
    const line = render(<DrawnCard card={card} />).container.querySelector(`[data-row-timing="${card.id}.rows.${at}"]`)!
    expect(line.getAttribute('title')).toBe(NONE_TIMING)
  })
  it('negative: a none row without timing (an older core) draws no timing element, and still its text', () => {
    const { card, at } = noneCard({})
    const { container } = render(<DrawnCard card={card} />)
    expect(container.querySelector(`[data-view="${card.id}.rows.${at}.text"]`)!.textContent).toBe(NONE_TEXT)
    expect(container.querySelector(`[data-view="${card.id}.rows.${at}.timing"]`)).toBeNull()
    expect(container.querySelector(`[data-row-timing="${card.id}.rows.${at}"]`)).toBeNull()
  })
})
