/**
 * SC-02 (DL backlog #4, 8 Nov): the dock's tabs say each thing once. Each row mounts the tab as the dock does (PortAnalysisTab,
 * ViewModelTabBlock, ViewReasoningBlock on the store) on a View core served, opens what a person can open, and counts each of core's
 * strings by its View path: drawn at most once at any moment (the fix), and still drawn (the contrast). The repeats were found on core
 * 5d8a009b's View of a copy of a real board (zero calls); the fixtures here are core's own captures.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { useMe } from '../../olumiCore/me'
import { PortAnalysisTab } from '../port/PortAnalysisTab'
import { ViewModelTabBlock } from '../ViewModelTab'
import { ViewReasoningBlock } from '../ViewReasoning'
import { optionCards } from '../layout'

const real = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/real', `${n}.view3.json`), 'utf8'))
const golden = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', `${n}.view.json`), 'utf8'))
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const drawn = (path: string) => document.querySelectorAll(`[data-view="${path}"]`).length
const closed = () => [...document.querySelectorAll<HTMLElement>('button[aria-expanded="false"]')]

describe('SC-02: each tab says each thing once', () => {
  it('Analysis and Reasoning together (bakery; redesign 18 Nov): each option\'s chance words, each figure it moves with and core\'s most-likely line are drawn once across both tabs, with the fold open', () => {
    const view = golden('bakery'), m = view.model!
    ready(view)
    render(<><PortAnalysisTab /><ViewReasoningBlock /></>)
    fireEvent.click(screen.getByTestId('analysis-why-toggle'))
    for (const b of closed()) fireEvent.click(b)
    const values = optionCards(m).flatMap((c) => c.rows.flatMap((r, i) => (r.kind === 'chance' ? [`${c.id}.rows.${i}.value`] : [])))
    const paths = [...values, 'run.most_likely.text', 'run.lead']
    expect(values.length).toBeGreaterThan(1)
    expect(paths.map((p) => [p, drawn(p)])).toEqual(paths.map((p) => [p, 1]))
    // Each figure the chances move most with is named once across both tabs (at its whisker), never again under "What would change".
    const movers = [...new Set([...document.querySelectorAll<HTMLElement>('[data-chart-figure]')].map((e) => e.dataset['chartFigure']!))]
    expect(movers.length).toBeGreaterThan(0)
    for (const id of movers) expect([id, document.querySelectorAll(`[data-view="${id}.heading"]`).length]).toEqual([id, 1])
    // A chance's words are core's for one row: the text appears once on the page, wherever it is bound.
    for (const p of values) { const t = document.querySelector(`[data-view="${p}"]`)!.textContent!; expect(document.body.textContent!.split(t).length - 1, p).toBe(1) }
  })

  for (const n of ['capacity', 'hosting'] as const) {
    it(`Analysis (${n}): each thing the chances wait on is drawn at most once, as a row of "what a result needs" with all rows shown`, () => {
      const view = real(n), w = view.model!.run!.waits_on!
      ready(view)
      render(<PortAnalysisTab />)
      const more = screen.queryByTestId('analysis-needs-more')
      if (more !== null) fireEvent.click(more)
      const items = w.items.flatMap((it, i) => (it.text === '' ? [] : [`run.waits_on.items.${i}.text`]))
      expect(items.length).toBeGreaterThan(0)
      expect(items.filter((p) => drawn(p) > 1)).toEqual([])
      // Contrast: an item is either drawn (once) or its card is already listed above it (a blocker about the same card).
      const listed = new Set([...document.querySelectorAll<HTMLElement>('[data-need]')].map((e) => e.dataset['need']!))
      for (const it of w.items) if (it.text !== '' && !listed.has(`waits:${it.id}`)) expect([...listed].some((k) => k.startsWith('blocks:') || k.startsWith('none:')), it.id).toBe(true)
    })
  }

  it('Analysis (strategy, every chance waits): each figure is drawn at most once, and the clause core adds for a figure no one can size is never run together in a head', () => {
    const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal-n1.view3.json'), 'utf8')) as View, w = view.model!.run!.waits_on!
    expect(view.model!.run!.all_withheld).toBe(true)
    ready(view)
    render(<PortAnalysisTab />)
    const more = screen.queryByTestId('analysis-needs-more')
    if (more !== null) fireEvent.click(more)
    expect(w.items.map((_, i) => drawn(`run.waits_on.items.${i}.text`)).filter((n) => n > 1)).toEqual([])
    expect(document.querySelectorAll('[data-view="run.waits_on.text"], [data-view="run.waits_on.head"]')).toHaveLength(0)
    const tab = document.querySelector('[data-testid="port-analysis-tab"]')!.textContent!
    expect(tab.split(', which no one can size yet').length - 1).toBeLessThanOrEqual(w.items.filter((it) => it.unknown !== null).length)
  })

  it('Model: the question is said once, above the outline; the Goal group, opened, keeps the aim it is measured by', () => {
    const view = real('european-22cards'), m = view.model!
    ready(view)
    render(<ViewModelTabBlock />)
    // Open every disclosure. "Expand all" is itself a disclosure now (aria-expanded), so a button an earlier click has opened is not clicked again (that would close it).
    for (let r = 0; r < 3 && closed().length > 0; r++) for (const b of closed()) if (b.getAttribute('aria-expanded') === 'false') fireEvent.click(b)
    // A relationship row names the question as one of its ends (a label, not the question said again): those are not counted.
    const said = [...document.querySelectorAll('[data-view="model.question.text"]')].filter((e) => e.closest('[data-model-select^="link:"]') === null)
    expect(said.length).toBe(1)
    expect(screen.getByTestId('view-model-question').querySelector('[data-view="model.question.text"]')?.textContent).toBe(m.question.text)
    expect(m.aim).not.toBeNull()
    expect(document.querySelector('[data-view="model.aim.text"]')?.textContent).toBe(m.aim!.text)
  })

  it('Reasoning: a challenge\'s reason is said once, as the challenge; the door does not repeat it as a premise in the same words', () => {
    const view = real('capacity'), m = view.model!
    const c = m.cards.find((k) => k.challenged === true && k.reason !== null && m.cards.some((o) => (o.premises ?? []).some((p) => p.text === k.reason)))!
    expect(c).toBeDefined()
    ready(view)
    render(<ViewReasoningBlock />)
    // The door opens where it has rows.
    const door = screen.queryByTestId('view-reasoning-premises-toggle')
    if (door !== null) fireEvent.click(door)
    const said = [...document.querySelectorAll('[data-view]')].filter((e) => e.textContent === c.reason)
    expect(said.map((e) => e.getAttribute('data-view'))).toEqual([`${c.id}.reason`])
  })
})
