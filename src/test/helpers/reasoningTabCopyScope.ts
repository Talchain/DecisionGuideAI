/**
 * THE REASONING TAB'S COPY SCOPE, DERIVED FROM THE IMPORT GRAPH.
 *
 * Copy guards on this surface keep failing on SCOPE rather than on rigour: the
 * matcher fires, the controls fire, and the guard reads one file while the
 * violation sits in the file next door. `noWinnerVocabulary.spec.ts` closed
 * that for itself on 9 Sep 2026 by walking the import graph from the tab's
 * mounted render root instead of keeping a hand-list. This is that derivation,
 * lifted out so a second guard does not have to re-copy it.
 *
 * ⚠ WHY IT WAS LIFTED — MEASURED, 11 Sep 2026.
 * `noEmDashesInRenderedCopy.spec.ts` kept a hand-list of TWO files and was
 * GREEN, 13/13, on the build serving this sentence on the Reasoning tab:
 *
 *     "Comparing 4 of your 8 options — Buy an AI Triage Tool, Hire Six More
 *      Agents and 2 others were left out."
 *
 * Its extractor was never the problem: it is TypeScript's own parser, it
 * already walks template spans, and it already carries a passing control for
 * an interpolated template. It simply was not pointed at
 * `utils/goalAnchorCopy.ts`.
 *
 * ⚠⚠ THE CLAIM TYPE, STATED PRECISELY, BECAUSE IT IS NOT WHAT THE NAME SAYS.
 * This is IMPORT-REACHABLE copy, a SUPERSET of RENDER-reachable copy. Import
 * closure is not render reachability. The superset is deliberate: excluding a
 * file needs positive proof it never renders, which nothing here supplies, and
 * the dangerous direction for a guard is the one that looks clean because it
 * stopped looking.
 *
 * ⭐ EXCEPT THROUGH A BARREL, WHERE THE SUPERSET GETS ABSURD. A barrel is a
 * re-export table, not a surface, so it is followed only into the modules that
 * export a name actually imported through it. Without that, three bindings
 * taken from the `../modals` barrel drag in all twelve modules it re-exports,
 * including `HowComputedModal.tsx`, which this tab never renders. Pinned by the
 * contrast controls in each consuming guard.
 *
 * ── ⭐⭐⭐ AND THE BARREL RULE SHIPPED A SILENT DROP. CLOSED HERE, 11 Sep ─────
 * THE LOAD-BEARING CORRECTION IN THIS FILE.
 *
 * The first version of this walk marked a file `seen` ON POP, then used the
 * name set it was popped WITH. One file, one name set. But a barrel is reached
 * once per importer, and the importers ask for DIFFERENT names: five files in
 * this closure import `../modals`, between them asking for five distinct
 * bindings. The first pop won and every later arrival hit `if (seen.has(file))
 * continue`, discarding its names unread.
 *
 * Measured at `18d681c2` and again after rebasing onto `f6f960b6`, identically:
 * the shipped walk returned **93** copy files, a union-corrected walk **94**.
 * The dropped file was `modals/analysedOptions.ts`, and it is not an obscure
 * leaf: `AnalysisNewTabBody.tsx:52` imports `hasAnalysedOptions` through that
 * barrel and calls it at `:774`. A DIRECT DEPENDENCY OF THE RENDER ROOT was
 * outside the guard's corpus.
 *
 * ⚠ AND NOTHING COULD SEE IT. `unresolved` was genuinely empty, because the
 * edge was never OFFERED to the resolver; the four positive controls all sit on
 * the name set that happened to win the first pop; and which set wins is a LIFO
 * artefact, so the identity of the dropped file was an accident of edge order.
 * A guard reporting a clean sweep of 93 of 94 files is the estate's canonical
 * false zero, and this one was inside the instrument written to abolish them.
 *
 * The walk below therefore ACCUMULATES a name set per file and re-processes a
 * file for names it has not yet been walked for. `exhausted()` is the single
 * definition of "nothing left to learn here", used on BOTH the push side and
 * the pop side so the two cannot drift apart (CLAUDE.md trap 12). Pinned by
 * `__tests__/reasoningTabCopyScope.spec.ts`, which binds by FILE IDENTITY to a
 * name reachable only through a second visit, not by a count.
 *
 * ── ⭐ THE TWIN ON THE SAME SEAM: `as` ──────────────────────────────────────
 * The same parse conflated two different names. For `export { A as B } from
 * './m'`, the target module exports `A` and the barrel exposes `B`; a consumer
 * asks for `B`. The first version recorded only the name BEFORE `as` and used
 * it for both roles, so a request for `B` would not match the edge that serves
 * it and `./m` would never be walked. `Edge` now carries `source` (pre-`as`,
 * carried forward) and `exposed` (post-`as`, matched against) as separate
 * fields.
 *
 * ⚠ STATED HONESTLY: THIS TWIN DOES NOT BITE TODAY, AND IT IS ONE IMPORT AWAY.
 * Measured on this walk at `f6f960b6`: exactly two barrels are walked
 * selectively (`canvas/layout/index.ts`, `results/modals/index.ts`) and NEITHER
 * carries an `as` in a from-clause, so the corrected parse returns the same 94
 * files as the `seen` fix alone. It is fixed anyway because the pattern is live
 * in this repo one barrel away — `components/ProsConsList/components/index.ts`
 * is three consecutive `export { default as X } from './X'` lines, every one of
 * which this walk would have dropped — and because a shared helper that drops a
 * file drops it for every future consumer, not just for the one that found it.
 *
 * ── ⚠ THE LIMIT THIS FILE DOES NOT CLOSE: `COPY_SCOPE_PREFIX` ───────────────
 * The walk reaches far more than it sweeps, and consuming guards MUST state
 * this in their own headers rather than inherit it from here, because the
 * verdict they publish is the one a reader believes. Measured at `f6f960b6`:
 * the walk reaches 350 non-test files, of which 94 are under
 * `src/components/results/` and swept. The other 256 are reached and NOT swept,
 * and they carry 84 em-dash string literals across 24 files. Some of those are
 * plainly user-facing copy on other surfaces (`v5/failureTypeRetryability.ts`
 * carries error sentences; `lib/mappers/constants.ts` carries result strings).
 * Whether any of them renders on THIS tab is a separate, unmeasured question.
 * Widening the prefix is not a free win and is deliberately not done here.
 *
 * ⚠ KNOWN DUPLICATE, NOT YET REMOVED — AND DELIBERATELY NOT TOUCHED HERE.
 * `noWinnerVocabulary.spec.ts` still carries its own copy of this walk, with
 * the same `seen`-on-pop defect. It was left alone because it is a live,
 * recently-merged file (#1476) and rewriting it is a separate reviewable
 * change, not "while we're here" work. Two copies of one derivation is trap 12
 * waiting to happen; migrating that spec onto this helper is the follow-up, and
 * it is named in this PR's body so it is not lost.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, join, basename } from 'node:path'

/** The tab's mounted render root — mounted at `canvas/components/OutputsDock.tsx`. */
export const TAB_RENDER_ROOT = 'src/components/results/analysisNew/AnalysisNewTabBody.tsx'

/**
 * Copy lives under here. Files outside it are reached but not swept.
 * ⚠ This is a real limit on every verdict built from this walk, and its
 * measured size is in the header above. Consuming guards must restate it.
 */
export const COPY_SCOPE_PREFIX = 'src/components/results/'

const MODULE_EXT = ['.ts', '.tsx', '.js', '.jsx'] as const

/**
 * `undefined` = the specifier named something this resolver could not find, and
 * consumers treat that as a HARD ERROR rather than a silent skip. A resolver
 * that drops what it cannot resolve shrinks the swept corpus invisibly — the
 * exact shape of every false zero in this estate.
 * `null` = a bare package specifier, correctly out of scope.
 */
export function resolveSpec(spec: string, fromFile: string): string | null | undefined {
  let base: string
  if (spec.startsWith('@/')) base = join(process.cwd(), 'src', spec.slice(2))
  else if (spec.startsWith('.')) base = resolve(dirname(fromFile), spec)
  else return null
  for (const e of MODULE_EXT) if (existsSync(base + e) && statSync(base + e).isFile()) return base + e
  if (existsSync(base) && statSync(base).isDirectory())
    for (const e of MODULE_EXT) {
      const i = join(base, 'index' + e)
      if (existsSync(i)) return i
    }
  if (existsSync(base) && statSync(base).isFile()) return base
  return undefined
}

/**
 * One import/export edge.
 *
 * ⭐ `source` AND `exposed` ARE TWO DIFFERENT NAMES AND MUST NOT BE MERGED
 * (CLAUDE.md trap 21 — two questions under one name). For `export { A as B }
 * from './m'`:
 *  · `source`  = `A` — what `./m` must export, so it is what the walk carries
 *                FORWARD into `./m`;
 *  · `exposed` = `B` — what a consumer of this file asks for, so it is what a
 *                selective barrel MATCHES against.
 * Without an `as` they are the same string, which is why merging them survived
 * review: the two roles are indistinguishable on every edge that has no alias.
 */
export interface Edge {
  spec: string
  /** Names the TARGET module must export (pre-`as`). `null` = no brace clause. */
  source: string[] | null
  /** Names this statement offers to a consumer (post-`as`). `null` = no brace clause. */
  exposed: string[] | null
  wildcard: boolean
}

/**
 * Every import/export edge in a source text, WITH the names it carries.
 *
 * Pure in its input so the alias handling above can be exercised directly,
 * rather than only through a filesystem walk where an alias bug looks exactly
 * like a file that legitimately was not reached.
 */
export function parseEdges(src: string): Edge[] {
  const re =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const out: Edge[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const spec = m[2] ?? m[3]
    if (!spec) continue
    const clause = m[1] ?? ''
    const brace = clause.match(/\{([\s\S]*?)\}/)
    let source: string[] | null = null
    let exposed: string[] | null = null
    if (brace) {
      source = []
      exposed = []
      for (const raw of brace[1]!.split(',')) {
        const binding = raw.replace(/\btype\b/g, '').trim()
        if (binding === '') continue
        const parts = binding.split(/\s+as\s+/)
        const from = parts[0]!.trim()
        const to = parts[parts.length - 1]!.trim()
        if (from !== '') source.push(from)
        if (to !== '') exposed.push(to)
      }
    }
    out.push({ spec, source, exposed, wildcard: /\*/.test(clause) && !brace })
  }
  return out
}

/** Every import/export edge out of a file, WITH the names it carries. */
function edgesOf(file: string): Edge[] {
  return parseEdges(readFileSync(file, 'utf8'))
}

/**
 * Does this edge serve any of the names a consumer asked for?
 *
 * Matched on `exposed`, never on `source` — see `Edge`. An edge with no brace
 * clause offers no named binding and is not followed out of a selective barrel.
 */
export function edgeIsRequested(edge: Edge, requested: readonly string[]): boolean {
  return edge.exposed !== null && edge.exposed.some(n => requested.includes(n))
}

const isBarrel = (f: string): boolean => /^index\.(ts|tsx|js|jsx)$/.test(basename(f))

export interface CopyScope {
  /** Copy files the tab's render root can reach, repo-relative and sorted. */
  files: readonly string[]
  /** Specifiers that could not be resolved. Consumers assert this is EMPTY. */
  unresolved: readonly string[]
}

/**
 * What this walk has already learned about one file.
 *
 * `all` = walked in full, so no later arrival can add anything. `names` = the
 * bindings a SELECTIVELY walked barrel has already been followed for. The two
 * are not interchangeable: a barrel walked for `{a}` is not walked, and a file
 * walked in full is not "walked for every name" in any enumerable sense.
 */
interface VisitState {
  all: boolean
  names: Set<string>
}

/**
 * Walk the import graph from the tab's render root and keep the copy files.
 *
 * Tests, fixtures and stories are excluded: a guard that swept its own corpus
 * would fire on the very strings the controls are written to detect.
 */
export function reasoningTabCopyScope(): CopyScope {
  const unresolved: string[] = []
  const visited = new Map<string, VisitState>()

  const stateOf = (file: string): VisitState => {
    let s = visited.get(file)
    if (s === undefined) {
      s = { all: false, names: new Set<string>() }
      visited.set(file, s)
    }
    return s
  }

  /**
   * ⭐ THE ONE DEFINITION OF "nothing left to learn by walking `file` for
   * `names`", used on the PUSH side and the POP side. Two hand-kept copies of
   * this predicate is precisely how the `seen` defect stayed invisible: the
   * push guard and the pop guard each looked correct alone.
   */
  const exhausted = (file: string, names: readonly string[] | null): boolean => {
    const s = visited.get(file)
    if (s === undefined) return false
    if (s.all) return true
    if (names === null) return false
    return names.every(n => s.names.has(n))
  }

  const queue: Array<{ file: string; names: string[] | null }> = [
    { file: join(process.cwd(), TAB_RENDER_ROOT), names: null },
  ]

  while (queue.length > 0) {
    const { file, names } = queue.pop()!
    const state = stateOf(file)
    // Already walked in full: no name set can add an edge.
    if (state.all) continue
    // Only the names this file has NOT been walked for. Restricting to these
    // is what terminates the walk on a cycle: every iteration that reaches the
    // edge loop either sets `all` (once per file) or adds at least one name to
    // a set that only ever grows.
    let fresh: string[] | null = null
    if (names !== null) {
      fresh = names.filter(n => !state.names.has(n))
      if (fresh.length === 0) continue
    }

    const es = edgesOf(file)
    // A barrel is a re-export table, not a surface: follow only what was asked
    // for. `export *` defeats that, so such a barrel is walked in full.
    const selective = isBarrel(file) && fresh !== null && !es.some(e => e.wildcard)
    if (selective) for (const n of fresh!) state.names.add(n)
    else state.all = true

    for (const e of es) {
      if (!e.spec.startsWith('.') && !e.spec.startsWith('@/')) continue
      if (selective && !edgeIsRequested(e, fresh!)) continue
      const r = resolveSpec(e.spec, file)
      if (r === undefined) {
        unresolved.push(`${e.spec}  <-  ${file.replace(process.cwd() + '/', '')}`)
        continue
      }
      if (r !== null && !exhausted(r, e.source)) queue.push({ file: r, names: e.source })
    }
  }

  const files = [...visited.keys()]
    .map(f => f.replace(process.cwd() + '/', ''))
    .filter(
      r =>
        r.startsWith(COPY_SCOPE_PREFIX) &&
        !/__tests__|__fixtures__|\.spec\.|\.test\.|\.stories\./.test(r),
    )
    .sort()
  // A barrel can now be walked more than once, so one unreadable specifier on
  // it would be reported once per visit. De-duplicated so the consumer's
  // failure message names each break once.
  return { files, unresolved: [...new Set(unresolved)].sort() }
}
