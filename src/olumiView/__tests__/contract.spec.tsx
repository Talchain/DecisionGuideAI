/**
 * The View API design's §3 contract for every UI, on DGAI's View-fed surfaces:
 * - each drawn element carries `data-view`, the path to its View string, and its text is exactly that string (bound by identity:
 *   text that merely exists elsewhere in the View does not pass);
 * - nothing is dropped: every option card's heading and every row is drawn;
 * - a mutant that swaps two options' rows fails;
 * - the lint: outside the one layout module, src/olumiView/ formats, sorts, filters and reduces nothing, and reads no CEE shape.
 */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { render } from '@testing-library/react'
import type { View, ViewModel } from '../client'
import { ViewChances } from '../ViewChances'

// Paths from the repository root (vitest's working directory): jsdom gives this module no file: URL to resolve against.
const DIR = path.resolve('src/olumiView')
const golden = (n: string): View => JSON.parse(readFileSync(path.join(DIR, 'golden', `${n}.view.json`), 'utf8'))
const GOLDEN = ['pricing', 'studio', 'bakery', 'european', 'app-launch', 's_ce285b3617bb'] as const

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
      for (const card of model.cards.filter((c) => c.family === 'option')) {
        expect(container.querySelector(`[data-view="${card.id}.heading"]`), card.id).not.toBeNull()
        card.rows.forEach((_, i) => expect(container.querySelector(`[data-view-row="${card.id}.rows.${i}"]`), `${card.id} row ${i}`).not.toBeNull())
      }
    })
  }

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
