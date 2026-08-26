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

/**
 * The store action that REPLACES the graph slice.
 *
 * ⚠ MATCHED AS A CALL, NOT AS A FIXED BIGRAM — and this was Gate 1 of the
 * re-review. The first version of this scan tested for the literal
 * `'hydrateGraphSlice({'`, which requires `(` and `{` to be ADJACENT. That is a
 * formatting accident, not a property of a call site. Measured against a fake
 * new unnormalised route, four semantically identical spellings:
 *
 *     hydrateGraphSlice({ … })         → CAUGHT
 *     hydrateGraphSlice(slice)         → MISSED
 *     hydrateGraphSlice(⏎  { … })      → MISSED
 *     hydrateGraphSlice ({ … })        → MISSED
 *
 * So the guard could not distinguish *"no undeclared route exists"* from *"an
 * undeclared route is spelled without `({`"*: an absence claim from a probe
 * never shown it can see a presence (CLAUDE.md trap 13), which is this file's
 * own subject matter turned on itself. It bit at all only because both of
 * today's callers happen to use the adjacent form — the class it exists to
 * catch is *tomorrow's* route, and three of four spellings walked past it.
 *
 * The detector below matches the IDENTIFIER, then optional whitespace
 * (including a newline), then `(`, with import lines removed first. Pinned per
 * spelling in the detector-contract block, because a wider needle with no
 * contract is the same defect with more characters.
 *
 * ─── WHAT THIS DETECTOR CANNOT SEE (stated, not implied away) ────────────────
 * It is a LEXICAL scan for one identifier, so it is blind to:
 *   · a DESTRUCTURING RENAME — `const { hydrateGraphSlice: replace } = …`,
 *     then `replace({ … })`. The call site reads `replace(`.
 *   · DYNAMIC DISPATCH — `store['hydrateGraphSlice'](…)`, or the action being
 *     put in a variable, passed as a prop, and invoked somewhere else.
 *   · anything the walk excludes — non-`.ts`/`.tsx` files, and `.spec`/`.test`
 *     files (excluded deliberately: a test may hydrate whatever it likes).
 * The IMPORT-ALIAS form is the one blind spot that can be closed cheaply,
 * because the alias is created somewhere this scan CAN read — so it is detected
 * and RED separately below instead of being left on this list.
 *
 * ⚠ AND IT ERRS TOWARDS OVER-INCLUSION, ON PURPOSE. Comments are not stripped,
 * so a comment containing `hydrateGraphSlice(` counts as a route and REDs until
 * declared. Over-reporting fails LOUD and a human resolves it; under-reporting
 * passes silently, which is the failure this file exists to prevent. Measured
 * at this tip: nine other files mention the identifier and NONE is counted —
 * they are prose, plus the store's own definition, which is a PROPERTY
 * (`hydrateGraphSlice: (loaded) => …`) whose colon stops the match. If that
 * definition is ever rewritten in method-shorthand form
 * (`hydrateGraphSlice(loaded) {`), this scan will flag `store.ts` as an
 * undeclared route. That is the loud direction: register it, do not weaken the
 * detector to make it quiet.
 */
const HYDRATE_IDENTIFIER = 'hydrateGraphSlice'

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

function relative(file: string): string {
  const idx = file.indexOf('/src/')
  return idx >= 0 ? file.slice(idx + 1) : file
}

/** Source with `import …` lines removed, so an import cannot read as a call. */
function withoutImportLines(src: string): string {
  return src
    .split('\n')
    .filter((line) => !/^\s*import\b/.test(line))
    .join('\n')
}

/**
 * Count CALL SITES of the graph-replacing store action.
 *
 * Exported so the detector's own contract can be pinned on literals — the twin
 * of `countNormaliserCalls`, and precisely what Gate 1 found missing. The regex
 * is rebuilt per call rather than hoisted to a module constant: a `/g` regex
 * carries `lastIndex`, and a shared one is a stateful instrument.
 */
export function countHydrationCalls(src: string): number {
  const callRe = new RegExp(`\\b${HYDRATE_IDENTIFIER}\\s*\\(`, 'g')
  return (withoutImportLines(src).match(callRe) ?? []).length
}

/**
 * Count ALIASED imports of the action (`… as somethingElse`).
 *
 * An alias renames the call site and defeats a lexical scan. Rather than list
 * that as an unfixable blind spot, the scan refuses to permit one: the alias is
 * created in source this scan can read, so an undetectable class is converted
 * into a detectable one at the single point where it comes into existence.
 */
export function countHydrationAliasImports(src: string): number {
  const aliasRe = new RegExp(
    `\\b${HYDRATE_IDENTIFIER}\\s+as\\s+[A-Za-z_$][\\w$]*`,
    'g',
  )
  return (src.match(aliasRe) ?? []).length
}

/** Files that actually invoke the graph-replacing store action. */
function hydrationRoutes(): string[] {
  return FILES.filter((f) => countHydrationCalls(readFileSync(f, 'utf8')) > 0).map(
    relative,
  )
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
  return FILES.filter((f) => countHydrationCalls(readFileSync(f, 'utf8')) > 0).map(
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

describe('detector contract — the hydration scan matches a CALL, not a fixed bigram', () => {
  // GATE 1. Every row below is the SAME call, differently formatted; the
  // previous detector caught only the first. A positive control PER SPELLING is
  // what turns "offenders: []" from a hope into a measurement — without them,
  // an empty offender list is equally consistent with a clean tree and with a
  // detector that cannot see.
  it.each([
    ['an adjacent brace', 'hydrateGraphSlice({ nodes, edges })'],
    ['a bare identifier argument', 'hydrateGraphSlice(slice)'],
    ['a newline before the brace', 'hydrateGraphSlice(\n  { nodes, edges },\n)'],
    ['a space before the paren', 'hydrateGraphSlice ({ nodes, edges })'],
    ['a newline before the paren', 'hydrateGraphSlice\n  ({ nodes, edges })'],
    ['a member call', 'useCanvasStore.getState().hydrateGraphSlice({ nodes })'],
    ['leading indentation', '      hydrateGraphSlice({ nodes })'],
    ['no argument at all', 'hydrateGraphSlice()'],
  ])('counts a call spelled with %s', (_label, src) => {
    expect(countHydrationCalls(src)).toBe(1)
  })

  // The negatives matter as much: a detector that counts everything is not a
  // detector. These are the real shapes present in this tree today — nine files
  // mention the identifier without calling it, and none may be counted.
  it.each([
    ['an import line', "import { hydrateGraphSlice } from '../store'"],
    ['the store\'s own property definition', 'hydrateGraphSlice: (loaded) => {'],
    ['a type declaration', 'hydrateGraphSlice: (loaded: { nodes: any[] }) => void'],
    ['prose in a comment', '// restored graphs arrive through `hydrateGraphSlice`'],
    ['a mention followed by a comma', 'loadScenario, hydrateGraphSlice, resetCanvas,'],
    ['a mention followed by a close paren', '// (useScenario → hydrateGraphSlice) did not'],
  ])('does NOT count %s', (_label, src) => {
    expect(countHydrationCalls(src)).toBe(0)
  })

  it('counts two distinct call sites in one file', () => {
    // Guards against a detector that reports a boolean dressed as a count.
    expect(
      countHydrationCalls('hydrateGraphSlice({ a })\nhydrateGraphSlice(b)'),
    ).toBe(2)
  })

  it('is not satisfied by a longer identifier that merely contains the name', () => {
    expect(countHydrationCalls('notHydrateGraphSliceAtAll(x)')).toBe(0)
  })
})

describe('the action may not be import-aliased (an alias blinds this scan)', () => {
  it('detects an aliased import on a literal', () => {
    expect(
      countHydrationAliasImports(
        "import { hydrateGraphSlice as replaceGraph } from '../store'",
      ),
    ).toBe(1)
  })

  it('does not fire on a plain import', () => {
    expect(
      countHydrationAliasImports("import { hydrateGraphSlice } from '../store'"),
    ).toBe(0)
  })

  // ⚠ WHERE THE DISCRIMINATION ACTUALLY LIVES, measured rather than assumed.
  // Killing the alias detector (making it always return 0) REDs the positive
  // literal above and NOTHING ELSE: the negative literal expects 0 and a dead
  // detector satisfies it, and the tree-level test below stays GREEN because
  // there is no alias in the tree to find. So the tree test is TRUE-BUT-VACUOUS
  // today — it is a regression tripwire for the day someone adds an alias, not
  // evidence that the detector works. The positive literal is the only thing
  // standing between this block and a guard agreeing with itself (trap 13b),
  // which is why it is not merely decorative to keep it.
  it('no source file aliases it', () => {
    const aliasing = FILES.filter(
      (f) => countHydrationAliasImports(readFileSync(f, 'utf8')) > 0,
    ).map(relative)

    expect(
      aliasing,
      'an aliased import renames the call site and hides it from this scan — ' +
        'import `hydrateGraphSlice` under its own name',
    ).toEqual([])
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
        `registered gap ${gap.file} no longer calls ${HYDRATE_IDENTIFIER} — remove it`,
      ).toContain(gap.file)
    }
  })

  it('every registered gap states a reason', () => {
    for (const gap of REGISTERED_KNOWN_GAPS) {
      expect(gap.reason.length, `${gap.file} has no reason`).toBeGreaterThan(40)
    }
  })
})
