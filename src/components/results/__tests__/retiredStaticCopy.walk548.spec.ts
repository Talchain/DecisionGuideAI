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

/**
 * ⚠ RE-POINTED BY THE v1 MODEL-TAB REMOVAL, on the same reasoning the F4 block
 * below records for its own re-point, and stated rather than slipped in.
 *
 * F2 was witnessed on `canvas/components/model-tab/RelationshipsSection.tsx`,
 * which rendered "Fragile relationships could change which option the data
 * supports. Review the strongest ones first." That file is DELETED with the v1
 * Model-tab stack, so a pin against it would read GREEN forever by reading
 * nothing — and the over-suppression control below, which is this block's
 * actual teeth, would have been the half that silently stopped testing.
 *
 * The rule is re-pointed at `utils/fragileEdgeCopy.ts` — the surviving module
 * that decides this exact sentence for the results panel's fragility card, and
 * which carries the SAME re-anchoring: its own header lists `the recommendation
 * could change` among the strings it retired, and it renders the re-anchored
 * object instead. Measured before re-pointing: no existing fragile-edge spec
 * asserts the recommendation-naming ban (`fragileRows`, `distinguishableRows`
 * and `flipEvidenceScope` return zero hits for "the recommendation" against a
 * non-zero "fragile" contrast control), so this is added coverage, not a
 * duplicate.
 *
 * ⚠ What this now guarantees is NARROWER in one respect and LIVE in the one
 * that matters: the witnessed SURFACE is gone, so this is a regression pin on
 * the copy module a user actually loads rather than a re-assertion about the
 * retired Model-tab pixels. The exact retired sentence F2_RETIRED is kept
 * pinned by value and permanently (trap 12b) — it is a historical record of a
 * string the product once shipped, and is not edited to match the new site.
 */
const FRAGILE_COPY = 'src/components/results/utils/fragileEdgeCopy.ts'
const WIN_GAUGE = 'src/components/results/WinGauge.tsx'

describe('F2 — the fragility copy does not name "the recommendation" (ROADMAP 2.213)', () => {
  it('the retired sentence is gone from the rendered copy', () => {
    expect(renderedCopy(FRAGILE_COPY)).not.toContain(F2_RETIRED)
    expect(renderedCopy(FRAGILE_COPY)).not.toContain('could change the recommendation')
    // The retired noun is named in this module's own header docblock, where it
    // records what it removed. That is the reason comments are stripped — and
    // the reason the stripper gets its own control below.
    expect(renderedCopy(FRAGILE_COPY)).not.toContain('the recommendation')
  })

  it('the coaching line still EXISTS — this was a re-anchoring, not a deletion', () => {
    // Over-suppression control: silencing the sentence would cost the user a
    // true and useful statement about fragility. The fact must survive; only
    // the retired noun goes.
    const copy = renderedCopy(FRAGILE_COPY)
    expect(copy).toContain('could change')
    expect(copy).toContain('which option is most likely to hit your goal could change')
    // The neutral object the module substitutes for the retired noun.
    expect(copy).toContain('the comparison')
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

/**
 * ⚠ RE-POINTED BY THE V7 RETIREMENT, and the scope change is stated rather than
 * slipped in. F4 was witnessed on `v7/V7Hero.tsx`'s gauge; that file is DELETED
 * with the V7 group, so a pin against it would read GREEN forever by reading
 * nothing. The rule is re-pointed at `WinGauge.tsx` — the results panel's
 * surviving gauge, which renders the same large percentage under the same
 * comparative register. What this now guarantees is NARROWER than before in one
 * respect (the witnessed file is gone, so this is a regression pin on a
 * different file rather than a re-assertion about the witnessed pixels) and
 * LIVE in the respect that matters: the retired caption cannot appear on the
 * gauge a user actually loads. The positive control is unchanged and still
 * pinned to the exact historical markup (trap 12b).
 */
describe('F4 — the gauge does not caption its number "wins" (ROADMAP 2.214)', () => {
  it('the bare caption is gone', () => {
    expect(renderedCopy(WIN_GAUGE)).not.toContain(F4_RETIRED)
  })

  it('the gauge still carries an ANCHORED accessible name — the number is not left unlabelled', () => {
    // Over-suppression control: removing the caption must not leave a large
    // bare percentage with no stated basis, which is the very defect the
    // comparative register exists to prevent.
    const copy = renderedCopy(WIN_GAUGE)
    expect(copy).toContain('COMPARATIVE_COPY.label')
    expect(copy).toContain('aria-label')
  })

  it('POSITIVE CONTROL — the rule fires on the exact historical markup', () => {
    const historical = '<span className="text-[8.5px] text-text-light">wins</span>'
    expect(historical).toContain(F4_RETIRED)
  })
})
