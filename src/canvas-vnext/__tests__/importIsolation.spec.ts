// Machine-enforced fences for the vNext surface (analysis-hero
// fixtureIsolation pattern — fs walk + import-statement scan):
//
//  1. BUNDLE FENCE — nothing outside src/canvas-vnext references it except
//     CanvasMVP's dynamic import (the default bundle stays untouched).
//  2. ONE-ADAPTER BOUNDARY — only vm/useGraphExperienceVM.tsx imports the
//     canvas store / guidance store / analysis-state / results-data modules.
//  3. FIXTURE FENCE — fixtures/ is imported only by the demo-load path
//     (CanvasVNext.tsx), fixtures/ itself, and tests.
//  4. A4 VOCABULARY LOCK-OUT — the competing edge-strength phrase ladders
//     (describeEdgeInfluence; model-tab strengthBands + its utils alias;
//     edgeLabels' boost/drag describeEdge/getEdgeLabel) are banned imports;
//     vNext uses ONLY the unified inspector-v2 ladder.
//  5. MUTATOR GUARD — no canvas-store writes anywhere in the surface.

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, sep } from 'node:path'

const SRC_ROOT = join(__dirname, '..', '..')
const VNEXT_ROOT = join(SRC_ROOT, 'canvas-vnext')

function walk(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      out.push(...walk(full))
    } else if (/\.(ts|tsx)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** Extract import/require/dynamic-import statements (clause + specifier). */
function importStatements(content: string): Array<{ clause: string; specifier: string }> {
  const statements: Array<{ clause: string; specifier: string }> = []
  const staticRe = /import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]/g
  const bareRe = /import\s+['"]([^'"]+)['"]/g
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g
  let m: RegExpExecArray | null
  while ((m = staticRe.exec(content))) statements.push({ clause: m[1], specifier: m[2] })
  while ((m = bareRe.exec(content))) statements.push({ clause: '', specifier: m[1] })
  while ((m = dynamicRe.exec(content))) statements.push({ clause: '(dynamic)', specifier: m[1] })
  return statements
}

const rel = (file: string) => relative(SRC_ROOT, file).split(sep).join('/')

describe('bundle fence', () => {
  it('no module outside src/canvas-vnext IMPORTS it, except CanvasMVP via dynamic import', () => {
    // Import statements only — comments may mention the directory.
    const offenders: string[] = []
    for (const file of walk(SRC_ROOT)) {
      if (file.startsWith(VNEXT_ROOT)) continue
      const content = readFileSync(file, 'utf8')
      const imports = importStatements(content).filter((s) => s.specifier.includes('canvas-vnext'))
      if (imports.length === 0) continue
      const path = rel(file)
      if (path === 'routes/CanvasMVP.tsx') {
        const statics = imports.filter((s) => s.clause !== '(dynamic)')
        if (statics.length > 0) offenders.push(`${path} (STATIC import of canvas-vnext)`)
        continue
      }
      offenders.push(path)
    }
    expect(offenders).toEqual([])
  })

  it('CanvasMVP actually lazy-loads the surface', () => {
    const content = readFileSync(join(SRC_ROOT, 'routes', 'CanvasMVP.tsx'), 'utf8')
    expect(content).toMatch(/lazy\(\(\)\s*=>\s*import\(['"]\.\.\/canvas-vnext\/CanvasVNext['"]\)\)/)
  })
})

describe('one-adapter boundary', () => {
  const BANNED_STORE_MODULES = [
    /(?:^|\/)canvas\/store$/,
    /canvas\/stores\/guidanceStore/,
    /hooks\/useAnalysisDisplayState/,
    /useResultsSectionData/,
    /canvas\/selectors\/results/,
  ]

  it('only vm/useGraphExperienceVM.tsx imports store/results modules', () => {
    const offenders: string[] = []
    for (const file of walk(VNEXT_ROOT)) {
      const path = rel(file)
      if (path === 'canvas-vnext/vm/useGraphExperienceVM.tsx') continue
      if (path.includes('__tests__')) continue
      const content = readFileSync(file, 'utf8')
      for (const { specifier } of importStatements(content)) {
        if (BANNED_STORE_MODULES.some((re) => re.test(specifier))) {
          offenders.push(`${path} → ${specifier}`)
        }
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('fixture fence', () => {
  it('fixtures are imported only by the demo-load path, fixtures/ itself, and tests', () => {
    const offenders: string[] = []
    for (const file of walk(VNEXT_ROOT)) {
      const path = rel(file)
      const allowed =
        path === 'canvas-vnext/CanvasVNext.tsx' ||
        path.startsWith('canvas-vnext/fixtures/') ||
        path.includes('__tests__')
      if (allowed) continue
      const content = readFileSync(file, 'utf8')
      for (const { specifier } of importStatements(content)) {
        if (/(^|\/)fixtures(\/|$)/.test(specifier)) offenders.push(`${path} → ${specifier}`)
      }
    }
    expect(offenders).toEqual([])
  })

  it('nothing outside canvas-vnext imports its fixtures at all', () => {
    const offenders: string[] = []
    for (const file of walk(SRC_ROOT)) {
      if (file.startsWith(VNEXT_ROOT)) continue
      const content = readFileSync(file, 'utf8')
      for (const { specifier } of importStatements(content)) {
        if (specifier.includes('canvas-vnext/fixtures')) offenders.push(rel(file))
      }
    }
    expect(offenders).toEqual([])
  })
})

describe('A4 vocabulary lock-out', () => {
  const BANNED_MODULES = [/model-tab\/strengthBands/, /model-tab\/utils/, /domain\/edgeLabels/]
  const BANNED_IDENTIFIERS = [
    'describeEdgeInfluence',
    'strengthSemanticLabel',
    'describeEdge',
    'getEdgeLabel',
    'getStrengthBand',
  ]

  it('no vNext module imports a competing edge-strength phrase ladder', () => {
    const offenders: string[] = []
    for (const file of walk(VNEXT_ROOT)) {
      const path = rel(file)
      // The lock-out targets surface modules; tests may name the banned
      // identifiers as data (this file does).
      if (path.includes('__tests__')) continue
      const content = readFileSync(file, 'utf8')
      for (const { clause, specifier } of importStatements(content)) {
        if (BANNED_MODULES.some((re) => re.test(specifier))) {
          offenders.push(`${path} → module ${specifier}`)
        }
        for (const name of BANNED_IDENTIFIERS) {
          if (new RegExp(`\\b${name}\\b`).test(clause)) {
            offenders.push(`${path} → import { ${name} }`)
          }
        }
      }
    }
    expect(offenders).toEqual([])
  })

  it('the unified ladder is the one in use (positive control)', () => {
    const strings = readFileSync(join(VNEXT_ROOT, 'vm', 'strings.ts'), 'utf8')
    expect(strings).toMatch(/from '\.\.\/\.\.\/canvas\/ui\/inspector-v2\/inspectorStrings'/)
  })
})

describe('mutator guard', () => {
  it('no canvas-store writes anywhere in the surface', () => {
    const offenders: string[] = []
    for (const file of walk(VNEXT_ROOT)) {
      const path = rel(file)
      if (path.includes('__tests__')) continue
      const content = readFileSync(file, 'utf8')
      if (/useCanvasStore\.setState/.test(content)) offenders.push(`${path} → useCanvasStore.setState`)
      if (/useCanvasStore\.getState\(\)\.(addNode|addEdge|updateNode|updateEdge|onNodesChange|onEdgesChange|setGoalThreshold|selectNode)/.test(content)) {
        offenders.push(`${path} → store mutator call`)
      }
    }
    expect(offenders).toEqual([])
  })
})
