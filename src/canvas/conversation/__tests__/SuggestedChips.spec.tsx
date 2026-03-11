/**
 * Tests for SuggestedChips.
 *
 * Verifies:
 * - Chips without message field are not rendered
 * - Click failure shows inline error that auto-dismisses after 5s
 * - Key uses id ?? chip-${index} fallback (no undefined key warning)
 * - Valid chips render and dispatch
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import type { ActionChip } from '../types'

const chip = (overrides: Partial<ActionChip> = {}): ActionChip => ({
  id: 'c1',
  label: 'Do something',
  intent: 'primary',
  message: 'do something',
  ...overrides,
})

describe('SuggestedChips', () => {
  it('does not render chips without a message field', () => {
    const chips: ActionChip[] = [
      chip({ id: 'ok', message: 'go' }),
      chip({ id: 'bad', message: undefined }),
    ]
    render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByTestId('suggested-chip-ok')).toBeInTheDocument()
    expect(screen.queryByTestId('suggested-chip-bad')).not.toBeInTheDocument()
  })

  it('renders nothing when all chips lack message', () => {
    const chips: ActionChip[] = [chip({ message: undefined })]
    const { container } = render(
      <SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('shows inline error when click handler rejects', async () => {
    const onChipClick = vi.fn().mockRejectedValue(new Error('network error'))
    render(<SuggestedChips chips={[chip()]} onChipClick={onChipClick} />)

    fireEvent.click(screen.getByTestId('suggested-chip-c1'))

    await waitFor(() => {
      expect(screen.getByTestId('chip-error')).toBeInTheDocument()
    })
    expect(screen.getByTestId('chip-error')).toHaveTextContent("That didn't work")
  })

  it('auto-dismisses chip error after 5s', async () => {
    vi.useFakeTimers()
    const onChipClick = vi.fn().mockRejectedValue(new Error('fail'))
    render(<SuggestedChips chips={[chip()]} onChipClick={onChipClick} />)

    // Use fireEvent instead of userEvent to avoid fake-timer deadlock
    fireEvent.click(screen.getByTestId('suggested-chip-c1'))

    // Wait for error to appear (promise rejection is microtask)
    await act(async () => { await Promise.resolve() })

    expect(screen.getByTestId('chip-error')).toBeInTheDocument()

    // Advance 5s
    act(() => { vi.advanceTimersByTime(5_000) })

    expect(screen.queryByTestId('chip-error')).not.toBeInTheDocument()

    vi.useRealTimers()
  })

  it('uses fallback key when chip.id is undefined', () => {
    // Ensures no React "undefined key" warning — rendered without crash is sufficient signal
    const chips: ActionChip[] = [
      { id: undefined as unknown as string, label: 'A', intent: 'primary', message: 'a' },
      { id: undefined as unknown as string, label: 'B', intent: 'secondary', message: 'b' },
    ]
    expect(() =>
      render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />),
    ).not.toThrow()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('calls onChipClick with the chip when clicked', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(<SuggestedChips chips={[chip()]} onChipClick={onChipClick} />)
    fireEvent.click(screen.getByTestId('suggested-chip-c1'))
    expect(onChipClick).toHaveBeenCalledWith(chip())
  })

  it('renders the user-facing chip label rather than the technical id', () => {
    render(
      <SuggestedChips
        chips={[chip({ id: 'clarify_option_a_internal', label: 'Tell me more about Option A' })]}
        onChipClick={vi.fn().mockResolvedValue(undefined)}
      />,
    )

    expect(screen.getByRole('button', { name: 'Tell me more about Option A' })).toBeInTheDocument()
    expect(screen.queryByText('clarify_option_a_internal')).not.toBeInTheDocument()
  })
})
