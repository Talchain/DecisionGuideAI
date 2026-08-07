/**
 * RETIRED UI STATIC COPY — the two strings the #548 sweep missed
 * (ROADMAP 2.213 / 2.214, walk findings F2 and F4).
 *
 * WHY A SOURCE-LEVEL PIN. Both strings are UI STATIC COPY — a real-browser
 * walk on deployed staging `900dbd6c` confirmed each renders to the user and
 * each has ZERO occurrences in the turn payload, so neither can be caught by a
 * wire fixture and neither is the producer's to fix
 * (`PHASE0-EVIDENCE-2026-07-28/walk-548-pixels.md`). They survived the #548
 * re-anchoring sweep for the dullest possible reason: the retired-string list
 * covered "winning" / "winner" / "Win probability" and neither "wins" nor "the
 * recommendation" was on it. A sweep that runs once and is never pinned is a
 * sweep that has to be re-run by hand forever, which is the hand-maintained
 * mirror this programme keeps paying for (CLAUDE.md trap 12).
 *
 * ── HONEST LIMIT OF THIS GUARD ────────────────────────────────────────────
 * This reads SOURCE TEXT for two specific retired strings in two specific
 * files. It is a REGRESSION PIN, not a proof that the estate is free of
 * retired nouns — a novel phrasing, or the same phrase in a third file, would
 * pass. It is deliberately not described as more than it is. What it does
 * guarantee is that these two, having been witnessed on a real screen, cannot
 * come back to these two files unnoticed.
 *
 * ── POSITIVE CONTROL (trap 13) ────────────────────────────────────────────
 * An absence assertion that has never seen a presence is vacuous. Every rule
 * below is proved to FIRE against the exact historical string, read from a
 * literal pinned here permanently rather than from whatever the file currently
 * says (trap 12b) — a control pinned to "current" decays into a tautology the
 * first time "current" changes.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const REPO_ROOT = resolve(__dirname, '../../../..')

function source(relativePath: string): string {
  return readFileSync(resolve(REPO_ROOT, relativePath), 'utf8')
}

/**
 * The rendered copy only — comments are stripped, because this file's own
 * explanatory comments quote the retired strings verbatim (as do the fixed
 * files'), and a guard that trips on its own explanation is a guard people
 * delete.
 */
function renderedCopy(relativePath: string): string {
  return source(relativePath)
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '')
}

// The historical strings, pinned BY VALUE and permanently.
const F2_RETIRED = 'Fragile relationships could change the recommendation.'
const F4_RETIRED = '>wins<'

const RELATIONSHIPS = 'src/canvas/components/model-tab/RelationshipsSection.tsx'
const V7_HERO = 'src/components/results/v7/V7Hero.tsx'

describe('F2 — the Model tab does not name "the recommendation" (ROADMAP 2.213)', () => {
  it('the retired sentence is gone from the rendered copy', () => {
    expect(renderedCopy(RELATIONSHIPS)).not.toContain(F2_RETIRED)
    expect(renderedCopy(RELATIONSHIPS)).not.toContain('could change the recommendation')
  })

  it('the coaching line still EXISTS — this was a re-anchoring, not a deletion', () => {
    // Over-suppression control: silencing the sentence would cost the user a
    // true and useful statement about fragility. The fact must survive; only
    // the retired noun goes.
    const copy = renderedCopy(RELATIONSHIPS)
    expect(copy).toContain('Fragile relationships could change')
    expect(copy).toContain('Review the strongest ones first.')
  })

  it('POSITIVE CONTROL — the rule fires on the exact historical sentence', () => {
    const historical = `<CoachingCard>${F2_RETIRED} Review the strongest ones first.</CoachingCard>`
    expect(historical).toContain('could change the recommendation')
  })

  it('POSITIVE CONTROL — comment stripping does not blind the rule to real copy', () => {
    const planted = `{/* a comment mentioning could change the recommendation */}\n<p>could change the recommendation</p>`
    expect(
      planted.replace(/\{\/\*[\s\S]*?\*\/\}/g, ''),
    ).toContain('could change the recommendation')
  })
})

describe('F4 — the hero gauge does not caption its number "wins" (ROADMAP 2.214)', () => {
  it('the bare caption is gone', () => {
    expect(renderedCopy(V7_HERO)).not.toContain(F4_RETIRED)
  })

  it('the gauge still carries an ANCHORED accessible name — the number is not left unlabelled', () => {
    // Over-suppression control: removing the caption must not leave a large
    // bare percentage with no stated basis, which is the very defect the
    // comparative register exists to prevent.
    const copy = renderedCopy(V7_HERO)
    expect(copy).toContain('COMPARATIVE_COPY.label')
    expect(copy).toContain('aria-label')
  })

  it('POSITIVE CONTROL — the rule fires on the exact historical markup', () => {
    const historical = '<span className="text-[8.5px] text-text-light">wins</span>'
    expect(historical).toContain(F4_RETIRED)
  })
})
