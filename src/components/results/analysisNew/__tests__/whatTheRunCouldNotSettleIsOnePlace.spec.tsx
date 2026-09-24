/**
 * ⭐⭐ §4 — WHAT THE RUN COULD NOT SETTLE LIVES IN ONE PLACE.
 *
 * ── WHAT WAS MEASURED, AND WHAT IT KILLED ──────────────────────────────────
 * Paul's complaint was that the lower panel "becomes more and more copy and
 * therefore just completely unhelpful". The obvious diagnosis — the hedges are
 * repetitive — was MEASURED AND REFUTED. On a reconstruction of the run he
 * screenshotted (no success target, three engine critiques, stale, leader
 * withheld) the panel renders EIGHT distinct "could not establish" statements
 * and only two are anything like duplicates; the chip/meaning pairs in
 * `WhatWeChecked` are a deliberate label-plus-expansion, not repetition.
 *
 * ⛔ So this is a RE-COMPOSITION, NOT A CULL. Every sentence is load-bearing and
 * several were written to close a specific fabrication — the estate has already
 * caught and reverted "improvements" to three of them. Nothing is deleted here.
 *
 * ⭐ THE ACTUAL CAUSE IS LOCATION. One category of information was spread over
 * SIX places: the critique strip, the inference strip, the glance's staleness
 * ribbon, this checks readout (12th), "Uncertainty and gaps" (18th) and the
 * value-of-information line (19th). A reader met the same kind of statement six
 * times, in six registers, never knowing they had seen the set.
 *
 * ── ⚠ WHAT DELIBERATELY DID NOT MOVE ───────────────────────────────────────
 * The two top strips stay above the glance, because
 * `mounts the warning strip ABOVE the glance, not below the sections` pins them
 * there and the reasoning is right: an engine critique qualifies the WHOLE run,
 * so a reader must meet it before the reading it qualifies. Moving it down
 * would be the fabrication risk this plan's own rule forbids — a claim
 * separated from its entitlement.
 *
 * This file pins the two that were merely far apart, and asserts the rulings
 * that constrain them still hold.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { openGroups } from './openNamedGroups'
import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'
import { manyFragileEdges, withLeaderLicensed } from './analysisNewFixtures'

const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)

/**
 * ⭐ V2 RE-POINT (Reasoning V2, 24 Sep 2026) — WHERE THE TWO HALVES LIVE NOW.
 *
 *  · THE CHECKS HALF. `WhatWeChecked` (`analysis-new-checks`) is no longer
 *    mounted. "About this analysis" (`analysis-new-about`, last on the tab,
 *    collapsed) absorbed it: its Evidence / Robustness / Most-likely-option
 *    status rows are the three check chips, and its "Limitations" detail carries
 *    their not-assessed meanings (`AboutThisAnalysis.tsx` header).
 *  · THE UNCERTAINTY HALF stays in "How this was worked out", as its last member.
 *  · THE COACHING. "Strengthen the reasoning" (`analysis-new-strengthen`) is no
 *    longer mounted on this tab; the model review tool (`analysis-new-review`),
 *    under the model strip, replaces it.
 *
 * So the ORDER FLIPS — uncertainty, then About — and the property this file
 * exists for (nothing renders BETWEEN the two halves) is asserted on the V2
 * pair, with the same derivation.
 */
const ABOUT = 'analysis-new-about'
/** The three check chips `WhatWeChecked` drew, as About's status rows. */
const CHECK_ROWS = ['evidence', 'robustness', 'leader'] as const

const renderStale = () =>
  render(
    <AnalysisNewTabBody
      // LICENSED (24 Sep 2026): "What would change your mind" is one of the
      // blocks this file places, and it mounts only on a licensed run.
      resultsSectionData={withLeaderLicensed(manyFragileEdges())}
      isPreRun={false} isRunning={false} isStale={true} responseHash="s4"
    />,
  )

/** About rests CLOSED (V2) and unmounts its rows while closed, like `SectionShell`. */
// V2 fidelity gap 24: About is now a named group, so `openGroups()` may already
// have opened it; open only when closed (its rest state is pinned in
// `theTailFoldsIntoAbout.spec.tsx`).
const openAbout = () => {
  const toggle = screen.getByTestId(`${ABOUT}-toggle`)
  if (toggle.getAttribute('aria-expanded') === 'false') fireEvent.click(toggle)
  expect(screen.getByTestId(`${ABOUT}-toggle`)).toHaveAttribute('aria-expanded', 'true')
}

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the run-could-not-settle block is contiguous', () => {
  it('PRECONDITION: this fixture mounts both halves', () => {
    renderStale()
    openGroups()
    openAbout()
    const about = screen.getByTestId(ABOUT)
    for (const row of CHECK_ROWS) {
      expect(
        within(about).getByTestId(`${ABOUT}-row-${row}`),
        `About must carry the "${row}" check row it absorbed from WhatWeChecked`,
      ).toBeInTheDocument()
    }
    expect(screen.getByTestId('analysis-new-uncertainty')).toBeInTheDocument()
  })

  /**
   * ⭐ ADJACENCY, DERIVED — not "one comes after the other", which was
   * already true when they were SIX SECTIONS APART and is therefore the
   * assertion that would have passed throughout the defect. This asserts no
   * OTHER panel section renders between them, which is the property that
   * actually changed.
   */
  it('nothing renders BETWEEN the uncertainty section and About (the checks’ V2 home)', () => {
    const { container } = renderStale()
    openGroups()
    openAbout()
    const uncertainty = screen.getByTestId('analysis-new-uncertainty')
    const about = screen.getByTestId(ABOUT)
    // V2 fidelity gap 24 (24 Sep 2026): "Uncertainty and gaps" folds INTO About,
    // so the two halves are one block — containment is the strongest form of
    // the contiguity this case pins (before: the uncertainty half preceded About).
    expect(
      about.contains(uncertainty),
      'V2 gap 24: the uncertainty half lives inside About, with the check rows',
    ).toBe(true)

    /* ⛔⛔ DERIVED, NOT HAND-LISTED — AND THE HAND-LIST HAD A HOLE.
       This filtered against a typed set of eight section ids. It omitted
       `analysis-new-decision-voi-section`, which is a real top-level section
       AND a member of the very "what this run could not settle" family this
       file exists to keep contiguous. So the value-of-information block could
       render BETWEEN checks and uncertainty and the adjacency assertion would
       not see it — the guard passing while the property it guards had gone.

       ⚠ A hand-maintained mirror of the surface's sections (trap 12), inside a
       guard about the surface's structure. Third collection gap found tonight
       by auditing what a rule COLLECTS rather than what it asserts.

       ⭐ NOW DERIVED FROM THE RENDER: every `analysis-new-*` element that is
       not nested inside another one is a top-level block, whatever it is
       called. A section added tomorrow is covered without anyone remembering
       to list it — and if one is added BETWEEN these two, this REDs. */
    /* ⚠ THE CONTAINER IS EXCLUDED FIRST, and my own PRECONDITION below caught
       its absence: `analysis-new-tab-body` is itself an `analysis-new-*`
       element, so a bare "not nested in another match" filter collapses the
       whole surface to the wrapper and returns ONE section. The same wrapper
       swallowed an earlier measurement on this panel — a container that
       matches the pattern it contains. */
    const body = container.querySelector<HTMLElement>('[data-testid="analysis-new-tab-body"]')
    expect(body, 'PRECONDITION: the tab body must render').not.toBeNull()
    const all = [...body!.querySelectorAll<HTMLElement>('[data-testid^="analysis-new-"]')]
    expect(
      all.length,
      'PRECONDITION: the derivation must yield several elements, not the wrapper alone',
    ).toBeGreaterThan(3)

    /* ⛔⛔ DOCUMENT ORDER, NOT A TOP-LEVEL SET — AND THE TOP-LEVEL SET BROKE.
       This derived "every `analysis-new-*` element not nested inside another
       one", then looked for the two targets IN that set. `analysis-new-checks`
       is no longer top-level: the tab's restructure nested it, so `indexOf`
       returned -1 and the guard died on its own PRECONDITION rather than on the
       property — which is the right failure, and is why the precondition is
       asserted at all.

       ⚠ THE FIX IS NOT TO RE-LIST ANYTHING. Nesting is a layout decision and
       this file's claim is about ADJACENCY, which document order answers
       whatever the tree looks like. A derivation that assumes a flat surface is
       a hand-maintained mirror of the surface's SHAPE — the same defect class
       one level up from the hand-listed ids it replaced.

       ⛔ ANCESTORS AND DESCENDANTS ARE NOT "BETWEEN", and excluding them is
       load-bearing rather than tidy: a wrapper CONTAINING one target precedes it
       in document order without rendering between the two, and a child of either
       is inside it, not after it. Counting either would make this assert a
       falsehood the moment anything is wrapped. */
    const between = all.filter(
      (el) =>
        el !== uncertainty &&
        el !== about &&
        !el.contains(uncertainty) &&
        !el.contains(about) &&
        !uncertainty.contains(el) &&
        !about.contains(el) &&
        precedes(uncertainty, el) &&
        precedes(el, about),
    )
    expect(
      between.map((el) => el.getAttribute('data-testid')),
      'the two halves of "what this run could not settle" must be contiguous — ' +
        `found between them: ${between.map((el) => el.getAttribute('data-testid')).join(', ') || '(nothing)'}`,
    ).toEqual([])
  })

  /**
   * ⚠ THE RULINGS THIS MOVE HAD TO RESPECT, ASSERTED RATHER THAN ASSUMED.
   * Both were derived before moving anything; a later change that satisfies the
   * adjacency above by dragging the block upward would break these instead of
   * passing silently. V2: the coaching is the model review tool, which replaced
   * the "Strengthen the reasoning" mount.
   */
  it('the constraining rulings still hold', () => {
    renderStale()
    openGroups()
    const review = screen.getByTestId('analysis-new-review')
    const sensitivity = screen.getByTestId('analysis-new-sensitivity')
    const uncertainty = screen.getByTestId('analysis-new-uncertainty')
    const about = screen.getByTestId(ABOUT)

    expect(precedes(review, about), 'coaching stays above the detail').toBe(true)
    expect(precedes(review, uncertainty), 'coaching stays above the detail').toBe(true)
    expect(precedes(sensitivity, uncertainty), '"what would change your mind" stays above').toBe(true)
  })

  /**
   * ⭐ THE DISCRIMINATOR. Without it the adjacency case passes on a panel that
   * renders only one of the two — which is a different product, not a tidier
   * one, and is exactly the shape a careless gate change would produce.
   */
  it('DISCRIMINATOR: adjacency is not absence', () => {
    renderStale()
    openGroups()
    openAbout()
    expect(
      screen.queryAllByTestId('analysis-new-checks'),
      'V2: the checks are said in ONE place — About — not also by the retired WhatWeChecked mount',
    ).toHaveLength(0)
    expect(screen.getAllByTestId(ABOUT)).toHaveLength(1)
    const about = screen.getByTestId(ABOUT)
    for (const row of CHECK_ROWS) {
      expect(within(about).getAllByTestId(`${ABOUT}-row-${row}`)).toHaveLength(1)
      expect(
        (within(about).getByTestId(`${ABOUT}-row-${row}-value`).textContent ?? '').trim().length,
        `the "${row}" check row must carry a value, not merely a label`,
      ).toBeGreaterThan(0)
    }
    expect(screen.getAllByTestId('analysis-new-uncertainty')).toHaveLength(1)
    expect(
      (screen.getByTestId('analysis-new-uncertainty').textContent ?? '').length,
      'the section must carry content, not merely a heading',
    ).toBeGreaterThan(20)
  })
})
