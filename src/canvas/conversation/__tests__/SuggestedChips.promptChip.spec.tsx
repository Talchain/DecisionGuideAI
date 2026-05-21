/**
 * SuggestedChips — prompt-chip contract under V5.
 *
 * Pins the live behaviour at SuggestedChips.tsx:171
 *   `if (!c.action_type) return true`
 * and the subsequent click path: chips without `action_type` must render
 * AND dispatch their full `message` via onChipClick.
 *
 * The readiness-gate spec already covers the *rendering* pass-through
 * (`shows chips with no action_type regardless of readiness`). This file
 * pins the *dispatch* half: under V5, clicking a prompt chip surfaces the
 * full chip object (with the `message` intact) to the handler, so the
 * upstream `dispatchAction` keyword-fallback path can route it as a
 * normal conversation turn.
 *
 * If this test ever fails, prompt chips have regressed and the V5
 * filter / click handler needs investigating — do NOT patch the test;
 * fix the production code.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

import { SuggestedChips } from '../zones/SuggestedChips'
import type { ActionChip } from '../types'

describe('SuggestedChips — prompt chip (no action_type) dispatches under V5', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', 'true')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders the prompt chip and dispatches the full chip (message intact) on click', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    const promptChip: ActionChip = {
      id: 'chip-prompt',
      label: 'Tell me more',
      intent: 'primary',
      message: 'Tell me more about this result',
      // no action_type
    }

    render(<SuggestedChips chips={[promptChip]} onChipClick={onChipClick} />)

    const button = screen.getByTestId('suggested-chip-chip-prompt')
    expect(button).toBeInTheDocument()

    fireEvent.click(button)

    expect(onChipClick).toHaveBeenCalledTimes(1)
    const received = onChipClick.mock.calls[0][0] as ActionChip
    expect(received).toEqual(promptChip)
    expect(received.message).toBe('Tell me more about this result')
    expect(received.action_type).toBeUndefined()
  })
})

describe('SuggestedChips — prompt chip (no action_type) also dispatches under V4', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_ENABLE_V5_ORCHESTRATOR', '')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('renders and dispatches the prompt chip with V5 off (V4 passthrough)', () => {
    const onChipClick = vi.fn().mockResolvedValue(undefined)
    const promptChip: ActionChip = {
      id: 'chip-prompt-v4',
      label: 'Why did it pick that?',
      intent: 'primary',
      message: 'Why did the analysis pick that option?',
    }

    render(<SuggestedChips chips={[promptChip]} onChipClick={onChipClick} />)

    fireEvent.click(screen.getByTestId('suggested-chip-chip-prompt-v4'))

    expect(onChipClick).toHaveBeenCalledTimes(1)
    expect(onChipClick.mock.calls[0][0]).toEqual(promptChip)
    expect((onChipClick.mock.calls[0][0] as ActionChip).message).toBe(
      'Why did the analysis pick that option?',
    )
  })
})
