/**
 * ⭐⭐ FIVE CONTEST-FRAME SURVIVORS OF #1281 — AND THE THREE DIFFERENT REASONS
 * THEY SURVIVED, WHICH MATTER MORE THAN THE STRINGS.
 *
 * Paul's ruling ("there is never a winner") was implemented by #1281 and by
 * `noContestFraming.canvas.spec.ts`. These five were live at `9c2923b5`
 * regardless, and they did NOT all survive for the reason the survivor audit
 * recorded. Naming the cause per site is the point of this file: a guard is
 * extended by knowing WHICH hole let a thing through.
 *
 *   ⓵ OUT OF SCOPE — `src/v5/blocks/*` is not swept at all. The guard's scope
 *      is `src/canvas` plus two registers, and the Olumi conversation's own
 *      blocks live outside it. Two findings, both plainly visible.
 *
 *   ⓶ BAN LIST — `win probability` is not on it. `\bwins\b` is (plural), and
 *      the noun phrase walks past. Two findings, both on ONE CONTIGUOUS LINE,
 *      which the audit's "split across interpolation boundaries" explanation
 *      does not cover.
 *
 *   ⓷ FRAGMENT — `{Math.round(...)}% win`. The only literal is the two-word
 *      tail, so no grep for a contest sentence can match it. One finding, and
 *      the only one the line-based limit actually explains.
 *
 * ⚠⚠ AND TWO OF THE FIVE REACHED ONLY ASSISTIVE-TECHNOLOGY USERS —
 * `DataBar`'s `label` is rendered exclusively as `aria-label` on a
 * `role="progressbar"`, and the probabilities row is an accessible name on a
 * container with no text node. **The ruling had been applied to what the
 * product SHOWS and left in what it SAYS.** That half is invisible to a visual
 * review and to a body-text sweep alike, which is why it lasted.
 *
 * ⚠ SCOPE. This is a SOURCE scan of five named files. It says nothing about
 * any other surface, and nothing about copy arriving on the wire from CEE.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(__dirname, '../../..')

/** The five repaired sites, each with the cause it is evidence for. */
const SITES = [
  { file: 'src/canvas/ui/inspector-v2/panels/OutcomePanel.tsx', cause: 'fragment + ban list' },
  { file: 'src/canvas/compare-tab/RunPairCompare.tsx', cause: 'ban list' },
  { file: 'src/v5/blocks/V5AnalysisResultBlock.tsx', cause: 'out of scope' },
  { file: 'src/v5/blocks/V5ComparisonBlock.tsx', cause: 'out of scope' },
] as const

function read(rel: string): string {
  const src = readFileSync(path.join(ROOT, rel), 'utf8')
  // PRECONDITION PINNED IN-TEST: a file read as empty agrees with every
  // absence assertion below (trap 13).
  expect(src.length, `${rel} read as empty — every assertion below is vacuous`).toBeGreaterThan(500)
  return src
}

/**
 * Strip line and block comments. The repaired sites keep long explanatory
 * comments that QUOTE the retired wording — deliberately, because a comment
 * recording what a line used to say is the record of why it changed. Sweeping
 * them would force the fix to erase its own reasoning.
 */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
}

describe('the repaired sites carry no contest framing in live copy', () => {
  it.each(SITES.map((s) => [s.file, s.cause]))('%s (survived via: %s)', (file) => {
    const live = stripComments(read(file))
    expect(live, 'a "win probability" caption is back').not.toMatch(/win\s+probabilit/i)
    expect(live, 'a "% win" fragment is back').not.toMatch(/%\s*\{?\s*win\b/i)
    expect(live, 'a bare "% win" tail is back').not.toMatch(/%\s+win\b/i)
  })

  it('⭐ each site actually READS THE REGISTER — deletion is not a pass', () => {
    // Without this, removing the caption entirely would satisfy every absence
    // assertion above while losing the label a reader needs.
    for (const { file } of SITES) {
      const src = read(file)
      expect(src, `${file} no longer takes its word from a register`).toMatch(
        /METRIC_NOUN\.support|COMPARATIVE_COPY\.(label|byOptionAria|phrase)/,
      )
    }
  })

  it('⛔ CONTRAST — the WIRE FIELD is untouched wherever it is read', () => {
    // ⭐ THE DISCRIMINATING TWIN. `win_probability` is a contract across four
    // services (UI · CEE · PLoT · ISL); renaming it from a copy lane would
    // break the wire, and the guard's own doctrine excludes identifiers for
    // exactly this reason. This arm fails if a future tidy-up "finishes the
    // job" by renaming the field — the plausible wrong next step, and the one
    // no absence assertion above could see.
    //
    // ⚠ NOT EVERY SITE READS IT, and asserting it on all four would have been
    // a guard that fails on correct code: `RunPairCompare` renders a heading
    // over rows built elsewhere and never touches the field. So the SET is
    // pinned instead — a site dropping the field moves the count and reds,
    // and the count cannot pass vacuously at zero.
    const reading = SITES.filter((s) => /win_probabilit/.test(read(s.file))).map((s) => s.file)
    expect(reading).toEqual([
      'src/canvas/ui/inspector-v2/panels/OutcomePanel.tsx',
      'src/v5/blocks/V5AnalysisResultBlock.tsx',
      'src/v5/blocks/V5ComparisonBlock.tsx',
    ])
  })
})

describe('the register is the single authority for this word', () => {
  it('no repaired site re-types the caption as a literal', () => {
    // `metricVocabulary`'s whole purpose: one noun per idea, by reference, so
    // the ninth word cannot be added quietly.
    for (const { file } of SITES) {
      const live = stripComments(read(file))
      expect(live, `${file} re-typed the register's word as a literal`).not.toMatch(
        /["'>]\s*Support\s*["'<]/,
      )
    }
  })
})
