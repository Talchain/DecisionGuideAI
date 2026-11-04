/**
 * The Reasoning tab on the olumi-core lane (src/olumiView/ViewReasoning.tsx), drawn from golden Views: core's lines verbatim and in core's
 * order, each bound to its own View string; nothing while no model is current; a figure tried there drawn there, nothing saved.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { useViewStore } from '../store'
import { optionCards } from '../layout'
import { ViewReasoning, ViewReasoningBlock } from '../ViewReasoning'
import { ViewChances } from '../ViewChances'
import { clearWhatIf } from '../whatif'
import { setTeamFetch } from '../../olumiCore/team/api'
import { resetWrites } from '../../olumiCore/team/writes'
import { useMe } from '../../olumiCore/me'
import { useUIStore } from '../../stores/uiStore'

const read = (n: string): View => JSON.parse(readFileSync(path.resolve('src/olumiView/golden', n), 'utf8'))
const ready = (view: View, more: object = {}) => {
  useViewStore.setState({ uuid: '00000000-0000-4000-8000-000000000001', sid: view.id, view, status: 'ready', error: null, stale: false, ...more } as never)
  useMe.setState({ me: { id: view.you_id, name: view.you }, status: 'ready' })
}
afterEach(() => { cleanup(); clearWhatIf(); setTeamFetch(null); resetWrites(); useViewStore.setState({ uuid: null, sid: null, view: null, error: null, status: 'none' } as never); useMe.setState({ me: null, status: 'none' }) })

/** Every word drawn: inside an element bound to its View string, or one of the tab's own labels (code writes labels, core the rest). */
const LABELS = new Set(['Worth checking first', 'Try a figure', '✎', ' '])
const unbound = (root: HTMLElement, also: string[]) => {
  const out: string[] = [], walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = walk.nextNode(); n !== null; n = walk.nextNode()) {
    if (n.parentElement!.closest('[data-view]') === null && !LABELS.has(n.textContent!) && !also.includes(n.textContent!)) out.push(n.textContent!)
  }
  return out
}

describe('the Reasoning tab draws the Run in core\'s words', () => {
  for (const golden of ['bakery.view.json', 'european.view.json', 'studio.view.json', 'app-launch.view.json', 'pricing.view.json', 's_ce285b3617bb.view.json']) {
    it(`${golden}: the lead, each option's rows and driver, and each worth line, each bound to its View string and in core's order; no word of its own`, () => {
      const view = read(golden), m = view.model!
      ready(view)
      render(<ViewReasoning model={m} />)
      const root = screen.getByTestId('view-reasoning')
      const at = (p: string) => root.querySelector(`[data-view="${p}"]`)
      if (m.run!.lead !== null) expect(at('run.lead')?.textContent).toBe(m.run!.lead)
      expect([...root.querySelectorAll('[data-view-card]')].map((e) => e.getAttribute('data-view-card'))).toEqual(optionCards(m).map((c) => c.id))
      for (const c of optionCards(m)) {
        expect(at(`${c.id}.heading`)?.textContent).toBe(c.heading)
        c.rows.forEach((r, i) => {
          const row = root.querySelector(`[data-view-row="${c.id}.rows.${i}"]`)!
          if (r.kind === 'none') expect(at(`${c.id}.rows.${i}.text`)?.textContent).toBe(r.text)
          else { expect(at(`${c.id}.rows.${i}.value`)?.textContent).toBe(r.value); expect(at(`${c.id}.rows.${i}.aim`)?.textContent).toBe(r.aim); expect(row.getAttribute('title')).toBe(r.title) }
          if (r.kind !== 'none' && r.olumi !== null) expect(at(`${c.id}.rows.${i}.olumi.glyph`)?.textContent).toBe(r.olumi.glyph)
        })
        if (c.driver !== null) { expect(at(`${c.id}.driver.text`)?.textContent).toBe(c.driver.text); expect(at(`${c.id}.driver.text`)?.getAttribute('title')).toBe(c.driver.title) }
        else expect(at(`${c.id}.driver.text`)).toBeNull()
      }
      m.run!.science.forEach((l, i) => {
        expect(at(`run.science.${i}.line`)?.textContent).toBe(l.line)
        expect(root.querySelector(`[data-view-fact="${l.id}"]`)?.getAttribute('title')).toBe(l.hover)
        if (l.olumi !== null) expect(at(`run.science.${i}.olumi.glyph`)?.textContent).toBe(l.olumi.glyph)
      })
      // A worth line's ✎ is led by core's own words for it (`figure.give.text`), drawn by the shared FigureEdit.
      expect(unbound(root, m.run!.science.flatMap((l) => (l.figure?.give == null ? [] : [`${l.figure.give.text} `, '.'])))).toEqual([])
    })
  }

  it('each figure the person may set is offered to try, under its own heading, its figure on hover; none where core offers no edit', () => {
    const view = read('bakery.view.json'), m = view.model!
    ready(view)
    render(<ViewReasoning model={m} />)
    const settable = m.cards.filter((c) => c.figure?.edit)
    expect(settable.length).toBeGreaterThan(0)
    const rows = [...screen.getByTestId('view-reasoning-try').querySelectorAll('[data-reasoning-try]')]
    expect(rows.map((r) => r.getAttribute('data-reasoning-try'))).toEqual(settable.map((c) => c.id))
    rows.forEach((r, i) => {
      expect(r.querySelector(`[data-view="${settable[i].id}.heading"]`)?.textContent).toBe(settable[i].heading)
      expect(r.getAttribute('title')).toBe(settable[i].figure!.text)
    })
    cleanup()
    render(<ViewReasoning model={{ ...m, cards: m.cards.map((c) => (c.figure === null ? c : { ...c, figure: { ...c.figure, edit: null } })) }} />)
    expect(screen.queryByTestId('view-reasoning-try')).toBeNull()
  })
})

describe('pending is never shown as current', () => {
  it('a held proposal, a stale View or a failed read draws nothing; the approved, current model draws the Run', () => {
    const held = read('proposal.view.json')
    expect(held.proposal).not.toBeNull()
    ready(held)
    const { rerender } = render(<ViewReasoningBlock />)
    expect(screen.queryByTestId('view-reasoning')).toBeNull()
    const bakery = read('bakery.view.json')
    for (const bad of [{ stale: true }, { error: 'Olumi could not be reached.' }]) {
      ready(bakery, bad)
      rerender(<ViewReasoningBlock />)
      expect(screen.queryByTestId('view-reasoning'), JSON.stringify(bad)).toBeNull()
    }
    ready(bakery)
    rerender(<ViewReasoningBlock />)
    expect(screen.getByTestId('view-reasoning').querySelector('[data-view="run.lead"]')?.textContent).toBe(bakery.model!.run!.lead)
  })
})

describe('try a figure: core\'s what-if, from the Reasoning tab', () => {
  const view = read('whatif.view.json'), answer = JSON.parse(readFileSync(path.resolve('src/olumiView/golden/whatif.answer.json'), 'utf8'))
  const variant = answer.variants[0], id: string = variant.edits[0].quantity
  let posts: Array<{ path: string; body: unknown }> = []
  beforeEach(() => {
    posts = []
    setTeamFetch((async (u: unknown, init?: RequestInit) => {
      if ((init?.method ?? 'GET') === 'GET') return new Response(JSON.stringify(String(u) === '/api/me' ? { me: { id: view.you_id, name: view.you } } : view), { status: 200 })
      posts.push({ path: String(u), body: JSON.parse(String(init!.body)) })
      return new Response(JSON.stringify(answer), { status: 200 })
    }) as unknown as typeof fetch)
    ready(view)
    useUIStore.setState({ activeOutputTab: 'analysisNew' } as never)
  })

  it('one POST to core\'s what-if with the figure as typed, nothing saved; the answer drawn at the top of this tab, which stays fronted', async () => {
    render(<ViewReasoning model={view.model!} />)
    fireEvent.click(screen.getByTestId(`reasoning-edit-${id}`))
    fireEvent.change(screen.getByTestId(`reasoning-typed-${id}`), { target: { value: '5' } })
    fireEvent.click(screen.getByTestId(`reasoning-try-${id}`))
    const block = await screen.findByTestId('view-whatif')
    expect(posts).toEqual([{ path: `/api/scenarios/${view.id}/whatif`, body: { base: view.model!.edit_base, variants: [{ edits: [{ quantity: id, typed: '5' }] }] } }])
    expect(screen.getByTestId('view-reasoning').firstElementChild).toBe(block)
    expect(block.querySelector('[data-view="whatif.edits.0.words"]')?.textContent).toBe(variant.edits[0].words)
    expect(useUIStore.getState().activeOutputTab).toBe('analysisNew')
  })

  it('under "Try a figure", Enter tries on a copy and never saves: no edit route, no new version', async () => {
    render(<ViewReasoning model={view.model!} />)
    fireEvent.click(screen.getByTestId(`reasoning-edit-${id}`))
    fireEvent.change(screen.getByTestId(`reasoning-typed-${id}`), { target: { value: '5' } })
    fireEvent.submit(screen.getByTestId(`reasoning-form-${id}`))
    await screen.findByTestId('view-whatif')
    expect(posts.map((p) => p.path)).toEqual([`/api/scenarios/${view.id}/whatif`])
  })
})

describe('each option\'s outcome band', () => {
  // bakery's golden (core c838f56): under each option the aim 'Sell at least 360 loaves a week' reads its measured quantity, 'sales'
  // (the chance row's `outcome`, the same figures as the card's `values`). One axis for the aim runs from the least low (carry_on, 300)
  // to the greatest high (second_oven, 387.094…), a span of 87.094…, so second_oven sits at (336.615 − 300) / 87.094 = 42.04% to
  // 100%, its median at 80.33%; longer_hours at 45.32% to 91.55% (a width of 46.22% unrounded), median 68.89%; carry_on, a point at
  // 300, at 0%.
  const view = read('bakery.view.json'), m = view.model!
  const sales = m.cards.find((c) => c.id === 'sales')!
  const PLACES: Record<string, [string, string, string]> = { second_oven: ['42.04%', '57.96%', '80.33%'], longer_hours: ['45.32%', '46.22%', '68.89%'], carry_on: ['0%', '0%', '0%'] }
  const places = (band: Element) => {
    const bar = band.querySelector('[data-band-bar]') as HTMLElement, mid = band.querySelector('[data-band-mid]') as HTMLElement
    return [bar.style.left, bar.style.width, mid.style.left].map((x) => (parseFloat(x).toFixed(2) + '%').replace('.00%', '%'))
  }
  /** The View a core before c838f56 (e16a497) serves: chance rows without `outcome`. */
  const withoutOutcome = (model: ViewModel) => ({ ...model, cards: model.cards.map((c) => ({ ...c, rows: c.rows.map((r) => { const { outcome: _gone, ...rest } = r as typeof r & { outcome?: unknown }; return rest }) })) }) as unknown as ViewModel

  it('under each chance row, the aim\'s outcome in core\'s own line, its range reading on hover, every option placed on the aim\'s one axis; no card band beside it', () => {
    ready(view)
    render(<ViewReasoning model={m} />)
    const root = screen.getByTestId('view-reasoning')
    for (const card of optionCards(m)) {
      const i = card.rows.findIndex((r) => r.kind === 'chance' && r.aim_id === 'sell_360'), row = card.rows[i] as Extract<typeof card.rows[number], { kind: 'chance' }>
      const bands = root.querySelectorAll(`[data-view-card="${card.id}"] [data-outcome="sell_360"]`)
      expect(bands.length, card.id).toBe(1)
      expect(bands[0].getAttribute('title')).toBe(row.outcome!.title)
      expect(bands[0].querySelector(`[data-view="${card.id}.rows.${i}.outcome.text"]`)?.textContent).toBe(row.outcome!.text)
      expect(places(bands[0]), card.id).toEqual(PLACES[card.id])
    }
    expect(root.querySelectorAll('[data-band]').length).toBe(0)
  })

  it('each aim has its own axis: s_ce285b3617bb\'s two aims in £ each run from their own least low to their own greatest high', () => {
    // secure_funding: £63,607 (continue_outreach) to £5,287,901, so add_angel_bridge (£82,442 to £2,975,060) sits at 0.36%, 55.37% wide.
    // cash_survival: £124,944 to £5,339,882, both continue_outreach's, so it fills the axis (0%, 100%); one axis for both aims would put
    // it at 1.16%, 98.84% wide.
    const s = read('s_ce285b3617bb.view.json')
    ready(s)
    render(<ViewReasoning model={s.model!} />)
    const root = screen.getByTestId('view-reasoning')
    expect(places(root.querySelector('[data-view-card="continue_outreach"] [data-outcome="cash_survival"]')!).slice(0, 2)).toEqual(['0%', '100%'])
    expect(places(root.querySelector('[data-view-card="add_angel_bridge"] [data-outcome="secure_funding"]')!).slice(0, 2)).toEqual(['0.36%', '55.37%'])
  })

  it('from a core before the row outcome (e16a497): under each option the band\'s card and core\'s own line for it, its range on hover, ◆ only where core marks it Olumi\'s, on one axis', () => {
    const before = withoutOutcome(m)
    ready(view)
    render(<ViewReasoning model={before} />)
    const root = screen.getByTestId('view-reasoning')
    expect(root.querySelectorAll('[data-outcome]').length).toBe(0)
    sales.values!.forEach((v, i) => {
      const bands = root.querySelectorAll(`[data-view-card="${v.option}"] [data-band]`)
      expect(bands.length, v.option).toBe(1)
      const band = bands[0] as HTMLElement
      expect(band.getAttribute('data-band')).toBe('sales')
      expect(band.getAttribute('title')).toBe(sales.figure!.title)
      expect(band.querySelector('[data-view="sales.heading"]')?.textContent).toBe(sales.heading)
      expect(band.querySelector(`[data-view="sales.values.${i}.text"]`)?.textContent).toBe(v.text)
      expect(band.querySelector('[data-view="key.0.glyph"]')?.textContent ?? null, v.option).toBe(v.olumi ? m.key[0].glyph : null)
      expect(places(band), v.option).toEqual(PLACES[v.option])
    })
    expect(m.key[0]).toEqual({ id: 'olumi', glyph: '◆', text: 'Olumi' })
  })

  it('must not change: no outcome (null) draws no band; before e16a497 (no field) and with null values nothing; the Analysis tab draws none', () => {
    ready(view)
    const nulls = { ...m, cards: m.cards.map((c) => ({ ...c, rows: c.rows.map((r) => (r.kind === 'chance' ? { ...r, outcome: null } : r)) })) }
    const { rerender } = render(<ViewReasoning model={nulls} />)
    expect(screen.getByTestId('view-reasoning').querySelectorAll('[data-outcome], [data-band]').length).toBe(0)
    const before = withoutOutcome(m)
    rerender(<ViewReasoning model={{ ...before, cards: before.cards.map((c) => ({ ...c, values: null })) }} />)
    expect(screen.getByTestId('view-reasoning').querySelectorAll('[data-outcome], [data-band]').length).toBe(0)
    rerender(<ViewReasoning model={{ ...before, cards: before.cards.map(({ values: _gone, ...c }) => c) } as unknown as ViewModel} />)
    expect(screen.getByTestId('view-reasoning').querySelectorAll('[data-outcome], [data-band]').length).toBe(0)
    rerender(<ViewChances model={m} />)
    expect(screen.getByTestId('view-chances').querySelectorAll('[data-outcome], [data-band]').length).toBe(0)
  })
})
