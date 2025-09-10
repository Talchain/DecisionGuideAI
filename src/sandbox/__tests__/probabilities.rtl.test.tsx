import React from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScenarioSandboxMock } from '@/sandbox/ui/ScenarioSandboxMock'

describe('Probabilities editor', () => {
  it('updates total and shows warning when total != 1; add/remove rows works', async () => {
    render(<ScenarioSandboxMock />)

    const user = userEvent.setup()

    // Initially total is 1.00
    expect(screen.getByLabelText('Total Probability').textContent).toBe('1.00')

    // Change first two probability values
    const valueInputs = screen.getAllByLabelText(/Probability Value/)
    await user.clear(valueInputs[0])
    await user.type(valueInputs[0], '0.7')
    await user.clear(valueInputs[1])
    await user.type(valueInputs[1], '0.2')

    // Total updates to 0.90 and warning appears
    expect(screen.getByLabelText('Total Probability').textContent).toBe('0.90')
    expect(screen.getByRole('note')).toHaveTextContent(/Warning: total should sum to 1.00/i)

    // Add a probability row
    await user.click(screen.getByLabelText('Add probability'))
    const updatedInputs = screen.getAllByLabelText(/Probability Value/)
    // New row defaults to 0; total remains 0.90
    expect(screen.getByLabelText('Total Probability').textContent).toBe('0.90')

    // Remove the last row
    const removeButtons = screen.getAllByLabelText(/Remove Probability/)
    await user.click(removeButtons[removeButtons.length - 1])

    // Back to two rows, total unchanged
    expect(screen.getByLabelText('Total Probability').textContent).toBe('0.90')
  })
})
