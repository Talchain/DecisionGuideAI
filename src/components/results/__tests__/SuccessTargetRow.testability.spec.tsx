/**
 * SuccessTargetRow harness-testability pins (Lane UI-W5, feature C).
 *
 * The Playwright acceptance harness could not reach the "Set target"
 * affordance because only the container carried a stable selector. These
 * pins fix the selector contract:
 *   - container:            data-testid="success-target-row"   (pre-existing)
 *   - "Set target" button:  data-testid="success-target-set-button"
 *   - target input:         data-testid="success-target-input"
 *     with aria-label "Edit success target value" (kept — harness + a11y
 *     both rely on it).
 *
 * Test-support attributes only — these pins assert PRESENCE of selectors
 * and that behaviour is unchanged (same handlers, same copy).
 */

import { describe, it, expect, vi } from 'vitest'
import '@testing-library/jest-dom/vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SuccessTargetRow } from '../SuccessTargetRow'

describe('SuccessTargetRow testability selectors', () => {
  it('container keeps data-testid="success-target-row"', () => {
    render(<SuccessTargetRow />)
    expect(screen.getByTestId('success-target-row')).toBeInTheDocument()
  })

  it('"Set target" button carries data-testid="success-target-set-button"', () => {
    render(<SuccessTargetRow />)
    const button = screen.getByTestId('success-target-set-button')
    expect(button).toBeInTheDocument()
    expect(button).toHaveTextContent('Set target')
  })

  it('target input carries data-testid="success-target-input" and keeps its aria-label', () => {
    render(<SuccessTargetRow />)
    // Enter edit mode via the harness selector — proves the click path works
    fireEvent.click(screen.getByTestId('success-target-set-button'))

    const input = screen.getByTestId('success-target-input')
    expect(input).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-label', 'Edit success target value')
  })

  it('behaviour unchanged: committing a value through the pinned selectors calls onApplyThreshold', () => {
    const onApplyThreshold = vi.fn()
    render(<SuccessTargetRow onApplyThreshold={onApplyThreshold} />)

    fireEvent.click(screen.getByTestId('success-target-set-button'))
    const input = screen.getByTestId('success-target-input')
    fireEvent.change(input, { target: { value: '250' } })
    fireEvent.keyDown(input, { key: 'Enter' })

    expect(onApplyThreshold).toHaveBeenCalledWith(250)
  })

  it('behaviour unchanged: set-target affordance still respects isRunning disable', () => {
    render(<SuccessTargetRow isRunning />)
    expect(screen.getByTestId('success-target-set-button')).toBeDisabled()
  })

  it('input testid appears when editing an EXISTING target too (edit-value path)', () => {
    render(<SuccessTargetRow goalThreshold={100} />)
    // No "Set target" button when a target exists — edit via the value button
    expect(screen.queryByTestId('success-target-set-button')).not.toBeInTheDocument()
    fireEvent.click(screen.getByLabelText('Edit success target: 100'))
    expect(screen.getByTestId('success-target-input')).toBeInTheDocument()
  })
})
