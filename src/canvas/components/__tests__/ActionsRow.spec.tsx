import { describe, it, expect } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ActionsRow } from '../ActionsRow'

describe('ActionsRow tooltips', () => {
  it('shows tooltip for Run Again via shared Tooltip when enabled', () => {
    const noop = () => {}

    render(
      <ActionsRow
        onRunAgain={noop}
        onCompare={noop}
        onShare={noop}
      />
    )

    const runLabel = screen.getByText('Run Again')
    const runButton = runLabel.closest('button') as HTMLButtonElement
    expect(runButton).toBeInTheDocument()

    fireEvent.mouseEnter(runButton)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Run analysis again with different seed')
  })

  it('shows disabled reason in tooltip when actions are disabled', () => {
    const noop = () => {}

    render(
      <ActionsRow
        onRunAgain={noop}
        onCompare={noop}
        onShare={noop}
        disabled
        disabledReason="Mock disabled reason"
      />
    )

    const runLabel = screen.getByText('Run Again')
    const runButton = runLabel.closest('button') as HTMLButtonElement
    expect(runButton).toBeInTheDocument()

    fireEvent.mouseEnter(runButton)

    const tooltip = screen.getByRole('tooltip')
    expect(tooltip).toHaveTextContent('Mock disabled reason')
  })
})
