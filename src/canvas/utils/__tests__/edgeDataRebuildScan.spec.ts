/**
 * A-3a — every EDGE-DATA REBUILD keeps the wholesale spread of the existing
 * edge's `data`. A derived source guard, not a list of files.
 *
 * ── WHY A SOURCE SCAN AND NOT MORE UNIT TESTS ────────────────────────────────
 * `edgeValidationRebuildHops.spec.ts` already drives five rebuild hops end to
 * end and asserts `validation` survives each. It is a good suite and it is not
 * enough, for the reason its own header states: those five sites survive only
 * because each happens to be written as a WHOLESALE SPREAD over the defaults —
 *
 *     { ...DEFAULT_EDGE_DATA, ...(edge.data ?? {}) }
 *
 * — so the hop-level tests pin ONE FIELD's survival at FIVE KNOWN SITES. They say
 * nothing about the SIXTH site that arrives next month, and nothing about the
 * NEXT field. That is the same shape as the defect the sibling scan
 * (`canvas/__tests__/edgeProvenanceLaundering.sourceScan.spec.ts`) exists for: a
 * hand-maintained list of places to be careful, which drifts silently and reads
 * as green (CLAUDE.md trap 12).
 *
 * ── WHY IT MATTERS NOW, RATHER THAN AS A ROWED IDEA ──────────────────────────
 * The resolve-contested writer puts USER DECISIONS in `edge.data.validation`
 * (`user_action`, `resolved_value`, `resolved_by`). Once that flag flips, a
 * rebuild hop written as a named-field copy is not a cosmetic regression — it is
 * DATA LOSS of a choice the user made, on scenario resume, the journey every
 * tester takes daily, with a fully green suite. The repo already owns this idiom
 * and it costs one file.
 *
 * ── WHAT COUNTS AS A REBUILD, AND WHY THE SIGNAL SURVIVES THE MUTATION ───────
 * A rebuild is an object literal that spreads an EXISTING edge (`...edge,`) and
 * then supplies a fresh `data` bag built over `DEFAULT_EDGE_DATA`. Both halves
 * are load-bearing:
 *
 *   · the OUTER `...<ident>,` spread is what identifies the input as an existing
 *     canvas edge rather than a wire object. It is ALSO what a named-field-copy
 *     mutation does not touch — the mutation rewrites the inner `data` bag — so
 *     the site stays visible to this scan exactly when it starts violating it.
 *     A detector keyed on the inner spread alone would go BLIND at the moment of
 *     the defect and report zero findings, i.e. pass.
 *   · the `...DEFAULT_EDGE_DATA` inside `data:` is what makes it a REBUILD rather
 *     than a patch — the bag is being reconstructed from scratch, which is when
 *     an unenumerated field can be lost.
 *
 * A FRESH CONSTRUCTION is therefore correctly excluded with no allowlist: the
 * blueprint insert (`ReactFlowGraph.tsx`), the user-drawn `onConnect`, the two
 * clarifier paths in `store.ts` and the two ingestion mappers all build a NEW
 * object (`id`/`source`/`target`/…) with no outer edge spread, because there is
 * no existing edge to spread. Nothing there can be dropped, so a pin would
 * assert a vacuous truth — the same reasoning `edgeValidationRebuildHops.spec.ts`
 * applies to the same sites, reached here structurally instead of by hand.
 *
 * ── SCOPE OF THE CLAIM ──────────────────────────────────────────────────────
 * This scans `src/` for the SYNTACTIC shape above. It does not prove that every
 * conceivable edge-data rebuild takes that shape — a rebuild written with
 * `Object.assign`, or one that spreads a variable holding `DEFAULT_EDGE_DATA`
 * under another name, is outside the detector. The claim is: every rebuild
 * written in the repo's own idiom is covered, and a new one written in that idiom
 * is covered automatically. The detector's reach is pinned by the positive
 * control below rather than asserted.
 */
import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import { blankNonCode } from '../../../../tests/helpers/stripSourceComments'

const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
const EXCLUDED_DIR_NAMES = new Set([
  '__tests__',
  '__fixtures__',
  '__helpers__',
  '__mocks__',
  'node_modules',
])

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
    out.push(full)
  }
  return out
}

/**
 * The rebuild opener: a spread of an identifier, then (allowing intervening
 * members) a `data:` object. Capturing the identifier is what lets the check
 * below demand a spread of THAT edge's `data` rather than of any `.data`.
 *
 * `blankNonCode` runs first, so this file's own prose above — which quotes the
 * very shape being hunted — cannot read as a call site. That is not theoretical
 * here: `domain/edgeValueProvenance.ts` carries a `{ ...DEFAULT_EDGE_DATA, … }`
 * example inside a JSDoc block, and without the blanking it would be scanned as
 * code.
 */
const REBUILD_OPENER = /\.\.\.\s*([A-Za-z_$][\w$]*)\s*,/g

/** How far after the outer spread the `data:` opener may sit. */
const DATA_WINDOW = 400

interface Finding {
  file: string
  /** The identifier spread by the outer literal — the existing edge. */
  identifier: string
  /** Does the rebuilt `data` bag wholesale-spread `<identifier>.data`? */
  wholesale: boolean
}

/**
 * Find the `data: {` that belongs to this outer spread and return its literal
 * body, or `null` when the spread is not an edge rebuild.
 */
function rebuiltDataBody(code: string, afterSpread: number): string | null {
  const window = code.slice(afterSpread, afterSpread + DATA_WINDOW)
  const dataAt = window.search(/\bdata\s*:\s*\{/)
  if (dataAt === -1) return null
  const open = afterSpread + window.indexOf('{', dataAt)
  let depth = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') depth++
    else if (code[i] === '}') {
      depth--
      if (depth === 0) {
        const body = code.slice(open, i + 1)
        // Only a bag rebuilt over the mapper defaults is a REBUILD. A `data:`
        // that merely patches named keys onto an existing bag is a different
        // operation and cannot lose an unenumerated field.
        return body.includes('DEFAULT_EDGE_DATA') ? body : null
      }
    }
  }
  return null
}

/**
 * The SPREAD ELEMENTS of an object literal body — each `...expr`, where `expr`
 * runs to the member-separating comma at depth 0.
 *
 * ⚠ THIS REPLACES A REGEX THAT MADE THIS WHOLE GUARD VACUOUS, and the failure is
 * worth recording because it is the guard-theatre shape this file exists to
 * prevent, committed inside the file itself. The first version asked whether the
 * body matched `/\.\.\.\s*\(?[^)]*\b<ident>\s*\.\s*data\b/`. `[^)]*` happily
 * skips across arbitrary text, so ANY `...` anywhere in the bag followed later by
 * ANY mention of `edge.data` satisfied it — and a named-field copy still contains
 * both (`...DEFAULT_EDGE_DATA,` and `weight: edge.data?.weight`). The seeded
 * mutation therefore left the scan GREEN: the guard reported "all rebuilds are
 * wholesale" while reading a rebuild that was not. Caught by the mutation check,
 * which is the only thing that could have caught it (CLAUDE.md trap 15: your own
 * script is not exempt; trap 13: prove the detector can see a PRESENCE).
 *
 * Splitting into actual spread elements makes the question the right one: is
 * `<identifier>.data` inside a SPREAD, rather than merely somewhere in the bag.
 */
function spreadElements(body: string): string[] {
  const out: string[] = []
  for (let i = 0; i < body.length - 2; i++) {
    if (body.slice(i, i + 3) !== '...') continue
    let depth = 0
    let j = i + 3
    for (; j < body.length; j++) {
      const c = body[j]
      if (c === '(' || c === '[' || c === '{') depth++
      else if (c === ')' || c === ']') depth--
      else if (c === '}') {
        if (depth === 0) break
        depth--
      } else if (c === ',' && depth === 0) break
    }
    out.push(body.slice(i + 3, j))
  }
  return out
}

function scan(): Finding[] {
  const findings: Finding[] = []
  for (const file of sourceFiles(SRC_ROOT)) {
    const code = blankNonCode(readFileSync(file, 'utf8'))
    for (const match of code.matchAll(REBUILD_OPENER)) {
      const identifier = match[1]
      const after = (match.index ?? 0) + match[0].length
      const body = rebuiltDataBody(code, after)
      if (body === null) continue
      // The required shape: a SPREAD whose expression reads `<identifier>.data`.
      // Every real site wraps it (`...(edge.data as Partial<EdgeData> | undefined
      // ?? {})`), so the test is on the spread's CONTENT, not on an exact form.
      const dataRead = new RegExp(`\\b${identifier}\\s*\\.\\s*data\\b`)
      const wholesale = spreadElements(body).some((e) => dataRead.test(e))
      findings.push({ file: relative(SRC_ROOT, file), identifier, wholesale })
    }
  }
  return findings
}

describe('edge-data rebuilds — derived source guard (A-3a)', () => {
  const findings = scan()

  /**
   * POSITIVE CONTROL (trap 13). If the detector finds nothing, the assertion
   * below passes by testing nothing — which is precisely how the unpinned class
   * survived until now. `useScenario.ts` (the Supabase resume hop) and
   * `store.ts` (the rehydrate + three repair hops) are the known homes; the scan
   * must SEE them, by file, not merely return a non-zero count.
   */
  it('the detector can see the real edge-data rebuilds (non-vacuous)', () => {
    expect(findings.length).toBeGreaterThan(0)
    const files = new Set(findings.map((f) => f.file))
    expect(files.has('hooks/useScenario.ts')).toBe(true)
    expect(files.has('canvas/store.ts')).toBe(true)
    // The five hops `edgeValidationRebuildHops.spec.ts` drives end to end. Not a
    // hand-maintained list of WHERE to look — the scan found these — but a floor
    // on the detector's reach, so a regex change that quietly narrowed it reds.
    expect(findings.length).toBeGreaterThanOrEqual(5)
  })

  /**
   * SECOND POSITIVE CONTROL — the detector's blindness to comments and strings
   * is a property, so it is pinned rather than trusted. `edgeValueProvenance.ts`
   * quotes `{ ...DEFAULT_EDGE_DATA, weight, beliefExists, … }` inside a JSDoc
   * block; a scan that read comments would report it and would then need an
   * allowlist entry, which is how a real violation later hides behind a
   * plausible exception.
   */
  it('ignores the shape when it appears in a comment (blankNonCode holds)', () => {
    expect(findings.some((f) => f.file === 'canvas/domain/edgeValueProvenance.ts')).toBe(false)
  })

  it('every edge-data rebuild spreads the existing edge data wholesale', () => {
    // THE PIN. Converting any one of these to a named-field copy — the exact
    // discipline the two INGESTION mappers deliberately use, and therefore the
    // change a well-intentioned reader is most likely to make here — turns this
    // red. Without it the same change is invisible: 139 pre-existing tests
    // across 8 files stay green through it, including both `useScenario` specs.
    const named = findings.filter((f) => !f.wholesale)
    expect(named.map((f) => `${f.file}: rebuild of ...${f.identifier}`)).toEqual([])
  })
})
