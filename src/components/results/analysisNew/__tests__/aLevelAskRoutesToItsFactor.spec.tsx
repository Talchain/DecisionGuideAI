/**
 * The first screen of a model CEE refuses for missing "today" levels (placeholder-zero readiness,
 * served 28 Sep on UI 673111fb): "What is X today, before any option changes it?" rendered as
 * plain text with no way to reach X. CEE's `missing_important_inputs[]` rows carry `factor_id` /
 * `factor_label` (and `option_id` / `option_label` for option values); the UI dropped them. Each
 * row now keeps the PRODUCER's own scope, so the refusal routes to the node it asks about.
 */
import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'

import { readRefusalWording } from '../../../../canvas/hooks/useAnalysisReady'
import { admissionRefusalItems } from '../../../../canvas/utils/canRunAnalysis'
import { WhyNoAnalysisYet } from '../sections/WhyNoAnalysisYet'

afterEach(cleanup)

/** The served shape (keys as CEE sends them; the sentences are CEE's). */
const ADMISSION = {
  may_run: false,
  reasons: [{ field: 'inputs', code: 'MISSING_FACTOR_LEVEL' }],
  missing_important_inputs: [
    {
      code: 'MISSING_FACTOR_LEVEL',
      factor_id: 'fac_market_competition',
      factor_label: 'Competitive Pressure for Usage Pricing',
      why_it_matters: 'What is "Competitive Pressure for Usage Pricing" today, before any option changes it?',
      obligation: 'required',
    },
    {
      code: 'MISSING_OPTION_VALUE',
      option_id: 'opt_hybrid',
      option_label: 'Hybrid Platform Fee Plus Usage',
      factor_id: 'fac_fee',
      factor_label: 'Platform fee',
      why_it_matters: 'Factor "Platform fee" needs a numeric value for option "Hybrid Platform Fee Plus Usage"',
      obligation: 'required',
    },
    { code: 'MISSING_FACTOR_LEVEL', why_it_matters: 'A row with no id at all.', obligation: 'required' },
    { code: 'X', factor_id: 'fac_offered', why_it_matters: 'Offered, not required.', obligation: 'offered' },
  ],
}

describe('the producer’s scope reaches the refusal row', () => {
  it('⭐ a level ask routes to its FACTOR; an option value routes to its OPTION (option first)', () => {
    const items = admissionRefusalItems(readRefusalWording(ADMISSION.missing_important_inputs ? ADMISSION : null))
    expect(items.map((i) => [i.text.slice(0, 20), i.scope?.id ?? null])).toEqual([
      ['What is "Competitive', 'fac_market_competition'],
      ['Factor "Platform fee', 'opt_hybrid'],
      ['A row with no id at ', null],
    ])
  })

  it('CONTROL: no id on the wire ⇒ no scope (never inferred from the sentence)', () => {
    const items = admissionRefusalItems(readRefusalWording(ADMISSION))
    expect(items[2]).toEqual({ text: 'A row with no id at all.' })
  })

  it('the row is a control that focuses that factor', () => {
    const onFocusTarget = vi.fn()
    const items = admissionRefusalItems(readRefusalWording(ADMISSION))
    render(<WhyNoAnalysisYet listing={{ summary: 's', sentences: items }} reason={null} onFocusTarget={onFocusTarget} />)
    const routes = screen.getAllByTestId('analysis-new-why-no-analysis-route')
    expect(routes).toHaveLength(2)
    fireEvent.click(routes[0])
    expect(onFocusTarget).toHaveBeenCalledWith('fac_market_competition')
  })
})
