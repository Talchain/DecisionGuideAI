// tests/ci-guards/panel-list-conformance.spec.ts
//
// Every `<ul>` the AI panel renders must take its styling from `panelLists.ts`.
//
// ── WHY ──────────────────────────────────────────────────────────────────────
// Ten lists, ten treatments, measured on `16c55158`: markers on three and absent
// from seven; indents `pl-4` / `pl-5` / inline `paddingLeft: 20`; rhythm
// `space-y-1` / `space-y-2` / a CSS-module margin / nothing. None of it was a
// decision — each list was styled by whoever wrote it, and the drift was
// invisible because no two sat on screen together.
//
// This guard is DERIVED: it finds the `<ul>` opening tags itself rather than
// carrying a list of files someone must remember to update. A new list in a new
// file is caught the day it lands.
//
// ⚠ IT ASSERTS THE MECHANISM, NOT THE VALUES. It does not check for `list-disc`
// or `space-y-1` — that would pass a hand-copied duplicate of the constant and
// re-open exactly the drift it exists to close. It requires the CONSTANT, so the
// values live in one place and changing them is one edit.
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'

const root = resolve(__dirname, '../..')

/** The AI panel's render surface — the dirs and files that compose the panel. */
const SURFACE = [
  'src/canvas/conversation',
  'src/v5/blocks',
  'src/canvas/components/FloatingOlumiPanel.tsx',
  'src/canvas/components/OlumiTabBody.tsx',
]

function walk(rel: string): string[] {
  const abs = resolve(root, rel)
  if (statSync(abs).isFile()) return abs.endsWith('.tsx') ? [rel] : []
  const out: string[] = []
  for (const entry of readdirSync(abs)) {
    if (entry === '__tests__' || entry === '__fixtures__') continue
    const childRel = join(rel, entry)
    const childAbs = resolve(root, childRel)
    if (statSync(childAbs).isDirectory()) out.push(...walk(childRel))
    else if (entry.endsWith('.tsx') && !/\.(spec|test)\.tsx$/.test(entry)) out.push(childRel)
  }
  return out
}

/** Every `<ul …>` opening tag in the surface, as `{ file, line, tag }`. */
function panelLists(): Array<{ file: string; line: number; tag: string }> {
  const found: Array<{ file: string; line: number; tag: string }> = []
  for (const rel of SURFACE.flatMap(walk)) {
    const src = readFileSync(resolve(root, rel), 'utf8')
    const lines = src.split('\n')
    for (let i = 0; i < lines.length; i++) {
      // `\b`, not `(\s|>)`: a multi-line JSX tag puts `<ul` at END of line with
      // nothing after it, and `(\s|>)` silently skipped every one of those —
      // which is the form the most complex lists happen to use. Caught by the
      // scan returning 8 when a hand audit found 10.
      if (!/<ul\b/.test(lines[i])) continue
      // A JSX opening tag may wrap over several lines; take until the closing `>`.
      let tag = ''
      for (let j = i; j < Math.min(i + 8, lines.length); j++) {
        tag += lines[j]
        if (lines[j].includes('>')) break
      }
      found.push({ file: rel, line: i + 1, tag })
    }
  }
  return found
}

const CONSTANTS = ['PANEL_LIST_BULLET', 'PANEL_LIST_STACK', 'PANEL_LIST_CONTROLS']

describe('AI panel list conformance', () => {
  it('PRECONDITION — the surface is walkable and actually contains lists', () => {
    // Without this, every assertion below passes vacuously on an empty scan —
    // a renamed directory would read as "all lists conform".
    const files = SURFACE.flatMap(walk)
    expect(files.length, 'no .tsx files found in the panel surface').toBeGreaterThan(40)
    expect(panelLists().length, 'no <ul> found — the scanner is blind').toBeGreaterThan(5)
  })

  it('every <ul> in the panel takes its styling from panelLists.ts', () => {
    const offenders = panelLists()
      .filter((l) => !CONSTANTS.some((c) => l.tag.includes(c)))
      .map((l) => `${l.file}:${l.line}`)
    expect(offenders, 'these lists style themselves instead of using a PANEL_LIST_* constant').toEqual([])
  })

  it('no <ul> hand-rolls a marker, indent or rhythm alongside the constant', () => {
    // Catches the half-migration: importing the constant and then appending
    // `pl-5` or `space-y-2` next to it, which re-opens the drift one class at a
    // time while the guard above still passes.
    const strays = panelLists()
      .filter((l) => CONSTANTS.some((c) => l.tag.includes(c)))
      .filter((l) => /\b(list-disc|list-none|list-decimal|pl-\d|pt-\d|space-y-\d|paddingLeft)\b/.test(
        // Look only at what sits OUTSIDE the constant reference itself.
        CONSTANTS.reduce((acc, c) => acc.split(c).join(''), l.tag),
      ))
      .map((l) => `${l.file}:${l.line}`)
    expect(strays, 'list styling appended beside the constant — put it in panelLists.ts instead').toEqual([])
  })

  it('the three constants remain distinct — two names for one spelling is not a scale', () => {
    const mod = readFileSync(resolve(root, 'src/canvas/conversation/panelLists.ts'), 'utf8')
    const values = CONSTANTS.map((c) => {
      const m = mod.match(new RegExp(`export const ${c} =\\s*'([^']+)'`))
      expect(m, `${c} is not exported as a string literal`).toBeTruthy()
      return m![1]
    })
    expect(new Set(values).size, `duplicate spellings: ${values.join(' | ')}`).toBe(3)
    // BULLET is the only one that carries a marker; the other two must not.
    expect(values[0]).toContain('list-disc')
    expect(values[1]).not.toContain('list-disc')
    expect(values[2]).not.toContain('list-disc')
  })

})
