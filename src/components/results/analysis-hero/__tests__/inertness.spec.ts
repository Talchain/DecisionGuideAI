/**
 * Mount guard (CI tripwire) — ALLOW-LIST.
 *
 * The analysis hero is mounted in exactly ONE authorised place: ResultsBody
 * renders `AnalysisHeroContainer`, unconditionally. This
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

// D7 integration witness exercises the authorised ResultsBody mount and its hero projection.
const TEST_IMPORTERS = new Set([
  join(SRC, 'components', 'results', '__tests__', 'driverOneList.paulGraph.spec.tsx'),
  // WS5 card DL gate row (#2713): builds the constrained fixture from hero.fixtures (test data only); mounts no hero.
  join(SRC, 'canvas', 'nodes', '__tests__', 'OptionNode.constrainedChanceCell.ws5.spec.tsx'),
])

// Pure-copy readers (7 Oct, A1 decision matrix): they say the hero's goal-chance WORDS so the Run tells one
// story (R4), and they mount nothing. Each may import ONLY goalChanceCopy; any other hero import still fails.
const COPY_MODULE = join(MODULE_DIR, 'goalChanceCopy')
const COPY_ONLY_IMPORTERS = new Set([
  // RunView: the one client chance authority; reads hero copy words, mounts nothing (#2704)
  join(SRC, 'canvas', 'runView', 'runView.ts'),
  join(SRC, 'components', 'results', 'analysisNew', 'sections', 'DecisionMatrix.tsx'),
  // Compare-chance (#87 6035414740): Compare says each Run's goal chance in the hero's own words; it mounts nothing.
  join(SRC, 'canvas', 'compare-tab', 'ComparePairSections.tsx'),
  join(SRC, 'canvas', 'compare-tab', '__tests__', 'CompareRunPairBody.goalChances.spec.tsx'),
  // B15 (#87, DL 7 Oct): the chat Analysis-result card leads with each option's goal chance in the hero's own words,
  // read from its own block's licence; it mounts nothing.
  join(SRC, 'v5', 'blocks', 'V5AnalysisResultBlock.tsx'),
])

function heroImportOffenders(content: string, file: string): string[] {
  return findAnalysisHeroImports(content, file).filter(
    (spec) => !(COPY_ONLY_IMPORTERS.has(file) && resolveSpec(spec, file) === COPY_MODULE),
  )
}

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
    // S1: only tests may import this explicit canonical fixture builder; it mounts no hero.
    if (importerFile.includes(sep + '__tests__' + sep) && resolved === join(MODULE_DIR, '__tests__', 'helpers', 'canonicalTestCells')) continue
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
      if (TEST_IMPORTERS.has(file)) continue
      const hits = heroImportOffenders(readFileSync(file, 'utf8'), file)
      if (hits.length) offenders.push(`${file.slice(SRC.length - 3)} -> ${hits.join(', ')}`)
    }
    expect(
      offenders,
      `Only ResultsBody may import the analysis hero; remove these other imports:\n${offenders.join('\n')}`,
    ).toEqual([])
  })

  const MATRIX = join(SRC, 'components', 'results', 'analysisNew', 'sections', 'DecisionMatrix.tsx')
  it.each([
    ['test helper importer', join(SRC, 'canvas', 'nodes', '__tests__', 'control.ts'), "import { canonicalTestCellsOf } from '../../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'", 0],
    ['production helper importer', join(SRC, 'canvas', 'nodes', 'control.ts'), "import { canonicalTestCellsOf } from '../../components/results/analysis-hero/__tests__/helpers/canonicalTestCells'", 1],
    ['copy-only reader importing goalChanceCopy', MATRIX, "import { about } from '../../analysis-hero/goalChanceCopy'", 0],
    ['copy-only reader importing the hero container', MATRIX, "import { AnalysisHeroContainer } from '../../analysis-hero'", 1],
    ['copy-only reader importing a hero component', MATRIX, "import { HeroOptionRow } from '../../analysis-hero/HeroOptionRow'", 1],
    ['an unlisted file importing goalChanceCopy', join(SRC, 'components', 'results', 'index.ts'), "import { about } from './analysis-hero/goalChanceCopy'", 1],
  ])('copy-only exemption is exact: %s', (_label, importer, code, expected) => {
    expect(heroImportOffenders(code, importer).length).toBe(expected)
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
