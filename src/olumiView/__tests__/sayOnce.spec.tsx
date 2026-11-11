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
const waitRows = (id: string) => document.querySelectorAll(`[data-testid="focus-card"][data-row-id="wait:${id}"]`).length
const closed = () => [...document.querySelectorAll<HTMLElement>('button[aria-expanded="false"]')]

describe('SC-02: each tab says each thing once', () => {
  it('Analysis: an option\'s driver sentence and its tipping lines are said under its row, never again in "Why and what could change it"', () => {
    const view = golden('bakery'), m = view.model!
    ready(view)
    render(<PortAnalysisTab />)
    fireEvent.click(screen.getByTestId('port-evidence-toggle'))
    const drivers = optionCards(m).filter((c) => c.driver != null).map((c) => `${c.id}.driver.text`)
    const tipping = m.run!.tipping.flatMap((t, i) => (t.line === '' ? [] : [`run.tipping.${i}.line`]))
    expect(drivers.length * tipping.length).toBeGreaterThan(0)
    const most = new Map<string, number>()
    const look = () => { for (const p of [...drivers, ...tipping]) most.set(p, Math.max(most.get(p) ?? 0, drawn(p))) }
    look()
    // Every evidence chip in turn, and each row's detail in turn (one open at a time): at no moment is a sentence drawn twice.
    for (const chip of [...document.querySelectorAll<HTMLElement>('[data-testid^="port-evidence-tab-"]')]) { fireEvent.click(chip); look() }
    for (const row of [...document.querySelectorAll<HTMLElement>('[data-testid="port-option-row"] > button[aria-expanded]')]) { fireEvent.click(row); look(); fireEvent.click(row) }
    expect([...most].filter(([, n]) => n > 1)).toEqual([])
    // Contrast: each is still said, once.
    expect(drivers.filter((p) => most.get(p) !== 1)).toEqual([])
    expect(tipping.filter((p) => most.get(p) !== 1)).toEqual([])
  })

  for (const n of ['capacity', 'hosting'] as const) {
    it(`Analysis (${n}): each figure the chances wait on is named once, in its own row with its edit, not again in the head`, () => {
      const view = real(n), w = view.model!.run!.waits_on!
      ready(view)
      render(<PortAnalysisTab />)
      // Re-pinned, UI recovery row 17 (DL 10 Nov): the figures are rows of the restored Focus now (the previous product's focus rows,
      // which carry the item's id, not a View path), all shown once "Show all" is pressed. Still one row per figure, by its id.
      for (const b of document.querySelectorAll<HTMLElement>('[data-testid="focus-reveal"]')) fireEvent.click(b)
      for (const d of document.querySelectorAll('details:not([open])')) (d as HTMLDetailsElement).open = true
      const items = w.items.flatMap((it) => (it.text === '' ? [] : [it.id]))
      expect(items.length).toBeGreaterThan(0)
      expect(items.map((id) => [id, waitRows(id)])).toEqual(items.map((id) => [id, 1]))
      expect(document.querySelectorAll('[data-view^="run.waits_on.items."]')).toHaveLength(0)
      // Contrast: the head keeps core's own words for it where every chance waits (the headline), with no list of its own.
      if (view.model!.run!.all_withheld) expect(screen.getByTestId('port-hero-waits-headline').querySelector('[data-view="run.waits_on.text"]')?.textContent).toBe(w.text)
      expect(document.querySelector('[data-testid="port-hero-waits-on"]')).toBeNull()
    })
  }

  it('Analysis (strategy, every chance waits; strategy witness, 8 Nov): the head says core\'s count only; each figure and its "which no one can size yet" is said once, under What to act on next', () => {
    const view = JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/strategy', 'growth-reveal-n1.view3.json'), 'utf8')) as View, w = view.model!.run!.waits_on!
    expect(view.model!.run!.all_withheld).toBe(true)
    const unknown = w.items.flatMap((it, i) => (it.unknown === null ? [] : [i]))
    expect(unknown.length).toBeGreaterThan(1)
    ready(view)
    render(<PortAnalysisTab />)
    const head = screen.getByTestId('port-hero-waits-headline')
    expect(head.querySelector('[data-view="run.waits_on.text"]')?.textContent).toBe(w.text)
    expect(head.querySelectorAll('[data-view^="run.waits_on.items."]')).toHaveLength(0)
    // Re-pinned, UI recovery row 17 (DL 10 Nov): each figure is one row of the restored Focus now, by its id.
    for (const b of document.querySelectorAll<HTMLElement>('[data-testid="focus-reveal"]')) fireEvent.click(b)
    for (const i of unknown) expect([i, waitRows(w.items[i]!.id)]).toEqual([i, 1])
    // Contrast: the clause is core's, said at most once per figure on the tab, never as a run in the head.
    const tab = document.querySelector('[data-testid="port-analysis-tab"]')!.textContent!
    expect(tab.split(', which no one can size yet').length - 1).toBeLessThanOrEqual(unknown.length)
  })

  it('Model: the question is said once, above the outline; the Goal group, opened, keeps the aim it is measured by', () => {
    const view = real('european-22cards'), m = view.model!
    ready(view)
    render(<ViewModelTabBlock />)
    for (let r = 0; r < 3 && closed().length > 0; r++) for (const b of closed()) fireEvent.click(b)
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
    // The door opens where it has rows (an option's own premises are said in its rack row, PL-252, so it may have none).
    const door = screen.queryByTestId('view-reasoning-premises-toggle')
    if (door !== null) fireEvent.click(door)
    const said = [...document.querySelectorAll('[data-view]')].filter((e) => e.textContent === c.reason)
    expect(said.map((e) => e.getAttribute('data-view'))).toEqual([`${c.id}.reason`])
  })
})
