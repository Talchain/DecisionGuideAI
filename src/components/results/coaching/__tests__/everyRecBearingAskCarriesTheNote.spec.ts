/**
 * EVERY ASK ROUTE THAT HOLDS A RECOMMENDATION CARRIES ITS NOTE — DERIVED, NOT LISTED.
 *
 * ⚠ THIS GUARD EXISTS BECAUSE I GOT THE ENUMERATION WRONG THREE TIMES IN ONE
 * NIGHT. First I wired one route and called the class closed; a reviewer found
 * a second and third on a sibling surface; a later reviewer found a FOURTH in
 * the parent component of the file I had just fixed. Each time the fix was
 * correct and the LIST was short, and each time a per-route test was written
 * that could not have caught the next omission.
 *
 * So this does not list routes. It DERIVES them: any `openAskOlumi({…})` whose
 * payload reads from a `rec`/`recommendation` is a rec-bearing ask route, and
 * must pass `attentionNote`. A fifth route added without one REDs here on the
 * day it lands, which a per-route test cannot do (CLAUDE.md trap 12 — derive,
 * don't mirror, and where you cannot derive, fail loud).
 *
 * ⛔ WHAT THIS GUARD CANNOT SEE, STATED SO NOBODY OVER-TRUSTS IT. The
 * rec-bearing predicate matches MEMBER ACCESS (`rec.whyNow`). A route that
 * DESTRUCTURED (`const { whyNow } = rec`) or ALIASED to an unrecognised name
 * would be invisible to it, and the guard would report the class closed while
 * it was not — the precise failure this file exists to end, one level up.
 *
 * Measured at this SHA, with controls: **no such route exists today** — zero
 * destructuring-from-a-rec and zero aliasing at any opener file, against a
 * contrast of 154 files in `src/components/results/**` that DO destructure
 * (so the probe is not blind) and a fabricated-symbol negative control at 0.
 * That is a fact about today, not a property of the guard.
 *
 * ⭐ THE DESTRUCTURED AND ALIASED FORMS ARE NOW CLOSED by the second
 * alternation in `REC_BEARING`. What remains open, and cannot be closed by any
 * predicate: a payload built in a VARIABLE and passed by reference
 * (`const p = {…}; openAskOlumi(p)`) is invisible by construction, because the
 * capture requires a literal `{` at the call.
 *
 * ⚠⚠ AND THE PLACE A SIXTH ROUTE WOULD ACTUALLY APPEAR, named by the review
 * that found it: `ModelStrip` is rec-derived IN SUBSTANCE — it renders
 * `finding.title` / `finding.tryThis` and opens the drawer with a `targetId` —
 * and is excluded only because its view-model type drops the fields. **If
 * `NodeInsightFinding` ever gains `helpType`, this guard binds to the
 * identifier NAME, not the shape, so it would still not fire.** A lane
 * widening that type must wire the note itself; the guard will not remind it.
 *
 * ⚠ COMMENTS ARE STRIPPED BEFORE MATCHING, and that is not defensive noise:
 * these files are heavily commented and several comments mention both
 * `attentionNote` and `rec.`, so an unstripped scan would pass by reading
 * prose about the thing instead of the thing. That is the exact vacuity this
 * repo has shipped before in `*.sourceScan.spec.ts`.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const SRC = join(process.cwd(), 'src')

/** Strip block and line comments so prose cannot satisfy a match. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) {
      if (entry === '__tests__' || entry === 'node_modules') continue
      walk(p, out)
    } else if (/\.tsx?$/.test(entry) && !/\.spec\.|\.test\./.test(entry)) {
      out.push(p)
    }
  }
  return out
}

/** Every `openAskOlumi({ … })` payload in product code, comments removed. */
/** The payload extractor, exposed so its brace-balancing can be tested directly. */
export function extractPayloads(src0: string): string[] {
  const src = stripComments(src0)
  const out: string[] = []
  const re = /(?:openAskOlumi|\.openAsk)\(\s*\{/g
  let m: RegExpExecArray | null
  while ((m = re.exec(src)) !== null) {
    let depth = 0
    let i = m.index + m[0].length - 1
    const start = i
    for (; i < src.length; i++) {
      if (src[i] === '{') depth++
      else if (src[i] === '}') {
        depth--
        if (depth === 0) break
      }
    }
    out.push(src.slice(start, i + 1))
  }
  return out
}

function askPayloads(): Array<{ file: string; body: string }> {
  const found: Array<{ file: string; body: string }> = []
  for (const file of walk(SRC)) {
    const raw = readFileSync(file, 'utf8')
    if (!raw.includes('openAskOlumi(') && !raw.includes('.openAsk(')) continue
    if (file.endsWith('askOlumiStore.ts')) continue // the definition, not a caller
    // ⚠ ONE extractor, not two. An earlier draft of this file duplicated the
    // brace-balancing here and exported a second copy for the tests to
    // exercise — so the tests would have proven a copy the guard did not use,
    // and the two could drift silently. That is CLAUDE.md trap 12 committed
    // inside a guard written to end a different instance of it.
    for (const body of extractPayloads(raw)) {
      found.push({ file: file.replace(SRC, 'src'), body })
    }
  }
  return found
}

/**
 * A payload is rec-bearing if it reads fields off a recommendation.
 *
 * TWO ALTERNATIONS, AND THE SECOND ONE'S MEMBERSHIP IS THE WHOLE DESIGN.
 * The first matches MEMBER ACCESS (`rec.whyNow`). The second matches BARE
 * IDENTIFIERS, closing the destructured (`const { whyNow } = rec`) and aliased
 * (`const finding = record.snapshot`) forms that an earlier version of this
 * guard was blind to — measured blind, by a review that injected both.
 *
 * ⚠ `title`, `action`, `targetId` and `signal` are DELIBERATELY EXCLUDED from
 * the bare-identifier alternation. They are generic enough to appear in
 * payloads that hold no recommendation, and a guard that fires on innocent
 * changes gets disabled — which costs more than the false negatives it closes.
 * The four kept are recommendation-specific vocabulary. Measured: GREEN on the
 * pristine tree, GREEN on an innocent route carrying `targetId`, RED on both
 * the destructured and aliased forms.
 */
const REC_BEARING =
  /\brec(?:ommendation)?\.(whyNow|signal|title|action|targetId|tryThis|helpType|sourceLine)\b|\b(?:whyNow|tryThis|sourceLine|helpType)\b/

describe('every rec-bearing ask route carries the producer\'s note', () => {
  const payloads = askPayloads()

  it('the scan found ask routes at all — otherwise every assertion below is vacuous', () => {
    // Trap 13: an absence assertion over an empty corpus passes by testing
    // nothing. Bound loosely on purpose; the point is non-zero, not a count
    // that decays (two earlier drafts of a sibling comment quoted counts and
    // both were wrong).
    expect(payloads.length).toBeGreaterThan(5)
  })

  it('the scan can SEE a rec-bearing payload — positive control', () => {
    const recBearing = payloads.filter((p) => REC_BEARING.test(p.body))
    expect(
      recBearing.length,
      'no payload matched the rec-bearing predicate — the guard below cannot discriminate',
    ).toBeGreaterThan(0)
  })

  it('comments cannot satisfy the match — the stripper is proven, not assumed', () => {
    const withProse = 'const x = 1 /* openAskOlumi({ context: rec.whyNow }) */'
    expect(stripComments(withProse)).not.toContain('rec.whyNow')
    // …and it must NOT strip real code, or the guard would pass by blindness.
    expect(stripComments('openAskOlumi({ context: rec.whyNow })')).toContain('rec.whyNow')
  })

  it('the extractor survives NESTED payloads, in both directions', () => {
    // `parameters: { method_id }` is real in this codebase, so a brace counter
    // that stopped at the first `}` would truncate the payload BEFORE
    // `attentionNote` and report a compliant route as a violation. A guard
    // that cries wolf gets disabled, which is worse than no guard.
    const withNote = extractPayloads(
      'openAskOlumi({ context: rec.whyNow, parameters: { a: { b: 1 } }, attentionNote: n })',
    )
    expect(withNote).toHaveLength(1)
    expect(withNote[0]).toContain('attentionNote')

    const withoutNote = extractPayloads(
      'openAskOlumi({ context: rec.whyNow, parameters: { a: { b: 1 } } })',
    )
    expect(withoutNote).toHaveLength(1)
    expect(withoutNote[0]).not.toContain('attentionNote')
  })

  it('one call cannot absorb a NEIGHBOUR\'s note — the masking failure', () => {
    // The inverse of truncation: if the counter over-ran the closing brace, a
    // compliant call sitting after a violating one would supply the
    // `attentionNote` the scan is looking for, and the violation would pass.
    const two = extractPayloads(
      'openAskOlumi({ context: rec.whyNow }) ; openAskOlumi({ context: rec.title, attentionNote: n })',
    )
    expect(two).toHaveLength(2)
    expect(two[0], 'the first payload absorbed the second\'s note — violations would be masked')
      .not.toContain('attentionNote')
    expect(two[1]).toContain('attentionNote')
  })

  it('EVERY rec-bearing ask route passes attentionNote', () => {
    const offenders = payloads
      .filter((p) => REC_BEARING.test(p.body))
      .filter((p) => !/\battentionNote\b/.test(p.body))
      .map((p) => p.file)

    expect(
      [...new Set(offenders)],
      'an ask route reads a recommendation but sends no attentionNote, so the finding is ' +
        'left behind when the user follows it to the canvas. Pass ' +
        '`attentionNote: attentionNoteForRecommendation(rec)` — it returns null when there is ' +
        'nothing honest to say, which is the old behaviour.',
    ).toEqual([])
  })
})
