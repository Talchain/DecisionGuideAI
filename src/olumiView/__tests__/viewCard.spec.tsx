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
 * Every visible string a card carries: never a hover (`title`), an aria label, an id or kind, the badge's record ids or its change
 * key, the figure editor's words (`edit`, drawn when the figure is edited, canvas A2), or an option's driver line, which the chances dock
 * draws as the base did (its canvas node never showed it).
 */
const SKIP = new Set(['id', 'family', 'title', 'label', 'kind', 'aim_id', 'records', 'edit', 'driver'])
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
