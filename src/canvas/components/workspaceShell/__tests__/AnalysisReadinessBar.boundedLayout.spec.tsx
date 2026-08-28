/**
 * THE READINESS BAR MUST BE BOUNDED, AND ITS RUN CONTROL MUST NOT SIT INSIDE
 * THE SENTENCE COLUMN.
 *
 * ── THE DEFECT, MEASURED ON THE DEPLOYED BUILD (`a9fc1564`, 28 Aug 2026) ─────
 * Driven as a guest in a controlled-state profile with a real strategic brief
 * — detailed and quantified, and it STILL produced seven blockers, because a
 * brief never states option→factor effects. So this is the normal first-run
 * path, not an edge case. In the Olumi tab at the default 416px dock:
 *
 *   analysis-readiness-bar            465px  — 60% of the panel's 772px
 *   chat-thread (the conversation)    132px  — 17%, holding 1,615px of content
 *                                              i.e. the conversation was 8% visible
 *
 * At the 280px dock floor the same state measured 1,392px of bar inside a
 * 900px viewport, the conversation collapsed to 28px, and the sentence column
 * ran at 68px — about eight characters per line.
 *
 * ── THREE CAUSES IN ONE ELEMENT ─────────────────────────────────────────────
 *  1. NO MAX-HEIGHT. The bar is `flex-shrink-0` in the shell footer stack and
 *     grows linearly with blocker count. Nothing bounds it.
 *  2. `items-center` ON A ROW WITH A 448px CHILD AND A 30px BUTTON, which
 *     centres "Analyse first pass" vertically against the middle of the list —
 *     the detached, floating button visible in every screenshot.
 *  3. THE RUN CONTROL SHARES THE SENTENCE COLUMN'S FLEX ROW, cutting the text
 *     to 220px of 414 (196px after `pl-4`).
 *
 * ── SCOPE ───────────────────────────────────────────────────────────────────
 * Derived from `WORKSPACE_SURFACES`, not assumed: `olumi` is the ONLY surface
 * declaring `footerBar: 'readiness'` (`results` — the existing Analysis tab —
 * declares `'none'` and renders its own `PanelFooter` inside
 * `PreAnalysisPanelV3`). So this component serves ONE surface and needs no
 * per-surface variant, and the Analysis tab's behaviour cannot move. A
 * derived test below pins that, so the claim fails loud if a second surface
 * ever adopts the readiness footer.
 *
 * ── WHAT THIS FILE CAN AND CANNOT PROVE (trap 3) ────────────────────────────
 * jsdom has no layout. These tests pin STRUCTURE — which element contains
 * which — and the presence of a bound. They CANNOT prove the rendered height,
 * the column width, or that anything is visible. The pixel figures above came
 * from driving the deployed product and must be re-measured there.
 */
import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen } from '@testing-library/react'
import { AnalysisReadinessBar } from '../AnalysisReadinessBar'
import { WORKSPACE_SURFACES } from '../shellContract'

/** The shape witnessed on staging — not an invented fixture. */
const REAL = [
  'Factor "Audit Firm Partnership Programme" is currently Low (0). What should option "partner with the big audit firms to reach their client base" set it to?',
  'Factor "Enterprise Sales Motion Investment" is currently Low (0). What should option "Status Quo — hold current mid-market motion" set it to?',
  'Factor "Self-Serve Pricing Tier" is currently Low (0). What should option "double down on the mid-market segment with a lower-priced self-serve tier" set it to?',
]

/**
 * ⚠ `sentences` is REQUIRED here, deliberately. The sibling spec's helper makes
 * it optional so that calling it bare exercises the "no sentences supplied"
 * arm — which renders today's single paragraph. I copied that shape, called it
 * bare, and my own PRECONDITION correctly caught the resulting prose branch.
 * Requiring the argument makes that mistake unavailable in this file.
 */
const renderBar = (sentences: readonly string[]) =>
  render(
    <AnalysisReadinessBar
      preRunWithModel
      canRun={false}
      isAnalysing={false}
      blockedReason={sentences.join(' ')}
      blockedSentences={sentences}
      nothingHasAnswered={false}
      onAnalyse={() => {}}
    />,
  )

describe('AnalysisReadinessBar — bounded, and the run control is out of the sentence column', () => {
  it('PRECONDITION: the fixture actually renders the multi-sentence list branch', () => {
    // Without this every assertion below could pass on the prose branch, where
    // none of them is the property under test — a guard agreeing with itself.
    renderBar(REAL)
    const list = screen.getByTestId('analysis-readiness-bar-reason-list')
    expect(list.querySelectorAll('li')).toHaveLength(REAL.length)
  })

  it('THE BAR STACKS so the sentences get the panel width, not a column beside a button', () => {
    renderBar(REAL)
    const bar = screen.getByTestId('analysis-readiness-bar')

    // jsdom has no layout, so the honest assertion is the layout INTENT: the
    // root stacks, which is what puts the run control below the sentences
    // rather than beside them. The width figures live in the header and were
    // measured in a browser.
    expect(bar.className).toMatch(/\bflex-col\b/)
  })

  it('THE SENTENCE LIST CARRIES A HEIGHT BOUND', () => {
    renderBar(REAL)
    const list = screen.getByTestId('analysis-readiness-bar-reason-list')

    // The defect was an element that grows without limit. Pin that SOME bound
    // exists and that it scrolls rather than clipping — a clipped producer
    // sentence would read as a different sentence.
    expect(list.className).toMatch(/\bmax-h-/)
    expect(list.className).toMatch(/\boverflow-y-auto\b/)

    // ⚠ AND IT MUST BE REACHABLE WITHOUT A MOUSE. Bounding a region that
    // scrolls puts content behind an interaction; without a tab stop that
    // content is pointer-only, which fails WCAG 2.1.1. Asserted here rather
    // than left to review, because a later "tidy-up" that drops the attribute
    // would otherwise take the keyboard path with it silently.
    expect(list.getAttribute('tabindex')).toBe('0')
  })

  it('THE COMPACT TWIN: with one sentence the bar does NOT stack', () => {
    // The discriminating half. Without it, a blanket `flex-col` would satisfy
    // the test above while costing the common short state a row of height it
    // does not need.
    renderBar(['Olumi is still drafting your model — analysis runs once it settles.'])

    expect(screen.queryByTestId('analysis-readiness-bar-reason-list')).toBeNull()
    const bar = screen.getByTestId('analysis-readiness-bar')
    expect(bar.className).not.toMatch(/\bflex-col\b/)
    expect(bar.className).toMatch(/\bitems-center\b/)
  })

  it('THE RUN CONTROL IS THE SAME DOM NODE ACROSS THE TRANSITION', () => {
    // ⚠ THIS GUARDS A DEFECT THIS CHANGE ACTUALLY INTRODUCED AND HAD TO UNDO.
    // The first cut rendered the actions in two different parents and picked
    // between them by `hasSentenceList`. React then unmounts and remounts the
    // button the moment the blockers clear — so "the producer answers and THE
    // SAME button enables" stops being true. `OutputsDock`'s ENABLE IN PLACE
    // spec caught it; this pins the same property at component level, where a
    // successor restructuring this layout will meet it first.
    const { rerender } = renderBar(REAL)
    const before = screen.getByTestId('analysis-readiness-bar-analyse')
    expect(screen.getByTestId('analysis-readiness-bar-reason-list')).toBeTruthy()

    const one = ['Olumi is still drafting your model — analysis runs once it settles.']
    rerender(
      <AnalysisReadinessBar
        preRunWithModel
        canRun={false}
        isAnalysing={false}
        blockedReason={one.join(' ')}
        blockedSentences={one}
        nothingHasAnswered={false}
        onAnalyse={() => {}}
      />,
    )

    // The layout changed; the node did not.
    expect(screen.queryByTestId('analysis-readiness-bar-reason-list')).toBeNull()
    expect(screen.getByTestId('analysis-readiness-bar-analyse')).toBe(before)
  })

  it('THE COMPACT CASE KEEPS THE ORIGINAL BUTTON RHYTHM', () => {
    // ⚠ THIS PINS A REGRESSION THE VISUAL CHECK CAUGHT AND EVERY ASSERTION IN
    // THIS FILE MISSED. Retry and Analyse were previously separated by the
    // ROOT's `gap-3`. Wrapping them in a group at `gap-2` narrowed that to 8px
    // and shifted Retry 4px right — 227 differing pixels on the `olumi-tab`
    // reference, in the OUTAGE arm, the one seeded state that renders BOTH
    // buttons. The other tests here check the ROOT's layout, so a child moving
    // inside it was invisible to all of them.
    //
    // The compact case must stay pixel-identical to today. Only the LIST case
    // is meant to look different.
    render(
      <AnalysisReadinessBar
        preRunWithModel
        canRun={false}
        isAnalysing={false}
        readinessCheck={{ headline: 'Could not re-check readiness', retry: () => {} } as never}
        blockedReason="The readiness service could not answer (HTTP 503)."
        nothingHasAnswered={false}
        onAnalyse={() => {}}
      />,
    )

    const retry = screen.getByTestId('analysis-readiness-bar-retry')
    const analyse = screen.getByTestId('analysis-readiness-bar-analyse')

    // PRECONDITION: this arm really does render both controls, or the gap
    // assertion below is about a group of one.
    expect(retry).toBeTruthy()
    expect(analyse).toBeTruthy()
    expect(retry.parentElement).toBe(analyse.parentElement)

    // The group's gap must match what the root used to provide between them.
    expect(retry.parentElement?.className).toMatch(/\bgap-3\b/)
  })

  it('DERIVED SCOPE: exactly one surface declares the readiness footer', () => {
    // Pins the reasoning this change rests on. If a second surface ever adopts
    // `footerBar: 'readiness'`, this REDs and whoever did it has to decide
    // deliberately whether the bounded layout is right there too — rather than
    // inheriting it silently.
    const withReadiness = Object.values(WORKSPACE_SURFACES)
      .filter(s => s.footerBar === 'readiness')
      .map(s => s.id)

    expect(withReadiness).toEqual(['olumi'])
    expect(WORKSPACE_SURFACES.results.footerBar).toBe('none')
  })
})
