/**
 * Mount guard (CI tripwire) — ALLOW-LIST.
 *
 * The analysis hero is mounted in exactly ONE authorised place: ResultsBody
 * renders `AnalysisHeroContainer` behind the `analysisHeroPanel` flag. This
 * test fails if ANY OTHER file outside the module imports it — via static /
 * type-only / re-export / dynamic import() / React.lazy / require /
 * side-effect / glued forms, by alias ('@/.../analysis-hero') or relative
 * path. Mechanism copied from the proven focus-now inertness guard (import
 * specifiers are RESOLVED to absolute paths, not substring-matched).
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { stripComments } from '../../../../../tests/helpers/stripSourceComments'

const SRC = resolve(process.cwd(), 'src')
const MODULE_DIR = join(SRC, 'components', 'results', 'analysis-hero')

// The ONE authorised LIVE mount, plus the internal fixture gallery route.
// The gallery renders ONLY fixture-branded models (provenance 'fixture' —
// visible internal-preview banner); it cannot produce live models because
// buildHeroModel is the sole 'live' producer and the gallery never touches
// ResultsSectionData. The live-data mount therefore remains ResultsBody
// alone.
const AUTHORIZED_IMPORTERS = new Set([
  join(SRC, 'components', 'results', 'ResultsBody.tsx'),
  join(SRC, 'routes', 'HeroGallery.tsx'),
])

// Capture the specifier of any import / re-export / dynamic import() /
// require() — including glued zero-whitespace forms (`import{X}from'x'`)
// and template-literal specifiers (`import(\`./x\`)` with no interpolation).
const SPEC_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s*|\brequire\s*\(\s*)['"`]([^'"`\n$]+)['"`]/g

// Boundary-aware path backstop: matches `.../results/analysis-hero` and
// `.../results/analysis-hero/<file>`, but NOT a sibling like
// `analysis-hero-helpers`.
const PATH_RE = /components\/results\/analysis-hero(\/|$)/

function resolveSpec(spec: string, importerFile: string): string | null {
  if (spec.startsWith('@/')) return resolve(SRC, spec.slice(2))
  if (spec === '.' || spec === '..' || spec.startsWith('./') || spec.startsWith('../')) {
    return resolve(dirname(importerFile), spec)
  }
  return null // bare package specifier — never an analysis-hero import
}

function isUnderModule(p: string): boolean {
  return p === MODULE_DIR || p.startsWith(MODULE_DIR + sep)
}

export function findAnalysisHeroImports(content: string, importerFile: string): string[] {
  const offenders: string[] = []
  // stripComments blanks comments but KEEPS string literals as code, so a
  // commented-out `import … from './analysis-hero'` no longer false-reds
  // (the #386/#403 footgun) while a real import specifier — which IS a string
  // literal — is still captured. blankNonCode would blank the specifier body
  // and make the guard blind to every relative import, so it is the wrong tool
  // here (reclassified from the #403 manifest's "blankNonCode class").
  for (const m of stripComments(content, importerFile).matchAll(SPEC_RE)) {
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

describe('Analysis hero inertness', () => {
  it('is imported ONLY by the authorised Analysis-tab mount', () => {
    const offenders: string[] = []
    for (const file of walk(SRC)) {
      if (file === MODULE_DIR || file.startsWith(MODULE_DIR + sep)) continue
      if (AUTHORIZED_IMPORTERS.has(file)) continue
      const hits = findAnalysisHeroImports(readFileSync(file, 'utf8'), file)
      if (hits.length) offenders.push(`${file.slice(SRC.length - 3)} -> ${hits.join(', ')}`)
    }
    expect(
      offenders,
      `Only ResultsBody may import the analysis hero; remove these other imports:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  it('the authorised mount (ResultsBody) actually imports the module', () => {
    for (const f of AUTHORIZED_IMPORTERS) {
      expect(
        findAnalysisHeroImports(readFileSync(f, 'utf8'), f).length,
        `${f.slice(SRC.length - 3)} should import analysis-hero (mount must stay wired)`,
      ).toBeGreaterThan(0)
    }
  })

  const PARENT = join(SRC, 'components', 'results', 'index.ts')
  const SIBLING = join(SRC, 'components', 'results', '__tests__', 'x.ts')

  it.each([
    ['relative static from parent dir', PARENT, "import { AnalysisHeroContainer } from './analysis-hero'"],
    ['relative type-only', PARENT, "import type { HeroModel } from './analysis-hero/heroTypes'"],
    ['relative re-export', PARENT, "export { AnalysisHeroContainer } from './analysis-hero'"],
    ['relative re-export star', PARENT, "export * from './analysis-hero'"],
    ['relative lazy/dynamic', PARENT, "const X = lazy(() => import('./analysis-hero'))"],
    ['relative deep file', PARENT, "import { HeroOptionRow } from './analysis-hero/HeroOptionRow'"],
    ['relative from sibling dir (../)', SIBLING, "import x from '../analysis-hero'"],
    ['aliased static', PARENT, "import { AnalysisHeroContainer } from '@/components/results/analysis-hero'"],
    ['aliased lazy/dynamic', PARENT, "const X = lazy(() => import('@/components/results/analysis-hero'))"],
    ['require()', PARENT, "const m = require('./analysis-hero')"],
    ['side-effect import', PARENT, "import './analysis-hero'"],
    ['glued no-whitespace named import', PARENT, "import{AnalysisHeroContainer}from'./analysis-hero'"],
    ['template-literal dynamic import', PARENT, 'const X = lazy(() => import(`./analysis-hero`))'],
  ])('FLAGS dynamic/relative import: %s', (_label, importer, code) => {
    expect(findAnalysisHeroImports(code, importer).length).toBeGreaterThan(0)
  })

  it.each([
    ['bare package import', PARENT, "import React from 'react'"],
    ['unrelated sibling module', PARENT, "import { OptionCards } from './OptionCards'"],
    ['similarly-named relative sibling', PARENT, "import x from './analysis-hero-helpers'"],
    ['similarly-named aliased sibling', PARENT, "import x from '@/components/results/analysis-hero-helpers'"],
    ['unrelated relative path elsewhere', join(SRC, 'foo', 'bar.ts'), "import './not-analysis-hero'"],
    // #386/#403 comment-strip: commented-out imports of the module no longer
    // false-red. The live forms above ('FLAGS …') still fire — both directions.
    ['//-commented module import', PARENT, "// import { AnalysisHeroContainer } from './analysis-hero'"],
    ['block-commented module import', PARENT, "/* import { HeroModel } from './analysis-hero/heroTypes' */"],
    ['//-commented aliased module import', PARENT, "// import x from '@/components/results/analysis-hero'"],
  ])('does NOT flag: %s', (_label, importer, code) => {
    expect(findAnalysisHeroImports(code, importer)).toEqual([])
  })
})
