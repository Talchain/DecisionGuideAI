/**
 * Inertness guard (CI tripwire).
 *
 * Focus Now is render-only, unmounted, and behind no feature flag. This test fails
 * if ANY file outside the module imports it — via static import, type-only import,
 * re-export, dynamic import(), React.lazy, or require() — whether by alias
 * ('@/.../focus-now') or RELATIVE path ('./focus-now', '../focus-now',
 * './focus-now/FocusNowPanel').
 *
 * It RESOLVES each import specifier to an absolute path and checks whether it lands
 * inside the module; it does NOT substring-match whole files. That closes the blind
 * spot found in PR #199 review, where a substring check ('coaching-panel/focus-now')
 * missed relative imports from the parent `coaching-panel` barrel (e.g.
 * `import { FocusNowPanel } from './focus-now'`). The in-test positive/negative
 * controls below are committed coverage, not just PR-body evidence.
 *
 * Known limitation (regex-based by design): it does not catch computed/indirect
 * dynamic imports such as `const p = './focus-now'; import(p)`. That is not a
 * current risk for an inert tripwire; an AST/parser-based guard would be more
 * exhaustive if this ever needs to harden further (PR #199 review note).
 *
 * When the deliberate mount PR lands, it must update/remove this guard.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'

const SRC = resolve(process.cwd(), 'src')
const MODULE_DIR = join(SRC, 'canvas', 'components', 'coaching-panel', 'focus-now')

// Capture the specifier of any import / re-export / dynamic import() / require().
// Covers `from 'x'`, side-effect `import 'x'`, `import('x')`, `require('x')`, and
// their "glued" zero-whitespace forms (`import{X}from'x'`, `import'x'`) — the
// `\s*` (not `\s+`) is load-bearing for that. Spurious in-string captures from
// the relaxed `from`/`import` are harmless: resolveSpec/PATH_RE never turn them
// into offenders (proven by the negative controls below).
const SPEC_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)['"]([^'"\n]+)['"]/g

// Boundary-aware path backstop: matches `.../coaching-panel/focus-now` and
// `.../coaching-panel/focus-now/<file>`, but NOT a sibling like `focus-now-helpers`.
const PATH_RE = /coaching-panel\/focus-now(\/|$)/

/** The '@/' alias maps to <src>/. Relative specifiers resolve against the importer's dir. */
function resolveSpec(spec: string, importerFile: string): string | null {
  if (spec.startsWith('@/')) return resolve(SRC, spec.slice(2))
  if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) {
    return resolve(dirname(importerFile), spec)
  }
  return null // bare package specifier — never a focus-now import
}

function isUnderModule(p: string): boolean {
  return p === MODULE_DIR || p.startsWith(MODULE_DIR + sep)
}

/** Offending specifiers in `content` that resolve into (or path-match) the module. */
export function findFocusNowImports(content: string, importerFile: string): string[] {
  const offenders: string[] = []
  for (const m of content.matchAll(SPEC_RE)) {
    const spec = m[1]
    const resolved = resolveSpec(spec, importerFile)
    if ((resolved && isUnderModule(resolved)) || PATH_RE.test(spec)) offenders.push(spec)
  }
  return offenders
}

function walk(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === 'dist') continue
    const full = join(dir, name)
    if (statSync(full).isDirectory()) walk(full, acc)
    else if (/\.(ts|tsx)$/.test(name)) acc.push(full)
  }
  return acc
}

describe('Focus Now inertness', () => {
  it('is not imported by any file outside its own module (alias OR relative, static OR dynamic)', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      if (file === MODULE_DIR || file.startsWith(MODULE_DIR + sep)) continue
      const hits = findFocusNowImports(readFileSync(file, 'utf8'), file)
      if (hits.length) offenders.push(`${file.slice(SRC.length - 3)} -> ${hits.join(', ')}`)
    }
    expect(
      offenders,
      `Focus Now is render-only/unmounted; nothing outside its module may import it yet:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  // Committed positive controls — the import forms a substring check missed.
  const PARENT = join(SRC, 'canvas', 'components', 'coaching-panel', 'index.ts')
  const SIBLING = join(SRC, 'canvas', 'components', 'coaching-panel', '__tests__', 'x.ts')

  it.each([
    ['relative static from parent barrel', PARENT, "import { FocusNowPanel } from './focus-now'"],
    ['relative type-only from parent', PARENT, "import type { FocusRow } from './focus-now'"],
    ['relative re-export from parent barrel', PARENT, "export { FocusNowPanel } from './focus-now'"],
    ['relative re-export star', PARENT, "export * from './focus-now'"],
    ['relative lazy/dynamic from parent', PARENT, "const X = lazy(() => import('./focus-now'))"],
    ['relative deep file from parent', PARENT, "import { FocusRowCard } from './focus-now/FocusRowCard'"],
    ['relative from sibling dir (../)', SIBLING, "import x from '../focus-now'"],
    ['aliased static', PARENT, "import { FocusNowPanel } from '@/canvas/components/coaching-panel/focus-now'"],
    ['aliased lazy/dynamic', PARENT, "const X = lazy(() => import('@/canvas/components/coaching-panel/focus-now'))"],
    ['require()', PARENT, "const m = require('./focus-now')"],
    ['side-effect import', PARENT, "import './focus-now'"],
    ['multiline dynamic import', PARENT, "const m = import(\n      './focus-now'\n    )"],
    ['glued no-whitespace named import', PARENT, "import{FocusNowPanel}from'./focus-now'"],
    ['glued no-whitespace re-export', PARENT, "export{FocusNowPanel}from'./focus-now'"],
    ['glued no-whitespace side-effect', PARENT, "import'./focus-now'"],
  ])('FLAGS dynamic/relative import: %s', (_label, importer, code) => {
    expect(findFocusNowImports(code, importer).length).toBeGreaterThan(0)
  })

  it.each([
    ['bare package import', PARENT, "import React from 'react'"],
    ['unrelated sibling module', PARENT, "import { CoachingPanel } from './CoachingPanel'"],
    ['similarly-named relative sibling', PARENT, "import x from './focus-now-helpers'"],
    ['similarly-named aliased sibling', PARENT, "import x from '@/canvas/components/coaching-panel/focus-now-helpers'"],
    ['unrelated relative path elsewhere', join(SRC, 'foo', 'bar.ts'), "import './focus-now'"],
  ])('does NOT flag: %s', (_label, importer, code) => {
    expect(findFocusNowImports(code, importer)).toEqual([])
  })
})
