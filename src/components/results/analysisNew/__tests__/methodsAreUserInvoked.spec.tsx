/**
 * A PERSON CAN CHOOSE THE THINKING MOVE — NOT ONLY BE OFFERED ONE.
 *
 * ⛔⛔ THE GAP THIS CLOSES, DERIVED AT `recommendationMethod.ts` WITH A CONTRAST
 * CONTROL. Every science-grounded method the Reasoning tab could name was gated
 * on the PRODUCER emitting a particular signal:
 *
 *     pre_mortem         only on PRE_MORTEM / an overconfidence finding
 *     review_bias        only on COGNITIVE_BIAS
 *     outside_view       only on an anchoring finding
 *     different_option   only on LOW_OPTION_COUNT
 *     consider_opposite  only when the run produced a flip condition
 *     reframe_problem    ⛔ no route to this tab at all
 *     explore_tradeoffs  ⛔ no route to this tab at all
 *
 * Not one was available because the PERSON wanted it. A surface for critical
 * and creative thinking has to let the thinker pick the move — and the two that
 * need no signal whatsoever are the two most generative: *"is the question too
 * narrow?"* and *"what does each option gain and give up?"*.
 *
 * ⛔ THEY WERE BUILT AND SHIPPED TO THE WRONG SURFACE. `ActionsMenu` renders the
 * whole `METHOD_CATALOGUE` and declares itself the owner of "user-invoked
 * science-grounded methods"; its only mount was inside `DecisionOverviewCard`,
 * on the ANALYSIS tab, which the scope ruling parks. Chronic failure #1 of this
 * estate, verbatim: we build more than we plug in.
 *
 * ⚠ THE ASSERTIONS BIND BY CATALOGUE IDENTITY, NOT BY COPY. Titles are wording
 * and may move; `METHOD_CATALOGUE` is the producer of this list, so the spec
 * reads the ids from it and would RED if a technique were dropped from the
 * catalogue AND from the menu together — which a copy-matching spec would not
 * notice (trap 19).
 *
 * ⚠ IT DOES NOT ASSERT WHAT THE METHOD SAYS. The prompts are the catalogue's,
 * the send is `openAskOlumi`'s editable draft, and this tab decides neither.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

/** The two that depend on NO producer signal — valid on any model, always. */
const ALWAYS_VALID = ['reframe_problem', 'explore_tradeoffs'] as const

const draw = () =>
  render(
    <AnalysisNewTabBody
      resultsSectionData={genuineDecision()}
      isPreRun={false}
      isRunning={false}
      isStale={false}
      responseHash="run_methods"
    />,
  )

beforeEach(() => {
  useStrengthenStore.setState({ records: {}, priorityOrder: [] } as never)
})
afterEach(() => cleanup())

describe('the thinking moves are user-invoked, not only producer-offered', () => {
  it('the catalogue still carries the two that need no producer signal', () => {
    // PRECONDITION, PINNED IN-TEST: if these were renamed or removed from the
    // catalogue, the case below would pass by asking for nothing (trap 13).
    for (const id of ALWAYS_VALID) {
      expect(
        METHOD_CATALOGUE.map((m) => m.id),
        `${id} left the catalogue — this guard's subject would be gone`,
      ).toContain(id)
    }
  })

  it('the Reasoning tab mounts the methods menu', () => {
    draw()
    expect(
      screen.getByTestId('analysis-new-methods'),
      'the menu was built and mounted only on the parked Analysis tab',
    ).toBeInTheDocument()
  })

  it('opening it offers every catalogue method, the two ungated ones included', () => {
    draw()
    const menu = screen.getByTestId('analysis-new-methods')
    const trigger = menu.querySelector('button')
    expect(trigger, 'the menu must have a trigger a person can press').not.toBeNull()
    fireEvent.click(trigger as HTMLButtonElement)

    /*
     * ⭐ SCOPED TO THE MENU, AND THE REASON IS A PREMISE OF THIS FILE THAT HAS
     * SINCE BECOME FALSE. This assertion read `screen.getByText`, which was
     * unambiguous only while the dropdown was the sole place a method title
     * appeared. `MethodsYouCanRun` now renders the same catalogue as a chip row
     * in ZONE: FOCUS, so every title resolves TWICE and the global query throws
     * "Found multiple elements" — the spec failed on the arrival of a second
     * route, not on a defect.
     *
     * ⛔ THE STALE CLAIM IS THE MESSAGE BELOW, NOT THE ASSERTION. The old text
     * said the menu is a method's "ONLY route". That was true when this file
     * was written and is now wrong; left unedited it would teach the next
     * reader that removing the chip row costs nothing. The ASSERTION is
     * unchanged in strength — this file is about the MENU, so binding the query
     * to the menu is the tighter claim, not the looser one (trap 19: bind by
     * identity, never by a match another element could satisfy).
     */
    for (const id of ALWAYS_VALID) {
      const entry = METHOD_CATALOGUE.find((m) => m.id === id)
      expect(
        within(menu).getByText(entry!.title),
        `"${entry!.title}" is reachable from no producer signal, so the menu must carry it — ` +
          'the ZONE: FOCUS chip row is a SECOND route and is pinned separately, not here',
      ).toBeInTheDocument()
    }
  })
})
