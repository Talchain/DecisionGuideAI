/**
 * Audit SI-4 (cards) — the keyboard focus ring must win on SPECIFICITY, never on
 * stylesheet load order.
 *
 * React Flow's own sheet (`@xyflow/react/dist/style.css`) turns the node
 * wrapper's outline off:
 *
 *     .react-flow__node.selectable:focus,
 *     .react-flow__node.selectable:focus-visible { outline: none }
 *
 * at (0,3,0). The review of 28 Sep 2026 found `nodeFocusRing.css` at (0,3,0)
 * too — a TIE, which the sheet injected LATER wins — while its header claimed
 * (0,4,0). The ring showed only because `ReactFlowGraph.tsx` imports React
 * Flow's sheet before `registry.ts` imports ours, and no spec referenced the
 * file: deleting it, or reordering the imports, left every test green.
 *
 * This spec reads BOTH files, computes the specificity of every competing
 * selector, and asserts ours outranks React Flow's. It fails if our sheet is
 * deleted, if its selector is weakened back to a tie, if the ring stops being
 * the contract's, or if `registry.ts` stops importing the sheet.
 *
 * CLAIM TYPE: specificity arithmetic over the two source files. jsdom does not
 * run the cascade across Vite-injected sheets, so whether the ring is VISIBLE
 * is a browser claim, witnessed separately.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, resolve } from 'node:path'
import postcss from 'postcss'

type Specificity = [number, number, number]

const NODES_DIR = resolve(__dirname, '..')
const OUR_SHEET = join(NODES_DIR, 'nodeFocusRing.css')
const RF_SHEET = resolve(process.cwd(), 'node_modules/@xyflow/react/dist/style.css')

/** Split on commas that are not inside parentheses or brackets. */
function splitTopLevel(list: string): string[] {
  const out: string[] = []
  let depth = 0
  let cur = ''
  for (const ch of list) {
    if (ch === '(' || ch === '[') depth++
    if (ch === ')' || ch === ']') depth--
    if (ch === ',' && depth === 0) {
      out.push(cur.trim())
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur.trim())
  return out
}

const add = (a: Specificity, b: Specificity): Specificity => [a[0] + b[0], a[1] + b[1], a[2] + b[2]]
const cmp = (a: Specificity, b: Specificity): number => a[0] - b[0] || a[1] - b[1] || a[2] - b[2]
const maxOf = (list: Specificity[]): Specificity =>
  list.reduce((m, s) => (cmp(s, m) > 0 ? s : m), [0, 0, 0] as Specificity)

const LEGACY_PSEUDO_ELEMENTS = new Set(['before', 'after', 'first-line', 'first-letter'])

/**
 * Selectors Level 4 specificity of ONE complex selector. Supports the forms
 * these two sheets use (ids, classes, attributes, pseudo-classes including
 * `:is/:not/:has/:where`, pseudo-elements, type and universal selectors,
 * combinators) and THROWS on anything else, so an unmodelled form can never be
 * silently scored as zero.
 */
function specificity(selector: string): Specificity {
  let s: Specificity = [0, 0, 0]
  let i = 0
  const readIdent = () => {
    const m = /^-?[_a-zA-Z0-9\\-]+/.exec(selector.slice(i))
    if (!m) throw new Error(`unparsed identifier at ${i} in "${selector}"`)
    i += m[0].length
    return m[0]
  }
  const readParens = () => {
    // selector[i] === '('
    let depth = 0
    const start = i
    for (; i < selector.length; i++) {
      if (selector[i] === '(') depth++
      else if (selector[i] === ')' && --depth === 0) { i++; return selector.slice(start + 1, i - 1) }
    }
    throw new Error(`unbalanced parentheses in "${selector}"`)
  }
  while (i < selector.length) {
    const ch = selector[i]
    if (/\s|>|\+|~/.test(ch)) { i++; continue }
    if (ch === '#') { i++; readIdent(); s = add(s, [1, 0, 0]); continue }
    if (ch === '.') { i++; readIdent(); s = add(s, [0, 1, 0]); continue }
    if (ch === '[') {
      const end = selector.indexOf(']', i)
      if (end < 0) throw new Error(`unclosed attribute in "${selector}"`)
      i = end + 1
      s = add(s, [0, 1, 0])
      continue
    }
    if (ch === '*') { i++; continue }
    if (ch === ':') {
      if (selector[i + 1] === ':') { i += 2; readIdent(); s = add(s, [0, 0, 1]); continue }
      i++
      const name = readIdent().toLowerCase()
      if (selector[i] === '(') {
        const arg = readParens()
        if (name === 'where') continue
        if (name === 'is' || name === 'not' || name === 'has') {
          s = add(s, maxOf(splitTopLevel(arg).map(specificity)))
          continue
        }
        if (name.startsWith('nth-')) { s = add(s, [0, 1, 0]); continue }
        throw new Error(`unmodelled functional pseudo-class :${name}() in "${selector}"`)
      }
      s = add(s, LEGACY_PSEUDO_ELEMENTS.has(name) ? [0, 0, 1] : [0, 1, 0])
      continue
    }
    if (/[a-zA-Z]/.test(ch)) { readIdent(); s = add(s, [0, 0, 1]); continue }
    throw new Error(`unparsed character "${ch}" at ${i} in "${selector}"`)
  }
  return s
}

const fmt = (s: Specificity) => `(${s.join(',')})`

/** Class tokens of a selector, exact (so `.react-flow__node-default` is not `.react-flow__node`). */
const classes = (sel: string) => new Set((sel.match(/\.-?[_a-zA-Z][_a-zA-Z0-9-]*/g) ?? []).map((c) => c.slice(1)))

type Rule = { selector: string; decls: Map<string, string> }

function rulesOf(file: string): Rule[] {
  const root = postcss.parse(readFileSync(file, 'utf8'), { from: file })
  const out: Rule[] = []
  root.walkRules((rule) => {
    const decls = new Map<string, string>()
    rule.walkDecls((d) => { decls.set(d.prop, d.value) })
    for (const selector of rule.selectors) out.push({ selector, decls })
  })
  return out
}

const setsOutline = (r: Rule) =>
  [...r.decls.keys()].some((p) => p === 'outline' || (p.startsWith('outline-') && p !== 'outline-offset'))

describe('the specificity calculator (instrument controls)', () => {
  it.each([
    ['.react-flow .react-flow__node:focus-visible', [0, 3, 0]],
    ['.react-flow__node.selectable:focus-visible', [0, 3, 0]],
    ['.react-flow .react-flow__node[tabindex]:focus-visible', [0, 4, 0]],
    ['.react-flow .react-flow__node.selectable:focus-visible', [0, 4, 0]],
    [".a:focus-visible:has([data-x='true'])", [0, 3, 0]],
    ['div#x > p::before', [1, 0, 3]],
    [':where(.a, #b) .c', [0, 1, 0]],
    [':is(.a, #b) span', [1, 0, 1]],
  ] as const)('%s → %j', (sel, expected) => {
    expect(specificity(sel)).toEqual(expected)
  })
})

describe('SI-4 — the card focus ring outranks React Flow\'s outline reset', () => {
  // React Flow rules that reset the node wrapper's outline on focus.
  const rfCompetitors = rulesOf(RF_SHEET).filter(
    (r) =>
      classes(r.selector).has('react-flow__node') &&
      /:focus(-visible)?\b/.test(r.selector) &&
      setsOutline(r),
  )
  const ours = rulesOf(OUR_SHEET).filter(
    (r) => classes(r.selector).has('react-flow__node') && setsOutline(r),
  )

  it('CONTROL — the probe finds React Flow\'s reset, at the specificity the review measured', () => {
    const reset = rfCompetitors.find((r) => r.selector === '.react-flow__node.selectable:focus-visible')
    expect(reset, `React Flow reset not found; competitors: ${rfCompetitors.map((r) => r.selector).join(' | ')}`).toBeDefined()
    expect(reset!.decls.get('outline')).toBe('none')
    expect(specificity(reset!.selector)).toEqual([0, 3, 0])
  })

  it('our sheet declares the contract\'s ring (2px solid Info, 3px offset) on the node wrapper, on :focus-visible', () => {
    expect(ours.length, 'nodeFocusRing.css must declare an outline on .react-flow__node').toBeGreaterThan(0)
    for (const r of ours) {
      expect(r.selector).toMatch(/:focus-visible/)
      expect(r.decls.get('outline')).toBe('2px solid var(--info)')
      expect(r.decls.get('outline-offset')).toBe('3px')
    }
  })

  it('⭐ every selector of our ring STRICTLY outranks every React Flow outline reset (no tie, so load order cannot decide)', () => {
    const theirs = maxOf(rfCompetitors.map((r) => specificity(r.selector)))
    for (const r of ours) {
      const mine = specificity(r.selector)
      expect(
        cmp(mine, theirs),
        `"${r.selector}" is ${fmt(mine)}; React Flow's reset is ${fmt(theirs)} — a tie or less means the later-injected sheet decides`,
      ).toBeGreaterThan(0)
    }
  })

  it('the driver-card offset rule outranks the ring it adjusts', () => {
    const base = ours.map((r) => specificity(r.selector))
    const offsetRules = rulesOf(OUR_SHEET).filter((r) => r.selector.includes(':has(') && r.decls.has('outline-offset'))
    expect(offsetRules.length).toBe(1)
    expect(cmp(specificity(offsetRules[0].selector), maxOf(base))).toBeGreaterThan(0)
  })

  it('registry.ts imports the sheet (the module every node-rendering surface imports)', () => {
    const registry = readFileSync(join(NODES_DIR, 'registry.ts'), 'utf8')
    expect(registry).toMatch(/^import\s+['"]\.\/nodeFocusRing\.css['"]/m)
  })
})
