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
 *
 * ⭐ REASONING V2 (24 Sep 2026): ONE SURFACE NOW. The chip shelf and this tab's
 * Actions dropdown are replaced by `MethodStrip` (`analysis-new-method-strip`):
 * five methods as icons, the rest of the catalogue in its "More" overflow. The
 * claim is unchanged and is asserted over the WHOLE catalogue, by id: every
 * method is reachable from the strip, either as an icon or in the overflow.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: () => true }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { genuineDecision } from './analysisNewFixtures'
import { METHOD_CATALOGUE } from '../../decision-overview/actionsCatalogue'
import { useStrengthenStore } from '../../../../canvas/stores/strengthenStore'

/** The two that depend on NO producer signal — valid on any model, always. */
const ALWAYS_VALID = ['reframe_problem', 'explore_tradeoffs'] as const
/** V2: the one method surface on this tab (`sections/MethodStrip.tsx`). */
const STRIP = 'analysis-new-method-strip'

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
      screen.getByTestId(STRIP),
      'the methods were built and mounted only on the parked Analysis tab',
    ).toBeInTheDocument()
  })

  it('opening it offers every catalogue method, the two ungated ones included', () => {
    draw()
    const strip = screen.getByTestId(STRIP)
    const more = screen.getByTestId(`${STRIP}-more`)
    expect(strip.contains(more), 'the overflow must be a trigger a person can press').toBe(true)
    fireEvent.click(more)
    expect(screen.getByTestId(`${STRIP}-menu`)).toBeInTheDocument()

    /*
     * ⭐ BY CATALOGUE IDENTITY, NOT BY COPY, AND OVER THE WHOLE CATALOGUE. A
     * method is reachable when its icon is on the strip OR its row is in the
     * overflow — V2 derives the overflow as "catalogue minus the icons", and
     * this REDs if any id falls between the two. The two ungated methods are
     * asserted by name as well, because they are this file's reason to exist.
     */
    const reachable = (id: string): boolean =>
      screen.queryByTestId(`${STRIP}-method-${id}`) !== null ||
      screen.queryByTestId(`${STRIP}-menu-method-${id}`) !== null
    for (const method of METHOD_CATALOGUE) {
      expect(reachable(method.id), `${method.id} is reachable from neither the icons nor the overflow`).toBe(true)
    }
    for (const id of ALWAYS_VALID) {
      expect(
        reachable(id),
        `"${id}" is reachable from no producer signal, so the strip must carry it`,
      ).toBe(true)
      // …and it is offered under the catalogue's own title (the icon's
      // accessible name, or the overflow row's text), not an unnamed control.
      const entry = METHOD_CATALOGUE.find((m) => m.id === id)!
      const el =
        screen.queryByTestId(`${STRIP}-method-${id}`) ?? screen.getByTestId(`${STRIP}-menu-method-${id}`)
      expect(`${el.getAttribute('aria-label') ?? ''} ${el.textContent ?? ''}`).toContain(entry.title)
    }
  })
})
