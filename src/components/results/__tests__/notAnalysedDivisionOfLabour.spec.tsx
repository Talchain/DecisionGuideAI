/**
 * THE DIVISION OF LABOUR BETWEEN THE CHAT AND THE RESULTS PANEL — pinned so it
 * cannot drift into "we thought the chat named them".
 *
 * ## The rule
 *
 * CEE's egress grammar carries ONE label slot. It names a SINGLE excluded
 * option; for two or more it gives only a COUNT. **Per-option visibility is
 * therefore the RESULTS PANEL's job**, and the ruling's "stays visible … with a
 * clear reason and an action to resolve it" is discharged HERE, per option, or
 * it is not discharged at all.
 *
 * ## Why it needs its own file
 *
 * This is a cross-service assumption, and cross-service assumptions are the
 * ones that rot silently: nothing in either repo's types says the chat can only
 * name one, so a later reader could reasonably decide the panel need only show
 * a summary — and the two surfaces would then BOTH give a count and neither
 * would name the second option. Nobody would see a red.
 *
 * ## The producer half is grounded in a LIVE CAPTURE, not in an assertion
 *
 * `live-analysis-turn-critique-degenerate-2026-08-08.json` is a captured turn
 * carrying CEE's own sentence with exactly one label interpolated
 * (*"'Migrate to Salesforce' was left out of this comparison …"*) and the
 * follow-up user message it prescribes. That file is a HISTORIC RECORD (trap
 * 14b): read here, never edited — its evidential value is that it is what the
 * product actually said on a dated build.
 */

import { describe, it, expect, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import { OptionCards } from '../OptionCards'
import { resolveOptionPrompt } from '../utils/notAnalysedCopy'
import type { OptionResult } from '../types'
import liveTurn from '../../../v5/__tests__/fixtures/live-analysis-turn-critique-degenerate-2026-08-08.json'

const ANALYSED = 'opt_keep_crm'
const EXCLUDED_ONE = 'opt_migrate'
const EXCLUDED_TWO = 'opt_rebuild'
const LABEL_ONE = 'Migrate to Salesforce'
const LABEL_TWO = 'Rebuild in-house'

function analysed(id: string): OptionResult {
  return {
    id,
    label: 'Keep Current CRM (Status Quo)',
    expected: 100,
    outcome: { mean: 100, p10: 60, p50: 100, p90: 140 },
    p10: 60, p50: 100, p90: 140,
    isRecommended: true,
    winProbability: 0.8,
    goalProbability: 0.5,
  } as unknown as OptionResult
}

function excluded(id: string, label: string): OptionResult {
  return {
    id,
    label,
    expected: null,
    outcome: { mean: null, p10: null, p50: null, p90: null },
    p10: null, p50: null, p90: null,
    isRecommended: false,
    notAnalysed: true,
    notAnalysedReason: 'no_interventions',
  } as unknown as OptionResult
}

afterEach(() => cleanup())

describe('division of labour — the chat names one, the panel names each', () => {
  it('PRODUCER EVIDENCE: the captured CEE turn carries ONE label slot', () => {
    // Read-only against the historic capture. If CEE ever gains a multi-label
    // grammar this assertion is the place that notices, rather than the panel
    // quietly duplicating a job the chat has taken over.
    const text = JSON.stringify(liveTurn)
    expect(text).toContain(`'${LABEL_ONE}' was left out of this comparison`)
    // And the route it prescribes is the one our resolve affordance drafts.
    expect(text).toContain(resolveOptionPrompt(LABEL_ONE))
  })

  it('the panel renders a card PER excluded option, never a count', () => {
    render(
      <OptionCards
        options={[analysed(ANALYSED), excluded(EXCLUDED_ONE, LABEL_ONE), excluded(EXCLUDED_TWO, LABEL_TWO)]}
        winnerId={ANALYSED}
        hasLeadingOption
      />,
    )
    // Two options, two cards, each addressed by its OWN id and showing its OWN
    // label — the exact case where the chat degrades to a count.
    expect(screen.getByTestId(`option-card-not-analysed-${EXCLUDED_ONE}`)).toBeInTheDocument()
    expect(screen.getByTestId(`option-card-not-analysed-${EXCLUDED_TWO}`)).toBeInTheDocument()
    expect(screen.getByText(LABEL_ONE)).toBeInTheDocument()
    expect(screen.getByText(LABEL_TWO)).toBeInTheDocument()
  })

  it('each card carries its OWN resolve action, addressed to its OWN option', () => {
    render(
      <OptionCards
        options={[analysed(ANALYSED), excluded(EXCLUDED_ONE, LABEL_ONE), excluded(EXCLUDED_TWO, LABEL_TWO)]}
        winnerId={ANALYSED}
        hasLeadingOption
      />,
    )
    expect(screen.getByTestId(`not-analysed-resolve-${EXCLUDED_ONE}`)).toBeInTheDocument()
    expect(screen.getByTestId(`not-analysed-resolve-${EXCLUDED_TWO}`)).toBeInTheDocument()
  })

  it('the panel takes the label from the OPTION, not from any chat text', () => {
    // The chat could only ever have named one of these. If the panel ever
    // started reading a producer sentence for its labels, this arm goes red:
    // the second option's label appears nowhere in the captured turn.
    expect(JSON.stringify(liveTurn)).not.toContain(LABEL_TWO)
    render(
      <OptionCards
        options={[analysed(ANALYSED), excluded(EXCLUDED_ONE, LABEL_ONE), excluded(EXCLUDED_TWO, LABEL_TWO)]}
        winnerId={ANALYSED}
        hasLeadingOption
      />,
    )
    expect(screen.getByText(LABEL_TWO)).toBeInTheDocument()
  })
})
