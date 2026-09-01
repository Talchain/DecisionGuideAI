/**
 * WHAT YOUR MODEL IMPLIES — the rendered block.
 *
 * The view-model rules are pinned in `modelImplication.spec.ts`. This file pins
 * only what the COMPONENT does with an already-decided model: it renders the
 * sentences it is handed, it renders nothing at all on `none`, and it never
 * renders a goal claim in the `needs_target` state — the one state where a
 * second claim would be a fabrication rather than a formatting slip.
 *
 * ⚠ IT ASSERTS NO ANALYTICAL RULE. If a test here ever needs to know which
 * option leads, that is the signal that a decision has leaked into the
 * component, where it would be a second oracle.
 */

import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ModelImplication } from '../sections/ModelImplication'
import { ANALYSIS_NEW_COPY as COPY } from '../analysisNewCopy'

afterEach(cleanup)

const OUTCOME = { optionId: 'opt_a', sentence: 'Segment has the highest expected outcome: 120.' }
const GOAL = { optionId: 'opt_b', sentence: 'RudderStack is most likely to meet your goal: 80%.' }

describe('the implication block', () => {
  it('renders BOTH readings and the divergence framing when they disagree', () => {
    render(<ModelImplication implication={{ kind: 'diverged', outcome: OUTCOME, goal: GOAL }} />)

    expect(screen.getByTestId('analysis-new-implication')).toHaveAttribute(
      'data-implication-kind',
      'diverged',
    )
    expect(screen.getByTestId('analysis-new-implication-outcome')).toHaveTextContent(OUTCOME.sentence)
    expect(screen.getByTestId('analysis-new-implication-goal')).toHaveTextContent(GOAL.sentence)
    expect(screen.getByTestId('analysis-new-implication-lead')).toHaveTextContent(
      COPY.implications.divergedLead,
    )
  })

  it('⭐ renders NO goal claim in the needs-target state, and offers the unlock instead', () => {
    render(<ModelImplication implication={{ kind: 'needs_target', outcome: OUTCOME }} />)

    expect(screen.getByTestId('analysis-new-implication-outcome')).toHaveTextContent(OUTCOME.sentence)
    // The claim the run is NOT entitled to make must be absent from the DOM, not
    // merely styled away.
    expect(screen.queryByTestId('analysis-new-implication-goal')).toBeNull()
    expect(screen.getByTestId('analysis-new-implication-resolve')).toHaveTextContent(
      COPY.implications.needsTargetUnlock,
    )
  })

  it('names the option once in the aligned state', () => {
    render(
      <ModelImplication
        implication={{ kind: 'aligned', label: 'RudderStack', outcome: OUTCOME, goal: GOAL }}
      />,
    )
    expect(screen.getByTestId('analysis-new-implication-lead')).toHaveTextContent(
      COPY.implications.alignedLead('RudderStack'),
    )
  })

  it('renders NOTHING on `none` — no heading, no empty shell', () => {
    const { container } = render(<ModelImplication implication={{ kind: 'none' }} />)
    expect(container).toBeEmptyDOMElement()
    expect(screen.queryByTestId('analysis-new-implication')).toBeNull()
  })
})
