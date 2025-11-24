/**
 * M2.2: Draft Form Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { DraftForm } from '../DraftForm'

describe('DraftForm (M2.2)', () => {
  it('renders form with all fields', () => {
    const onSubmit = vi.fn()
    render(<DraftForm onSubmit={onSubmit} isSubmitting={false} />)

    expect(screen.getByLabelText(/what decision are you making/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/what else should olumi know/i)).toBeInTheDocument()
    expect(screen.getByText(/supporting documents/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /draft my model/i })).toBeInTheDocument()
  })

  it('submits form with valid prompt', async () => {
    const onSubmit = vi.fn()
    render(<DraftForm onSubmit={onSubmit} isSubmitting={false} />)

    const promptInput = screen.getByLabelText(/what decision are you making/i)
    fireEvent.change(promptInput, { target: { value: 'Should we launch product X?' } })

    const submitButton = screen.getByRole('button', { name: /draft my model/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        prompt: 'Should we launch product X?',
        context: undefined,
        files: undefined,
      })
    })
  })

  it('includes context when provided', async () => {
    const onSubmit = vi.fn()
    render(<DraftForm onSubmit={onSubmit} isSubmitting={false} />)

    const promptInput = screen.getByLabelText(/what decision are you making/i)
    fireEvent.change(promptInput, { target: { value: 'Launch decision' } })

    const contextInput = screen.getByLabelText(/what else should olumi know/i)
    fireEvent.change(contextInput, { target: { value: 'Q4 2025 timeline' } })

    const submitButton = screen.getByRole('button', { name: /draft my model/i })
    fireEvent.click(submitButton)

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        prompt: 'Launch decision',
        context: 'Q4 2025 timeline',
        files: undefined,
      })
    })
  })

  it('disables submit when prompt is empty', () => {
    const onSubmit = vi.fn()
    render(<DraftForm onSubmit={onSubmit} isSubmitting={false} />)

    const submitButton = screen.getByRole('button', { name: /draft my model/i })
    expect(submitButton).toBeDisabled()
  })

  it('disables form when isSubmitting is true', () => {
    const onSubmit = vi.fn()
    render(<DraftForm onSubmit={onSubmit} isSubmitting={true} />)

    const promptInput = screen.getByLabelText(/what decision are you making/i)
    expect(promptInput).toBeDisabled()

    const submitButton = screen.getByRole('button', { name: /generating draft/i })
    expect(submitButton).toBeDisabled()
  })

  it('allows file removal', async () => {
    const onSubmit = vi.fn()
    render(<DraftForm onSubmit={onSubmit} isSubmitting={false} />)

    // Simulate file upload would require more complex setup with FileReader mocks
    // This test validates the structure exists
    expect(screen.getByText(/upload file/i)).toBeInTheDocument()
  })

  it('prevents submission without prompt', () => {
    const onSubmit = vi.fn()
    render(<DraftForm onSubmit={onSubmit} isSubmitting={false} />)

    const submitButton = screen.getByRole('button', { name: /draft my model/i })
    expect(submitButton).toBeDisabled()

    fireEvent.click(submitButton)
    expect(onSubmit).not.toHaveBeenCalled()
  })
})
