/**
 * The View API design's §3 contract for every UI, on DGAI's View-fed surfaces:
 * - each drawn element carries `data-view`, the path to its View string, and its text is exactly that string (bound by identity:
 *   text that merely exists elsewhere in the View does not pass);
 * - nothing is dropped: every option card's heading and every row is drawn;
 * - a mutant that swaps two options' rows fails;
 * - the lint: outside the one layout module, src/olumiView/ formats, sorts, filters and reduces nothing, and reads no CEE shape.
 */
import { afterEach, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { ViewChances, ViewChancesBlock } from '../ViewChances'
import { useViewStore } from '../store'

// Paths from the repository root (vitest's working directory): jsdom gives this module no file: URL to resolve against.
const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb', 'proposal'] as const

/** The View string a `data-view` path names: `<card id>.<field>…` under the model's cards. */
function at(model: ViewModel, path: string): unknown {
  const [id, ...rest] = path.split('.')
  let x: unknown = model.cards.find((c) => c.id === id)
  for (const k of rest) x = x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]
  return x
}

describe('the chances block draws the View exactly (design §3)', () => {
  for (const n of GOLDEN) {
    it(`${n}: every drawn string is the View's own string at its path, and every option and row is drawn`, () => {
      const model = golden(n).model!
      const { container } = render(<ViewChances model={model} />)
      const drawn = [...container.querySelectorAll<HTMLElement>('[data-view]')]
      for (const el of drawn) {
        const want = at(model, el.dataset['view']!)
        expect(typeof want, el.dataset['view']).toBe('string')
        expect(el.textContent, el.dataset['view']).toBe(want)
      }
      for (const card of model.cards.filter((c) => c.family === 'option' && c.status === null)) {
        expect(container.querySelector(`[data-view="${card.id}.heading"]`), card.id).not.toBeNull()
        card.rows.forEach((_, i) => expect(container.querySelector(`[data-view-row="${card.id}.rows.${i}"]`), `${card.id} row ${i}`).not.toBeNull())
      }
    })
  }

  it('an option core does not compare (its card says "removed" or "ruled out") draws no chance line, as the base leaves it out (review 00051 P2)', () => {
    const model = structuredClone(golden('pricing').model!)
    const [kept, out] = model.cards.filter((c) => c.family === 'option')
    out!.status = 'removed'
    const { container } = render(<ViewChances model={model} />)
    expect(container.querySelector(`[data-view-card="${out!.id}"]`)).toBeNull()
    expect(container.querySelector(`[data-view-card="${kept!.id}"]`)).not.toBeNull()
  })

  it('a View whose two options\' chances are swapped draws differently for each option (identity, not a value somewhere)', () => {
    const model = golden('pricing').model!, swapped = structuredClone(model)
    const [a, b] = swapped.cards.filter((c) => c.family === 'option')
    ;[a!.rows, b!.rows] = [b!.rows, a!.rows]
    const text = (m: ViewModel, id: string) => render(<ViewChances model={m} />).container.querySelector(`[data-view-card="${id}"]`)!.textContent
    expect(text(swapped, a!.id)).not.toBe(text(model, a!.id))
    expect(text(swapped, b!.id)).not.toBe(text(model, b!.id))
  })
})

describe('the lint over the View render chain (design §3)', () => {
  const files = readdirSync(DIR).filter((f) => /\.(ts|tsx)$/.test(f) && f !== 'types.ts')
  it('reads the files it lints', () => expect(files).toEqual(expect.arrayContaining(['client.ts', 'layout.ts', 'store.ts', 'ViewChances.tsx'])))
  for (const f of files) {
    it(`${f}: no formatting or ordering of View values${f === 'layout.ts' ? ' (picking is allowed here only)' : ', no picking'}; no CEE shapes`, () => {
      const src = readFileSync(path.join(DIR, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')
      for (const banned of ['toFixed(', 'toPrecision(', 'toLocaleString(', 'Intl.', '.sort(', '.reduce(', 'Math.round(']) expect(src.includes(banned), `${f}: ${banned}`).toBe(false)
      if (f !== 'layout.ts') expect(src.includes('.filter('), `${f}: .filter(`).toBe(false)
      for (const cee of ['canonicalAnalysisView', 'runView', 'adapters/cee', 'scripts/olumi-core']) expect(src.includes(cee), `${f}: ${cee}`).toBe(false)
    })
  }
})

describe('nothing the View says on a line is dropped (review 00049)', () => {
  /** Every visible string a row carries: its words and marks, never its hovers (`title`), its kind or its aim's id. */
  const shownStrings = (row: Record<string, unknown>, at: string): string[] => Object.entries(row).flatMap(([k, v]) =>
    typeof v === 'string' ? (v !== '' && k !== 'kind' && k !== 'aim_id' && k !== 'title' ? [`${at}.${k}`] : [])
    : v !== null && typeof v === 'object' ? shownStrings(v as Record<string, unknown>, `${at}.${k}`) : [])
  for (const n of GOLDEN) {
    it(`${n}: every word and mark on every option line is drawn, and each line carries core's hover`, () => {
      const model = golden(n).model!
      const { container } = render(<ViewChances model={model} />)
      for (const card of model.cards.filter((c) => c.family === 'option' && c.status === null)) card.rows.forEach((row, i) => {
        const at = `${card.id}.rows.${i}`
        for (const path of shownStrings(row as unknown as Record<string, unknown>, at)) expect(container.querySelector(`[data-view="${path}"]`), path).not.toBeNull()
        expect(container.querySelector(`[data-view-row="${at}"]`)?.getAttribute('title'), at).toBe(row.title)
      })
    })
  }
})

describe('the block draws only a current View of the approved model (review 00049)', () => {
  const view = golden('pricing')
  const block = () => render(<ViewChancesBlock />).container.querySelector('[data-testid="view-chances"]')
  afterEach(() => useViewStore.setState({ view: null, error: null, status: 'none' }))

  it('draws the approved model\'s lines when the last read succeeded', () => {
    useViewStore.setState({ view, error: null, status: 'ready' })
    expect(block()).not.toBeNull()
  })

  it('draws nothing from a View that holds a proposal: its lines are the proposal\'s, not the approved model the canvas shows', () => {
    useViewStore.setState({ view: { ...view, proposal: { id: 9, base: 1, heading: 'Olumi proposes 1 change', on: 'on version 1', removed: null, problem: null, marks: [] } }, error: null, status: 'ready' })
    expect(block()).toBeNull()
  })

  it('draws nothing when the last read failed: older lines are never shown as current', () => {
    useViewStore.setState({ view, error: 'Olumi could not be read just now. Try again in a moment.', status: 'ready' })
    expect(block()).toBeNull()
  })
})

describe('each option says what moves its chance most, as the base dock did (00053 #2; core wip/view-dock dock.oracle.json)', () => {
  const oracle = JSON.parse(readFileSync(path.join(DIR, 'golden', 'dock.oracle.json'), 'utf8')) as Record<string, { drivers: Record<string, string | null> }>
  for (const n of GOLDEN.filter((g) => g !== 'proposal')) {
    it(`${n}: every option's driver line is the base dock's words, drawn under that option with core's hover`, () => {
      const model = golden(n).model!
      const { container } = render(<ViewChances model={model} />)
      for (const [id, words] of Object.entries(oracle[n]!.drivers)) {
        const line = container.querySelector<HTMLElement>(`[data-view-card="${id}"] [data-view="${id}.driver.text"]`)
        if (words === null) { expect(line, id).toBeNull(); continue }
        expect(line?.textContent, id).toBe(words)
        expect(line?.getAttribute('title'), id).toBe(model.cards.find((c) => c.id === id)!.driver!.title)
      }
    })
  }
})
