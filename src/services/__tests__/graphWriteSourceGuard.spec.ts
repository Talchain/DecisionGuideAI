/**
 * Trust-spine board #2 — "one authoritative graph-mutation path" enforced
 * structurally, across the WHOLE source tree.
 *
 * THE RULE: nothing in src/ may write the `scenarios.graph` column through a
 * raw PostgREST `.update(...)` / `.upsert(...)`. The only sanctioned writer is
 * the gated `apply_patch_and_log` RPC (wrapped by
 * `scenarioService.saveGraphViaGatedPath`), which atomically writes the graph
 * AND appends an event carrying the graph hash. A raw write persists graph
 * state with no event and no hash — invisible to the audit trail.
 *
 * WHY REPO-WIDE, not one file: the first version of this guard read only
 * `scenarioService.ts`. A raw write introduced in `useScenario.ts` (or any
 * component reaching for `supabase` directly) would have evaded it completely.
 * The bypass this PR removed lived in the service, but nothing structurally
 * confines the next one there.
 *
 * Scope: all non-test .ts/.tsx under src/, comments and string bodies blanked
 * so prose about the rule (this docstring included) cannot read as a call site.
 *
 * KNOWN LIMIT (stated, not papered over): the scan resolves inline object
 * literals — `.update({ graph })` / `.update({ graph: g })` — which is the
 * shape the real bypass used. A write assembled indirectly
 * (`.update(payload)` where `payload.graph` is set elsewhere) is beyond static
 * reach here; the RPC-shape assertions in scenarioService.spec and the
 * behavioural pins in useScenario.spec are the complementary cover.
 *
 * NOTE: `blankNonCode` is now the SHARED helper in
 * tests/helpers/stripSourceComments.ts (converged 2026-07-20 — the two
 * hand-duplicated copies here and in cameraMotion.sourceScan.spec.ts were
 * folded into one). `argsAt` remains a small local text util. The
 * detector-contract block below still independently pins the shared
 * `blankNonCode` — a drift fails these positive controls rather than silently
 * returning a wrong verdict.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../tests/helpers/stripSourceComments'

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')

const EXCLUDED_DIR_NAMES = new Set(['__tests__', '__fixtures__', '__helpers__', '__mocks__'])

/** PostgREST mutation builders that can write a column directly. */
const RAW_WRITERS = ['update', 'upsert']

function sourceFiles(dir: string): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    const stats = statSync(full)
    if (stats.isDirectory()) {
      if (!EXCLUDED_DIR_NAMES.has(entry)) out.push(...sourceFiles(full))
      continue
    }
    if (!/\.(ts|tsx)$/.test(entry)) continue
    if (/\.(spec|test)\.(ts|tsx)$/.test(entry)) continue
    if (/\.d\.ts$/.test(entry)) continue
    out.push(full)
  }
  return out
}

// `blankNonCode` (blanks comments + string/template bodies, offset-preserving)
// is now the shared helper in tests/helpers/stripSourceComments.ts — the
// detector contract below still pins its behaviour so documentation of the
// rule is never mistaken for a violation.

/** Extract the balanced `(...)` argument text starting at `openIdx`. */
function argsAt(src: string, openIdx: number): string {
  let depth = 0
  for (let i = openIdx; i < src.length; i++) {
    if (src[i] === '(') depth++
    else if (src[i] === ')') {
      depth--
      if (depth === 0) return src.slice(openIdx + 1, i)
    }
  }
  return src.slice(openIdx + 1)
}

/**
 * True when the argument text contains `graph` in KEY position of an object
 * literal — `{ graph }`, `{ graph: x }`, `{ a: 1, graph: b }`.
 *
 * Deliberately anchored on a preceding `{` or `,` so that `graph` appearing as
 * a VALUE (`{ framing: graph }`) is not a false positive.
 */
function writesGraphKey(args: string): boolean {
  return /[{,]\s*graph\s*[:,}]/.test(args)
}

/**
 * Every raw `.update(...)`/`.upsert(...)` in `src` whose inline object literal
 * writes a `graph` column. Exported shape: `.update({ … graph … })`.
 */
export function findRawGraphWrites(src: string): string[] {
  const code = blankNonCode(src)
  const violations: string[] = []
  for (const writer of RAW_WRITERS) {
    const re = new RegExp(`\\.${writer}\\s*\\(`, 'g')
    let m: RegExpExecArray | null
    while ((m = re.exec(code)) !== null) {
      const openIdx = code.indexOf('(', m.index)
      if (openIdx === -1) continue
      const args = argsAt(code, openIdx)
      if (writesGraphKey(args)) violations.push(`.${writer}({ … graph … })`)
    }
  }
  return violations
}

// ---------------------------------------------------------------------------
// Positive control: the scan must be able to SEE a violation.
// An absence assertion whose detector cannot detect is vacuous.
// ---------------------------------------------------------------------------

describe('board #2 — the scan itself bites (detector contract)', () => {
  it('catches the exact bypass shape this PR removed', () => {
    expect(
      findRawGraphWrites("await supabase.from('scenarios').update({ graph }).eq('id', id)"),
    ).toEqual(['.update({ … graph … })'])
  })

  it('catches an explicit graph value', () => {
    expect(findRawGraphWrites(".from('scenarios').update({ graph: nextGraph })")).toEqual([
      '.update({ … graph … })',
    ])
  })

  it('catches graph alongside other columns', () => {
    expect(findRawGraphWrites('.update({ title: t, graph: g, stage: s })')).toEqual([
      '.update({ … graph … })',
    ])
  })

  it('catches a multi-line update payload', () => {
    const src = ["supabase.from('scenarios').update({", '  graph: currentGraph,', '})'].join('\n')
    expect(findRawGraphWrites(src)).toEqual(['.update({ … graph … })'])
  })

  it('catches an upsert that carries a graph column', () => {
    expect(findRawGraphWrites('.upsert({ id, graph: g }, { onConflict: "id" })')).toEqual([
      '.upsert({ … graph … })',
    ])
  })

  it('catches a raw write no matter WHICH file it lives in (shape-directed, not path-directed)', () => {
    // The evasion the one-file guard allowed: a raw write inside a hook.
    const hookish = [
      'export function useThing() {',
      "  void supabase.from('scenarios').update({ graph: g }).eq('id', sid)",
      '}',
    ].join('\n')
    expect(findRawGraphWrites(hookish)).toHaveLength(1)
  })

  // -- and must NOT fire on the sanctioned path or unrelated writes ----------

  it('allows the gated RPC (p_graph is an RPC param, not a column write)', () => {
    const gated = [
      "await supabase.rpc('apply_patch_and_log', {",
      '  p_scenario_id: scenarioId,',
      '  p_graph: graph,',
      "  p_event_type: 'graph_saved',",
      '})',
    ].join('\n')
    expect(findRawGraphWrites(gated)).toEqual([])
  })

  it('allows updates to other columns', () => {
    expect(findRawGraphWrites(".from('scenarios').update({ framing }).eq('id', id)")).toEqual([])
    expect(findRawGraphWrites(".from('scenarios').update({ title: t }).eq('id', id)")).toEqual([])
    expect(
      findRawGraphWrites(".update({ analysis_status: 'none', analysis_error: null })"),
    ).toEqual([])
  })

  it('does not treat `graph` in VALUE position as a graph-column write', () => {
    expect(findRawGraphWrites('.update({ framing: graph })')).toEqual([])
  })

  it('ignores raw writes written in comments and strings', () => {
    expect(findRawGraphWrites('// legacy: .update({ graph })')).toEqual([])
    expect(findRawGraphWrites('/* .update({ graph: g }) */')).toEqual([])
    expect(findRawGraphWrites('const doc = ".update({ graph })"')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
// The actual guard.
// ---------------------------------------------------------------------------

describe('board #2 — no raw scenarios.graph writer anywhere in src/', () => {
  it('every graph write routes through the gated RPC (violations must be [])', () => {
    const violations: string[] = []
    for (const file of sourceFiles(SRC_ROOT)) {
      for (const v of findRawGraphWrites(readFileSync(file, 'utf8'))) {
        violations.push(`${relative(SRC_ROOT, file)} → ${v}`)
      }
    }
    expect(violations).toEqual([])
  })

  it('scans a non-trivial number of files (the walk is not silently empty)', () => {
    // Guards the guard: a broken walk would make the assertion above vacuous.
    expect(sourceFiles(SRC_ROOT).length).toBeGreaterThan(200)
  })
})
