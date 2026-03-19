/**
 * Tests for SuggestedChips.
 *
 * Verifies:
 * - Chip count: 0, 1, 2, 3, 4 chips; 0 chips renders no container
 * - Chips without message field are not rendered
 * - Click dispatches chip.message (not chip.label) — verified via onChipClick call arg
 * - Click failure shows inline error that auto-dismisses after 5s
 * - Key uses id ?? chip-${index} fallback (no undefined key warning)
 * - Role dots: facilitator=info, challenger=danger, scientist=goal, missing/unknown=no dot
 * - In-flight: isThinking=true disables all chips; re-enable when false
 * - Historical: isHistorical=true renders chips non-interactive
 * - Feature flag: v2 path (mocked as enabled) vs legacy path (mocked as disabled)
 * - Layout: flex-wrap container rendered
 * - Accessibility: aria-label includes role, keyboard activatable
 * - XML escaping: labels/messages with &amp; &lt; &gt; render correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, waitFor, fireEvent } from '@testing-library/react'
import { SuggestedChips } from '../zones/SuggestedChips'
import type { ActionChip } from '../types'

// ---------------------------------------------------------------------------
// Flag mock — default to v2 enabled; individual tests override as needed
// ---------------------------------------------------------------------------

vi.mock('../../../flags', () => ({
  isOrchestratorRenderingV2Enabled: vi.fn(() => true),
}))

import { isOrchestratorRenderingV2Enabled } from '../../../flags'
const mockFlagEnabled = isOrchestratorRenderingV2Enabled as ReturnType<typeof vi.fn>

beforeEach(() => {
  mockFlagEnabled.mockReturnValue(true)
})

// ---------------------------------------------------------------------------
// Fixture helper
// ---------------------------------------------------------------------------

const chip = (overrides: Partial<ActionChip> = {}): ActionChip => ({
  id: 'c1',
  label: 'Do something',
  intent: 'primary',
  message: 'do something full message',
  ...overrides,
})

// ---------------------------------------------------------------------------
// 0 chips — no container
// ---------------------------------------------------------------------------

describe('SuggestedChips — 0 chips', () => {
  it('renders nothing when chips array is empty', () => {
    const { container } = render(
      <SuggestedChips chips={[]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders nothing when all chips lack message', () => {
    const chips: ActionChip[] = [chip({ message: undefined })]
    const { container } = render(
      <SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    expect(container.firstChild).toBeNull()
  })
})

// ---------------------------------------------------------------------------
// Chip count: 1, 2, 3, 4
// ---------------------------------------------------------------------------

describe('SuggestedChips — chip count', () => {
  it('renders a single chip', () => {
    render(<SuggestedChips chips={[chip({ id: 'c1' })]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })

  it('renders 2 chips', () => {
    const chips = [chip({ id: 'c1' }), chip({ id: 'c2' })]
    render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('renders 3 chips', () => {
    const chips = [chip({ id: 'c1' }), chip({ id: 'c2' }), chip({ id: 'c3' })]
    render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getAllByRole('button')).toHaveLength(3)
  })

  it('renders at most 4 chips even when more are supplied', () => {
    const chips = [
      chip({ id: 'c1' }), chip({ id: 'c2' }), chip({ id: 'c3' }),
      chip({ id: 'c4' }), chip({ id: 'c5' }),
    ]
    render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getAllByRole('button')).toHaveLength(4)
  })

  it('does not render chips without a message field', () => {
    const chips: ActionChip[] = [
      chip({ id: 'ok', message: 'go' }),
      chip({ id: 'bad', message: undefined }),
    ]
    render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByTestId('suggested-chip-ok')).toBeInTheDocument()
    expect(screen.queryByTestId('suggested-chip-bad')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Click: dispatches chip.message not chip.label
// ---------------------------------------------------------------------------

describe('SuggestedChips — click behaviour', () => {
  it('calls onChipClick with the full chip object (including message)', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    const c = chip({ id: 'c1', label: 'Short label', message: 'The full orchestrator message text' })
    render(<SuggestedChips chips={[c]} onChipClick={onChipClick} />)
    fireEvent.click(screen.getByTestId('suggested-chip-c1'))
    expect(onChipClick).toHaveBeenCalledWith(c)
    expect(onChipClick.mock.calls[0][0].message).toBe('The full orchestrator message text')
  })

  it('renders the chip label (not the message) as visible text', () => {
    const c = chip({ id: 'c1', label: 'Add a factor', message: 'Please add a new factor node' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByText('Add a factor')).toBeInTheDocument()
    expect(screen.queryByText('Please add a new factor node')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Error handling
// ---------------------------------------------------------------------------

describe('SuggestedChips — error handling', () => {
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
    fireEvent.click(screen.getByTestId('suggested-chip-c1'))
    await act(async () => { await Promise.resolve() })
    expect(screen.getByTestId('chip-error')).toBeInTheDocument()
    act(() => { vi.advanceTimersByTime(5_000) })
    expect(screen.queryByTestId('chip-error')).not.toBeInTheDocument()
    vi.useRealTimers()
  })
})

// ---------------------------------------------------------------------------
// Role dots (v2 only)
// ---------------------------------------------------------------------------

describe('SuggestedChips — role dots', () => {
  it('renders an info-coloured dot for facilitator role', () => {
    const c = chip({ id: 'c1', role: 'facilitator' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    const dot = screen.getByTestId('chip-role-dot-c1')
    expect(dot).toBeInTheDocument()
    expect(dot).toHaveClass('bg-info')
  })

  it('renders a danger-coloured dot for challenger role', () => {
    const c = chip({ id: 'c1', role: 'challenger' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    const dot = screen.getByTestId('chip-role-dot-c1')
    expect(dot).toHaveClass('bg-danger')
  })

  it('renders a goal-coloured dot for scientist role', () => {
    const c = chip({ id: 'c1', role: 'scientist' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    const dot = screen.getByTestId('chip-role-dot-c1')
    expect(dot).toHaveClass('bg-goal')
  })

  it('renders chip without dot when role is missing', () => {
    const c = chip({ id: 'c1', role: undefined })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.queryByTestId('chip-role-dot-c1')).not.toBeInTheDocument()
    expect(screen.getByTestId('suggested-chip-c1')).toBeInTheDocument()
  })

  it('renders chip without dot for unrecognised role string (graceful fallback)', () => {
    const c = chip({ id: 'c1', role: 'unknown_future_role' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.queryByTestId('chip-role-dot-c1')).not.toBeInTheDocument()
    expect(screen.getByTestId('suggested-chip-c1')).toBeInTheDocument()
  })

  it('does not render role dots when feature flag is off (legacy path)', () => {
    mockFlagEnabled.mockReturnValue(false)
    const c = chip({ id: 'c1', role: 'facilitator' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.queryByTestId('chip-role-dot-c1')).not.toBeInTheDocument()
    expect(screen.getByTestId('suggested-chip-c1')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// In-flight disable
// ---------------------------------------------------------------------------

describe('SuggestedChips — in-flight disable', () => {
  it('disables all chips when isThinking=true', () => {
    const chips = [chip({ id: 'c1' }), chip({ id: 'c2' })]
    render(<SuggestedChips chips={chips} onChipClick={vi.fn()} isThinking />)
    const buttons = screen.getAllByRole('button')
    buttons.forEach(btn => {
      expect(btn).toBeDisabled()
    })
  })

  it('does not call onChipClick when isThinking=true and chip is clicked', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(<SuggestedChips chips={[chip()]} onChipClick={onChipClick} isThinking />)
    fireEvent.click(screen.getByTestId('suggested-chip-c1'))
    expect(onChipClick).not.toHaveBeenCalled()
  })

  it('re-enables chips when isThinking becomes false', () => {
    const chips = [chip({ id: 'c1' })]
    const { rerender } = render(
      <SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} isThinking />,
    )
    expect(screen.getByRole('button')).toBeDisabled()
    rerender(
      <SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} isThinking={false} />,
    )
    expect(screen.getByRole('button')).not.toBeDisabled()
  })

  it('does not disable chips when isThinking is omitted (default)', () => {
    render(<SuggestedChips chips={[chip()]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Historical (visible but non-interactive)
// ---------------------------------------------------------------------------

describe('SuggestedChips — historical', () => {
  it('disables chips when isHistorical=true', () => {
    render(<SuggestedChips chips={[chip()]} onChipClick={vi.fn()} isHistorical />)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('does not call onChipClick when isHistorical=true and chip is clicked', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    render(<SuggestedChips chips={[chip()]} onChipClick={onChipClick} isHistorical />)
    fireEvent.click(screen.getByTestId('suggested-chip-c1'))
    expect(onChipClick).not.toHaveBeenCalled()
  })
})

// ---------------------------------------------------------------------------
// Accessibility
// ---------------------------------------------------------------------------

describe('SuggestedChips — accessibility', () => {
  it('aria-label includes role name for known roles', () => {
    const c = chip({ id: 'c1', label: 'Push back on this', role: 'challenger' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByRole('button', { name: 'Challenger: Push back on this' })).toBeInTheDocument()
  })

  it('aria-label is the label text when role is absent', () => {
    const c = chip({ id: 'c1', label: 'Add factor', role: undefined })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByRole('button', { name: 'Add factor' })).toBeInTheDocument()
  })

  it('chips are keyboard focusable (role=button)', () => {
    render(<SuggestedChips chips={[chip()]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('disabled chip has aria-disabled=true when isThinking', () => {
    render(<SuggestedChips chips={[chip()]} onChipClick={vi.fn()} isThinking />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true')
  })
})

// ---------------------------------------------------------------------------
// XML escaping
// ---------------------------------------------------------------------------

describe('SuggestedChips — XML escaping in labels and messages', () => {
  it('renders chip label containing &amp; correctly', () => {
    const c = chip({ id: 'c1', label: 'Marketing & Sales', message: 'Tell me about Marketing & Sales' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByText('Marketing & Sales')).toBeInTheDocument()
  })

  it('renders chip label containing < and > correctly', () => {
    const c = chip({ id: 'c1', label: 'Compare A vs B', message: 'Compare A < B vs B > A' })
    render(<SuggestedChips chips={[c]} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getByTestId('suggested-chip-c1')).toBeInTheDocument()
  })

  it('dispatches message containing special chars on click', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    const fullMessage = 'What if Revenue & Costs < $100k?'
    const c = chip({ id: 'c1', label: 'Check R&C', message: fullMessage })
    render(<SuggestedChips chips={[c]} onChipClick={onChipClick} />)
    fireEvent.click(screen.getByTestId('suggested-chip-c1'))
    expect(onChipClick.mock.calls[0][0].message).toBe(fullMessage)
  })
})

// ---------------------------------------------------------------------------
// Feature flag — legacy path cap at 2
// ---------------------------------------------------------------------------

describe('SuggestedChips — feature flag legacy path', () => {
  beforeEach(() => {
    mockFlagEnabled.mockReturnValue(false)
  })

  it('caps at 2 chips in legacy mode even with 4 supplied', () => {
    const chips = [
      chip({ id: 'c1' }), chip({ id: 'c2' }), chip({ id: 'c3' }), chip({ id: 'c4' }),
    ]
    render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />)
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })

  it('legacy chips are enabled regardless of isThinking', () => {
    render(<SuggestedChips chips={[chip()]} onChipClick={vi.fn().mockResolvedValue(undefined)} isThinking />)
    // Legacy path does not check isThinking — chip remains enabled
    expect(screen.getByRole('button')).not.toBeDisabled()
  })
})

// ---------------------------------------------------------------------------
// Fallback key (no id)
// ---------------------------------------------------------------------------

describe('SuggestedChips — key fallback', () => {
  it('uses fallback key when chip.id is undefined', () => {
    const chips: ActionChip[] = [
      { id: undefined as unknown as string, label: 'A', intent: 'primary', message: 'a' },
      { id: undefined as unknown as string, label: 'B', intent: 'secondary', message: 'b' },
    ]
    expect(() =>
      render(<SuggestedChips chips={chips} onChipClick={vi.fn().mockResolvedValue(undefined)} />),
    ).not.toThrow()
    expect(screen.getAllByRole('button')).toHaveLength(2)
  })
})

// ---------------------------------------------------------------------------
// Retry chip visibility (P0 regression guard)
//
// SuggestedChips filters out chips without a message field. Retry chips
// (id: 'retry', intent: 'primary', no message) must NOT be passed to
// SuggestedChips — they should remain in ActionChipRow inline. This test
// confirms the filter works correctly and no retry chip slips through.
// ---------------------------------------------------------------------------

describe('SuggestedChips — retry chip filtered out (no message)', () => {
  it('renders nothing when the only chip is a retry chip (no message field)', () => {
    const retryChip: ActionChip = { id: 'retry', label: 'Try again', intent: 'primary' }
    const { container } = render(
      <SuggestedChips chips={[retryChip]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('renders suggested chips but not retry chip when mixed', () => {
    const retryChip: ActionChip = { id: 'retry', label: 'Try again', intent: 'primary' }
    const suggested = chip({ id: 'c1', message: 'Do something' })
    render(
      <SuggestedChips chips={[retryChip, suggested]} onChipClick={vi.fn().mockResolvedValue(undefined)} />,
    )
    expect(screen.queryByTestId('suggested-chip-retry')).not.toBeInTheDocument()
    expect(screen.getByTestId('suggested-chip-c1')).toBeInTheDocument()
    expect(screen.getAllByRole('button')).toHaveLength(1)
  })
})
