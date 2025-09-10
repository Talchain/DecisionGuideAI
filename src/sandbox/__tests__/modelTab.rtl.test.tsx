import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ScenarioSandboxMock } from '@/sandbox/ui/ScenarioSandboxMock'
import * as analytics from '@/lib/analytics'

describe('Model tab segmented control (Options | Probabilities)', () => {
  const user = userEvent.setup()
  let spyModelChanged: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    spyModelChanged = vi.spyOn(analytics, 'model_segment_changed')
  })

  it('renders Model heading and two radio segments with correct initial state', () => {
    render(<ScenarioSandboxMock />)

    // Heading
    expect(screen.getByText('Model')).toBeInTheDocument()

    // Radiogroup
    const group = screen.getByRole('radiogroup', { name: /Model view/i })
    expect(group).toBeInTheDocument()

    const opt = screen.getByRole('radio', { name: /Options/i })
    const prob = screen.getByRole('radio', { name: /Probabilities/i })

    expect(opt).toHaveAttribute('aria-checked', 'true')
    expect(prob).toHaveAttribute('aria-checked', 'false')

    // Options region is visible by default
    expect(screen.getByRole('region', { name: 'Options' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Probabilities' })).not.toBeInTheDocument()
  })

  it('switches views by mouse click and calls telemetry', async () => {
    render(<ScenarioSandboxMock />)

    const opt = screen.getByRole('radio', { name: /Options/i })
    const prob = screen.getByRole('radio', { name: /Probabilities/i })

    await user.click(prob)
    expect(prob).toHaveAttribute('aria-checked', 'true')
    expect(opt).toHaveAttribute('aria-checked', 'false')

    // Probabilities view shows header and total label
    expect(screen.getByRole('region', { name: 'Probabilities' })).toBeInTheDocument()
    expect(screen.getByTestId('probabilities-total')).toBeInTheDocument()

    expect(spyModelChanged).toHaveBeenCalled()
    expect(spyModelChanged).toHaveBeenLastCalledWith('Probabilities')

    // Click back to Options
    spyModelChanged.mockClear()
    await user.click(opt)
    expect(opt).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('region', { name: 'Options' })).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Probabilities' })).not.toBeInTheDocument()
    expect(spyModelChanged).toHaveBeenLastCalledWith('Options')
  })

  it('supports keyboard: Arrow keys move selection; Space/Enter select', async () => {
    render(<ScenarioSandboxMock />)

    const group = screen.getByRole('radiogroup', { name: /Model view/i })
    const opt = screen.getByRole('radio', { name: /Options/i })
    const prob = screen.getByRole('radio', { name: /Probabilities/i })

    // ArrowRight should select Probabilities
    fireEvent.keyDown(group, { key: 'ArrowRight', code: 'ArrowRight' })
    expect(prob).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('region', { name: 'Probabilities' })).toBeInTheDocument()

    // ArrowLeft should select Options
    fireEvent.keyDown(group, { key: 'ArrowLeft', code: 'ArrowLeft' })
    expect(opt).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('region', { name: 'Options' })).toBeInTheDocument()

    // Move focus index to Probabilities, then Space to confirm (still Probabilities)
    fireEvent.keyDown(group, { key: 'ArrowRight', code: 'ArrowRight' })
    fireEvent.keyDown(group, { key: ' ', code: 'Space' })
    expect(prob).toHaveAttribute('aria-checked', 'true')

    // Telemetry was called along the way
    expect(spyModelChanged).toHaveBeenCalled()
  })
})
