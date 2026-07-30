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
 * ── WHAT IS ASSERTED: TWO PROPERTIES, NOT ONE ───────────────────────────────
 *   1. every rebuild spreads the existing edge's `data` WHOLESALE; and
 *   2. NOTHING is written after that spread.
 *
 * Property 2 was added by the adversarial review of PR #539, which seeded
 * `{...DEFAULT_EDGE_DATA, ...(edge.data ?? {}), validation: undefined}` and found
 * the guard GREEN. Property 1 alone reads as "persisted edge data survives the
 * rebuild" while permitting the single line that guarantees it does not.
 *
 * ── SCOPE OF THE CLAIM ──────────────────────────────────────────────────────
 * This scans `src/` for the SYNTACTIC shapes above. It does not prove that every
 * conceivable edge-data rebuild takes one of them. Known outside the detector,
 * disclosed rather than discovered later:
 *
 *   · `Object.assign(...)` in place of an object literal;
 *   · a rebuild that spreads a variable holding `DEFAULT_EDGE_DATA` under another
 *     name (the `rebuiltDataBody` gate looks for that identifier by name);
 *   · a `data:` opener sitting more than `DATA_WINDOW` characters after the outer
 *     spread;
 *   · a rebuild assembled across statements (`const d = {...}; return {...edge,
 *     data: d}`) rather than in one literal.
 *
 * Two shapes that WERE outside it and are now inside, both from the #539 review:
 * a member-expression outer spread (`...edges[i],`) and an override after the
 * wholesale spread. Two that were already covered and are pinned so they stay
 * covered: multiline and comment-interleaved named copies.
 *
 * The claim is: every rebuild written in the repo's own idiom is covered, a new
 * one written in that idiom is covered automatically, and the detector's reach is
 * PINNED by the three positive controls below rather than asserted.
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
 * The rebuild opener: a spread of a REFERENCE EXPRESSION, then (allowing
 * intervening members) a `data:` object. Capturing the expression is what lets
 * the check below demand a spread of THAT edge's `data` rather than of any
 * `.data`.
 *
 * ⚠ THE EXPRESSION IS NOT JUST A BARE IDENTIFIER — that was blind spot (ii) from
 * the adversarial review of PR #539. The first version matched
 * `[A-Za-z_$][\w$]*` only, so an index or member rebuild — `...edges[i],`,
 * `...pair.edge,` — was **invisible**, and a named-field copy at such a site
 * passed the scan silently. A `for (let i…)` rebuild loop is an entirely ordinary
 * way to write one of these, so this was not an exotic gap.
 *
 * `blankNonCode` runs first, so this file's own prose above — which quotes the
 * very shape being hunted — cannot read as a call site. That is not theoretical
 * here: `domain/edgeValueProvenance.ts` carries a `{ ...DEFAULT_EDGE_DATA, … }`
 * example inside a JSDoc block, and without the blanking it would be scanned as
 * code.
 */
const REBUILD_OPENER =
  /\.\.\.\s*([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*|\s*\[\s*[\w$]+\s*\])*)\s*,/g

/** How far after the outer spread the `data:` opener may sit. */
const DATA_WINDOW = 400

/** Whitespace-insensitive comparison, so `edges [ i ] .data` reads as `edges[i].data`. */
function squash(s: string): string {
  return s.replace(/\s+/g, '')
}

interface Finding {
  file: string
  /** The reference expression spread by the outer literal — the existing edge. */
  identifier: string
  /** Does the rebuilt `data` bag wholesale-spread `<identifier>.data`? */
  wholesale: boolean
  /**
   * Members written AFTER the wholesale spread. Each one can override a field the
   * spread just carried through — blind spot (i) from the same review.
   */
  overridesAfterSpread: string[]
}

/**
 * Find the `data: {` that is a SIBLING MEMBER of the same object literal as this
 * outer spread, and return its body — or `null` when the spread is not an edge
 * rebuild.
 *
 * ⚠ THE SIBLING TEST IS NOT COSMETIC; A PLAIN LOOKAHEAD WINDOW PRODUCED A FALSE
 * POSITIVE THE MOMENT THE OPENER WAS WIDENED. `OutputsDock.tsx` spreads
 * `...newNode.data` inside a NODE data literal, and a few lines later — inside a
 * *different* literal, in a `addEdge({...})` call — writes
 * `data: { ...DEFAULT_EDGE_DATA, confidence: 0 }`. A window that only looks
 * FORWARD walked out of the node literal, found the edge literal, and reported a
 * rebuild of `...newNode.data` that does not exist. Requiring the `data:` opener
 * to sit at depth 0 RELATIVE TO THE SPREAD — i.e. to be a member of the same
 * literal, not merely nearby — is the structural version of the question, and it
 * costs nothing.
 */
function rebuiltDataBody(code: string, afterSpread: number): string | null {
  // Walk forward from the spread, tracking nesting. Depth < 0 means we have left
  // the literal the spread belongs to: any `data:` beyond that is a sibling of
  // something else.
  let depth = 0
  let open = -1
  for (let i = afterSpread; i < code.length && i < afterSpread + DATA_WINDOW; i++) {
    const c = code[i]
    if (c === '{' || c === '(' || c === '[') {
      depth++
      continue
    }
    if (c === '}' || c === ')' || c === ']') {
      depth--
      if (depth < 0) return null // left the enclosing literal
      continue
    }
    if (depth === 0 && /^data\s*:\s*\{/.test(code.slice(i))) {
      open = code.indexOf('{', i)
      break
    }
  }
  if (open === -1) return null

  let d = 0
  for (let i = open; i < code.length; i++) {
    if (code[i] === '{') d++
    else if (code[i] === '}') {
      d--
      if (d === 0) {
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
 * The TOP-LEVEL MEMBERS of an object literal body, in source order — each spread
 * and each named key, split at depth-0 commas.
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
 * Parsing MEMBERS (rather than only spreads) makes both questions answerable: is
 * `<identifier>.data` inside a SPREAD, and is anything written AFTER it.
 */
function topLevelMembers(body: string): string[] {
  const inner = body.slice(1, -1) // strip the braces
  const out: string[] = []
  let depth = 0
  let start = 0
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i]
    if (c === '(' || c === '[' || c === '{') depth++
    else if (c === ')' || c === ']' || c === '}') depth--
    else if (c === ',' && depth === 0) {
      out.push(inner.slice(start, i))
      start = i + 1
    }
  }
  out.push(inner.slice(start))
  return out.map((s) => s.trim()).filter((s) => s !== '')
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

      const members = topLevelMembers(body)
      // The required shape: a SPREAD whose expression reads `<identifier>.data`.
      // Every real site wraps it (`...(edge.data as Partial<EdgeData> | undefined
      // ?? {})`), so the test is on the spread's CONTENT, not on an exact form.
      // Compared whitespace-squashed so a member expression spanning line breaks
      // still matches.
      const wanted = squash(identifier) + '.data'
      const spreadIdx = members.findIndex(
        (m) => m.startsWith('...') && squash(m).includes(wanted),
      )
      // ⚠ ANYTHING AFTER THE WHOLESALE SPREAD CAN UNDO IT — blind spot (i). The
      // guard used to assert only that the spread was PRESENT, so
      // `{...DEFAULT_EDGE_DATA, ...(edge.data ?? {}), validation: undefined}`
      // passed while destroying exactly the user-decision field this file's
      // WHY-IT-MATTERS section is about. Both named keys and further spreads
      // count: either can overwrite a field the spread just carried through, and
      // a rebuild whose whole purpose is "carry everything through" has no
      // business writing after it. A site that genuinely must force a field
      // should have to argue for it against a RED, not do it silently.
      const overridesAfterSpread =
        spreadIdx === -1
          ? []
          : members.slice(spreadIdx + 1).map((m) => m.split(/[:(]/)[0].trim())

      findings.push({
        file: relative(SRC_ROOT, file),
        identifier,
        wholesale: spreadIdx !== -1,
        overridesAfterSpread,
      })
    }
  }
  return findings
}

/**
 * Overrides after the wholesale spread that are ADJUDICATED DELIBERATE, each with
 * the reason it is here. Keyed `<file>:<key>`.
 *
 * ⚠ NOT A SUPPRESSION LIST. It fails loud in BOTH directions — an undisclosed
 * override reds because it is absent here, and a disclosed one that stops
 * existing reds because this list would then over-state. Adding an entry is a
 * decision someone has to make in a diff, with a reason, against a RED. That is
 * the only honest way to hold "nothing is written after the spread" as a property
 * when one legitimate exception genuinely exists: the alternative — a clever
 * predicate that tries to tell a good override from a bad one — is how a guard
 * trades one vacuity for another.
 *
 * The single entry is a v1→v2 MIGRATION, not a rebuild-in-flight:
 * `migrateEdgeV1ToV2` hoists the legacy TOP-LEVEL `edge.label` into `data.label`,
 * and "top-level edge.label takes precedence over edge.data.label" IS the
 * migration's documented purpose (its own docstring says so). The override reads
 * FROM the same edge — it moves data within the edge rather than discarding it —
 * which is the opposite of the seeded `validation: undefined` this pin exists to
 * catch.
 */
const KNOWN_POST_SPREAD_OVERRIDES: ReadonlyArray<readonly [string, string]> = [
  [
    'canvas/domain/migrations.ts:label',
    'migrateEdgeV1ToV2 hoists the legacy top-level edge.label into data.label — the documented purpose of the v1→v2 migration, and it reads from the same edge',
  ],
]

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

  /**
   * THIRD POSITIVE CONTROL — the widened opener must actually see a
   * member-expression spread, or blind spot (ii) is only nominally closed.
   *
   * There is no member-expression rebuild in `src/` today, so this control is on
   * the DETECTOR rather than on the tree: it runs the opener over a fixture of
   * each shape the review named and requires each to be recognised. A control
   * pinned to "whatever is in the tree" would silently become vacuous the moment
   * the tree changed (CLAUDE.md trap 12b), which is exactly the wrong property for
   * a control guarding a widened regex.
   */
  it('the widened opener recognises index, member and bare-identifier spreads', () => {
    const cases: Array<[string, string]> = [
      ['...edge,', 'edge'],
      ['...edges[i],', 'edges[i]'],
      ['...pair.edge,', 'pair.edge'],
      ['...state.edges[0],', 'state.edges[0]'],
    ]
    for (const [src, expected] of cases) {
      const m = [...src.matchAll(REBUILD_OPENER)]
      expect(m.length, `opener must see ${src}`).toBe(1)
      expect(squash(m[0][1])).toBe(expected)
    }
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

  /**
   * ⭐ THE SECOND PIN — added by the adversarial review of PR #539 (blind spot i).
   *
   * The pin above asks whether the wholesale spread is PRESENT. It does not ask
   * whether anything UNDOES it. So
   *
   *     { ...DEFAULT_EDGE_DATA, ...(edge.data ?? {}), validation: undefined }
   *
   * passed the guard while destroying exactly the `validation` user-decision field
   * this file's WHY-IT-MATTERS section is written about — the resolve-contested
   * writer's `user_action` / `resolved_value` / `resolved_by`. A guard that reads
   * as "persisted edge data survives the rebuild" while permitting the one line
   * that guarantees it does not is worse than no guard, because it is cited.
   */
  it('nothing is written AFTER the wholesale spread (an override undoes it)', () => {
    const found = findings
      .flatMap((f) => f.overridesAfterSpread.map((k) => `${f.file}:${k}`))
      .sort()
    const known = KNOWN_POST_SPREAD_OVERRIDES.map(([k]) => k).sort()

    // No UNDISCLOSED override.
    expect(found.filter((k) => !known.includes(k))).toEqual([])

    // …and no STALE disclosure: an entry whose override has since been removed
    // must be deleted in the same change, so the record cannot outlive the thing
    // it describes. Same both-directions rule as `KNOWN_HOP_DIVERGENCES` in
    // `edgeValidationMapperMirror.spec.ts` — which has already caught a wrong
    // entry once.
    expect(
      KNOWN_POST_SPREAD_OVERRIDES.filter(([k]) => !found.includes(k)).map(
        ([k, why]) => `${k} (recorded as: ${why}) no longer overrides — delete this entry`,
      ),
    ).toEqual([])
  })

  it('the disclosed override set is exactly the one documented migration hoist', () => {
    // Pinned separately so the SIZE of the exception set is visible in a diff.
    expect(KNOWN_POST_SPREAD_OVERRIDES.map(([k]) => k)).toEqual([
      'canvas/domain/migrations.ts:label',
    ])
  })
})
