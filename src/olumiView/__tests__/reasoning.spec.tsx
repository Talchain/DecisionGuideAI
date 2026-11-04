/**
 * The Reasoning tab on the olumi-core lane (src/olumiView/ViewReasoning.tsx), drawn from golden Views: core's lines verbatim and in core's
 * order, each bound to its own View string; nothing while no model is current; a figure tried there drawn there, nothing saved.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import type { View } from '../client'
import { useViewStore } from '../store'
import { optionCards } from '../layout'
import { ViewReasoning, ViewReasoningBlock } from '../ViewReasoning'
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
  for (const golden of ['bakery.view.json', 'european.view.json', 'studio.view.json', 'app-launch.view.json']) {
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
