/**
 * Analysis (New) — the tab MARKS ITS CONTENT BUSY while a run is in flight, and
 * does so on the element that already exists.
 *
 * ── WHY BOTH HALVES ARE THE PROPERTY ────────────────────────────────────────
 *
 * Every sibling surface that shows a run in flight marks its content busy —
 * `ModelTabBody:882`, `CompareTabBody:263-265`, `CoachingPanel:59` — and so does
 * the Analysis tab (`OutputsDock` results branch). This tab mounted the shared
 * in-flight cover and did not, so a screen-reader user was told a run had started
 * and then read the retained report with nothing marking it superseded.
 *
 * ⚠⚠ AND THE FIRST ATTEMPT AT THIS FIX BROKE THE TAB, WHICH IS WHY THE SECOND
 * TEST BELOW EXISTS.
 *
 * It put `aria-busy` on a classless wrapper `<div>` inserted in `OutputsDock`
 * between the tabpanel and this body's root. `SectionErrorBoundary` renders its
 * children with no DOM node of its own, so the root WAS a direct flex item;
 * demoted to a block child, its `flex-1 min-h-0` went inert. Measured in a real
 * browser: the body grew 400px → 2000px, stopped scrolling, and **1600px of
 * content became unreachable** inside the panel's `overflow: hidden`.
 *
 * Nothing in this repo could have caught that from the attribute alone — jsdom
 * performs no layout, `Visual Regression` is red at every head, and the spec that
 * covered the wrapper STUBBED this component, replacing the very root whose
 * classes are load-bearing. What IS visible to jsdom is the STRUCTURAL fact: which
 * element carries the attribute, and whether it still carries the scroll classes.
 * So the second test binds those together — an `aria-busy` that has drifted onto
 * a new node fails it, without needing layout at all.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'

vi.mock('../../coaching/askOlumiStore', () => ({ openAskOlumi: vi.fn() }))
vi.mock('../../../../canvas/utils/focusHelpers', () => ({ focusModelTarget: vi.fn() }))

import { AnalysisNewTabBody } from '../AnalysisNewTabBody'
import { openStrategicChallenge } from './analysisNewFixtures'

afterEach(cleanup)

function mount(isRunning: boolean) {
  render(
    <AnalysisNewTabBody
      resultsSectionData={openStrategicChallenge()}
      isPreRun={false}
      isRunning={isRunning}
      isStale={false}
      responseHash="run_abc123"
    />,
  )
  return screen.getByTestId('analysis-new-tab-body')
}

describe('the Reasoning tab marks its content busy while a run is in flight', () => {
  it('sets aria-busy while running, and ABSENT — not "false" — when idle', () => {
    // ⚠ THE IDLE ARM PINS `|| undefined`, NOT TRUTHINESS. `aria-busy="false"` is
    // not the same as no attribute to assistive tech, and the four sibling
    // surfaces all use the absent form.
    expect(mount(false).getAttribute('aria-busy'), 'idle: the attribute must be ABSENT').toBeNull()
    cleanup()
    expect(
      mount(true).getAttribute('aria-busy'),
      'running: the siblings all mark their content busy; without it a screen-reader ' +
        'user is told a run started and then reads the retained report unmarked',
    ).toBe('true')
  })

  /**
   * ⭐⭐ THE REGRESSION GUARD. The property is not "an element has aria-busy" —
   * it is "THE SCROLL CONTAINER has aria-busy", i.e. no new box was introduced
   * into the flex chain to carry it. That is exactly what the first attempt got
   * wrong, and it is checkable without layout.
   */
  it('the busy element IS the scroll container — no new box in the flex chain', () => {
    const root = mount(true)
    // PRECONDITION: this really is the scroll container, or the assertion below
    // is about some other element and proves nothing.
    for (const cls of ['flex-1', 'min-h-0', 'overflow-y-auto']) {
      expect(root.className, `the root must still be the scroll container (${cls})`).toContain(cls)
    }
    expect(root.getAttribute('aria-busy')).toBe('true')

    // …and it must be the ONLY busy element here, so a wrapper added above or
    // below it fails rather than silently doubling the marker.
    const busy = Array.from(document.querySelectorAll('[aria-busy]'))
    expect(busy, 'exactly one busy element').toHaveLength(1)
    expect(busy[0]).toBe(root)
  })
})
