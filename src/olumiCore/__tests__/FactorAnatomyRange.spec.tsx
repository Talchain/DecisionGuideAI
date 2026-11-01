import '@testing-library/jest-dom/vitest'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { FactorAnatomySummary } from '../../canvas/ui/inspector-v2/panels/FactorAnatomy'

afterEach(cleanup)

const props = { label: 'per specialist', displayText: '20 ticket/week/specialist', hasStoredValue: true, sourceLabel: 'From your brief' }
const withRange = { observedState: { unit: 'ticket/week/specialist', value: 20, raw_value: 20, range: { low: 10, high: 30, source: 'user_override', meaning: 'plausible' } } }

describe('the inspector says the person\'s stated range beside the figure (gap 2)', () => {
  it('shows the range the node carries, in the card\'s own words', () => {
    render(<FactorAnatomySummary {...props} data={withRange} />)
    expect(screen.getByTestId('factor-stated-range')).toHaveTextContent('Range: 10–30 ticket/week/specialist')
    expect(screen.getByText(/per specialist is 20 ticket\/week\/specialist\./)).toBeInTheDocument()
  })
  it('says nothing when the figure was given as a point', () => {
    render(<FactorAnatomySummary {...props} data={{ observedState: { unit: 'ticket/week', value: 80, raw_value: 80 } }} />)
    expect(screen.queryByTestId('factor-stated-range')).toBeNull()
  })
  it('is unchanged for a caller that passes no data', () => {
    render(<FactorAnatomySummary {...props} />)
    expect(screen.queryByTestId('factor-stated-range')).toBeNull()
  })
})
