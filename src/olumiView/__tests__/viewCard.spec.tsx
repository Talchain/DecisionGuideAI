/**
 * The canvas card on the olumi-core lane (decision A): every card of every golden View drawn exactly as core wrote it, bound by
 * identity, every word drawn; and a proposed change shows core's mark with its hover naming each changed field (canvas A, 00052 #2).
 */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { ViewCard } from '../../canvas/nodes/ViewCardNode'

const DIR = path.resolve('src/olumiView')
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal'] as const
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))

function at(model: ViewModel, p: string): unknown {
  const [id, ...rest] = p.split('.')
  let x: unknown = model.cards.find((c) => c.id === id)
  for (const k of rest) x = x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]
  return x
}

/**
 * Every visible string a card carries: never a hover (`title`, or core's `detail`, which core's page uses as the hover and the card
 * gives its heading, DL 4 Nov), an aria label, an id or kind, the badge's record ids or its change
 * key, the figure editor's words (`edit`, drawn when the figure is edited, canvas A2), or an option's driver line, which the chances dock
 * draws as the base did (its canvas node never showed it), or a card's outcome band (`values`, olumi.view/3 since core e16a497), which
 * the Reasoning tab draws under each option; whether the card face draws it too is the canvas's call.
 */
const SKIP = new Set(['id', 'family', 'title', 'detail', 'label', 'kind', 'aim_id', 'records', 'edit', 'driver', 'values'])
const shown = (x: unknown, p: string): string[] => typeof x === 'string' ? (x !== '' ? [p] : [])
  : Array.isArray(x) ? x.flatMap((y, i) => shown(y, `${p}.${i}`))
  : x !== null && typeof x === 'object' ? Object.entries(x).flatMap(([k, y]) => (SKIP.has(k) || (k === 'change' && typeof y === 'string') ? [] : shown(y, `${p}.${k}`))) : []

describe('the canvas card draws the View exactly', () => {
  for (const n of GOLDEN) {
    it(`${n}: every drawn string is the View's own at its path, and every word of every card is drawn`, () => {
      const model = golden(n).model!
      for (const card of model.cards) {
        const { container, unmount } = render(<ViewCard card={card} />)
        for (const el of container.querySelectorAll<HTMLElement>('[data-view]')) expect(el.textContent, el.dataset['view']).toBe(at(model, el.dataset['view']!))
        const { id: _id, ...fields } = card
        for (const p of shown(fields, card.id)) expect(container.querySelector(`[data-view="${p}"]`), p).not.toBeNull()
        if (card.detail !== '') expect(container.querySelector(`[data-view="${card.id}.heading"]`)?.getAttribute('title'), `${card.id}.detail on hover`).toBe(card.detail)
        unmount()
      }
    })
  }

  it('two cards swapped draw differently (identity, not a value found somewhere)', () => {
    const [a, b] = golden('pricing').model!.cards
    const text = (c: typeof a) => render(<ViewCard card={c!} />).container.textContent
    expect(text(a)).not.toBe(text(b))
  })
})

describe('a proposed change is seen on the card it changes, before approval (canvas A, review 00052 #2)', () => {
  const model = golden('proposal').model!
  const changed = model.cards.filter((c) => c.change !== null)
  it('the proposal golden holds changed cards', () => expect(changed.length).toBeGreaterThan(0))
  for (const card of changed) {
    it(`${card.id}: core's change mark is drawn, its hover names each changed field before → after`, () => {
      const mark = render(<ViewCard card={card} />).container.querySelector<HTMLElement>(`[data-view="${card.id}.change.glyph"]`)!
      expect(mark.textContent).toBe(card.change!.glyph)
      expect(mark.getAttribute('title')).toBe(card.change!.title)
      expect(card.change!.title).toMatch(/→/)
    })
  }
})

describe('a none row from a core before view-dock (no `text`) still says why (00058 P1)', () => {
  it('each such row draws its title', () => {
    let seen = 0
    for (const n of GOLDEN) for (const card of golden(n).model?.cards ?? []) card.rows.forEach((r, i) => {
      if (r.kind !== 'none') return
      const old = structuredClone(card) as unknown as { rows: Record<string, unknown>[] }
      delete old.rows[i]!['text']
      const c = render(<ViewCard card={old as unknown as typeof card} />).container
      expect(c.querySelector(`[data-view="${card.id}.rows.${i}.title"]`)?.textContent).toBe(r.title)
      seen++
    })
    expect(seen).toBeGreaterThan(0)
  })
})

describe('a badge opens what core folded into it (review 00002 ledger): a new read of the View with ?open=, nothing re-folded here', () => {
  it('pressing a closed badge reads the View with that card\'s records opened; pressing it open closes them', async () => {
    const { setTeamFetch } = await import('../../olumiCore/team/api')
    const { useViewStore } = await import('../store')
    const { fireEvent, waitFor } = await import('@testing-library/react')
    const view = golden('european'), card = view.model!.cards.find((c) => c.badge !== null)!
    const paths: string[] = []
    setTeamFetch((async (u: unknown) => { paths.push(decodeURIComponent(String(u))); return new Response(JSON.stringify(view), { status: 200 }) }) as unknown as typeof fetch)
    useViewStore.setState({ uuid: 'u', sid: 's_0123456789ab', view, opened: { open: new Map(), all: false }, status: 'ready', error: null, stale: false })
    const { container, rerender } = render(<ViewCard card={{ ...card, badge: { ...card.badge!, open: false } }} />)
    fireEvent.click(container.querySelector(`[data-view="${card.id}.badge.text"]`)!)
    await waitFor(() => expect(paths.at(-1)).toBe(`/api/scenarios/s_0123456789ab/view?schema=3&open=${JSON.stringify({ [card.id]: card.badge!.records })}`))
    rerender(<ViewCard card={{ ...card, badge: { ...card.badge!, open: true } }} />)
    fireEvent.click(container.querySelector(`[data-view="${card.id}.badge.text"]`)!)
    await waitFor(() => expect(paths.at(-1)).toBe('/api/scenarios/s_0123456789ab/view?schema=3'))
    setTeamFetch(null)
  })
  it('a badge folding a record the held proposal changes shows core\'s change glyphs and is marked; one with none shows no glyph (final review 00004 #3)', () => {
    const card = golden('european').model!.cards.find((c) => c.badge !== null)!
    const marked = render(<ViewCard card={{ ...card, badge: { ...card.badge!, proposed: true, change: '+ ↻' } }} />).container
    expect(marked.querySelector(`[data-view="${card.id}.badge.change"]`)?.textContent).toBe('+ ↻')
    expect(marked.querySelector(`[data-view="${card.id}.badge.text"]`)?.closest('button')?.getAttribute('data-proposed')).toBe('true')
    marked.remove()
    const plain = render(<ViewCard card={{ ...card, badge: { ...card.badge!, proposed: false, change: '' } }} />).container
    expect(plain.querySelector(`[data-view="${card.id}.badge.change"]`)).toBeNull()
    expect(plain.querySelector(`[data-view="${card.id}.badge.text"]`)?.closest('button')?.hasAttribute('data-proposed')).toBe(false)
  })
})

describe('the compact face (Paul 4 Nov: the causal graph reads; every word of core\'s still reachable)', () => {
  const ON_FACE = /^[^.]+\.(glyph|heading|olumi(\.glyph)?|change(\.glyph)?|figure\..*|rows\..*|badge.*)$/
  const MORE = /^[^.]+\.(status|reason|bound\..*|premises\..*)$/
  for (const n of GOLDEN) {
    it(`${n}: unselected, a card shows only its glyph, heading, marks, figure and rows (an assumption its reason); the rest opens on selection`, () => {
      for (const card of golden(n).model!.cards) {
        const face = render(<ViewCard card={card} />).container
        for (const el of face.querySelectorAll<HTMLElement>('[data-view]')) {
          const p = el.dataset['view']!, hidden = el.closest('[hidden]') !== null
          // An assumption or condition (no figure, no rows) says what it holds in its reason: on the face, whole on hover.
          const says = card.figure === null && card.rows.length === 0 && p === `${card.id}.reason`
          if (says) expect([hidden, el.getAttribute('title')], `${p} on the face`).toEqual([false, card.reason])
          else if (MORE.test(p)) expect(hidden, `${p} folded`).toBe(true)
          else expect(ON_FACE.test(p) && !hidden, `${p} on the face`).toBe(true)
        }
        const open = render(<ViewCard card={card} selected />).container
        expect(open.querySelector('[hidden]'), `${card.id} opened`).toBeNull()
      }
    })
  }
})
