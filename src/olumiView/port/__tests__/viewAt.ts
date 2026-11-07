/**
 * Spec helpers for the ported components: a View read from DGAI's own fixtures (core-produced; never a person's store), and the View
 * string a `data-view` path names, so every drawn element is bound to its own value by identity (View API design §3).
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'
import type { View } from '../../client'

const DIR = path.resolve('src/olumiView')
/**
 * `real/<name>` (real-AI boards, fixtures/real), `golden/<name>` (core's goldens vendored in DGAI) or `core/<name>` (core's own golden
 * at wip/core-port-fields 6affb5d4f7de55978849ef0eb74297747b1fc39e, `src/view/__tests__/golden/<name>.view3.json`, copied unedited: it
 * carries the port fields `run.lenses` and `run.most_likely.option`).
 */
export function viewOf(name: `real/${string}` | `golden/${string}` | `core/${string}`): View {
  const [kind, n] = name.split('/') as ['real' | 'golden' | 'core', string]
  const file = kind === 'real' ? path.join(DIR, 'fixtures', 'real', `${n}.view3.json`)
    : kind === 'core' ? path.join(DIR, 'port', '__tests__', 'fixtures', `${n}.view3.json`) : path.join(DIR, 'golden', `${n}.view.json`)
  return JSON.parse(readFileSync(file, 'utf8')) as View
}

/** The value at a `data-view` path: `run.…` under the model's Run, `sharpen.…`, `chat.<k>.…` under the View's chat, else `<card id>.…`. */
export function at(view: View, p: string): unknown {
  const [id, ...rest] = p.split('.')
  const m = view.model!
  let x: unknown = id === 'run' ? m.run : id === 'sharpen' ? m.sharpen : id === 'chat' ? view.chat : m.cards.find((c) => c.id === id)
  for (const k of rest) x = x === null || x === undefined ? undefined : (x as Record<string, unknown>)[k]
  return x
}

/** Every `[data-view]` element under `root` draws exactly the View's string at its path; returns how many were checked. */
export function expectAllBound(view: View, root: ParentNode, expect: (v: unknown, m?: string) => { toBe: (w: unknown) => void }): number {
  const els = [...root.querySelectorAll<HTMLElement>('[data-view]')]
  for (const el of els) {
    const want = at(view, el.dataset['view']!)
    expect(typeof want, el.dataset['view']).toBe('string')
    expect(el.textContent, el.dataset['view']).toBe(want)
  }
  return els.length
}
