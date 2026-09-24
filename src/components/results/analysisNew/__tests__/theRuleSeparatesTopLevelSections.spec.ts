/**
 * ⭐⭐ ONE FULL-WIDTH RULE BETWEEN THE REASONING TAB'S TOP-LEVEL SECTIONS
 * (fidelity gaps 6 and 11, `FIDELITY-WORKFLOW-RESULT-20260924.json`).
 *
 * The design authority (`prototype-v2-reference.html`, `reasoningHTML()`)
 * draws one hairline above each top-level section — `.section:before` /
 * `.about:before` — full panel width, always the TOP edge,
 * `var(--border-default)` only, with the SAME margin above the rule as
 * padding below it (`.section{margin-top:11px;padding-top:11px}`).
 *
 * The gap report measured three defects against that:
 *   (6)  the model block and "Challenge the thinking" had NO rule between
 *        them at all — only an `mt-4` gap — and `CommitmentSummary` drew a
 *        BOTTOM border instead of a rule above the section that follows it;
 *   (11) every existing rule sat inside the column's own `px-4` gutter (16px
 *        short of each edge), some were `border-t` and some `border-b`, and
 *        the space above and below them did not match.
 *
 * This pins the fix at SOURCE level — jsdom applies no CSS and cannot measure
 * a gap, the same limit `theZonesCarryTheirOwnRhythm.spec.ts` documents — so
 * it reads the raw files rather than a render, and derives the "one
 * consistent rule" claim from the three call sites sharing the same
 * IDENTIFIER rather than merely resembling strings.
 */
import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import { PANEL_RULE } from '../panelSurfaces'

const TAB_BODY = fs.readFileSync(path.resolve(__dirname, '../AnalysisNewTabBody.tsx'), 'utf8')
const COMMITMENT_SUMMARY = fs.readFileSync(
  path.resolve(__dirname, '../sections/CommitmentSummary.tsx'),
  'utf8',
)
const ABOUT = fs.readFileSync(path.resolve(__dirname, '../sections/AboutThisAnalysis.tsx'), 'utf8')

describe('PANEL_RULE — the one shared full-width divider token', () => {
  it('reaches both panel edges by cancelling the columns own px-4 gutter', () => {
    expect(PANEL_RULE).toMatch(/-mx-4\b/)
    expect(PANEL_RULE).toMatch(/\bpx-4\b/)
  })

  it('is always the TOP edge, never the bottom — "always on the same side"', () => {
    expect(PANEL_RULE).toMatch(/\bborder-t\b/)
    expect(PANEL_RULE).not.toMatch(/\bborder-b\b/)
  })

  it('carries the neutral token only — never a tint', () => {
    expect(PANEL_RULE).toMatch(/\bborder-panel-border\b/)
    expect(PANEL_RULE).not.toMatch(/border-(success|warning|info)\b/)
  })

  it('spaces the rule EVENLY: the same step above the line as below it', () => {
    const above = PANEL_RULE.match(/!mt-\[(\d+)px\]/)
    const below = PANEL_RULE.match(/\bpt-\[(\d+)px\]/)
    expect(above, 'no explicit above-rule spacing — an ambient space-y would differ per zone').not.toBeNull()
    expect(below, 'no explicit below-rule spacing').not.toBeNull()
    expect(above![1]).toBe(below![1])
  })

  it('the above-rule spacing is !important, or an ambient space-y silently wins', () => {
    // Tailwind's `space-y-N > :not([hidden]) ~ :not([hidden])` selector
    // out-specifies a plain `mt-*` utility, and every call site sits inside
    // SOME zone's space-y — so without `!` the gap above the rule would
    // drift with whichever zone it was dropped into, rather than staying
    // even with the gap below it.
    expect(PANEL_RULE).toMatch(/!mt-\[/)
  })
})

describe('the rule reaches every top-level section (fidelity gap 6)', () => {
  it('separates the model block from "Challenge the thinking" — gap 6\'s named example', () => {
    const modelReview = TAB_BODY.indexOf('<ModelReviewTool')
    const challengeZone = TAB_BODY.indexOf('data-testid="analysis-new-zone-also-group"')
    expect(modelReview, 'anchor moved: <ModelReviewTool not found').toBeGreaterThan(-1)
    expect(challengeZone, 'anchor moved: the challenge zone group not found').toBeGreaterThan(-1)
    const between = TAB_BODY.slice(modelReview, challengeZone)
    expect(between, 'no PANEL_RULE between the model block and the challenge zone').toContain('PANEL_RULE')
  })

  it('"Move towards commitment" opens on the rule, not a trailing bottom border', () => {
    const section = COMMITMENT_SUMMARY.match(/<section[\s\S]*?>/)
    expect(section, "the commitment section's opening tag was not found").not.toBeNull()
    expect(section![0]).toContain('PANEL_RULE')
    expect(section![0]).not.toMatch(/\bborder-b\b/)
  })

  it('"About this analysis" opens on the same shared rule, full-width rather than inset', () => {
    const section = ABOUT.match(/<section[\s\S]*?>/)
    expect(section, "the about section's opening tag was not found").not.toBeNull()
    expect(section![0]).toContain('PANEL_RULE')
  })

  it('all three sites spell the SAME identifier — "one consistent rule", not three resemblances', () => {
    const modelReview = TAB_BODY.indexOf('<ModelReviewTool')
    const challengeZone = TAB_BODY.indexOf('data-testid="analysis-new-zone-also-group"')
    const between = TAB_BODY.slice(modelReview, challengeZone)
    const commitSection = COMMITMENT_SUMMARY.match(/<section[\s\S]*?>/)![0]
    const aboutSection = ABOUT.match(/<section[\s\S]*?>/)![0]
    for (const src of [between, commitSection, aboutSection]) {
      expect(src.match(/PANEL_RULE/g)?.length).toBeGreaterThan(0)
    }
  })
})
