/** U13: the retired notice has no production mount; its copy authority and provenance checks remain. */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const SRC = resolve(__dirname, '../../..')

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
 * Comments are stripped first — a scan that cannot tell code from prose about
 * code reports a component's own header as a mount site of itself.
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
 * Closes the aliased-import channel a name-shaped scan is blind to: the name is
 * what a reader looks for, the PATH is what cannot be renamed away.
 */
function importersOf(moduleBasename: string, files: string[]): string[] {
  const imported = new RegExp(`from\\s*['"][^'"]*\\b${moduleBasename}['"]`)
  return files
    .filter((f) => imported.test(stripComments(readFileSync(f, 'utf8'))))
    .map((f) => f.slice(SRC.length + 1))
    .sort()
}


describe('model-building notices have exactly one production mount site', () => {
  const files = walk(SRC)

  it('CONTROL: the scanner reads a plausible number of files and can see known symbols', () => {
    // (1) Magnitude. A scanner that walked nothing, or one directory, would
    //     still return a clean "no extra mounts" answer below.
    expect(files.length).toBeGreaterThan(500)
    // (2) Discrimination — a CONTRAST symbol expected in more than one place.
    //     Zero or one here means the regex is broken and every absence claim
    //     below is unsupported (trap 13e: a control must be PLAUSIBLE, not
    //     merely non-zero).
    expect(mountSitesOf('SectionErrorBoundary', files).length).toBeGreaterThan(1)
    expect(importersOf('typography', files).length).toBeGreaterThan(1)
  })

  it('U13: ModelBuildingNoticesNotice has no production mount', () => {
    expect(mountSitesOf('ModelBuildingNoticesNotice', files)).toEqual([])
  })

  it('U13: no production caller imports the retired notice', () => {
    // The path-shaped half: a file that cannot import the module cannot mount
    // it under any local name. Stated as the exact importer set, so a new
    // importer names itself in the failure.
    expect(importersOf('ModelBuildingNoticesNotice', files)).toEqual([])
  })

  it('the copy authority is imported by the renderer and the wire binding only', () => {
    // One place owns kind -> user-visible string. A second mapper elsewhere is
    // how two vocabularies for one concept get shipped (Paul's convergence
    // rule: name the canonical owner, never add a parallel one).
    //
    // ⭐⭐ THREE IMPORTERS ADDED 12 Sep 2026 (ROADMAP 2.1379), AND THE SET IS
    // STATED SO EACH ONE HAD TO COME AND JUSTIFY ITSELF. The Reasoning tab's
    // "Not modelled yet" pane now answers from this same attestation when the
    // cold read's manifest cannot — so the register and the bubble describe one
    // payload. That is the OPPOSITE of a second vocabulary, but only because
    // each new importer CONSUMES the authority rather than restating it:
    //
    //   contextIntegrity/notModelledNotices.ts   asks `modelBuildingNoticeOutcome`
    //     for which kinds may sit under "Not modelled yet". A predicate written
    //     there would put two answers to one question on one screen.
    //   contextIntegrity/WhatIWasGivenSection.tsx  takes the ROW TYPE only; the
    //     strings it renders are the ones the wire binding already resolved.
    //   canvas/stores/contextIntegrityStore.ts    takes the VIEW TYPE only, to
    //     carry the draft turn's attestation to a surface mounted much later.
    //
    // ⚠ THE LIST IS THE WEAKER HALF OF THIS GUARANTEE — it says WHO imports,
    // never WHAT they took. The assertion below is the half that actually pins
    // the ruling, and it is the one to read first if this set ever grows again.
    expect(importersOf('modelBuildingNotices', files)).toEqual([
      'canvas/conversation/ModelBuildingNoticesNotice.tsx',
      'canvas/conversation/types.ts',
      'canvas/conversation/useConversation.ts',
      'canvas/stores/contextIntegrityStore.ts',
      'components/results/contextIntegrity/WhatIWasGivenSection.tsx',
      'components/results/contextIntegrity/notModelledNotices.ts',
    ])
  })

  /**
   * ⭐⭐ THE RULING ITSELF, PINNED — not the list of files that happen to hold it.
   *
   * `describeModelBuildingNoticeKind` is the ONLY path from a producer kind to a
   * user-visible string, and its own header says a kind with no phrasing renders
   * NOTHING rather than its code. A second caller is how a surface acquires a
   * `?? kind` fallback and starts printing `existence_boundary_crossing` at a
   * user — the exact defect that file exists to end.
   *
   * So the ONE legitimate caller is the wire binding inside the module itself,
   * which resolves every string once at `toModelBuildingNoticesView`. Every
   * consumer downstream renders `row.description` and never reaches for the map.
   * Stated as an import-specifier scan rather than a file list, because the file
   * list grows for honest reasons and this must not.
   */
  it('NOTHING outside the module reaches for the kind -> string map', () => {
    const importers = importersOf('modelBuildingNotices', files)

    /**
     * What each importer actually TOOK from the module. Bounded by `[^}]`, so a
     * match cannot run past its own brace into a neighbouring import — a lazy
     * cross-statement match is how a scan of this shape silently reads the
     * wrong specifiers.
     */
    const specifiersTakenBy = (relPath: string): string => {
      const src = stripComments(readFileSync(join(SRC, relPath), 'utf8'))
      const re = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['"][^'"]*\bmodelBuildingNotices['"]/g
      return [...src.matchAll(re)].map((m) => m[1]).join(',')
    }
    const taken = new Map(importers.map((f) => [f, specifiersTakenBy(f)]))

    /**
     * ⚠ CONTROL FIRST, IN THE SAME RUN (traps 13 / 13e). A specifier scan that
     * matched nothing would report a perfect absence below. So: every importer
     * must have yielded a non-empty specifier list, and a CONTRAST symbol that
     * IS genuinely shared must be seen in more than one of them. An absence is
     * believed only once the same scan has produced a presence.
     */
    for (const [file, specifiers] of taken) {
      expect(`${file} -> ${specifiers}`).toMatch(/->\s*\S/)
    }
    const outcomeCallers = [...taken].filter(([, s]) => s.includes('modelBuildingNoticeOutcome'))
    expect(outcomeCallers.length).toBeGreaterThan(1)

    // And the claim itself.
    const describeCallers = [...taken]
      .filter(([, s]) => s.includes('describeModelBuildingNoticeKind'))
      .map(([f]) => f)
    expect(describeCallers).toEqual([])
  })
})
