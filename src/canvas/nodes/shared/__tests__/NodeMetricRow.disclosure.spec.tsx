import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NodeMetricRow } from '../NodeMetricRow'

describe('metric explanations use the real positioned tooltip', () => {
  it('exposes a measured value and its basis on focus, and dismisses with Escape', async () => {
    const user = userEvent.setup()
    const explanation = 'Relative to the strongest factor, not a share of the outcome.'
    render(<NodeMetricRow label="Influence" value={0.6} formatted="60%"
      fillClass="bg-info" title={explanation} phrase={explanation} />)

    const row = screen.getByRole('img', { name: `Influence: 60%. ${explanation}` })
    expect(row).toHaveAttribute('data-node-tooltip', 'true')
    expect(row).toHaveAttribute('title', '')
    expect(screen.queryByRole('tooltip')).toBeNull()
    await user.tab()
    expect(row).toHaveFocus()
    const tooltip = await screen.findByRole('tooltip')
    expect(tooltip).toHaveTextContent(explanation)
    expect(row).toHaveAttribute('aria-describedby', tooltip.id)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('tooltip')).toBeNull()
    expect(row).toHaveTextContent('60%')
  })

  it('keeps an unset state distinct from zero while exposing the available assumption', async () => {
    const user = userEvent.setup()
    const explanation = 'Olumi supplied an assumed strength. Open the details to review it.'
    render(<NodeMetricRow label="Strength" value={null} unsetText="Not set"
      title={explanation} phrase={explanation} testId="unset" />)
    const row = screen.getByTestId('unset')
    expect(row.querySelector('[style]')).toBeNull()
    await user.tab()
    expect(row).toHaveFocus()
    expect(await screen.findByRole('tooltip')).toHaveTextContent(explanation)
    expect(row).toHaveAccessibleName(`Strength: Not set. ${explanation}`)
  })

  it('adds no tab stop or tooltip without an explanation and retains measured zero', () => {
    render(<NodeMetricRow label="Chance" value={0} formatted="0%"
      fillClass="bg-info" phrase="Chance: 0%" testId="zero" />)
    const row = screen.getByTestId('zero')
    expect(row).not.toHaveAttribute('tabindex')
    expect(row).not.toHaveAttribute('data-node-tooltip')
    expect(row).toHaveTextContent('0%')
    expect(row.querySelector('[style]')).toHaveStyle({ width: '0%' })
    expect(screen.queryByRole('tooltip')).toBeNull()
  })

  it('does not turn an absent measurement into a metric or a focus stop', () => {
    const { container } = render(<NodeMetricRow label="Chance" value={null}
      formatted="" fillClass="bg-info" title="Not available" />)
    expect(container).toBeEmptyDOMElement()
  })
})
