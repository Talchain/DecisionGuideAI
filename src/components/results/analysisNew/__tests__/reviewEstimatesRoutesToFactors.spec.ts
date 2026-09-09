/**
 * The Reasoning tab's refusal act must deep-link to a REAL Model-tab section,
 * and must actually be mounted.
 *
 * ⚠ WRITTEN BECAUSE THE SAME CALL HAS BEEN SHIPPED WRONG TWICE ON THIS ROUTE,
 * SILENTLY BOTH TIMES. `requestModelTabSection` takes a section NAME.
 * `MODEL_SECTION_TARGET` (`canvas/components/ModelTabBody.tsx`) maps names to
 * testids, and its consumer coalesces a miss to the panel top
 * (`?? 'model-tab-v2-panel'`). Passing the TESTID therefore degrades rather than
 * throwing: the user lands at the top of the outline with nothing selected —
 * verbatim the failure the call was added to fix. Both shipped precedents carry
 * that confession in their own comments (`TriageActionCardsBody.tsx`,
 * `AnalysisHeroContainer.tsx`), and `reviewValueTargetsFactorsSection.spec.ts` is
 * this file's model. The assertion is MEMBERSHIP OF THE DERIVED KEY SET, never
 * equality with a string — a rename would satisfy equality while pointing
 * nowhere.
 *
 * ⭐⭐ AND THE SECOND HALF, WHICH THE PRECEDENT SPEC DOES NOT COVER: THE MOUNT.
 * `AtAGlance` is fail-closed, so a dock that defines this handler and never
 * passes it renders the sentence alone and NOTHING REDS anywhere — a working
 * handler with no caller is this estate's first chronic failure ("we build more
 * than we plug in"), and it is invisible to every render test because the
 * fail-closed branch is a legitimate state.
 *
 * ── WHY A SOURCE SCAN, AND WHAT IT DOES NOT PROVE ─────────────────────────
 * The handler is inline at the dock mount, as both precedents are. This scan
 * proves the CALL IS WRITTEN CORRECTLY and THE PROP IS PASSED; it is not a wire
 * witness that the user arrives. The behavioural half — that the control renders
 * beside the sentence, fires its handler, and refuses to render without one —
 * lives in `withheldReasonHasAMove.spec.tsx`. Neither half implies the other.
 */
import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

const DOCK = 'src/canvas/components/OutputsDock.tsx'
const MAP_HOST = 'src/canvas/components/ModelTabBody.tsx'
const TAB_BODY = 'src/components/results/analysisNew/AnalysisNewTabBody.tsx'

describe('the refusal act targets a real Model-tab section', () => {
  const dock = readFileSync(DOCK, 'utf8')
  const host = readFileSync(MAP_HOST, 'utf8')
  const tabBody = readFileSync(TAB_BODY, 'utf8')

  /**
   * ⭐ POSITIVE CONTROL. A spec that cannot read its subject reports a clean
   * sweep of nothing (CLAUDE.md trap 13), and `readFileSync` on a path this
   * config resolves differently would not be the first instrument here to
   * return a plausible empty answer.
   */
  it('all three files are tracked and non-empty (positive control)', () => {
    for (const f of [DOCK, MAP_HOST, TAB_BODY]) {
      expect(execFileSync('git', ['ls-files', f], { encoding: 'utf8' }).trim()).toBe(f)
    }
    expect(dock.length).toBeGreaterThan(1000)
    expect(host.length).toBeGreaterThan(1000)
    expect(tabBody.length).toBeGreaterThan(1000)
  })

  /** Keys DERIVED from the host — never restated here (CLAUDE.md trap 12). */
  const sectionKeys = (): string[] => {
    const i = host.indexOf('const MODEL_SECTION_TARGET')
    expect(i, 'MODEL_SECTION_TARGET not found — renamed?').toBeGreaterThan(-1)
    const block = host.slice(i, host.indexOf('}', i))
    return [...block.matchAll(/^\s*([a-zA-Z][a-zA-Z0-9_]*)\s*:/gm)].map((m) => m[1])
  }

  it('derives a plausible key set, and the testid is NOT one of them', () => {
    const keys = sectionKeys()
    expect(keys.length).toBeGreaterThanOrEqual(4)
    expect(keys).toContain('factors')
    // ⚠ THE PREMISE PIN. If the testid ever became a key, this spec's whole
    // reason for existing would be void — it must fail loudly, not pass quietly.
    expect(keys).not.toContain('model-group-v2-factors')
  })

  /** The handler body, isolated by name so a sibling call cannot satisfy this. */
  const handler = (): string => {
    const i = dock.indexOf('const handleReviewEstimates')
    expect(
      i,
      'handleReviewEstimates not found in OutputsDock — the refusal act has no handler.',
    ).toBeGreaterThan(-1)
    // Bounded at the next top-level `const ` declaration, so the scan cannot
    // wander into an unrelated handler and read ITS calls as this one's.
    const rest = dock.slice(i + 10)
    const end = rest.indexOf('\n  const ')
    return end === -1 ? rest : rest.slice(0, end)
  }

  it('requests the factors section BY KEY, from inside this handler', () => {
    const m = handler().match(/requestModelTabSection\(\s*'([^']+)'\s*\)/)
    expect(m, 'no literal requestModelTabSection call in handleReviewEstimates').toBeTruthy()
    const arg = m![1]
    expect(
      sectionKeys(),
      `requestModelTabSection('${arg}') is not a key of MODEL_SECTION_TARGET, so the `
        + "consumer's `?? 'model-tab-v2-panel'` fallback lands the user at the panel top.",
    ).toContain(arg)
    expect(arg).toBe('factors')
  })

  /**
   * ⚠ THE SECTION REQUEST ALONE DOES NOT ARRIVE. The user is on the Reasoning
   * tab when they press this; without the tab switch the pending section is set
   * on a surface nobody is looking at. Both precedents switch FIRST and say so.
   */
  it('switches to the Model tab, and does so BEFORE requesting the section', () => {
    const body = handler()
    const switchAt = body.search(/setActiveOutputTab\(\s*'diagnostics'/)
    const sectionAt = body.search(/requestModelTabSection\(/)
    expect(switchAt, "handleReviewEstimates does not switch to the Model tab ('diagnostics')")
      .toBeGreaterThan(-1)
    expect(sectionAt).toBeGreaterThan(-1)
    expect(
      switchAt,
      'the tab switch must precede the section request — the order both shipped ' +
        'precedents use, so the section resolves on the surface the user is about to see.',
    ).toBeLessThan(sectionAt)
  })
})

describe('the act is mounted, not merely defined', () => {
  const dock = readFileSync(DOCK, 'utf8')
  const tabBody = readFileSync(TAB_BODY, 'utf8')

  /** The `<AnalysisNewTabBody …>` opening tag in the dock, and nothing else. */
  const mount = (): string => {
    const i = dock.indexOf('<AnalysisNewTabBody')
    expect(i, 'AnalysisNewTabBody is not mounted in OutputsDock').toBeGreaterThan(-1)
    const end = dock.indexOf('/>', i)
    expect(end, 'unterminated AnalysisNewTabBody mount').toBeGreaterThan(i)
    return dock.slice(i, end)
  }

  it('the dock passes the handler to the Reasoning tab at the mount', () => {
    expect(
      mount(),
      'OutputsDock defines handleReviewEstimates but does not pass it to ' +
        'AnalysisNewTabBody. AtAGlance is fail-closed, so the control simply ' +
        'never renders and no test anywhere REDs.',
    ).toMatch(/onReviewEstimates=\{handleReviewEstimates\}/)
  })

  it('the tab body forwards it to AtAGlance rather than swallowing it', () => {
    const i = tabBody.indexOf('<AtAGlance')
    expect(i, 'AtAGlance is not mounted in AnalysisNewTabBody').toBeGreaterThan(-1)
    const end = tabBody.indexOf('/>', i)
    expect(end).toBeGreaterThan(i)
    expect(
      tabBody.slice(i, end),
      'AnalysisNewTabBody accepts onReviewEstimates but does not thread it to ' +
        'AtAGlance — the prop arrives at the tab and stops there.',
    ).toMatch(/onReviewEstimates=\{onReviewEstimates\}/)
  })
})
