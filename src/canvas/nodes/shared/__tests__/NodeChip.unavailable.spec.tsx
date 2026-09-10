import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { NodeChip } from '../NodeChip'
import { useGuidanceStore } from '../../../stores/guidanceStore'

const chip = <NodeChip chipId="option_counter_case" actionType={null}
  label="What could be missing?" message="What assumptions might we have missed?" />

beforeEach(() => {
  useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null })
})
afterEach(() => {
  cleanup()
  useGuidanceStore.setState({ _dispatchAction: null, _sendMessage: null })
})

describe('coaching when Olumi is unavailable', () => {
  it('explains the unsent question visibly, including without a toast provider', () => {
    render(chip)
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    fireEvent.click(screen.getByRole('button', { name: 'What could be missing?' }))
    expect(screen.getByRole('status').textContent).toBe(
      'Olumi is unavailable here. Your question has not been sent.',
    )
    expect(screen.getByRole('button', { name: 'What could be missing?' })).toBeEnabled()
  })

  it('recovers when the conversation registers and sends the unchanged intent once', () => {
    render(chip)
    const button = screen.getByRole('button', { name: 'What could be missing?' })
    fireEvent.click(button)
    expect(screen.getByRole('status')).not.toBeEmptyDOMElement()
    const dispatch = vi.fn()
    act(() => useGuidanceStore.setState({ _dispatchAction: dispatch }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    // Registration must clear the failed-attempt state, not merely mask it.
    act(() => useGuidanceStore.setState({ _dispatchAction: null }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
    act(() => useGuidanceStore.setState({ _dispatchAction: dispatch }))
    fireEvent.click(button)
    expect(dispatch).toHaveBeenCalledTimes(1)
    expect(dispatch).toHaveBeenCalledWith({
      parameters: { chip_id: 'option_counter_case' },
      label: 'What could be missing?',
      message: 'What assumptions might we have missed?',
      source: 'chip',
    })
    // Losing the channel later must not revive the earlier unsent claim.
    act(() => useGuidanceStore.setState({ _dispatchAction: null }))
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })

  it('keeps the legacy send route working without an unavailable warning', () => {
    const send = vi.fn()
    useGuidanceStore.setState({ _sendMessage: send })
    render(chip)
    fireEvent.click(screen.getByRole('button', { name: 'What could be missing?' }))
    expect(send).toHaveBeenCalledOnce()
    expect(send).toHaveBeenCalledWith('What assumptions might we have missed?')
    expect(screen.getByRole('status')).toBeEmptyDOMElement()
  })
})
