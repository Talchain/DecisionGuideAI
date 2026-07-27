/**
 * Claim-ownership drift walker — the ENGINE. One instrument, all families.
 *
 * WHY THIS EXISTS
 * ---------------
 * The estate's dominant display defect is a consumer that reaches around the
 * module that owns a claim and re-derives it from the producer's raw fields.
 * PR #496 is the worked example: `selectGoalProbability` became THE chooser for
 * the goal-probability identity, and the canvas chain in
 * `useNodeDisplayMetadata` had to be deleted because it was a SECOND chooser
 * that disagreed with it live. The house already solved this once, for the
 * driver-influence family, with a bespoke tripwire
 * (`src/components/results/__tests__/no-raw-influence-read.spec.ts`) whose
 * detector logic is proven — but which HAND-LISTS its family in two places
 * (`RAW_PROPS` in the ESLint rule, `SCAN_ROOTS`/`ALLOWLIST`/`RAW_MEMBER_READ`
 * here). Adding a family means editing both files. That is the
 * hand-maintained-mirror defect class, which is the one that drifts silently.
 *
 * THE DESIGN MOVE is not the detector, it is the REGISTRATION. An owner module
 * exports `CLAIM_OWNERSHIP` naming its family and the raw producer fields it
 * owns; this walker DISCOVERS owners by globbing `git ls-files` and then
 * DYNAMICALLY IMPORTS them to read the real runtime value. There is therefore
 * no mirror at all between what the walker enforces and what an owner declares
 * — they are the same object. A new family registers by construction.
 *
 * WHAT THIS FILE IS. Pure functions, no assertions. The assertions (and the
 * anti-vacuity controls) live in
 * `src/test/__tests__/claim-ownership.drift.spec.ts`. The engine is separated
 * so that the baseline GENERATOR
 * (`tools/ci-guards/update-claim-drift-baseline.mjs`) can load and run exactly
 * this code rather than carrying a second implementation of discovery and
 * detection — the generator and the gate cannot disagree, because there is only
 * one of them.
 *
 * WHAT IT CANNOT SEE is declared in `UNDETECTABLE` below, and is not a
 * formality: this is a source-TEXT scanner, and the scope of the absence claim
 * it supports is stated there precisely. In particular it polices reads of raw
 * field NAMES, which is a PROXY for the real invariant "consumers render, never
 * derive". A consumer that recomputes a claim from ALREADY-SELECTED values
 * reads no raw field and is invisible here. First hop, not second hop.
 */

import { execFileSync } from 'child_process'
import { readFileSync } from 'fs'
import { join } from 'path'
import { stripComments } from '../../../tests/helpers/stripSourceComments'

/**
 * Repo root, asked of git rather than computed from this file's location.
 *
 * Two reasons. (1) It is derived from the same authority the file set comes
 * from, so the walk and the root cannot disagree. (2) `__dirname` is injected by
 * vitest but NOT by a bare Vite SSR load, and the baseline generator loads this
 * exact module that way — path arithmetic here would work in the gate and break
 * in the generator, which is precisely the two-implementations problem this
 * engine exists to avoid. Outside a checkout this throws, loudly.
 */
export const REPO_ROOT = execFileSync('git', ['rev-parse', '--show-toplevel'], {
  encoding: 'utf8',
}).trim()

/** The generated, shrink-only ratchet. Next to the repo's other guard baselines. */
export const BASELINE_PATH = join(REPO_ROOT, 'tools', 'ci-guards', 'claim-drift-baseline.tsv')

/**
 * The generated ITEM baseline. Same provenance, same command, written in the
 * same pass — see THE RATCHET below for why one artefact was not enough.
 */
export const IDENTITIES_PATH = join(REPO_ROOT, 'tools', 'ci-guards', 'claim-drift-identities.tsv')

/** The named, no-env-var escape hatch. Printed in every failure message. */
export const UPDATE_COMMAND = 'node tools/ci-guards/update-claim-drift-baseline.mjs'

/**
 * Shapes this instrument PROVABLY does not detect. Written down rather than
 * discovered later. Every entry was searched for at 8b2f5945 and is absent from
 * `src/` today — a declared blind spot that is currently empty is still a blind
 * spot.
 */
export const UNDETECTABLE = [
  "computed access via a non-literal key: const K = 'goal_probability'; obj[K]",
  'field name assembled at runtime: obj["goal_" + "probability"]',
  'read through an `any`-typed alias with a computed key: (o as any)[k]',
  're-derivation from already-selected values (no raw field name appears)',
  'files outside the tracked src/ TS/TSX set (tools/, scripts/, e2e/)',
  // Measured, not assumed: a brand-new owner module was invisible to the walker
  // until it was staged. `git ls-files` is the authority for the scan, so a file
  // that is not yet tracked is not yet policed. This is sound in CI, which only
  // ever sees a committed tree, and it matches how the typecheck gate derives
  // its own file set — but locally, `git add` is what arms the instrument.
  'untracked files: a new file is invisible until `git add` (CI sees only committed trees)',
  // Added 2026-07-27 after the #506 inheritance check. Both are limits of
  // COUNTING, not of detection: the reads are seen, the ratchet cannot price
  // them. Written down here rather than left for someone to discover green.
  'a second raw read on a line that already has one: findReads records at most one hit per line',
  'a within-file swap of the SAME field: no count-based ratchet can see one — it is REPORTED ' +
    'via claim-drift-identities.tsv, and reporting is not blocking',
] as const

/**
 * The scope of the absence claim this instrument supports, stated precisely.
 * Kept next to `UNDETECTABLE` so the two are read together.
 */
export const ABSENCE_CLAIM_SCOPE =
  'No production file under src/ tracked by git, outside the owner module and ' +
  'outside an attested producer, contains a literal member-read, destructure ' +
  '(renamed or not), or quoted computed access of a registered raw claim field.'

/** Non-production files: fixtures, specs, stories. Not render surfaces. */
export const TEST_LIKE = /(__tests__|__fixtures__|__mocks__|\.spec\.|\.test\.|\.stories\.)/

/**
 * Floor for the derived production file set. Copied in spirit from
 * `scripts/ci/typecheck-gate.sh`'s `MIN_TRACKED_FILES=2000`: if `git ls-files`
 * returns far fewer files than the repo has (not a checkout, a broken glob, a
 * shallow tree), the walk would be vacuously empty and PASS. vitest runs with
 * `passWithNoTests: true`, so a vacuous instrument is a GREEN instrument.
 * 1,437 production files at 8b2f5945.
 */
export const MIN_PROD_FILES = 900

/** A registered claim family, as read from an owner module at runtime. */
export interface Family {
  /** Family name. Unique across the tree; a clash is a hard RED. */
  family: string
  /** The producer field names this owner owns. Non-empty. */
  rawFields: readonly string[]
  /**
   * The exported selector consumers must call instead, or `null` for a family
   * that has NO chooser yet and is registered purely to FREEZE its debt.
   * `null` is deliberately explicit: a family with no owner has no sanctioned
   * chain, so every read is a violation and lands in the baseline.
   */
  callInstead: string | null
  /** Required when `callInstead` is null: why this family is frozen, not owned. */
  debtReason?: string
  /** Path of the registering module, relative to the repo root. Derived. */
  ownerRel: string
  /**
   * Keys of the value `callInstead` returns, DERIVED by calling it — never
   * declared. Used by the collision assertion. Empty for a debt-only family.
   */
  outputFields: readonly string[]
}

/** Tracked TS/TSX under src/. The house standard for an absence claim. */
export function trackedSourceFiles(): string[] {
  const out = execFileSync('git', ['ls-files', '--', 'src/*.ts', 'src/*.tsx'], {
    cwd: REPO_ROOT,
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  })
  return out.split('\n').filter(Boolean)
}

/** Production subset — the surfaces that can actually render a claim. */
export function productionFiles(all: string[]): string[] {
  return all.filter((rel) => !TEST_LIKE.test(rel))
}

/**
 * Discover owners.
 *
 * A cheap textual prefilter narrows 2,733 files to candidates. The prefilter is
 * SOUND BY CONSTRUCTION: the export statement necessarily contains the
 * identifier, so no registered owner can hide from it.
 *
 * Then DYNAMIC IMPORT, to read the real runtime value. This is the whole point
 * — a regex parse of the literal would be a second representation of the
 * family, i.e. a mirror, i.e. the defect. An import that throws is a HARD
 * FAILURE, never a silent skip: an owner the walker cannot read is an owner it
 * is not policing, and that must be loud.
 */
export async function discoverFamilies(all: string[]): Promise<Family[]> {
  const candidates = all.filter((rel) =>
    /export\s+const\s+CLAIM_OWNERSHIP\b/.test(readFileSync(join(REPO_ROOT, rel), 'utf8')),
  )

  const families: Family[] = []
  for (const rel of candidates) {
    let mod: Record<string, unknown>
    try {
      mod = (await import(/* @vite-ignore */ join(REPO_ROOT, rel))) as Record<string, unknown>
    } catch (e) {
      throw new Error(
        `Owner module ${rel} exports CLAIM_OWNERSHIP but the drift walker could not ` +
          `import it: ${(e as Error).message}\n` +
          `The walker must never SKIP an owner it cannot read — that would silently ` +
          `stop policing a whole family. Fix the import, or remove the registration.`,
      )
    }

    const raw = mod.CLAIM_OWNERSHIP as Partial<Family> | undefined
    if (
      !raw ||
      typeof raw.family !== 'string' ||
      !raw.family ||
      !Array.isArray(raw.rawFields) ||
      raw.rawFields.length === 0 ||
      raw.rawFields.some((f) => typeof f !== 'string' || !f) ||
      !(typeof raw.callInstead === 'string' || raw.callInstead === null)
    ) {
      throw new Error(
        `${rel} exports CLAIM_OWNERSHIP but it is malformed. Required shape: ` +
          `{ family: non-empty string; rawFields: non-empty string[]; ` +
          `callInstead: string | null }.`,
      )
    }

    let outputFields: string[] = []
    if (raw.callInstead === null) {
      // A family with no chooser must say why, in the registration, where a
      // reviewer sees it. Frozen debt is a declaration, not a default.
      if (typeof raw.debtReason !== 'string' || raw.debtReason.trim().length < 40) {
        throw new Error(
          `${rel} registers family "${raw.family}" with callInstead: null (frozen debt) ` +
            `but no adequate \`debtReason\`. A family with no owner freezes every ` +
            `existing read into the baseline and gives new code no compliant route; ` +
            `say so, in at least 40 characters, in the registration itself.`,
        )
      }
    } else {
      // DERIVE the owner's output surface by CALLING the selector, rather than
      // asking the registration to declare it (which would be a mirror). This
      // is what makes the collision assertion possible: see §9.2 of the design
      // — registering `goalProbability`, which is ALSO the selector's own
      // output field name, manufactures ~14 false reds on correct code.
      const fn = mod[raw.callInstead]
      if (typeof fn !== 'function') {
        throw new Error(
          `${rel} registers callInstead: "${raw.callInstead}" for family ` +
            `"${raw.family}", but that module exports no such function. The name is ` +
            `load-bearing — it sanctions consumer chains and is printed in every ` +
            `failure message — so it must resolve, not merely read well.`,
        )
      }
      let result: unknown
      try {
        result = (fn as (x: unknown) => unknown)(undefined)
      } catch (e) {
        throw new Error(
          `${rel}: calling ${raw.callInstead}(undefined) threw (${(e as Error).message}). ` +
            `A claim selector must be TOTAL — callable on absent input, returning its ` +
            `full selection shape — because absence is one of the cases it exists to ` +
            `decide. The walker also needs the shape to detect output-name collisions.`,
        )
      }
      if (!result || typeof result !== 'object') {
        throw new Error(
          `${rel}: ${raw.callInstead}(undefined) returned ${String(result)}; a claim ` +
            `selector must return its selection object even when the input is absent ` +
            `(with a 'none'-style discriminant), never null/undefined.`,
        )
      }
      outputFields = Object.keys(result as Record<string, unknown>)
    }

    families.push({
      family: raw.family,
      rawFields: raw.rawFields as readonly string[],
      callInstead: raw.callInstead,
      debtReason: raw.debtReason,
      ownerRel: rel,
      outputFields,
    })
  }

  families.sort((a, b) => a.family.localeCompare(b.family))
  return families
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Detection patterns, built per family from the DISCOVERED field names.
 *
 * The shipped family-1 detector is defeated by 5 of 9 evasion shapes (measured;
 * latent, none live at 8b2f5945). Two classes are closed here:
 *
 *   * RENAMED / DEFAULTED destructure — `{ f: alias }`, `{ f: alias = 0 }`,
 *     `function g({ f: p })`. Family 1's `[{,]\s*(f)\s*[,}]` requires the field
 *     to be followed by `,` or `}`, so a `:` slips through.
 *   * QUOTED COMPUTED access — `o['f']`, `o["f"]`, o[`f`]. Family 1 requires a
 *     literal `.`.
 *
 * ⚠ REFINEMENT OF THE DESIGN (measured, see the PR body). The design proposed
 * widening the destructure class to `[,}:=]`. That is too wide: `{ f: … }` is
 * also how an object is CONSTRUCTED and how an inline TYPE MEMBER is declared,
 * so the wide form reddens producers writing the field out
 * (`{ goal_probability: safeFiniteNumber(x) }`, mapV5AnalysisToReport L563) and
 * inline type positions (`Record<string, { goal_probability: number; … }>`,
 * discriminationFallback L270) — neither of which is a READ. The renamed form
 * below therefore requires the value to be a BINDING TARGET (identifier, or a
 * nested `{`/`[` pattern, with an optional default) terminated by `,` or `}`,
 * which is what a destructuring pattern looks like and what a constructed value
 * usually does not. Residual known imprecision, declared not discovered: a
 * SINGLE-MEMBER inline type (`{ goal_probability: number }`) still matches,
 * because it is textually identical to a renamed destructure. Such a line is a
 * structural re-declaration of an owned field, which is itself worth seeing.
 */
export function patternsFor(fields: readonly string[]): {
  member: RegExp
  destructure: RegExp
  renamed: RegExp
  computed: RegExp
} {
  const alt = fields.map(escapeRe).join('|')
  return {
    /** `x.field`, `x?.field` */
    member: new RegExp(`\\b[\\w$)\\]]+\\??\\.(${alt})\\b`),
    /** `{ field }`, `{ field, ` — family 1's shape, kept verbatim. */
    destructure: new RegExp(`[{,]\\s*(${alt})\\s*[,}]`),
    /** `{ field: alias }`, `{ field: alias = 0 }`, `{ field: { nested } }` */
    renamed: new RegExp(`[{,]\\s*(${alt})\\s*:\\s*(?:[{[]|[A-Za-z_$][\\w$]*)\\s*(?:=[^,}]*)?[,}]`),
    /** `x['field']`, `x["field"]`, x[\`field\`] */
    computed: new RegExp(`\\[\\s*['"\`](${alt})['"\`]\\s*\\]`),
  }
}

/**
 * SANCTIONED CHAIN, carried over from the family-1 tripwire and load-bearing:
 * without it the driver-influence family alone emits ~7 false reds on code that
 * is already correct (the canonical `displayInfluence ?? raw ?? raw` chain).
 *
 * A read is sanctioned when the owner's `callInstead` symbol appears EARLIER on
 * the same line, or trails the previous line as a `??` chain. A family with no
 * owner (`callInstead: null`) sanctions NOTHING — by construction there is no
 * compliant chain to sanction.
 */
export function isSanctioned(lines: string[], i: number, at: number, fam: Family): boolean {
  if (fam.callInstead === null) return false
  const before = lines[i].slice(0, at)
  if (before.includes(fam.callInstead)) return true
  // A presence probe is not a decision (same exemption the ESLint rule takes).
  if (/typeof\s+$/.test(before)) return true
  const prev = i > 0 ? lines[i - 1] : ''
  return new RegExp(`${escapeRe(fam.callInstead)}[^]*\\?\\?\\s*$`).test(prev.trimEnd())
}

/**
 * One raw read: which registered field, on which line, in what text.
 *
 * THE IDENTITY OF A READ IS (field, canonical text) — NOT the line number.
 * This is the deliberate INVERSE of the typecheck gate's dedup key, and the
 * inversion is the whole point. `tsc` emits diagnostics whose POSITION is
 * stable and whose WORDING is not (union members re-order between programs), so
 * that gate keys on file+line+column+code. This walker scans SOURCE, where the
 * opposite holds: the text of a read is byte-stable at a commit, while its line
 * number moves every time anything above it is edited. Keying an item on the
 * line here would manufacture churn on every unrelated edit — the same phantom
 * signal #506 removed, arrived at from the other direction.
 */
export interface Hit {
  /** 1-based line number. For the human failure message ONLY; not the identity. */
  line: number
  /** Which of `fam.rawFields` this read names. Part of the identity. */
  field: string
  /** The source line, whitespace-canonicalised. Part of the identity. */
  text: string
  /** The source line as written, trimmed. For the failure message. */
  raw: string
}

/**
 * Whitespace-canonicalised so that re-indentation (a Prettier reflow, a change
 * of nesting depth) is not reported as a new read. Also guarantees the text
 * carries no TAB, which is what the identities file uses as its separator.
 */
export function canonicaliseHitText(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

/** The failure-message rendering, unchanged from the shape callers expect. */
export function renderHit(h: Hit): string {
  return `L${h.line}: ${h.raw}`
}

/**
 * Raw reads of a family's fields in one file's source.
 *
 * Comments are stripped first, via the SHARED
 * `tests/helpers/stripSourceComments` — a commented-out
 * `// return prob.goal_probability` must not redden CI (the #385/#386 footgun),
 * and the stripper is imported rather than copied because a second hand-kept
 * copy of a state machine is the defect class this whole instrument exists for.
 * String and TEMPLATE literals are kept as CODE, deliberately: a real
 * `${prob.goal_probability}` interpolation renders, and the quoted-computed-key
 * pattern below needs the string body to survive.
 *
 * AT MOST ONE HIT PER LINE, which is an UNDER-count and is declared as such in
 * `UNDETECTABLE`: two raw reads on one line count once, so adding a second read
 * to a line that already has one moves no number anywhere. The identities file
 * narrows that hole (a second FIELD on an existing line is a new item) but does
 * not close it for a second read of the SAME field on the same line.
 */
export function findReads(src: string, rel: string, fam: Family): Hit[] {
  const p = patternsFor(fam.rawFields)
  const stripped = stripComments(src, rel).split('\n')
  const rawLines = src.split('\n')
  const hits: Hit[] = []
  for (let i = 0; i < stripped.length; i++) {
    const line = stripped[i]
    const at = (field: string): Hit => ({
      line: i + 1,
      field,
      text: canonicaliseHitText(rawLines[i]),
      raw: rawLines[i].trim(),
    })
    const m = p.member.exec(line)
    if (m && !isSanctioned(stripped, i, m.index, fam)) {
      hits.push(at(m[1]))
      continue
    }
    // Same predicates, same precedence as before; `exec` rather than `test`
    // only so the matched FIELD is recoverable for the identities file.
    const other = p.destructure.exec(line) ?? p.renamed.exec(line) ?? p.computed.exec(line)
    if (other) hits.push(at(other[1]))
  }
  return hits
}

/**
 * In-file, at-the-site producer exemption. There is NO central allowlist.
 *
 * Family 1 maps path → attestation regex in the spec. That is good — a rotted
 * attestation kills its own exemption — but it has a hole the in-file form does
 * not: if an allowlisted file is DELETED or RENAMED its entry simply matches
 * nothing, forever, silently. An in-file marker cannot outlive its file. It
 * also puts the exemption in the diff of the PR that needs it, where review
 * happens, instead of in a file nobody opens.
 *
 * A bare marker is not an exemption: the rationale must be substantive.
 */
export function producerAttestation(src: string, family: string): string | null {
  // `(?![\w-])` rather than `\b`: family names contain hyphens, and `\b` would
  // let an attestation for `goal-probability-v2` also exempt `goal-probability`
  // — one family silently inheriting another's exemption.
  const re = new RegExp(
    `@claim-producer\\s+${escapeRe(family)}(?![\\w-])([^]*?)(?:\\*/|@claim-producer)`,
    'm',
  )
  const m = re.exec(src)
  if (!m) return null
  const rationale = (/@rationale\s+([^]*?)(?:\*\/|$)/.exec(m[1])?.[1] ?? '').trim()
  return rationale.length >= 40 ? rationale : null
}

/**
 * One row of the walk.
 *
 * ⚠ AN EXEMPT ROW STILL CARRIES ITS COUNT, and that count is ratcheted exactly
 * like a violation's. This is a deliberate strengthening: attestation is
 * per-FILE, so a bare "this file is exempt" flag would make a 3,000-line mapper
 * a free-for-all — any future raw read added there would be invisible. Recording
 * the number of reads the attestation SUPPRESSES means a new one is still a RED,
 * and the attestation buys only what it was reviewed for.
 */
export interface Row {
  family: string
  rel: string
  /** Raw reads found. For an exempt row, the count the attestation suppresses. */
  count: number
  /** True when an in-file `@claim-producer <family>` attestation covers the file. */
  exempt: boolean
}

/**
 * One raw read as the identities artefact records it. Deliberately carries NO
 * `exempt` flag: exemption is a property of the (family, file) row and is
 * already recorded, once, in the count baseline. Recording it twice would be a
 * second place for it to drift.
 */
export interface Item {
  family: string
  rel: string
  field: string
  text: string
}

export interface WalkResult {
  rows: Row[]
  /** `${family}\t${rel}` → the offending lines, for the failure message. */
  detail: Map<string, string[]>
  /** Every hit, flattened. The SET the count ratchet cannot see. */
  items: Item[]
}

/** Walk every production file for every discovered family. */
export function walk(families: Family[], prod: string[]): WalkResult {
  const rows: Row[] = []
  const detail = new Map<string, string[]>()
  const items: Item[] = []

  for (const fam of families) {
    const fieldRe = new RegExp(fam.rawFields.map(escapeRe).join('|'))
    for (const rel of prod) {
      if (rel === fam.ownerRel) continue
      const src = readFileSync(join(REPO_ROOT, rel), 'utf8')
      if (!fieldRe.test(src)) continue // cheap prefilter
      const hits = findReads(src, rel, fam)
      const exempt = producerAttestation(src, fam.family) !== null
      if (hits.length === 0 && !exempt) continue
      rows.push({ family: fam.family, rel, count: hits.length, exempt })
      if (hits.length > 0) detail.set(`${fam.family}\t${rel}`, hits.map(renderHit))
      for (const h of hits) items.push({ family: fam.family, rel, field: h.field, text: h.text })
    }
  }

  rows.sort((a, b) => a.family.localeCompare(b.family) || a.rel.localeCompare(b.rel))
  return { rows, detail, items }
}

// ─────────────────────────────────────────────────────────────────────────────
// THE RATCHET.
//
// ⚠ THIS HEADER PREVIOUSLY SAID the rules were "copied from
// scripts/ci/typecheck-gate.sh, WHICH HAS ALREADY SURVIVED THIS CRITIQUE".
// That was false when it was written, and it was load-bearing: it invited every
// reader to stop checking. #506 landed the same day as this walker and found
// TWO defects in the gate whose survival was being cited —
//   (1) `sort -u` deduplicating on RENDERED diagnostic text that the producer
//       renders differently between runs, so one error was baselined twice; and
//   (2) per-file counts that were documented as closing the intra-baseline swap
//       hole and do not: a fix-N-add-N inside ONE file moves no count. 37 real
//       diagnostics landed green through it, measured.
// Inheritance of both was then checked HERE rather than assumed. What was
// actually verified, and how, is recorded below.
//
// DEFECT 1 — NOT INHERITED, by construction. This walker performs no
// deduplication at all, and its row identity is (family, repo-relative path):
// structural facts from the registration and from `git ls-files`, not text any
// producer renders. Its unit of count is a source LINE read off disk, which is
// byte-stable at a commit. It is already keyed the way #506 had to move the
// typecheck gate.
//
// DEFECT 2 — INHERITED, and now closed as far as counting can close it.
// Measured by injection against the real gate at 13cca490: replacing one raw
// read with another inside a single already-baselined file left every row
// identical and the gate GREEN, for a different-field swap AND for a same-field
// swap. So this file now generates a SECOND artefact, and the pair is
// cross-checked on every run so it fails loud rather than rotting into
// disagreement:
//
//   claim-drift-baseline.tsv    per (family, file) counts        BLOCKING
//   claim-drift-identities.tsv  per (family, file, field) counts BLOCKING
//                               the item SET, by canonical text  REPORTED
//
// WHAT THAT GUARANTEES, AND WHAT IT DOES NOT — state both, per #506's lesson.
// The field bucket closes the within-file swap that changes WHICH owned field
// is read. A within-file swap of the SAME field — delete one `elasticity` read,
// add another `elasticity` read — moves no count in either artefact and is
// invisible to ANY count-based ratchet by construction. It is REPORTED, not
// blocked, and for the reason #506 established: the report's key includes
// source text, text moves under reformatting, and a heuristic belongs where its
// drift costs noise rather than a red build.
//
// Both properties the old header claimed, kept and still true of both
// artefacts: generator-written only; BIDIRECTIONAL (a stale row or bucket is
// RED, so a baseline cannot rot into a green lie); and header totals
// cross-checked against the row sums, so a hand-edited number cannot loosen
// either gate without touching the rows.
//
// The gate whose rules these are now proves its own discrimination in
// `scripts/ci/typecheck-gate-selftest.sh`, which drives it through seven
// scenarios including the dedup key and the within-file swap, each with a
// mutant. The equivalents for this instrument are the swap controls and their
// mutants in `src/test/__tests__/claim-ownership.drift.spec.ts`. Cite those, not
// a claim that some other gate has been reviewed enough.
// ─────────────────────────────────────────────────────────────────────────────

export interface Baseline {
  rows: Row[]
  declaredCount: number
  declaredExemptions: number
  declaredSuppressed: number
}

const EXEMPT_PREFIX = 'exempt:'

/** `5` for a violation row, `exempt:5` for an attested producer row. */
function renderCell(r: Row): string {
  return r.exempt ? `${EXEMPT_PREFIX}${r.count}` : String(r.count)
}

/** Serialise the walk as the baseline file's exact bytes. */
export function renderBaseline(rows: Row[]): string {
  const total = rows.filter((r) => !r.exempt).reduce((s, r) => s + r.count, 0)
  const exemptRows = rows.filter((r) => r.exempt)
  const exemptions = exemptRows.length
  const suppressed = exemptRows.reduce((s, r) => s + r.count, 0)
  const body = rows.map((r) => `${renderCell(r)}\t${r.family}\t${r.rel}`).join('\n')
  return (
    [
      '# Claim-ownership drift baseline — PER-FAMILY, PER-FILE raw-read counts.',
      `# Generated by: ${UPDATE_COMMAND}`,
      '# Consumed by:  src/test/__tests__/claim-ownership.drift.spec.ts, which runs in',
      '#               the full vitest suite and therefore in the required "Staging Gate".',
      '#',
      '# These are PRE-EXISTING re-derivation sites, frozen so the instrument can police',
      '# the WHOLE tree today without a big-bang migration first. They are not hidden and',
      '# not tolerated: the gate FAILS on a new site, on a higher count for an existing',
      '# site, on a STALE row (a site that is now clean — fix it and regenerate), and on',
      '# an exemption that is not already recorded here.',
      '#',
      '# SHRINK-ONLY. There is no env var and no silent bypass. To accept a change,',
      `# regenerate in the same PR with \`${UPDATE_COMMAND}\` and say so in the PR body.`,
      '#',
      '# Format: <count|exempt:count><TAB><family><TAB><path>, sorted by family then path.',
      '# `exempt:` rows are files carrying an in-file `@claim-producer <family>` marker',
      '# with a rationale — recorded individually, not as an opaque counter, so granting',
      '# oneself an exemption is a visible NEW ROW in the diff. The number after the colon',
      '# is how many raw reads that attestation SUPPRESSES, and it is ratcheted exactly',
      '# like a violation count: attestation is per-FILE, so without it an attested mapper',
      '# would be a free-for-all in which the next raw read is invisible.',
      `# count=${total}`,
      `# exemptions=${exemptions}`,
      `# suppressed=${suppressed}`,
    ].join('\n') + `\n${body}\n`
  )
}

/** Parse the baseline. Malformed input is rejected, never treated as absent. */
export function parseBaseline(text: string): Baseline {
  const lines = text.split('\n')

  const header = (name: string): number => {
    const found = lines.filter((l) => new RegExp(`^\\s*#\\s*${name}=`).test(l))
    if (found.length !== 1) {
      throw new Error(
        `Baseline must have exactly one '# ${name}=<N>' header (found ${found.length}).`,
      )
    }
    const n = Number(found[0].replace(new RegExp(`.*${name}=`), '').trim())
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`Baseline '# ${name}=' must be a non-negative integer.`)
    }
    return n
  }

  const declaredCount = header('count')
  const declaredExemptions = header('exemptions')
  const declaredSuppressed = header('suppressed')

  const rows: Row[] = []
  for (const line of lines) {
    if (/^\s*(#|$)/.test(line)) continue
    const parts = line.split('\t')
    if (parts.length !== 3 || !parts[1] || !parts[2]) {
      throw new Error(
        `Malformed baseline row (expected '<count|exempt:count><TAB><family><TAB><path>'): ${line}`,
      )
    }
    const [cell, family, rel] = parts
    const exempt = cell.startsWith(EXEMPT_PREFIX)
    const digits = exempt ? cell.slice(EXEMPT_PREFIX.length) : cell
    if (!/^\d+$/.test(digits)) {
      throw new Error(
        `Malformed baseline count (expected digits, optionally '${EXEMPT_PREFIX}'-prefixed): ${line}`,
      )
    }
    rows.push({ family, rel, count: Number(digits), exempt })
  }

  // Cross-check every header against the rows it claims to summarise, so a
  // hand-edited number cannot loosen the gate without touching the rows.
  const check = (name: string, declared: number, actual: number): void => {
    if (declared !== actual) {
      throw new Error(
        `Baseline is internally inconsistent: '# ${name}=${declared}' but the rows give ${actual}. ` +
          `Regenerate with \`${UPDATE_COMMAND}\` instead of editing by hand.`,
      )
    }
  }
  const exemptRows = rows.filter((r) => r.exempt)
  check('count', declaredCount, rows.filter((r) => !r.exempt).reduce((s, r) => s + r.count, 0))
  check('exemptions', declaredExemptions, exemptRows.length)
  check('suppressed', declaredSuppressed, exemptRows.reduce((s, r) => s + r.count, 0))

  return { rows, declaredCount, declaredExemptions, declaredSuppressed }
}

const key = (r: Row): string => `${r.family}\t${r.rel}`

/**
 * The four ratchet rules. Rule 3 (stale rows) is the bidirectional half that
 * stops the baseline rotting into a green lie; rule 4 is what stops a rogue
 * consumer self-granting `@claim-producer` to walk out of the instrument.
 */
export function compareToBaseline(
  current: Row[],
  baseline: Baseline,
  detail: Map<string, string[]>,
  families: Family[],
): string[] {
  const callInstead = new Map(families.map((f) => [f.family, f.callInstead]))
  const base = new Map(baseline.rows.map((r) => [key(r), r]))
  const cur = new Map(current.map((r) => [key(r), r]))
  const failures: string[] = []

  for (const r of current) {
    const b = base.get(key(r))
    const chooser = callInstead.get(r.family)
    const advice = chooser
      ? `call ${chooser}() instead`
      : `family "${r.family}" has NO owner selector yet — its debt is FROZEN, so a new ` +
        `site is not admissible; attest it in-file as a @claim-producer if it genuinely ` +
        `produces the field`
    const lines = (detail.get(key(r)) ?? []).map((l) => `      ${l}`).join('\n')

    if (!b) {
      failures.push(
        r.exempt
          ? `+ NEW EXEMPTION  ${r.family}  ${r.rel}  (suppressing ${r.count} read(s))\n` +
            `    This file grants itself @claim-producer ${r.family} but is not in the baseline.\n` +
            `    Self-granting an exemption is not free: it lands as a reviewed row, with the\n` +
            `    number of reads it buys, and that number is ratcheted too.`
          : `+ NEW re-derivation site  ${r.family}  ${r.rel}  (${r.count} hit(s))\n${lines}\n` +
            `    → ${advice}.`,
      )
      continue
    }
    if (b.exempt !== r.exempt) {
      failures.push(
        r.exempt
          ? `! ${r.family}  ${r.rel}: this file has GAINED a @claim-producer attestation that ` +
            `the baseline does not record. An exemption must be reviewed, not assumed.`
          : `! ${r.family}  ${r.rel}: the @claim-producer attestation is gone (or its rationale ` +
            `is now too thin) — ${r.count} raw read(s) are no longer exempt.\n${lines}`,
      )
      continue
    }
    if (r.count > b.count) {
      failures.push(
        r.exempt
          ? `! MORE suppressed reads than the attestation was granted for  ${r.family}  ` +
            `${r.rel}: baseline ${b.count} → current ${r.count}\n${lines}\n` +
            `    → An attestation covers the reads it was reviewed for, not every future one.`
          : `! MORE reads than the baseline allows  ${r.family}  ${r.rel}: ` +
            `baseline ${b.count} → current ${r.count}\n${lines}\n    → ${advice}.`,
      )
    }
  }

  for (const b of baseline.rows) {
    if (!cur.has(key(b))) {
      failures.push(
        `- STALE row  ${b.family}  ${b.rel}\n` +
          `    The baseline still reserves ${b.count} ${b.exempt ? 'suppressed ' : ''}hit(s) ` +
          `here, but the walk finds no such file/reads (fixed, renamed, or deleted).\n` +
          `    This is the ratchet working: regenerate with \`${UPDATE_COMMAND}\` so the ` +
          `number goes DOWN and stays down.`,
      )
    }
  }

  return failures
}

// ─────────────────────────────────────────────────────────────────────────────
// THE ITEM BASELINE. What the count ratchet above cannot see.
// ─────────────────────────────────────────────────────────────────────────────

/** One recorded identity: N reads of `field`, all rendering as `text`. */
export interface IdentityRow {
  family: string
  rel: string
  field: string
  text: string
  count: number
}

export interface Identities {
  rows: IdentityRow[]
  declaredCount: number
  declaredIdentities: number
}

/** The BLOCKING bucket. Stable under reflow, under line moves, under renaming. */
const bucket = (r: { family: string; rel: string; field: string }): string =>
  `${r.family}\t${r.rel}\t${r.field}`

/** The REPORTED identity. Adds the text, which is what a same-field swap moves. */
const identity = (r: { family: string; rel: string; field: string; text: string }): string =>
  `${r.family}\t${r.rel}\t${r.field}\t${r.text}`

/**
 * Aggregate items into counted identity rows.
 *
 * COUNTED, not de-duplicated. Two identical reads on two lines of one file are
 * two reads, and collapsing them would under-count in exactly the direction
 * #506's Fix 1 over-counted. There is no `sort -u` anywhere in this instrument.
 */
export function aggregateItems(items: Item[]): IdentityRow[] {
  const byId = new Map<string, IdentityRow>()
  for (const it of items) {
    const k = identity(it)
    const prev = byId.get(k)
    if (prev) prev.count += 1
    else byId.set(k, { family: it.family, rel: it.rel, field: it.field, text: it.text, count: 1 })
  }
  // BYTE order, not `localeCompare`. Collation is locale- and ICU-version
  // dependent, and this artefact's last column is arbitrary source text full of
  // punctuation — precisely where two environments disagree. A generator whose
  // output ordering depends on the machine it ran on produces phantom diffs
  // with no defect behind them, which is #506's Fix 1 arriving by another road.
  const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0)
  return [...byId.values()].sort(
    (a, b) =>
      cmp(a.family, b.family) || cmp(a.rel, b.rel) || cmp(a.field, b.field) || cmp(a.text, b.text),
  )
}

/** Serialise the item set as the identities file's exact bytes. */
export function renderIdentities(items: Item[]): string {
  const rows = aggregateItems(items)
  const total = rows.reduce((s, r) => s + r.count, 0)
  const body = rows.map((r) => `${r.count}\t${r.family}\t${r.rel}\t${r.field}\t${r.text}`).join('\n')
  return (
    [
      '# Claim-ownership drift ITEM baseline — PER-FAMILY, PER-FILE, PER-FIELD raw reads.',
      `# Generated by: ${UPDATE_COMMAND}`,
      '# Consumed by:  src/test/__tests__/claim-ownership.drift.spec.ts, alongside',
      '#               claim-drift-baseline.tsv. The two are written in the SAME pass and',
      '#               cross-checked on every run, so the pair fails loud rather than',
      '#               rotting into disagreement.',
      '#',
      '# WHY A SECOND FILE. claim-drift-baseline.tsv counts per (family, file). A',
      '# fix-one-add-one INSIDE one file moves no such count, so a raw read can be',
      '# replaced by a different raw read with the gate staying green — measured by',
      '# injection at 13cca490, for a different-field swap and a same-field swap alike.',
      '# That is the hole #506 measured in the typecheck gate (37 diagnostics landed',
      '# through its equivalent), inherited here.',
      '#',
      '# WHAT BLOCKS: a new (family, file, FIELD) bucket, a bucket whose count rises,',
      '# or a STALE bucket the walk no longer finds. Bidirectional, like the counts.',
      '#',
      '# WHAT IS REPORTED BUT DOES NOT BLOCK: added/removed identities, where the',
      '# identity includes the canonicalised source TEXT. This is what makes a',
      '# SAME-field within-file swap visible at all — no count-based ratchet can see',
      '# one. It does not block because the text moves under reformatting, and a',
      '# heuristic belongs where its drift costs noise in a report, not a red build.',
      '#',
      '# Counted, never de-duplicated: two identical reads on two lines are two reads.',
      '# No `exempt` column — exemption is a property of the (family, file) row and is',
      '# recorded once, in claim-drift-baseline.tsv. Twice would be twice to drift.',
      '#',
      '# SHRINK-ONLY. No env var, no silent bypass. To accept a change, regenerate in',
      `# the same PR with \`${UPDATE_COMMAND}\` and say so in the PR body.`,
      '#',
      '# Format: <count><TAB><family><TAB><path><TAB><field><TAB><canonicalised source line>',
      `# count=${total}`,
      `# identities=${rows.length}`,
    ].join('\n') + `\n${body}\n`
  )
}

/** Parse the identities file. Malformed input is rejected, never treated as absent. */
export function parseIdentities(text: string): Identities {
  const lines = text.split('\n')

  const header = (name: string): number => {
    const found = lines.filter((l) => new RegExp(`^\\s*#\\s*${name}=`).test(l))
    if (found.length !== 1) {
      throw new Error(
        `Identities file must have exactly one '# ${name}=<N>' header (found ${found.length}).`,
      )
    }
    const n = Number(found[0].replace(new RegExp(`.*${name}=`), '').trim())
    if (!Number.isInteger(n) || n < 0) {
      throw new Error(`Identities '# ${name}=' must be a non-negative integer.`)
    }
    return n
  }

  const declaredCount = header('count')
  const declaredIdentities = header('identities')

  const rows: IdentityRow[] = []
  for (const line of lines) {
    if (/^\s*(#|$)/.test(line)) continue
    const parts = line.split('\t')
    if (parts.length !== 5 || parts.slice(1).some((p) => !p)) {
      throw new Error(
        `Malformed identities row (expected ` +
          `'<count><TAB><family><TAB><path><TAB><field><TAB><text>'): ${line}`,
      )
    }
    const [cell, family, rel, field, itemText] = parts
    if (!/^\d+$/.test(cell)) {
      throw new Error(`Malformed identities count (expected digits): ${line}`)
    }
    rows.push({ family, rel, field, text: itemText, count: Number(cell) })
  }

  const check = (name: string, declared: number, actual: number): void => {
    if (declared !== actual) {
      throw new Error(
        `Identities file is internally inconsistent: '# ${name}=${declared}' but the rows give ` +
          `${actual}. Regenerate with \`${UPDATE_COMMAND}\` instead of editing by hand.`,
      )
    }
  }
  check('count', declaredCount, rows.reduce((s, r) => s + r.count, 0))
  check('identities', declaredIdentities, rows.length)

  return { rows, declaredCount, declaredIdentities }
}

export interface IdentityComparison {
  /** Blocking. Per (family, file, field) — the sub-case a count CAN close. */
  failures: string[]
  /** Non-blocking. The item set — the only place a same-field swap shows up. */
  notices: string[]
}

/**
 * Compare the walked items against the frozen item baseline.
 *
 * Two tiers, deliberately, exactly as #506 shipped for the typecheck gate: a
 * cheap STABLE bucket that blocks, and a text-bearing SET that only reports.
 */
export function compareIdentities(current: Item[], baseline: Identities): IdentityComparison {
  const sum = (rows: Array<{ count: number }>): number => rows.reduce((s, r) => s + r.count, 0)

  const curRows = aggregateItems(current)
  const group = (rows: IdentityRow[]): Map<string, IdentityRow[]> => {
    const m = new Map<string, IdentityRow[]>()
    for (const r of rows) {
      const k = bucket(r)
      const list = m.get(k)
      if (list) list.push(r)
      else m.set(k, [r])
    }
    return m
  }
  const curBuckets = group(curRows)
  const baseBuckets = group(baseline.rows)

  const failures: string[] = []
  for (const [k, rows] of curBuckets) {
    const [family, rel, field] = k.split('\t')
    const b = baseBuckets.get(k)
    const now = sum(rows)
    if (!b) {
      failures.push(
        `+ NEW raw-read field  ${family}  ${rel}  field "${field}" (${now} read(s))\n` +
          rows.map((r) => `      ${r.count}× ${r.text}`).join('\n') +
          `\n    → This file is already in the count baseline, so swapping one owned field\n` +
          `      for another inside it moves no per-file count. That is the hole this\n` +
          `      artefact exists to close.`,
      )
      continue
    }
    const was = sum(b)
    if (now > was) {
      failures.push(
        `! MORE reads of one field than the baseline allows  ${family}  ${rel}  ` +
          `field "${field}": baseline ${was} → current ${now}\n` +
          rows.map((r) => `      ${r.count}× ${r.text}`).join('\n'),
      )
    }
  }
  for (const [k, rows] of baseBuckets) {
    if (curBuckets.has(k)) continue
    const [family, rel, field] = k.split('\t')
    failures.push(
      `- STALE raw-read field  ${family}  ${rel}  field "${field}"\n` +
        `    The item baseline still reserves ${sum(rows)} read(s) of this field here, but\n` +
        `    the walk finds none. Regenerate with \`${UPDATE_COMMAND}\` so the number goes\n` +
        `    DOWN and stays down.`,
    )
  }

  // ── The non-blocking half. A same-field swap lives ONLY here. ──
  const notices: string[] = []
  const curById = new Map(curRows.map((r) => [identity(r), r]))
  const baseById = new Map(baseline.rows.map((r) => [identity(r), r]))
  for (const [k, r] of curById) {
    const b = baseById.get(k)
    if (!b) notices.push(`+ ${r.count}\t${r.family}\t${r.rel}\t${r.field}\t${r.text}`)
    else if (r.count > b.count) notices.push(`~ ${b.count} → ${r.count}\t${k}`)
  }
  for (const [k, b] of baseById) {
    const r = curById.get(k)
    if (!r) notices.push(`- ${b.count}\t${k}`)
    else if (r.count < b.count) notices.push(`~ ${b.count} → ${r.count}\t${k}`)
  }
  notices.sort()

  return { failures, notices }
}

/**
 * The two artefacts must agree about how many reads each (family, file) holds.
 *
 * Generated in one pass from one walk, so a disagreement means one of them was
 * hand-edited or a generator half-ran. Either way the pair must fail LOUD: a
 * baseline that silently disagrees with its own detail is the green-lie shape
 * both files exist to prevent.
 */
export function crossCheckArtefacts(rows: Row[], identityRows: IdentityRow[]): string[] {
  const perRow = new Map<string, number>()
  for (const r of rows) perRow.set(`${r.family}\t${r.rel}`, r.count)
  const perItems = new Map<string, number>()
  for (const r of identityRows) {
    const k = `${r.family}\t${r.rel}`
    perItems.set(k, (perItems.get(k) ?? 0) + r.count)
  }
  const problems: string[] = []
  for (const [k, n] of perRow) {
    const m = perItems.get(k) ?? 0
    if (n !== m) {
      problems.push(
        `${k.replace('\t', '  ')}: claim-drift-baseline.tsv says ${n} read(s), ` +
          `claim-drift-identities.tsv accounts for ${m}.`,
      )
    }
  }
  for (const [k, m] of perItems) {
    if (!perRow.has(k)) {
      problems.push(
        `${k.replace('\t', '  ')}: claim-drift-identities.tsv records ${m} read(s) for a ` +
          `(family, file) that claim-drift-baseline.tsv does not list at all.`,
      )
    }
  }
  return problems.sort()
}
