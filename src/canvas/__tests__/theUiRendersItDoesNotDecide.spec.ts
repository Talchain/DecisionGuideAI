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

  it('⭐ no NEW place turns a producer number into words', () => {
    const baseline = new Set(readFileSync(BASELINE, 'utf8').trim().split('\n'))
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
    const baseline = readFileSync(BASELINE, 'utf8').trim().split('\n')
    const current = new Set(currentSites())
    const gone = baseline.filter(s => !current.has(s))
    expect(
      gone,
      `${gone.length} site(s) no longer offend — good. Regenerate:\n` +
        `  node ${SCANNER} --json | ... > ${BASELINE}\n  ${gone.join('\n  ')}`,
    ).toEqual([])
  })
})
