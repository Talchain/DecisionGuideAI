/**
 * ⭐⭐⭐ THE PANEL REACHED TWENTY TOP-LEVEL BLOCKS ONE BLOCK AT A TIME.
 *
 * Every one of them was justified on its own. Nobody added a dump; the dump is
 * what twenty individually-reasonable additions look like from the reader's
 * chair, and Paul's report — "as you go down the panel it just becomes a big
 * unwieldy dump of text that no user can wade through" — is the only place the
 * cumulative cost was ever visible.
 *
 * The restructure is worth nothing without this. A ratchet is the ONLY thing
 * that survives the next well-argued section, because the argument for that
 * section will be good and the cost will again be invisible to whoever makes
 * it.
 *
 * ⚠ A CEILING, NOT A TARGET. It ratchets DOWN and never up: a fall is recorded
 * by tightening the number in this file, a rise is a RED that must be argued
 * in a PR rather than absorbed. Adding a section is not forbidden — it is made
 * VISIBLE, which is the thing that was missing.
 *
 * ⚠ COUNTS WHAT THE READER MEETS, NOT WHAT THE FILE CONTAINS. The measurement
 * is direct children of the rendered root that actually produced DOM, so a
 * section returning null on this run costs nothing — which is the honest unit,
 * because a reader never pays for a block that does not render.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/ToastContext', () => ({ useShowToastSafe: () => vi.fn() }))
vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision, highUncertainty, openStrategicChallenge } from './analysisNewFixtures'
import type { ResultsSectionDataReturn } from '../../useResultsSectionData'
import { topLevelBlockElements } from './panelContentColumn'

/**
 * ⛔ THE CEILING, PER STATE. Measured 15 Sep 2026 after the restructure.
 * Lower these when the count falls; raising one is a reviewer conversation.
 */
const CEILING: Record<string, number> = {
  /*
   * ⚠⚠ RAISED BY ONE ON ALL THREE, 24 Sep 2026 (Reasoning V2) — 4/5/4 -> 5/6/5.
   * The argument this file demands, derived by listing the content column's
   * counted children on each fixture before and after:
   *
   *   BEFORE (24e06704)                    AFTER (V2, 716b8e67)
   *   ──────────────────────────────────   ──────────────────────────────────────
   *                                        MethodStrip (first) — icons only,
   *                                          textContent '' so NOT COUNTED (⚠ below)
   *   [status note — highUncertainty only] [status note — highUncertainty only]
   *   ZONE: FOCUS (method chips shelf)     (absent here: V2 gates it on focus
   *                                          nudges alone; its methods are the strip)
   *                                        + ModelReviewTool `analysis-new-review`
   *                                          (was StrengthenTheReasoning, INSIDE
   *                                          ZONE: ALSO)
   *   ZONE: ANSWER                         ZONE: CHALLENGE `…-zone-also-group`
   *   ZONE: ALSO                           ZONE: ANSWER (glance + commitment)
   *   ZONE: FURTHER                        ZONE: FURTHER
   *                                        + AboutThisAnalysis `analysis-new-about`
   *                                          (absorbs TrustLine + DeeperAnalysis,
   *                                          which were INSIDE ZONE: ANSWER, and
   *                                          WhatWeChecked, INSIDE ZONE: FURTHER)
   *
   * So −1 (the focus zone; its methods are the strip) and +2 (review tool,
   * About). Both additions are the V2 composition's own placements OUTSIDE the
   * zones — `everySectionBelongsToAZone.spec.tsx` lists them as its two
   * deliberate, reviewable `NOT_A_SECTION` entries — and each REPLACES blocks
   * that were already on the panel (Strengthen; TrustLine, DeeperAnalysis,
   * WhatWeChecked) rather than adding a new kind of content. That is a
   * replacement set, not the one-more-section regrowth this file forbids.
   *
   * ⚠ THE COUNTER CANNOT SEE THE METHOD STRIP. `topLevelBlockElements` drops a
   * child whose `textContent` is '', and the strip is five icon buttons plus an
   * overflow, named only by `aria-label`. A reader meets it, so the honest
   * reader-met count is one higher (6/7/6). Not changed here — the instrument
   * is `panelContentColumn.ts`, shared with the zone spec — but the next raise
   * must not be argued as if the strip cost nothing.
   */
  /**
   * ⭐ LOWERED 17 Sep 2026 WHEN THE ZONE GRAMMAR LANDED — 8/8/6 -> 4/6/4.
   *
   * The approved prototype's first rule is "four named zones, not eight peer
   * cards". Grouping the blocks into zones is what makes that a REDUCTION
   * rather than a relabelling: the column's direct children fell by half,
   * because a zone is one child carrying its own label and its own blocks.
   *
   * ⚠ A LOOSE LABEL WOULD HAVE DONE THE OPPOSITE. The first cut added the five
   * labels without wrapping and the count went 8 -> 13, which this file caught
   * by name. Raising the ceiling to fit them would have recorded the panel
   * growing while the design brief asked it to shrink.
   */
  /*
   * ⚠ RAISED 3 -> 4 ON 18 Sep 2026, AND THIS IS THE RAISE THIS FILE EXISTS TO
   * MAKE SOMEBODY ARGUE. The docblock above says a raise "is a reviewer
   * conversation"; here it is.
   *
   * WHAT CHANGED, derived rather than inferred: `topLevelBlockElements()`
   * counts the content column's non-empty direct children. ZONE: FOCUS is one
   * such child and its gate WAS `focusApplicableIds.length > 0`, which is false
   * on all three fixtures — so the zone rendered on none of them. The gate is
   * now `focusApplicableIds.length > 0 || METHOD_CATALOGUE.length > 0`, and the
   * catalogue is a module constant that is never empty, so ZONE: FOCUS now
   * renders ALWAYS. Every fixture therefore gains EXACTLY ONE child, which is
   * why all three ceilings move by exactly one and none by more.
   *
   * ⛔ WHY THIS IS NOT THE REGROWTH THE FILE FORBIDS — and the distinction is
   * the whole point. The 17 Sep note above records the defect case: five labels
   * added WITHOUT wrapping took the count 8 -> 13, and raising the ceiling then
   * would have "recorded the panel growing while the design brief asked it to
   * shrink". That was a LABEL bought at the cost of a block. This is a BLOCK
   * that carries the seven science-grounded methods onto the first screen on
   * Paul's explicit ruling ("make it first-screen — put it in ZONE: FOCUS"),
   * replacing a dropdown nobody opens. The zone grammar is unchanged: still
   * four zones, still one child each, no section outside a zone.
   *
   * ⚠ THE COST IS REAL AND I AM NOT HIDING IT. The panel measures 1,408px at
   * rest and 4,164px expanded — 7.9 screens — and this adds to that. The honest
   * trade is that the added block is the one section on the tab a person can
   * act on without waiting for the producer to offer something.
   */
  // ⭐ LOWERED 24 Sep 2026 (V2 fidelity gap 24): ZONE: FURTHER is deleted and its
  // blocks fold into About, so every state loses one top-level block — 5/6/5 -> 4/5/4.
  genuineDecision: 4,
  /**
   * ⭐ LOWERED 5 -> 4 ON 17 Sep 2026, when the sensitivity section moved inside
   * the answer group (`everySectionBelongsToAZone`). The spec's own rule is
   * "lower these when the count falls", and here it is load-bearing rather than
   * tidy: leaving it at 5 licenses the count to climb back, and the ONLY way
   * back to 5 on this fixture is a section outside every zone — precisely the
   * defect the sibling spec was written to stop. A slack ceiling would have
   * made that regression legal.
   *
   * ⚠ Measured, with a contrast control: this branch reports slack at 4, and
   * the same run against `origin/staging`'s copy of the body reports NO slack —
   * so the fall is this change's and not a fixture drifting underneath.
   */
  highUncertainty: 5,
  /*
   * ⚠ Both raised by exactly one on 18 Sep 2026, same cause as `genuineDecision`
   * above — ZONE: FOCUS now renders unconditionally. Recorded per-key rather
   * than as one shared note so that a future fall in ANY single fixture is
   * still visible as slack by the sibling assertion below.
   */
  openStrategicChallenge: 4,
}

const FIXTURES: ReadonlyArray<[string, () => ResultsSectionDataReturn]> = [
  ['genuineDecision', genuineDecision],
  ['highUncertainty', highUncertainty],
  ['openStrategicChallenge', openStrategicChallenge],
]

const renderBody = (data: ResultsSectionDataReturn) =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={data}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="regrowth-ratchet"
    />,
  )

/**
 * Direct children of the tab's CONTENT column that produced DOM on this run.
 *
 * ⚠ NOT the element carrying `analysis-new-tab-body`. That is the scroll
 * container and it has exactly ONE child — so a counter pointed at it reads 1
 * for every panel that has ever existed, passes every ceiling, and measures
 * nothing. The positive control below caught exactly that on the first run.
 *
 * ⭐ THE TRAVERSAL NOW HAS ONE OWNER (`panelContentColumn.ts`), because a
 * second spec asks the same question about the same element — a different
 * question ABOUT it, but the same traversal. Two copies that drift is two
 * guards silently pointed at the scroll container.
 */
function topLevelBlocks(): number {
  return topLevelBlockElements().length
}

afterEach(() => cleanup())

describe('the panel cannot regrow', () => {
  /**
   * ⭐ THE POSITIVE CONTROL, AND IT IS NOT OPTIONAL HERE. A counter that
   * returned 0 for everything would satisfy every ceiling in this file while
   * measuring nothing — the vacuous-green shape this suite has been bitten by
   * before.
   *
   * ⛔ IT IS STRUCTURAL, NOT A MAGNITUDE, AND IT USED TO BE A MAGNITUDE. This
   * control read `toBeGreaterThan(3)`, which was comfortably true when the
   * panel carried eight blocks and became FALSE the moment the zone grammar
   * cut it to three — the control failing for the success it was meant to
   * permit. A control pinned to whatever the panel currently measures has an
   * expiry date nobody wrote down. The real failure it guards is a counter
   * pointed at the SCROLL CONTAINER, which has exactly one child, so the
   * honest form is the discrimination itself: the container reads 1, the
   * counter must read more.
   */
  it('CONTROL: the counter is not pointed at the scroll container', () => {
    renderBody(genuineDecision())
    const root = screen.getByTestId('analysis-new-tab-body')
    expect(
      root.children.length,
      'precondition: the scroll container is the wrong element to count, and has one child',
    ).toBe(1)
    expect(
      topLevelBlocks(),
      'the counter read the scroll container — it is measuring the wrong element',
    ).toBeGreaterThan(root.children.length)
  })

  it.each(FIXTURES)('%s stays at or below its ceiling', (name, make) => {
    renderBody(make())
    const count = topLevelBlocks()
    expect(
      count,
      `${name}: ${count} top-level blocks vs a ceiling of ${CEILING[name]}. ` +
        'If this is a deliberate addition, argue it in the PR and raise the ceiling there. ' +
        'If the count FELL, lower the ceiling in this file so the gain is kept.',
    ).toBeLessThanOrEqual(CEILING[name])
  })

  /**
   * ⭐ THE OTHER HALF OF A RATCHET, AND THE HALF THAT USUALLY ROTS. A ceiling
   * nobody tightens drifts into a number with no relationship to the panel. A
   * fall is REPORTED, never failed — failing on improvement is how a ratchet
   * teaches people to stop improving.
   */
  it('reports any ceiling that is now slack', () => {
    const slack: Array<[string, number, number]> = []
    for (const [name, make] of FIXTURES) {
      renderBody(make())
      const count = topLevelBlocks()
      if (count < CEILING[name]) slack.push([name, count, CEILING[name]])
      cleanup()
    }
    if (slack.length > 0) {
      console.warn(
        'CEILING NOW SLACK — tighten these in thePanelCannotRegrow.spec.tsx:\n' +
          slack.map(([n, c, ceil]) => `  ${n}: ${c} (ceiling ${ceil})`).join('\n'),
      )
    }
    expect(true).toBe(true)
  })
})
