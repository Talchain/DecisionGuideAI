/**
 * HowComputedCard + HowComputedTrigger — the rendered Model-Card-Lite (P1-9).
 *
 * These specs are written to catch an ESCAPE, not merely to pass. The last UI
 * lane had a mutation slip through because removing a provenance stamp left
 * its tests green. So each unknown fact is asserted at ITS OWN testid — if
 * `buildMethodCard` were mutated to fabricate a default for any single field,
 * exactly that assertion goes RED. A whole-document "some text is present"
 * assertion would not have caught it.
 *
 * Driven by the same two REAL captures as buildMethodCard.spec, so the
 * presence and absence arms are both anchored to bytes a producer actually
 * sent.
 */
import { describe, it, expect, beforeEach } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

import { HowComputedCard, HOW_COMPUTED_COPY } from '../HowComputedModal'
import { HowComputedTrigger } from '../HowComputedTrigger'
import { buildMethodCard } from '../buildMethodCard'
import { useHowComputedStore } from '../howComputedStore'
import goldenPath from '../../../../test/fixtures/golden-path-staging-2026-04-05.json'
import debugBundle from '../../../debug/__tests__/fixtures/staging-bundles/olumi-debug-50b336a6-20260510.pre-fix.json'

const CAPTURE_0405 = (goldenPath as { plot_response: unknown }).plot_response
const CAPTURE_0510 = (debugBundle as { payloads: { plot_response: unknown } }).payloads.plot_response

const NOT_REPORTED = HOW_COMPUTED_COPY.notReported

/** Assert a named fact row shows the producer's value, NOT the absence line. */
function expectFactReported(testId: string, text: string | RegExp) {
  const row = screen.getByTestId(testId)
  expect(row).toHaveTextContent(text)
  expect(row).not.toHaveTextContent(NOT_REPORTED)
}

/** Assert a named fact row explicitly discloses that nothing was reported. */
function expectFactNotReported(testId: string) {
  expect(screen.getByTestId(testId)).toHaveTextContent(NOT_REPORTED)
}

beforeEach(() => {
  // `_reset` was a byte-identical alias of `close` with zero production
  // callers — one name per behaviour.
  useHowComputedStore.getState().close()
})

describe('HowComputedCard — real capture 2026-04-05 (partial provenance)', () => {
  beforeEach(() => {
    render(<HowComputedCard model={buildMethodCard(CAPTURE_0405)} />)
  })

  it('shows the sample count and seed this run actually reported', () => {
    expectFactReported('how-computed-fact-samples', '1,000')
    expectFactReported('how-computed-fact-seed', '485977')
  })

  it("shows the producer's EVPI method verbatim — 'heuristic', not a euphemism", () => {
    expectFactReported('how-computed-fact-evpi', 'heuristic')
  })

  it('shows robustness bands as provisional rather than settled', () => {
    expectFactReported('how-computed-fact-stability', 'Provisional')
  })

  it('DISCLOSES that confidence calibration was not reported — never fills it in', () => {
    // ⛔ Escape-catcher. Scoped to this row: a fabricated default for
    // confidence alone would turn this RED while every other row stayed green.
    expectFactNotReported('how-computed-fact-confidence')
  })

  it('DISCLOSES that the auto-noise adjustment was not reported', () => {
    expectFactNotReported('how-computed-fact-autonoise')
  })

  it('states plainly that nothing is looked up and there are no sources to cite', () => {
    // The honest answer to "where did that number come from?" for a system
    // whose pinned contract carries NO citation field on any block and whose
    // producers emit none. If this sentence is ever softened or removed, the
    // card starts implying an evidence base that does not exist.
    const limits = within(screen.getByTestId('how-computed-limits'))
    expect(limits.getByText(/does not look anything up/i)).toBeInTheDocument()
    expect(limits.getByText(/no sources to cite here/i)).toBeInTheDocument()
  })

  it('states that the percentages are not calibrated and it does not forecast', () => {
    const limits = within(screen.getByTestId('how-computed-limits'))
    expect(limits.getByText(/not calibrated/i)).toBeInTheDocument()
    expect(limits.getByText(/does not forecast/i)).toBeInTheDocument()
  })

  it('names unset starting values as assumptions, not findings', () => {
    // The honest method-level disclosure for defaulted inputs (e.g. a link
    // that opens on a default confidence until the user sets it).
    const uncertainty = within(screen.getByTestId('how-computed-uncertainty'))
    expect(uncertainty.getByText(/assumptions, not findings/i)).toBeInTheDocument()
  })

  it('describes wins as a share of simulated scenarios, not a prediction', () => {
    expect(screen.getByText(/not a prediction that it will win/i)).toBeInTheDocument()
  })
})

describe('HowComputedCard — real capture 2026-05-10 (POSITIVE CONTROL)', () => {
  it('shows the provisional confidence stamp when the producer DOES send provenance', () => {
    // Without this, the 04-05 "not reported" assertions prove nothing: the
    // card would look identical if it could never render a confidence value
    // at all. This is the presence that makes the absence meaningful.
    render(<HowComputedCard model={buildMethodCard(CAPTURE_0510)} />)
    expectFactReported('how-computed-fact-confidence', /Provisional — not yet calibrated/)
  })
})

describe('HowComputedCard — a response with nothing in it', () => {
  it('discloses every fact as not reported and invents none', () => {
    render(<HowComputedCard model={buildMethodCard({})} />)
    for (const id of [
      'how-computed-fact-samples',
      'how-computed-fact-seed',
      'how-computed-fact-evpi',
      'how-computed-fact-confidence',
      'how-computed-fact-stability',
      'how-computed-fact-autonoise',
    ]) {
      expectFactNotReported(id)
    }
  })

  it('still shows the method explanation and the limits — the card is never blank', () => {
    render(<HowComputedCard model={buildMethodCard({})} />)
    expect(screen.getByTestId('how-computed-limits')).toBeInTheDocument()
    expect(screen.getByText(HOW_COMPUTED_COPY.whatItDoesHeading)).toBeInTheDocument()
  })
})

describe('HowComputedTrigger', () => {
  it('renders nothing when there are no results to explain', () => {
    render(<HowComputedTrigger hasResults={false} />)
    expect(screen.queryByTestId('how-computed-trigger')).toBeNull()
  })

  it('renders when results are on screen', () => {
    render(<HowComputedTrigger hasResults />)
    expect(screen.getByTestId('how-computed-trigger')).toHaveTextContent(HOW_COMPUTED_COPY.title)
  })

  it('opens the card via the store when clicked', async () => {
    render(<HowComputedTrigger hasResults />)
    expect(useHowComputedStore.getState().isOpen).toBe(false)
    await userEvent.click(screen.getByTestId('how-computed-trigger'))
    expect(useHowComputedStore.getState().isOpen).toBe(true)
  })
})
