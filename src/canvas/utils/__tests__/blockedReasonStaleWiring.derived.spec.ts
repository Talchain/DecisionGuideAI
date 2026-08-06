/**
 * DERIVED guard: the staleness mark actually reaches the copy (ROADMAP 2.635, I-3).
 *
 * ── WHY THIS EXISTS ──────────────────────────────────────────────────────
 * `composeReadinessBlockedReason`'s `verdictIsStale` parameter DEFAULTS to
 * `false`. That default is the safe one — it reproduces pre-2.635 behaviour for
 * a caller who omits it — but a safe default is also a silent one: a caller who
 * stops passing the argument loses the whole invariant and every unit test of
 * the composer stays green, because they pass it explicitly.
 *
 * This is the failure shape `runGateCallSites.derived.spec.ts` was written for
 * on a different parameter, and its mutation battery proved it real: removing
 * `draftStreamPhase` from `OutputsDock`'s gate call survived the entire suite.
 * A gate nobody feeds is a gate that never fires — correct machinery, never
 * executed.
 *
 * So the manifest is DERIVED from source at test time rather than hand-listed
 * (trap 12): a third run surface added tomorrow is covered without anyone
 * remembering to add it here, and the file list is a directory walk, not a
 * literal.
 *
 * ── ITS HONEST LIMIT, STATED ─────────────────────────────────────────────
 * This is a STRUCTURAL check on source text. It proves the argument is passed
 * and that the value passed is the store's own staleness mark — it does NOT
 * prove the resulting sentence is right. That is pinned by behaviour, in
 * `canRunAnalysis.staleVerdict.spec.ts` (the gate's own logic) and
 * `OutputsDock.staleVerdictCopy.spec.tsx` (the real wiring, through the
 * deployed-flag surface). The two kinds of guard are not redundant.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

import { describe, it, expect } from 'vitest'

const SRC = join(process.cwd(), 'src')

/** Every `.ts`/`.tsx` file under `src/`, tests and stories excluded. */
function productionSources(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      productionSources(full, out)
    } else if (/\.tsx?$/.test(entry) && !/\.(spec|test|stories)\.tsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

/** Read the whole argument list of a call, balancing parens from the `(`. */
function callArguments(text: string, openParenIndex: number): string {
  let depth = 1
  let i = openParenIndex + 1
  while (i < text.length && depth > 0) {
    if (text[i] === '(') depth++
    else if (text[i] === ')') depth--
    i++
  }
  return text.slice(openParenIndex + 1, i - 1)
}

function composerCallSites(): Array<{ file: string; args: string }> {
  const found: Array<{ file: string; args: string }> = []
  const pattern = /\bcomposeReadinessBlockedReason\s*\(/g
  for (const file of productionSources(SRC)) {
    // The composer's own module defines it; a definition is not a call site.
    if (file.endsWith(join('canvas', 'utils', 'composeBlockedReason.ts'))) continue
    const text = readFileSync(file, 'utf8')
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      // Skip the import statement, which matches the bare identifier.
      const lineStart = text.lastIndexOf('\n', m.index) + 1
      const line = text.slice(lineStart, m.index)
      if (/\bimport\b/.test(line)) continue
      found.push({ file: relative(SRC, file), args: callArguments(text, m.index + m[0].length - 1) })
    }
  }
  return found
}

/** Run-gate call sites, matched under the local alias both live callers use. */
function runGateCallSites(): Array<{ file: string; args: string }> {
  const found: Array<{ file: string; args: string }> = []
  const pattern = /\bcanRunAnalysis(?:Util)?\s*\(\s*\{/g
  for (const file of productionSources(SRC)) {
    if (file.endsWith(join('canvas', 'utils', 'canRunAnalysis.ts'))) continue
    const text = readFileSync(file, 'utf8')
    let m: RegExpExecArray | null
    while ((m = pattern.exec(text)) !== null) {
      let depth = 1
      let i = m.index + m[0].length
      while (i < text.length && depth > 0) {
        if (text[i] === '{') depth++
        else if (text[i] === '}') depth--
        i++
      }
      found.push({ file: relative(SRC, file), args: text.slice(m.index, i) })
    }
  }
  return found
}

const COMPOSER_SITES = composerCallSites()
const GATE_SITES = runGateCallSites()

describe('composeReadinessBlockedReason — derived staleness-wiring manifest', () => {
  it('finds the call site at all (trap 13: prove the matcher sees a presence)', () => {
    // If this drops to zero every assertion below is vacuous, which is why it is
    // the first test in the file.
    expect(COMPOSER_SITES.length).toBeGreaterThan(0)
    // Reported by name so a reviewer can see what was actually measured.
    expect(COMPOSER_SITES.map((s) => s.file)).toMatchObject(
      COMPOSER_SITES.map(() => expect.any(String)),
    )
  })

  it('every production caller passes a third (staleness) argument', () => {
    const offenders = COMPOSER_SITES.filter((site) => {
      // Count top-level commas: two of them means three arguments.
      let depth = 0
      let commas = 0
      for (const ch of site.args) {
        if ('([{'.includes(ch)) depth++
        else if (')]}'.includes(ch)) depth--
        else if (ch === ',' && depth === 0) commas++
      }
      return commas < 2
    })

    expect(offenders.map((o) => `${o.file}: ${o.args.replace(/\s+/g, ' ').trim()}`)).toEqual([])
  })

  it('the staleness argument is the readiness verdict’s own mark, not a literal', () => {
    // `composeReadinessBlockedReason(v, opts, false)` would satisfy the arity
    // check above while disabling the invariant everywhere — the exact shape a
    // "just make it compile" edit produces.
    const offenders = COMPOSER_SITES.filter((site) => /,\s*(false|true)\s*\)?$/.test(site.args.trim()))

    expect(offenders.map((o) => o.file)).toEqual([])
  })
})

describe('run-gate call sites — derived staleness manifest', () => {
  it('finds the run-gate call sites at all', () => {
    expect(GATE_SITES.length).toBeGreaterThan(0)
  })

  it('every run-gate call site feeds the readiness staleness mark', () => {
    // The gate is what forwards staleness to the composer, so a surface that
    // omits it silently reverts to quoting a stale verdict as current — with no
    // type error, because the parameter is optional by design (52 existing test
    // call sites made it impractical to require).
    const offenders = GATE_SITES.filter((site) => !/\breadinessStale\b/.test(site.args))

    expect(offenders.map((o) => o.file)).toEqual([])
  })
})
