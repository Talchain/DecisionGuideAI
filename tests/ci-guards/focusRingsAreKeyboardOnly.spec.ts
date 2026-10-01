/**
 * ⭐ A CLICK NEVER LEAVES A BLUE HIGHLIGHT (Paul, 1 Oct 2026: "remove all of the blue highlighted borders when
 * anything is clicked on … stripped completely from the PoC").
 *
 * `focus:ring-*` and a blue `focus:border-*` fire on a mouse click as well as on Tab; `focus-visible:` fires on
 * the keyboard only, so the ring stays for keyboard users (WCAG 2.4.7). Text fields count every click as
 * :focus-visible, so `index.css` strips their ring and outline outright. Repo-wide scan, so a new click ring
 * fails here rather than in Paul's next test.
 */
import { describe, expect, it } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(__dirname, '..', '..', 'src')
const files: string[] = []
const walk = (d: string) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n)
    if (statSync(p).isDirectory()) { if (n !== '__tests__' && n !== 'node_modules') walk(p) }
    else if (/\.(tsx?|css)$/.test(n) && !/\.(spec|test|stories)\.tsx?$/.test(n)) files.push(p)
  }
}
walk(SRC)

const CLICK_RING = /(^|[^\w:-])focus:ring-[\w/.[\]-]+/g
const CLICK_BLUE_BORDER = /(^|[^\w:-])focus:border-(info|primary|sky-500|blue-\d+)(\/\d+)?\b/g
// Tailwind classes live in .ts/.tsx; CSS files only mention them in comments.
// ⚠ `components/auth/` is EXCLUDED, not exempt: auth paths need an independent review under the premerge guard, so
// LoginPage's click rings are converted in their own PR. Remove this filter when that lands.
const AUTH = /[\\/]components[\\/]auth[\\/]/
const hits = (re: RegExp) => files.filter((f) => /\.tsx?$/.test(f) && !AUTH.test(f)).flatMap((f) => (readFileSync(f, 'utf8').match(re) ?? []).map((m) => `${f.slice(SRC.length + 1)}: ${m.trim()}`))

describe('⭐ a click shows no blue ring; the keyboard keeps its ring', () => {
  it('scans the whole of src (positive control: the keyboard rings are there)', () => {
    expect(files.length).toBeGreaterThan(500)
    expect(hits(/focus-visible:ring-[\w/.-]+/g).length).toBeGreaterThan(200)
  })
  it('no `focus:ring-*` anywhere in src (use `focus-visible:ring-*`)', () => {
    expect(hits(CLICK_RING)).toEqual([])
  })
  it('no blue `focus:border-*` anywhere in src', () => {
    expect(hits(CLICK_BLUE_BORDER)).toEqual([])
  })
  it('text fields never ring or outline on focus (a click into one is :focus-visible)', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8')
    expect(css).toMatch(/textarea:focus,[\s\S]{0,80}outline: none !important;\s*box-shadow: none !important;/)
  })
})
