/**
 * THE STRUCTURAL HALF of the single-truth-banner guarantee.
 *
 * `AnalysisStateRegion.singleTruthBanner.spec.tsx` proves the REGION renders at
 * most one banner. That is worth nothing if a second copy of either banner is
 * mounted somewhere else on the same surface — which is exactly how L-36
 * happened: seven independently-sourced truth-state children, each correct in
 * isolation, none gating any other.
 *
 * So this guard asserts the other half: across the whole product source, each
 * truth-state notice has EXACTLY ONE production mount site, and it is the
 * region.
 *
 * ⚠ DERIVED, NOT MIRRORED (CLAUDE.md trap 12). There is no hand-kept list of
 * allowed mount sites here — the sites are read out of the source at test time.
 * A hand-maintained allowlist would drift silently the first time someone added
 * a mount, and the drift would read as green.
 *
 * ⚠ AND IT HAS A POSITIVE CONTROL, because every assertion below is an ABSENCE
 * claim over a file scan, and a scan that silently reads nothing produces a
 * perfect absence result (trap 13 / 13e). The control asserts the scanner finds
 * a KNOWN-PRESENT mount in a plausible quantity before any absence is believed.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(__dirname, '../../../..')

/** Production source only: stories, fixtures and specs may mount anything. */
function isProductionSource(path: string): boolean {
  if (!/\.(ts|tsx)$/.test(path)) return false
  if (path.includes('__tests__')) return false
  if (path.includes('__fixtures__')) return false
  if (/\.spec\.[tj]sx?$/.test(path)) return false
  if (/\.test\.[tj]sx?$/.test(path)) return false
  if (/\.stories\.[tj]sx?$/.test(path)) return false
  return true
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (isProductionSource(full)) out.push(full)
  }
  return out
}

/**
 * ⚠ COMMENTS ARE STRIPPED FIRST, AND THAT WAS A MEASURED INSTRUMENT DEFECT,
 * NOT A PRECAUTION. The first version of this scanner matched `<Name` anywhere
 * in the file and reported `AnalysisStateRegion.tsx` as a mount site of
 * itself — because its own header comment writes `<AnalysisStateRegion>` when
 * naming the component. A scan that cannot tell code from prose about code
 * produces confident, wrong mount inventories in BOTH directions.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/.*$/gm, '$1')
}

/** Files containing a JSX MOUNT of `<Name`, not merely an import or a mention. */
function mountSitesOf(name: string, files: string[]): string[] {
  const mount = new RegExp(`<${name}[\\s/>]`)
  return files
    .filter((f) => mount.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(SRC.length + 1))
    .sort()
}

/**
 * Files that IMPORT a module by path, whatever local name they bind it to.
 *
 * ⚠ THIS CLOSES AN EVASION CHANNEL AN ADVERSARIAL REVIEW EXECUTED. `mountSitesOf`
 * greps for `<Name`, so an ALIASED import defeats it completely:
 *
 *     import { AnalysisFreshnessNotice as Strip } from '.../AnalysisFreshnessNotice'
 *     <Strip />
 *
 * — a second live banner on the surface, invisible to a name-shaped scan. The
 * name is the thing a reader looks for and therefore the thing a scan is
 * tempted to bind to; the PATH is what cannot be renamed away, because it is
 * what the module system resolves. Both are checked: the name scan says where
 * it is mounted, the path scan says who can mount it at all.
 */
function importersOf(moduleBasename: string, files: string[]): string[] {
  const imported = new RegExp(`from\\s*['"][^'"]*\\b${moduleBasename}['"]`)
  return files
    .filter((f) => imported.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(SRC.length + 1))
    .sort()
}

describe('truth-state notices have exactly one production mount site', () => {
  const files = walk(SRC)

  it('CONTROL: the scanner reads a plausible number of files and can see a known mount', () => {
    // Two independent controls, because a scan can fail in two directions.
    // (1) Magnitude: this repo has thousands of production TS/TSX files. A
    //     scanner that walked nothing, or walked one directory, would still
    //     return a clean "no extra mounts" answer below.
    expect(files.length).toBeGreaterThan(500)
    // (2) Discrimination: a CONTRAST symbol we expect to be PRESENT in more
    //     than one place. If this reads zero or one, the regex is broken and
    //     every absence claim below is unsupported (trap 13e: a control must be
    //     plausible, not merely non-zero).
    expect(mountSitesOf('SectionErrorBoundary', files).length).toBeGreaterThan(1)
  })

  it('AnalysisRefusalNotice is mounted only by the region', () => {
    expect(mountSitesOf('AnalysisRefusalNotice', files)).toEqual([
      'components/results/analysisState/AnalysisStateRegion.tsx',
    ])
  })

  it('AnalysisFreshnessNotice is mounted only by the region', () => {
    // The historical second mount was `OutputsDock.tsx`, as a SIBLING of the
    // refusal notice. That sibling relationship WAS the defect.
    expect(mountSitesOf('AnalysisFreshnessNotice', files)).toEqual([
      'components/results/analysisState/AnalysisStateRegion.tsx',
    ])
  })

  it('and NOTHING ELSE CAN MOUNT EITHER — nobody else imports the modules', () => {
    // The path-shaped half. A file that cannot import the module cannot mount
    // it under any local name, so this closes the aliased-import channel the
    // name scan above is blind to. Stated as the exact importer set rather than
    // a count, so a new importer names itself in the failure.
    const REGION = 'components/results/analysisState/AnalysisStateRegion.tsx'
    expect(importersOf('AnalysisRefusalNotice', files)).toEqual([REGION])
    expect(importersOf('AnalysisFreshnessNotice', files)).toEqual([REGION])
  })

  it('CONTROL: the importer scan is not blind (it can see a known importer)', () => {
    // Same discipline as the mount-site control: an absence claim over a file
    // scan needs proof the scan can observe a presence. `analysisStateContract`
    // is imported by the region AND by the hook, so a working scan returns
    // more than one — a scan returning one would be indistinguishable from a
    // regex that only ever matches the file it was tuned against.
    expect(importersOf('analysisStateContract', files).length).toBeGreaterThan(1)
  })

  it('the region itself is mounted exactly once — one surface, one region', () => {
    // A second region on the same scroller would restore the stacking with the
    // per-region invariant intact in each: two regions, one banner each, two
    // banners on screen. The count is the thing that matters, so it is pinned.
    expect(mountSitesOf('AnalysisStateRegion', files)).toEqual([
      'canvas/components/OutputsDock.tsx',
    ])
  })
})
