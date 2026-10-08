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
const CLICK_SELECTION_RING = /\b(?:selected|pressed|checked|chosen)\b(?=[^\n]{0,240}\bring-(?:1|2)\b)(?=[^\n]{0,240}\bring-(?:info|primary|sky(?:-\d+)?|blue-\d+|indigo-\d+)\b)/g
const CLICK_CSS_FOCUS = /:focus(?!-visible)[^{]*\{[^}]{0,300}(?:outline|box-shadow)\s*:[^;}]*(?:info|primary|sky|blue|indigo|focus-color)/g
// Tailwind classes live in .ts/.tsx; CSS files only mention them in comments.
const hits = (re: RegExp) => files.filter((f) => /\.tsx?$/.test(f)).flatMap((f) => (readFileSync(f, 'utf8').match(re) ?? []).map((m) => `${f.slice(SRC.length + 1)}: ${m.trim()}`))
// Comments are stripped first: two style sheets explain `:focus` in prose, and a comment paints nothing.
const withoutComments = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
const styleHits = (re: RegExp) => files.flatMap((f) => (withoutComments(f).match(re) ?? []).map((m) => `${f.slice(SRC.length + 1)}: ${m.trim()}`))

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
  it.each([
    ['Model-tab row selection', 'canvas/model-tab-v2/ModelRowView.tsx', CLICK_SELECTION_RING],
    ['auth password reveal focus', 'components/auth/AuthField.tsx', CLICK_RING],
    ['auth home-link focus', 'components/auth/AuthShell.tsx', CLICK_RING],
  ] as const)('%s has no pointer-visible blue ring', (_name, path, pattern) => {
    expect(hits(pattern).filter(hit => hit.startsWith(path))).toEqual([])
  })
  it('no selected or pressed state in src paints a blue ring', () => {
    expect(hits(CLICK_SELECTION_RING)).toEqual([])
  })
  it('no CSS `:focus` selector paints a blue outline or shadow', () => {
    expect(styleHits(CLICK_CSS_FOCUS)).toEqual([])
  })
  it('recognises the removed selection-ring form (mutation control)', () => {
    expect("selected ? 'ring-1 ring-inset ring-info' : ''".match(CLICK_SELECTION_RING)).not.toBeNull()
  })
  it('a `:focus` mentioned inside a CSS comment is not a rule (control for the comment strip)', () => {
    expect('/* a :focus { outline: 2px solid var(--info) } note */'.replace(/\/\*[\s\S]*?\*\//g, '').match(CLICK_CSS_FOCUS)).toBeNull()
    expect('.x:focus { outline: 2px solid var(--info); }'.match(CLICK_CSS_FOCUS)).not.toBeNull()
  })
  it('allows the NEUTRAL selection cue (DL ruling 7 Oct: ring-1 ring-inset ring-gray-400), which is visible and never blue', () => {
    expect("selected ? 'ring-1 ring-inset ring-gray-400 rounded-sm' : ''".match(CLICK_SELECTION_RING)).toBeNull()
  })
  it('allows keyboard-only focus styling in the product palette', () => {
    expect('focus-visible:ring-2 focus-visible:ring-info'.match(CLICK_RING)).toBeNull()
    expect('focus-visible:ring-2 focus-visible:ring-info'.match(CLICK_SELECTION_RING)).toBeNull()
    expect(':focus-visible { outline: 2px solid var(--info); }'.match(CLICK_CSS_FOCUS)).toBeNull()
  })
  it('text fields never ring or outline on focus (a click into one is :focus-visible)', () => {
    const css = readFileSync(join(SRC, 'index.css'), 'utf8')
    expect(css).toMatch(/textarea:focus,[\s\S]{0,80}outline: none !important;\s*box-shadow: none !important;/)
  })
})
