/**
 * THE GUARD THAT WATCHES ROUTES.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * WHY A SOURCE SCAN AND NOT A BEHAVIOURAL TEST
 * ─────────────────────────────────────────────────────────────────────────────
 * `normalisePersistedGraph.geometryBearingCeeRow.p0.spec.ts` proves the
 * PROJECTOR PROJECTS. It is a post-condition over that function's return value,
 * and it is structurally blind to ROUTES: review demonstrated this by severing
 * the call at `useScenario.ts:699` — the spec stayed **15/15 GREEN**, because a
 * caller that never invokes the function cannot be observed by a test of the
 * function's output.
 *
 * The gap that leaves is the one that actually ships: a NEW graph-replacement
 * path added later, hydrating the store without normalising, silently re-opening
 * the P0 for whichever rows it touches. Nothing in a per-function test can see
 * that arriving.
 *
 * So this scan derives the route list FROM SOURCE and requires every caller of
 * `hydrateGraphSlice` either to normalise, or to be a REGISTERED KNOWN GAP with
 * a stated reason. Hand-maintaining a list of "the safe routes" would be the
 * mirror this estate keeps paying for (CLAUDE.md trap 12); deriving the callers
 * and checking each one means a new route FAILS LOUD by default.
 *
 * ⚠ WHAT THIS PROVES, AND WHAT IT DOES NOT. It is a claim about the SOURCE TREE
 * at your tip — that every route either normalises or is declared. It is NOT a
 * claim about deployed behaviour, and NOT a claim about a store that was already
 * populated before the shape fix shipped. Those are different questions with
 * different instruments; naming them apart here is deliberate, because this
 * whole change exists because a contingent claim was written as a settled one.
 */

import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'

const SRC = resolve(__dirname, '../../..')

/** The store action that REPLACES the graph slice. */
const HYDRATE_CALL = 'hydrateGraphSlice({'

/**
 * The canonical projector every persisted-column route must go through.
 *
 * ⚠ MATCHED AS A CALL, NOT AS AN IDENTIFIER — and this cost a round. The first
 * version of this scan tested `source.includes('normalisePersistedGraph')`,
 * which is satisfied by the IMPORT LINE alone. Severing the actual call at
 * `useScenario.ts:699` therefore left this scan **GREEN** (measured), because
 * `import { normalisePersistedGraph } from …` still contains the identifier.
 * A guard that cannot tell an import from a call is a guard agreeing with
 * itself. The trailing `(` is what makes it a call site.
 */
const NORMALISER_CALL = 'normalisePersistedGraph('

/**
 * Routes that call `hydrateGraphSlice` WITHOUT normalising, each with the reason
 * it is safe. A registered gap is a disclosure, not an exemption — if one of
 * these ever starts carrying persisted-column bytes it must move.
 *
 * ⚠ APPEND ONLY AFTER DERIVING WHY. The point of the scan is that an
 * undocumented new route REDs; adding an entry to silence a red without stating
 * a reason defeats the guard entirely.
 */
const REGISTERED_KNOWN_GAPS: ReadonlyArray<{ file: string; reason: string }> = [
  {
    file: 'src/canvas/ReactFlowGraph.tsx',
    reason:
      'Hydrates from the localStorage AUTOSAVE and from run-history restores, ' +
      'both of which are written FROM the canvas store and are therefore already ' +
      'in React Flow shape. ⚠ RESIDUAL, disclosed not dismissed: a store polluted ' +
      'BEFORE the shape fix shipped was autosaved in CEE shape and re-enters here ' +
      'unnormalised. That is a data-migration question, not a routing one, and it ' +
      'is why this is a registered gap rather than a clean pass.',
  },
]

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.git') continue
    const full = resolve(dir, entry)
    if (statSync(full).isDirectory()) {
      walk(full, out)
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    if (/\.d\.ts$/.test(entry)) continue
    out.push(full)
  }
  return out
}

const FILES = walk(SRC)

/** Files that actually invoke the graph-replacing store action. */
function hydrationRoutes(): string[] {
  return FILES.filter((f) => readFileSync(f, 'utf8').includes(HYDRATE_CALL)).map(
    (f) => f.slice(SRC.length - 'src'.length + 1).replace(/^\/+/, ''),
  )
}

function relative(file: string): string {
  const idx = file.indexOf('/src/')
  return idx >= 0 ? file.slice(idx + 1) : file
}

/**
 * Count genuine CALL SITES of the normaliser in a source text, ignoring imports.
 * Exported shape so the detector's own contract can be tested on literals —
 * a scan whose detector is only ever exercised against the real tree cannot
 * demonstrate WHAT it discriminates.
 */
export function countNormaliserCalls(src: string): number {
  return src
    .split('\n')
    .filter((line) => !/^\s*import\b/.test(line))
    .filter((line) => line.includes(NORMALISER_CALL)).length
}

function routesWithNormalisation(): { route: string; normalises: boolean }[] {
  return FILES.filter((f) => readFileSync(f, 'utf8').includes(HYDRATE_CALL)).map(
    (f) => ({
      route: relative(f),
      normalises: countNormaliserCalls(readFileSync(f, 'utf8')) > 0,
    }),
  )
}

describe('detector contract — the scan distinguishes a CALL from an IMPORT', () => {
  // This is the distinction the first version of this scan got wrong, and it is
  // why severing the fixed route left it green. Pinned on literals so the
  // discrimination is demonstrated, not assumed.
  it('counts a real call site', () => {
    expect(
      countNormaliserCalls('const g = normalisePersistedGraph(row.graph)'),
    ).toBe(1)
  })

  it('does NOT count the import line alone', () => {
    expect(
      countNormaliserCalls(
        "import { normalisePersistedGraph } from '../canvas/utils/normalisePersistedGraph'",
      ),
    ).toBe(0)
  })

  it('a file with the import but no call reads as NOT normalising', () => {
    // The exact severed-route shape.
    const severed = [
      "import { normalisePersistedGraph } from '../x'",
      'const normalised = { nodes: row.graph.nodes, edges: row.graph.edges }',
    ].join('\n')
    expect(countNormaliserCalls(severed)).toBe(0)
  })

  it('still counts a call that sits on a line beginning with whitespace', () => {
    expect(countNormaliserCalls('      const g = normalisePersistedGraph(x)')).toBe(1)
  })
})

describe('the scan can see (walk is not silently empty)', () => {
  it('walks a non-trivial number of source files', () => {
    // Positive control. A broken walk returns "no violations" and looks
    // identical to a clean tree (CLAUDE.md trap 13).
    expect(FILES.length).toBeGreaterThan(500)
  })

  it('finds the hydration routes it exists to police', () => {
    // Contrast control: if this ever reads zero, the scan is measuring nothing
    // and every assertion below passes vacuously.
    const routes = hydrationRoutes()
    expect(routes.length).toBeGreaterThan(0)
  })

  it('sees the route the P0 was fixed on', () => {
    // Binds by IDENTITY, not by count — a different route could satisfy a count.
    const routes = routesWithNormalisation().map((r) => r.route)
    expect(routes).toContain('src/hooks/useScenario.ts')
  })
})

describe('every hydration route normalises, or is a registered known gap', () => {
  it('has no undeclared route that replaces the graph without normalising', () => {
    const offenders = routesWithNormalisation()
      .filter((r) => !r.normalises)
      .filter((r) => !REGISTERED_KNOWN_GAPS.some((g) => g.file === r.route))
      .map((r) => r.route)

    expect(
      offenders,
      'a new graph-replacement route must normalise the persisted column, ' +
        'or be added to REGISTERED_KNOWN_GAPS with a derived reason',
    ).toEqual([])
  })

  it('the fixed route genuinely still normalises (REDs if the call is severed)', () => {
    // This is the assertion that severing `useScenario.ts:699` must break —
    // the one the per-function post-condition test could not make.
    const useScenario = routesWithNormalisation().find(
      (r) => r.route === 'src/hooks/useScenario.ts',
    )
    expect(useScenario).toBeDefined()
    expect(useScenario!.normalises).toBe(true)
  })

  it('every registered gap is still a real route (no stale exemptions)', () => {
    // A gap entry for a file that no longer hydrates is dead weight that would
    // silently excuse a future file of the same name.
    const routes = routesWithNormalisation().map((r) => r.route)
    for (const gap of REGISTERED_KNOWN_GAPS) {
      expect(
        routes,
        `registered gap ${gap.file} no longer calls ${HYDRATE_CALL} — remove it`,
      ).toContain(gap.file)
    }
  })

  it('every registered gap states a reason', () => {
    for (const gap of REGISTERED_KNOWN_GAPS) {
      expect(gap.reason.length, `${gap.file} has no reason`).toBeGreaterThan(40)
    }
  })
})
