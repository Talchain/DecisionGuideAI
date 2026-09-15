/**
 * ⭐⭐⭐ THE UI RENDERS THE DATA. IT DOES NOT DECIDE WHAT IT MEANS.
 *
 * Founder's rule, 15 Sep 2026: *"every piece of data displayed should be a true
 * representation of it. If it's wrong, it's the CEE's job to correct it or
 * inform the user."*
 *
 * Sharpened with Panel, because the Reasoning tab's product IS sentences:
 * **the UI's words may be SELECTED BY A PRODUCER FIELD, BY IDENTITY — never
 * COMPUTED FROM THE NUMBERS.**
 *
 * This is a RATCHET, not a clean gate. 34 places already do it, and they are
 * baselined rather than fixed in one pass — the point today is that the number
 * cannot GROW while we work through it. What the scanner found on its first
 * honest run:
 *
 *   `absValue <= 0.9`    → "Very strong — few real-world factors have this much influence"
 *   `qualityScore >= 0.7`→ "Ready to Review"
 *   `belief <= 0.39`     → "Low confidence — analysis will treat this link as uncertain"
 *   `overlapRatio > 0.8` → "Options … may not represent different strategies"
 *
 * A claim about the real world, and a verdict on whether the model is ready,
 * both authored by a threshold the UI chose.
 *
 * ⚠ IT IS A SCANNER, NOT A PROOF. It finds ONE shape — prose selected by a
 * numeric or relational comparison on a render surface. It cannot see a claim
 * computed three functions away, and it cannot tell a true sentence from a
 * false one. A clean run means this shape is absent, nothing more. Two earlier
 * cuts returned 305 and 127 and were useless; the exclusions (self-observation,
 * input validation, markup) are named in the scanner so they can be argued
 * with rather than trusted.
 */
import { describe, it, expect } from 'vitest'
import { execFileSync } from 'node:child_process'
import { readFileSync, existsSync } from 'node:fs'

const SCANNER = 'scripts/ci/uiRendersItDoesNotDecide.mjs'
const BASELINE = 'scripts/ci/ui-decides-baseline.txt'

/** The baseline, minus the reasons it now carries. */
function baselineSites(): string[] {
  return readFileSync(BASELINE, 'utf8')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#'))
}

function currentSites(): string[] {
  const out = execFileSync('node', [SCANNER, '--json'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
  return (JSON.parse(out) as Array<{ file: string; line: number }>)
    .map(v => `${v.file}:${v.line}`)
    .sort()
}

describe('the UI renders the data; it does not decide what it means', () => {
  it('the scanner and its baseline both exist — the precondition, pinned', () => {
    expect(existsSync(SCANNER), 'the scanner is gone').toBe(true)
    expect(existsSync(BASELINE), 'the baseline is gone').toBe(true)
    // ⛔ An empty baseline would make every assertion below vacuous.
    expect(readFileSync(BASELINE, 'utf8').trim().length).toBeGreaterThan(0)
  })

  /**
   * ⚠ THE BASELINE CARRIES ITS OWN REASONS NOW, so the parser has to strip
   * them — and a parser that silently dropped a real line would quietly widen
   * what counts as "not new". Pinned here rather than assumed.
   */
  it('the baseline parser keeps every site and drops every comment', () => {
    const raw = readFileSync(BASELINE, 'utf8')
    expect(raw).toContain('#')
    const parsed = baselineSites()
    expect(parsed.length, 'the parser dropped everything').toBeGreaterThan(5)
    expect(parsed.every(l => !l.startsWith('#')), 'a comment survived').toBe(true)
    expect(parsed.every(l => /:\d+$/.test(l)), 'a line that is not a site survived').toBe(true)
    // ⛔ Contrast: the count must match the non-comment, non-blank lines exactly.
    const byHand = raw.split('\n').filter(l => l.trim() && !l.trim().startsWith('#')).length
    expect(parsed.length).toBe(byHand)
  })

  /**
   * ⭐⭐ THE HOP IS REAL, AND SO IS ITS LIMIT — the discriminating pair for the
   * 15 Sep widening, bound to two NAMED sites rather than to a count.
   *
   * A count would pass on a scanner that had started matching something else
   * entirely. These two cases are the whole argument: one helper-authored
   * verdict that MUST be seen, and one helper-authored range check that MUST
   * NOT be, in a file that contributes a dozen of them.
   */
  it('⭐ it reaches a verdict AUTHORED IN A HELPER — the reason the hop exists', () => {
    const sites = new Set(currentSites())
    // `jointProbabilityLabel`: "Meets all targets" from `probability >= 0.40`,
    // rendered by OptionCards. Invisible to the four render roots, because only
    // the CALL appears there.
    expect(
      [...sites].some(s => s.startsWith('src/types/constraints.ts:')),
      'the helper hop stopped reaching src/types — the widening is inert',
    ).toBe(true)
  })

  it('⛔ CONTRAST: it does NOT report a range check between two runtime values', () => {
    const sites = [...new Set(currentSites())]
    // `params.curvature < constraints.curvature.min` → "Curvature must be
    // between … and …". Input validation echoing a declared range: the UI chose
    // no number. `canvas/domain/edges.ts` carries about a dozen of these, and
    // reporting them would bury the five real influence bands in the SAME FILE.
    const edgeValidation = sites.filter(s => /^src\/canvas\/domain\/edges\.ts:1[0-9]{3}$/.test(s))
    expect(
      edgeValidation,
      'range checks are being reported as verdicts — the report becomes a number nobody acts on',
    ).toEqual([])
    // ⛔ …and the same FILE must still be reported for its real bands, or this
    // contrast would be satisfied by excluding the file wholesale.
    expect(
      sites.some(s => /^src\/canvas\/domain\/edges\.ts:7[0-9]{2}$/.test(s)),
      'the influence bands went missing with the validation noise',
    ).toBe(true)
  })

  it('⭐ no NEW place turns a producer number into words', () => {
    const baseline = new Set(baselineSites())
    const added = currentSites().filter(s => !baseline.has(s))
    expect(added, `new UI-authored claims:\n  ${added.join('\n  ')}`).toEqual([])
  })

  /**
   * ⛔ THE OTHER DIRECTION, AND IT IS NOT DECORATION. A baseline that only
   * catches growth lets the file rot: sites get deleted or moved, the list
   * drifts, and one day the ratchet is guarding nothing. Shrinking is the
   * GOAL — so it must be recorded deliberately, not absorbed silently.
   */
  it('⛔ and when a place is FIXED, the baseline must be regenerated deliberately', () => {
    const baseline = baselineSites()
    const current = new Set(currentSites())
    const gone = baseline.filter(s => !current.has(s))
    expect(
      gone,
      `${gone.length} site(s) no longer offend — good. Regenerate:\n` +
        `  node ${SCANNER} --json | ... > ${BASELINE}\n  ${gone.join('\n  ')}`,
    ).toEqual([])
  })
})
