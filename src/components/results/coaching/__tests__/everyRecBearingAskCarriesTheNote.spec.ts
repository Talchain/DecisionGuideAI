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
function askPayloads(): Array<{ file: string; body: string }> {
  const found: Array<{ file: string; body: string }> = []
  for (const file of walk(SRC)) {
    const raw = readFileSync(file, 'utf8')
    if (!raw.includes('openAskOlumi(') && !raw.includes('.openAsk(')) continue
    if (file.endsWith('askOlumiStore.ts')) continue // the definition, not a caller
    const src = stripComments(raw)
    const re = /(?:openAskOlumi|\.openAsk)\(\s*\{/g
    let m: RegExpExecArray | null
    while ((m = re.exec(src)) !== null) {
      // Balance braces from the opening `{` to capture the whole payload.
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
      found.push({ file: file.replace(SRC, 'src'), body: src.slice(start, i + 1) })
    }
  }
  return found
}

/** A payload is rec-bearing if it reads fields off a recommendation. */
const REC_BEARING = /\brec(?:ommendation)?\.(whyNow|signal|title|action|targetId|tryThis|helpType|sourceLine)\b/

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
