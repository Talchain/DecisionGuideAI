/**
 * M3: Clarifier Panel Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClarifierPanel } from '../ClarifierPanel'

describe('ClarifierPanel (M3)', () => {
  const mockClarifier = {
    questions: [
      {
        id: 'q1',
        text: 'What is your target market?',
        type: 'mcq' as const,
        options: ['B2B', 'B2C', 'Both'],
        required: true,
      },
      {
        id: 'q2',
        text: 'Any additional constraints?',
        type: 'text' as const,
        required: false,
      },
    ],
    round: 1,
  }

  it('renders all questions', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    expect(screen.getByText(/what is your target market/i)).toBeInTheDocument()
    expect(screen.getByText(/any additional constraints/i)).toBeInTheDocument()
  })

  it('shows round progress', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={{ ...mockClarifier, round: 2 }}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    expect(screen.getByText(/round 2 of 3/i)).toBeInTheDocument()
  })

  it('renders MCQ options as radio buttons', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    expect(screen.getByLabelText('B2B')).toBeInTheDocument()
    expect(screen.getByLabelText('B2C')).toBeInTheDocument()
    expect(screen.getByLabelText('Both')).toBeInTheDocument()
  })

  it('renders text input for text questions', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    expect(screen.getByPlaceholderText(/type your answer here/i)).toBeInTheDocument()
  })

  it('disables submit until required questions are answered', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    const submitButton = screen.getByRole('button', { name: /submit answers/i })
    expect(submitButton).toBeDisabled()
  })

  it('enables submit when required questions are answered', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    // Answer required MCQ
    const b2bOption = screen.getByLabelText('B2B')
    fireEvent.click(b2bOption)

    const submitButton = screen.getByRole('button', { name: /submit answers/i })
    expect(submitButton).not.toBeDisabled()
  })

  it('calls onSubmit with answers', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    // Answer MCQ
    const b2bOption = screen.getByLabelText('B2B')
    fireEvent.click(b2bOption)

    // Answer text
    const textInput = screen.getByPlaceholderText(/type your answer here/i)
    fireEvent.change(textInput, { target: { value: 'Budget limit' } })

    const submitButton = screen.getByRole('button', { name: /submit answers/i })
    fireEvent.click(submitButton)

    expect(onSubmit).toHaveBeenCalledWith([
      { question_id: 'q1', answer: 'B2B' },
      { question_id: 'q2', answer: 'Budget limit' },
    ])
  })

  it('calls onSkip when skip button is clicked', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    const skipButton = screen.getByRole('button', { name: /skip & continue/i })
    fireEvent.click(skipButton)

    expect(onSkip).toHaveBeenCalled()
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables form when isSubmitting is true', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={true}
      />
    )

    const b2bOption = screen.getByLabelText('B2B')
    expect(b2bOption).toBeDisabled()

    const textInput = screen.getByPlaceholderText(/type your answer here/i)
    expect(textInput).toBeDisabled()

    expect(screen.getByRole('button', { name: /re-drafting/i })).toBeDisabled()
  })

  it('shows progress indicator with correct filled bars', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    const { container } = render(
      <ClarifierPanel
        clarifier={{ ...mockClarifier, round: 2 }}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    // Find progress bars (should be 2 filled, 1 empty)
    const progressBars = container.querySelectorAll('.bg-blue-600')
    expect(progressBars.length).toBeGreaterThanOrEqual(2)
  })

  it('marks required fields with asterisk', () => {
    const onSubmit = vi.fn()
    const onSkip = vi.fn()

    render(
      <ClarifierPanel
        clarifier={mockClarifier}
        onSubmit={onSubmit}
        onSkip={onSkip}
        isSubmitting={false}
      />
    )

    const requiredMarkers = screen.getAllByText('*')
    expect(requiredMarkers.length).toBeGreaterThan(0)
  })
})
