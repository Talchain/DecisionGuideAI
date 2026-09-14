/**
 * THE STRUCTURAL HALF of the model-building-notices guarantee: the notice has
 * EXACTLY ONE production mount site, and it is the assistant message bubble.
 *
 * WHY THIS EXISTS AT ALL (CLAUDE.md trap 3b). This estate has twice shipped a
 * badge DARK because its tests targeted a component the deployed flag posture
 * does not mount — every instrument green, nothing on the user's screen. The
 * render spec beside this one drives `MessageBubble` for exactly that reason;
 * this file pins the other half, so the binding fails LOUD if the mount moves
 * to a surface that is gated, or if a second copy appears somewhere else.
 *
 * ⚠ DERIVED, NOT MIRRORED (trap 12). There is no hand-kept allowlist of
 * permitted mount sites — the sites are read out of the source at test time.
 * A hand-maintained list would drift silently, and the drift would read green.
 *
 * ⚠ AND IT HAS POSITIVE CONTROLS, because every assertion below is an ABSENCE
 * claim over a file scan, and a scan that silently reads nothing produces a
 * perfect absence result (traps 13 / 13e). The controls assert the scanner
 * walks a plausible number of files and can see a KNOWN-PRESENT symbol in a
 * plausible quantity before any absence is believed.
 *
 * Structure and scanners are adapted from
 * `components/results/analysisState/__tests__/analysisStateRegion.mountSites.spec.ts`
 * — the estate's established form for this guarantee.
 *
 * ⚠⚠ WHAT THE "UNGATED" TEST BELOW DOES **NOT** PROVE — READ BEFORE CITING IT.
 * It reads the ONE LINE ABOVE the mount and greps for `isEnabled|Enabled\(\)|
 * flags\.`. That makes it evidence about the LOCAL guard expression and NOTHING
 * ELSE. It is STRUCTURALLY INCAPABLE of seeing an ANCESTOR gate: a flag on
 * MessageBubble itself, on ChatMessage, on ChatThread, on ConversationPanel, or
 * on any host above them would leave this test fully green while the notice
 * never reached a user. **This test is not product-level reachability
 * evidence, and must never be reported as such.**
 *
 * The ancestor chain was cleared SEPARATELY, by hand, in the #804 review
 * (2026-08-19): `ConversationPanel → ChatThread → ChatMessage → MessageBubble`,
 * each a single unconditional call site, all three panel hosts reading the same
 * state, with extraction at the one `routeV5Response` success branch where the
 * streamed and buffered draft paths have already converged. The only gate on
 * the path is the V5 flag the entire live product already runs behind. That is
 * a DATED MANUAL DERIVATION, not something this file re-derives — if the
 * component tree changes, it must be re-walked by hand, because nothing here
 * will fail.
 */
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

const BUBBLE = 'canvas/conversation/MessageBubble.tsx'

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

  it('ModelBuildingNoticesNotice is mounted ONLY by the assistant message bubble', () => {
    expect(mountSitesOf('ModelBuildingNoticesNotice', files)).toEqual([BUBBLE])
  })

  it('and NOTHING ELSE CAN MOUNT IT — nobody else imports the component module', () => {
    // The path-shaped half: a file that cannot import the module cannot mount
    // it under any local name. Stated as the exact importer set, so a new
    // importer names itself in the failure.
    expect(importersOf('ModelBuildingNoticesNotice', files)).toEqual([BUBBLE])
  })

  it('the mount guard is LOCALLY flag-free (see header: says nothing about ancestors)', () => {
    // ⭐ THE POINT OF THE WHOLE LANE. `model_building_notices` was wire-reachable
    // and unrendered; hanging it behind a flag would repeat that failure in a
    // new place. `preAnalysisEnriched` in particular defaults to FALSE and its
    // envKey is absent from netlify.toml, which is why the notice is
    // deliberately NOT hosted inside ModelReceiptBlock.
    const bubble = stripComments(readFileSync(join(SRC, BUBBLE), 'utf8'))
    const mountLine = bubble
      .split('\n')
      .findIndex((l) => l.includes('<ModelBuildingNoticesNotice'))
    expect(mountLine).toBeGreaterThan(-1)

    // The guard expression sits immediately above the mount. It must test the
    // payload's presence and the assistant role — and nothing else.
    const guard = bubble.split('\n')[mountLine - 1]
    expect(guard).toContain('message.modelBuildingNotices')
    expect(guard).toContain('!isUser')
    expect(guard).not.toMatch(/isEnabled|Enabled\(\)|flags\./)
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
