/**
 * Focus now, Strengthen your model and Stress test on the olumi-core lane (UI recovery row 17, DL 10 Nov 2026): the previous product's
 * sections, fed by core's View. Each row is bound by identity (the item's id, or its View path), says its own item's words and no
 * other's, and each thing is said once in the tab. Fixtures are core's own captures.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import type { View } from '../../client'
import { newestNextOf } from '../../layout'
import { useViewStore } from '../../store'
import { useMe } from '../../../olumiCore/me'
import { PortAnalysisTab } from '../PortAnalysisTab'
import { viewOf } from './viewAt'

const v11 = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/fixtures/v11', `${n}.view3.json`), 'utf8'))
const ready = (view: View) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, at: null } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
  render(<PortAnalysisTab />)
}
afterEach(() => { cleanup(); useViewStore.setState({ uuid: null, sid: null, view: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })
const drawn = (p: string) => document.querySelectorAll(`[data-view="${p}"]`).length
const row = (id: string) => document.querySelector<HTMLElement>(`[data-testid="focus-card"][data-row-id="${id}"]`)!
const open = (id: string) => fireEvent.click(within(row(id)).getAllByRole('button')[0]!)

describe('the restored sections, in the previous product\'s order', () => {
  it('RS0: hero, Focus now, Strengthen, Your options, what could change, Stress test', () => {
    ready(viewOf('golden/bakery'))
    const order = [...screen.getByTestId('port-analysis-tab').children].map((e) => e.getAttribute('data-testid'))
    const want = ['port-analysis-hero', 'port-focus-now', 'port-strengthen', 'port-your-options', 'accordion-tornado', 'accordion-stress-test']
    expect(order.filter((t) => want.includes(t ?? ''))).toEqual(want)
  })
})

describe('Focus now', () => {
  it('FN1: the coach\'s newest next step is said whole, once, here and not in the hero, with its move', () => {
    const view = v11('consulting-chain')
    const next = newestNextOf(view.chat)!
    ready(view)
    const block = screen.getByTestId('port-focus-next')
    expect(screen.getByTestId('port-focus-now')).toContainElement(block)
    expect(block).toHaveTextContent(next.next.label)
    for (const p of next.next.text) if ('text' in p) expect(block).toHaveTextContent(p.text)
    expect(drawn(`chat.${next.k}.answer.next.label`)).toBe(1)
    expect(screen.queryByTestId('port-hero-next')).toBeNull()
    expect(within(block).getByTestId('view-next-move')).toHaveAttribute('data-move', next.next.move!)
  })

  it('FN2: each figure the chances wait on is a row under core\'s label; opened, it says core\'s question, and only an editable one has the edit', () => {
    const view = viewOf('golden/studio'), w = view.model!.run!.waits_on!
    ready(view)
    const waits = screen.getByTestId('port-focus-waits')
    expect(within(waits).getByText(w.label)).toHaveAttribute('data-view', 'run.waits_on.label')
    expect([...waits.querySelectorAll('[data-testid="focus-card"]')].map((e) => e.getAttribute('data-row-id'))).toEqual(w.items.map((it) => `wait:${it.id}`))
    const withEdit = w.items.filter((it) => it.edit !== null), without = w.items.filter((it) => it.edit === null)
    expect(withEdit.length * without.length).toBeGreaterThan(0)
    for (const it of w.items) {
      open(`wait:${it.id}`)
      expect(row(`wait:${it.id}`)).toHaveTextContent(it.text)
      if (it.title !== it.text) expect(within(row(`wait:${it.id}`)).getByTestId('focus-noticed')).toHaveTextContent(it.title)
      if (it.stays_in_words != null) expect(within(row(`wait:${it.id}`)).getByTestId('focus-why')).toHaveTextContent(it.stays_in_words)
      expect(within(row(`wait:${it.id}`)).queryAllByTestId('focus-extra')).toHaveLength(it.edit === null ? 0 : 1)
      open(`wait:${it.id}`)
    }
  })

  it('FN3: with no next step and nothing waited on, there is no Focus now', () => {
    const view = structuredClone(viewOf('real/hiring'))
    view.chat = []
    ready(view)
    expect(view.model!.run!.waits_on).toBeNull()
    expect(screen.queryByTestId('port-focus-now')).toBeNull()
  })
})

describe('Strengthen your model', () => {
  it('ST1: each figure worth finding out, then each prompt about the model\'s shape, in core\'s order; opened, each says its own words', () => {
    // A served View with a worth line and a prompt and no `find_out` (core before SCI-8), so every row below is drawn and checked; the
    // bakery golden's only worth line is said under "Worth finding out" instead (UI-9, findOut.spec FO2), which would leave no worth row here.
    const view = viewOf('real/hiring-unchecked-first'), m = view.model!
    ready(view)
    const section = screen.getByTestId('port-strengthen')
    expect(within(section).getByRole('heading', { name: 'Strengthen your model' })).toBeInTheDocument()
    const ids = [...section.querySelectorAll('[data-testid="focus-card"]')].map((e) => e.getAttribute('data-row-id'))
    expect(m.run!.find_out ?? null, 'precondition: no figures worth finding out on this View').toBeNull()
    expect(ids).toEqual(['worth:F26', 'sharpen:risk_count'])
    const rows = m.run!.science
    for (const l of rows) {
      expect(row(`worth:${l.id}`)).toHaveTextContent(l.figure!.label)
      open(`worth:${l.id}`)
      expect(within(row(`worth:${l.id}`)).getByTestId('focus-noticed')).toHaveTextContent(l.line)
      // The give words and the figure's edit sit in the row (core offers a give for this figure).
      expect(within(row(`worth:${l.id}`)).getByTestId('focus-extra')).toHaveTextContent(l.figure!.give!.text)
    }
    for (const s of m.sharpen) {
      expect(row(`sharpen:${s.id}`)).toHaveTextContent(s.lead)
      open(`sharpen:${s.id}`)
      expect(within(row(`sharpen:${s.id}`)).getByTestId('focus-noticed')).toHaveTextContent(s.emphasis)
      expect(within(row(`sharpen:${s.id}`)).getByTestId('focus-why')).toHaveTextContent(s.rationale)
      expect(within(row(`sharpen:${s.id}`)).queryByTestId('focus-extra')).toBeNull()
    }
  })

  it('ST2: nothing worth finding out and no prompt draws no section', () => {
    const view = viewOf('real/hiring')
    ready(view)
    expect((view.model!.run!.science ?? []).length + (view.model!.sharpen ?? []).length).toBe(0)
    expect(screen.queryByTestId('port-strengthen')).toBeNull()
  })
})

describe('Stress test', () => {
  it('SS1: every "would have to be true" line under core\'s heading, said once in the tab (no row\'s detail repeats one), with the count on the header', () => {
    const view = viewOf('golden/bakery'), run = view.model!.run!
    ready(view)
    const section = screen.getByTestId('accordion-stress-test')
    expect(within(section).getByText(run.tipping_heading)).toHaveAttribute('data-view', 'run.tipping_heading')
    expect(run.tipping.length).toBeGreaterThan(1)
    // Open everything a person can open in the hero: a row's detail must not say a tipping line again.
    for (const b of screen.getByTestId('port-analysis-hero').querySelectorAll<HTMLElement>('button[aria-expanded="false"]')) fireEvent.click(b)
    run.tipping.forEach((t, i) => {
      expect(section.querySelector(`[data-view="run.tipping.${i}.line"]`)).toHaveTextContent(t.line)
      expect(drawn(`run.tipping.${i}.line`)).toBe(1)
    })
    run.rests.forEach((r, i) => expect(section.querySelector(`[data-view="run.rests.${i}.line"]`)).toHaveTextContent(r.line))
    expect(within(section).getByText(run.rests_heading)).toHaveAttribute('data-view', 'run.rests_heading')
    expect(within(section).getByText(String(run.tipping.length + run.rests.length + run.failure.length))).toBeInTheDocument()
  })

  it('SS2: an aim core has no crossing for says core\'s own reason', () => {
    const view = viewOf('golden/studio'), run = view.model!.run!
    ready(view)
    const silent = run.tipping_aims.flatMap((a) => a.silent)
    expect(silent.length).toBeGreaterThan(0)
    for (const s of silent) expect(screen.getByTestId('port-stress-tipping')).toHaveTextContent(s.line)
  })

  it('SS3: with nothing from core there is no Stress test, and the hero\'s disclosure holds only the trade-offs under their own name', () => {
    ready(viewOf('real/hiring'))
    expect(screen.queryByTestId('accordion-stress-test')).toBeNull()
    cleanup()
    const view = viewOf('golden/bakery')
    ready(view)
    for (const k of ['drivers', 'tipping', 'rests', 'failure', 'worth']) expect(screen.queryByTestId(`port-evidence-tab-${k}`)).toBeNull()
    expect(view.model!.run!.compared.length).toBeGreaterThan(0)
    expect(screen.getByTestId('port-evidence-toggle')).toHaveTextContent('Trade-offs')
    expect(screen.getByTestId('port-evidence-toggle')).not.toHaveTextContent('Why and what could change it')
  })
})
