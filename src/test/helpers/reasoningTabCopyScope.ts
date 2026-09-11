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
 * `utils/goalAnchorCopy.ts`. Derived at the same commit, the walk below
 * reaches 93 copy files, and 16 em-dash offenders live in 10 of them — none of
 * which the two-file list could see.
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
 * ⚠ KNOWN DUPLICATE, NOT YET REMOVED — AND DELIBERATELY NOT TOUCHED HERE.
 * `noWinnerVocabulary.spec.ts` still carries its own copy of this walk. It was
 * left alone because it is a live, recently-merged file (#1476) and rewriting
 * it is a separate reviewable change, not "while we're here" work. Two copies
 * of one derivation is trap 12 waiting to happen; migrating that spec onto this
 * helper is the follow-up, and it is named in this PR's body so it is not lost.
 */
import { readFileSync, existsSync, statSync } from 'node:fs'
import { resolve, dirname, join, basename } from 'node:path'

/** The tab's mounted render root — mounted at `canvas/components/OutputsDock.tsx`. */
export const TAB_RENDER_ROOT = 'src/components/results/analysisNew/AnalysisNewTabBody.tsx'

/** Copy lives under here. Files outside it are reached but not swept. */
export const COPY_SCOPE_PREFIX = 'src/components/results/'

const MODULE_EXT = ['.ts', '.tsx', '.js', '.jsx'] as const

/**
 * `undefined` = the specifier named something this resolver could not find, and
 * consumers treat that as a HARD ERROR rather than a silent skip. A resolver
 * that drops what it cannot resolve shrinks the swept corpus invisibly — the
 * exact shape of every false zero in this estate.
 * `null` = a bare package specifier, correctly out of scope.
 */
function resolveSpec(spec: string, fromFile: string): string | null | undefined {
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

interface Edge {
  spec: string
  names: string[] | null
  wildcard: boolean
}

/** Every import/export edge out of a file, WITH the names it carries. */
function edgesOf(file: string): Edge[] {
  const src = readFileSync(file, 'utf8')
  const re =
    /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?(?:([\s\S]*?)\s+from\s+)?['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
  const out: Edge[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    const spec = m[2] ?? m[3]
    if (!spec) continue
    const clause = m[1] ?? ''
    const brace = clause.match(/\{([\s\S]*?)\}/)
    const names = brace
      ? brace[1]
          .split(',')
          .map(s => s.replace(/\btype\b/g, '').split(/\s+as\s+/)[0]!.trim())
          .filter(Boolean)
      : null
    out.push({ spec, names, wildcard: /\*/.test(clause) && !brace })
  }
  return out
}

const isBarrel = (f: string): boolean => /^index\.(ts|tsx|js|jsx)$/.test(basename(f))

export interface CopyScope {
  /** Copy files the tab's render root can reach, repo-relative and sorted. */
  files: readonly string[]
  /** Specifiers that could not be resolved. Consumers assert this is EMPTY. */
  unresolved: readonly string[]
}

/**
 * Walk the import graph from the tab's render root and keep the copy files.
 *
 * Tests, fixtures and stories are excluded: a guard that swept its own corpus
 * would fire on the very strings the controls are written to detect.
 */
export function reasoningTabCopyScope(): CopyScope {
  const unresolved: string[] = []
  const seen = new Set<string>()
  const queue: Array<{ file: string; names: string[] | null }> = [
    { file: join(process.cwd(), TAB_RENDER_ROOT), names: null },
  ]
  while (queue.length > 0) {
    const { file, names } = queue.pop()!
    if (seen.has(file)) continue
    seen.add(file)
    const es = edgesOf(file)
    // A barrel is a re-export table, not a surface: follow only what was asked
    // for. `export *` defeats that, so such a barrel is walked in full.
    const selective = isBarrel(file) && names !== null && !es.some(e => e.wildcard)
    for (const e of es) {
      if (!e.spec.startsWith('.') && !e.spec.startsWith('@/')) continue
      if (selective && (e.names === null || !e.names.some(n => names!.includes(n)))) continue
      const r = resolveSpec(e.spec, file)
      if (r === undefined) {
        unresolved.push(`${e.spec}  <-  ${file.replace(process.cwd() + '/', '')}`)
        continue
      }
      if (r !== null && !seen.has(r)) queue.push({ file: r, names: e.names })
    }
  }
  const files = [...seen]
    .map(f => f.replace(process.cwd() + '/', ''))
    .filter(
      r =>
        r.startsWith(COPY_SCOPE_PREFIX) &&
        !/__tests__|__fixtures__|\.spec\.|\.test\.|\.stories\./.test(r),
    )
    .sort()
  return { files, unresolved }
}
