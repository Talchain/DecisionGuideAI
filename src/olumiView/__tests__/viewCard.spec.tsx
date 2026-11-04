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
// The real dense boards from the R2 witness store (DL 4 Nov), walked as the goldens are.
const REAL = ['capacity', 'hiring'] as const
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal', ...REAL] as const
const golden = (n: string): View => JSON.parse(readFileSync((REAL as readonly string[]).includes(n) ? path.join(DIR, 'fixtures', 'real', `${n}.view3.json`) : path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))

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
 * draws as the base did (its canvas node never showed it), or a card's outcome band (`values`, olumi.view/3 since core e16a497) or a
 * chance row's aim outcome (`outcome`, since c838f56), which the Reasoning tab draws under each option; whether the card face draws them
 * too is the canvas's call; nor what an option rests on (`rests_on`, since c838f56: record ids with whose they are, a code, not words).
 */
// `outcome` (core c838f56): a chance row's low / median / high and unit, drawn by the option card's outcome band (the v10 slot), not
// as the row's words: deliberately exempt here.
// `values` (core e92f2a6): each option's outcome band for a figure, the v10 band's (the card's figure line already says it);
// `rests_on` (ids and whose, for the Rests-on lens): deliberately exempt too.
const SKIP = new Set(['id', 'family', 'title', 'detail', 'label', 'kind', 'aim_id', 'records', 'edit', 'driver', 'outcome', 'values', 'rests_on'])
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
        // A worked-out figure with a line per option (two or more `values`) is drawn as those lines, a row per option, in place of its one
        // run-on sentence (R3 pristine): each option's line is then the drawn string, and the sentence stays the rows' hover (core's title).
        const perOption = card.figure !== null && (card.values?.length ?? 0) > 1
        const want = perOption ? [...shown(fields, card.id).filter((p) => p !== `${card.id}.figure.text`), ...card.values!.map((_, i) => `${card.id}.values.${i}.text`)] : shown(fields, card.id)
        for (const p of want) expect(container.querySelector(`[data-view="${p}"]`), p).not.toBeNull()
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
  const ON_FACE = /^[^.]+\.(glyph|heading|olumi(\.glyph)?|change(\.glyph)?|figure\..*|values\.\d+\.text|rows\..*|badge.*)$/ // values: the figure's per-option rows (R3 pristine)
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

describe('the original card\'s look and its named places (DL 4 Nov: an improved version of Paul\'s original UI)', () => {
  const model = golden('european').model!
  it('every card keeps the marks row and the bottom-right corner; an option its driver corner and outcome band; a figure the place beside its value', () => {
    for (const card of model.cards) {
      const c = render(<ViewCard card={card} />).container
      const slots = [...c.querySelectorAll<HTMLElement>('[data-slot]')].map((e) => e.dataset['slot'])
      expect(slots, card.id).toEqual(expect.arrayContaining(['title-mark', 'marks', 'olumi-badge']))
      expect(slots.includes('driver-badge') && slots.includes('outcome-band'), `${card.id} option places`).toBe(card.family === 'option' && card.rows.length > 0)
      expect(slots.includes('figure-side') && slots.includes('values-band'), `${card.id} figure places`).toBe(card.figure !== null)
      expect([...c.querySelectorAll('[data-slot]')].every((e) => e.childElementCount === 0 && e.textContent === ''), `${card.id} places are empty`).toBe(true)
      expect(c.querySelector('[data-view-card]')!.getAttribute('data-slot-outline')).toBe('next-step')
    }
  })
  it('an option the team committed to says who in the marks row, when on hover (olumi.view/3 `committed`); an option without one says nothing', () => {
    const option = golden('european').model!.cards.find((c) => c.family === 'option')!
    const c = render(<ViewCard card={{ ...option, committed: { by: 'Bea', at: '2026-11-04T10:00:00Z' } }} />).container
    const marks = c.querySelector('[data-slot="marks"]')!
    expect(marks.querySelector(`[data-view="${option.id}.committed.by"]`)?.textContent).toBe('Bea')
    expect(marks.textContent).toBe('Committed by: Bea')
    expect(marks.querySelector(`[data-committed="${option.id}"]`)?.getAttribute('title')).toBe('Committed by: Bea · 2026-11-04T10:00:00Z')
    // CONTRAST: core's null draws an empty marks row
    expect(render(<ViewCard card={{ ...option, committed: null }} />).container.querySelector('[data-slot="marks"]')!.childElementCount).toBe(0)
  })
  it('the number before the title, as the original numbers its cards', () => {
    const card = model.cards.find((c) => c.family === 'option')!
    const t = render(<ViewCard card={card} number="O1" />).container.querySelector('[data-card-number]')!
    expect([t.textContent, t.nextElementSibling?.getAttribute('data-view')]).toEqual(['O1', `${card.id}.heading`])
  })
})
