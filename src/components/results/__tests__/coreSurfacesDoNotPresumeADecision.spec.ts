/**
 * Three MOUNTED Core labels must not tell a user they have a decision.
 *
 * ⚠ WITNESSED, NOT DERIVED. These three were seen on the deployed product in a
 * session where the user had entered a strategic FUNDRAISING CHALLENGE — no
 * options, nothing being chosen between — and Olumi told them they had a
 * "Draft decision" under a "Decision overview", beside a "Decision brief". That
 * is the mislabelling in its clearest form, and it needs no reachability
 * argument: it was on screen.
 *
 * ⚠⚠ SCOPE — THIS IS NOT A TERMINOLOGY MIGRATION GUARD, AND MUST NOT BECOME ONE.
 * It pins THREE named user-facing strings on THREE named surfaces. It does not
 * sweep the repo, does not police the word "decision" generally, and must never
 * be widened into one: "decision" is the RIGHT word wherever the user is
 * genuinely deciding between alternatives, and a guard that forbade it estate-
 * wide would swap one presumption for its mirror.
 *
 * WHAT IS DELIBERATELY NOT CHANGED, and why this guard does not look at it:
 *  · `decision-brief-*` testids, the directory names, the view-model types and
 *    the `SectionErrorBoundary section="Decision brief"` label. That last one is
 *    INTERNAL — the fallback renders "This section couldn't load" and never
 *    shows the section name; it reaches only console.error and a telemetry
 *    label, so renaming it would churn dashboards for no user benefit.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const BRIEF = 'src/components/results/decision-brief/DecisionBriefSection.tsx'
const OVERVIEW = 'src/components/results/decision-overview/DecisionOverviewCard.tsx'

const read = (f: string) => readFileSync(f, 'utf8')

describe('Core orientation labels do not presume a discrete decision', () => {
  it('both files are tracked and non-empty (positive control)', () => {
    for (const f of [BRIEF, OVERVIEW]) {
      expect(execFileSync('git', ['ls-files', f], { encoding: 'utf8' }).trim()).toBe(f)
      expect(read(f).length).toBeGreaterThan(500)
    }
  })

  it('the brief section heading describes its contents, not a decision', () => {
    const s = read(BRIEF)
    // The rendered <h3>, not a comment: match inside the heading element.
    const h = s.match(/<h3[^>]*>\s*([^<]+?)\s*<\/h3>/)
    expect(h, 'no <h3> found in the brief section — has the heading moved?').toBeTruthy()
    const heading = h![1]
    expect(heading).toBe('Behind this result')
    expect(
      /decision/i.test(heading),
      `the brief heading reads "${heading}" — a user who brought a strategic challenge `
        + 'is told they have a decision.',
    ).toBe(false)
  })

  it('the orientation card label and title fallback presume nothing', () => {
    const s = read(OVERVIEW)
    const meta = s.match(/metaLabel:\s*'([^']+)'/)
    const title = s.match(/titleFallback:\s*'([^']+)'/)
    expect(meta, 'metaLabel not found').toBeTruthy()
    expect(title, 'titleFallback not found').toBeTruthy()
    expect(meta![1]).toBe('Overview')
    expect(title![1]).toBe('Untitled draft')
    for (const [name, value] of [['metaLabel', meta![1]], ['titleFallback', title![1]]]) {
      expect(/decision/i.test(value), `${name} reads "${value}"`).toBe(false)
    }
  })

  /*
   * ⭐ THE MIRROR CHECK. Generalising must not become its own presumption. These
   * labels are shown for a genuine decision too, so they must not assert
   * "challenge" either — the right generic asserts neither.
   */
  it('does not swap one presumption for its mirror', () => {
    const s = read(OVERVIEW)
    const meta = s.match(/metaLabel:\s*'([^']+)'/)![1]
    const title = s.match(/titleFallback:\s*'([^']+)'/)![1]
    for (const value of [meta, title]) {
      expect(
        /\bchallenge\b/i.test(value),
        `"${value}" presumes a challenge, which is wrong when the user IS deciding `
          + 'between options. The generic must assert neither.',
      ).toBe(false)
    }
  })
})
