/**
 * S7-HINTS: ClarifierPanel Impact Hints Tests
 *
 * Tests that impact hints are displayed correctly:
 * - Show hints when provided
 * - Accessibility attributes
 * - Integration with other features
 * - Visual indicators (Info icon)
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ClarifierPanel } from '../ClarifierPanel'
import type { DraftResponse } from '../../../adapters/assistants/types'

describe('S7-HINTS: ClarifierPanel Impact Hints', () => {
  const mockOnSubmit = vi.fn()
  const mockOnSkip = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Display Impact Hints', () => {
    it('should show impact hint when provided', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'What is your goal?',
            type: 'text',
            required: true,
            impact_hint: 'This helps us prioritize outcomes and identify key success metrics.'
          }
        ]
      }

      render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      expect(screen.getByText('This helps us prioritize outcomes and identify key success metrics.')).toBeInTheDocument()
    })

    it('should not show hint when impact_hint is not provided', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'What is your goal?',
            type: 'text',
            required: true
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      // No hint container should be present
      const hintContainer = container.querySelector('[role="note"]')
      expect(hintContainer).not.toBeInTheDocument()
    })

    it('should not show hint when impact_hint is empty string', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'What is your goal?',
            type: 'text',
            required: true,
            impact_hint: ''
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      const hintContainer = container.querySelector('[role="note"]')
      expect(hintContainer).not.toBeInTheDocument()
    })

    it('should show Info icon with impact hint', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'What is your goal?',
            type: 'text',
            required: true,
            impact_hint: 'This helps us understand your priorities.'
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      // Check for Info icon (lucide-react renders SVG with specific class)
      const infoIcon = container.querySelector('svg.lucide-info')
      expect(infoIcon).toBeInTheDocument()
    })
  })

  describe('Multiple Questions with Hints', () => {
    it('should show hints for some questions and not others', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            type: 'text',
            required: true,
            impact_hint: 'Hint for question 1'
          },
          {
            id: 'q2',
            text: 'Question 2',
            type: 'text',
            required: false
            // No impact_hint
          },
          {
            id: 'q3',
            text: 'Question 3',
            type: 'mcq',
            options: ['A', 'B', 'C'],
            required: false,
            impact_hint: 'Hint for question 3'
          }
        ]
      }

      render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      expect(screen.getByText('Hint for question 1')).toBeInTheDocument()
      expect(screen.queryByText('Hint for question 2')).not.toBeInTheDocument()
      expect(screen.getByText('Hint for question 3')).toBeInTheDocument()
    })

    it('should show all hints when all questions have them', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            type: 'text',
            required: true,
            impact_hint: 'First hint'
          },
          {
            id: 'q2',
            text: 'Question 2',
            type: 'text',
            required: false,
            impact_hint: 'Second hint'
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      expect(screen.getByText('First hint')).toBeInTheDocument()
      expect(screen.getByText('Second hint')).toBeInTheDocument()

      // Should have 2 hint containers
      const hintContainers = container.querySelectorAll('[role="note"]')
      expect(hintContainers).toHaveLength(2)
    })

    it('should not show any hints when no questions have them', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            type: 'text',
            required: true
          },
          {
            id: 'q2',
            text: 'Question 2',
            type: 'mcq',
            options: ['A', 'B'],
            required: false
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      const hintContainers = container.querySelectorAll('[role="note"]')
      expect(hintContainers).toHaveLength(0)
    })
  })

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            type: 'text',
            required: true,
            impact_hint: 'This is an important hint'
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      const hintContainer = container.querySelector('[role="note"]')
      expect(hintContainer).toHaveAttribute('aria-label', 'Impact hint')
    })

    it('should use role="note" for semantic meaning', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            type: 'text',
            required: true,
            impact_hint: 'Helpful context'
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      const hintContainer = container.querySelector('[role="note"]')
      expect(hintContainer).toBeInTheDocument()
      expect(hintContainer?.getAttribute('role')).toBe('note')
    })
  })

  describe('Integration with Other Features', () => {
    it('should work with pre-filled answers', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 2,
        questions: [
          {
            id: 'q1',
            text: 'Question 1',
            type: 'text',
            required: true,
            impact_hint: 'This question affects the model structure'
          }
        ]
      }

      const previousAnswers = [
        {
          round: 1,
          answers: [{ question_id: 'q1', answer: 'Previous answer' }]
        }
      ]

      render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      // Both pre-filled badge and hint should be visible
      expect(screen.getByText('Pre-filled')).toBeInTheDocument()
      expect(screen.getByText('This question affects the model structure')).toBeInTheDocument()
    })

    it('should work with required questions', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Required Question',
            type: 'text',
            required: true,
            impact_hint: 'This is critical for the model'
          }
        ]
      }

      render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      // Should show both required indicator (*) and hint
      expect(screen.getByText(/Required Question/)).toBeInTheDocument()
      expect(screen.getByText('*')).toBeInTheDocument()
      expect(screen.getByText('This is critical for the model')).toBeInTheDocument()
    })

    it('should work with MCQ questions', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Choose an option',
            type: 'mcq',
            options: ['Option A', 'Option B', 'Option C'],
            required: false,
            impact_hint: 'Your selection determines risk assessment priorities'
          }
        ]
      }

      render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      expect(screen.getByText('Your selection determines risk assessment priorities')).toBeInTheDocument()
      expect(screen.getByLabelText('Option A')).toBeInTheDocument()
    })

    it('should work with multi-select MCQ questions', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Select all that apply',
            type: 'mcq',
            options: ['A', 'B', 'C'],
            multiple: true,
            required: false,
            impact_hint: 'Multiple selections help us build a comprehensive view'
          }
        ]
      }

      render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      expect(screen.getByText('Multiple selections help us build a comprehensive view')).toBeInTheDocument()

      // Should render as checkboxes (multiple selections)
      const checkboxes = screen.getAllByRole('checkbox')
      expect(checkboxes.length).toBeGreaterThan(0)
    })

    it('should work with text questions', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Describe your scenario',
            type: 'text',
            required: true,
            impact_hint: 'Your description helps us identify relevant factors and constraints'
          }
        ]
      }

      render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      expect(screen.getByText('Your description helps us identify relevant factors and constraints')).toBeInTheDocument()
      expect(screen.getByPlaceholderText('Type your answer here...')).toBeInTheDocument()
    })
  })

  describe('Visual Styling', () => {
    it('should have distinct styling from question text', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Question text',
            type: 'text',
            required: true,
            impact_hint: 'Hint text'
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      const hintContainer = container.querySelector('[role="note"]')

      // Should have blue background
      expect(hintContainer).toHaveClass('bg-blue-50')

      // Should have border
      expect(hintContainer).toHaveClass('border-blue-100')

      // Should have padding
      expect(hintContainer).toHaveClass('px-3')
      expect(hintContainer).toHaveClass('py-2')
    })

    it('should use smaller text size for hints', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Question',
            type: 'text',
            required: true,
            impact_hint: 'Hint'
          }
        ]
      }

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      const hintText = container.querySelector('[role="note"] p')
      expect(hintText).toHaveClass('text-xs')
    })
  })

  describe('Long Hint Text', () => {
    it('should handle long multi-line hints gracefully', () => {
      const longHint = 'This is a very long impact hint that explains in great detail why this question is important and how it will affect the resulting model structure, including considerations for risk factors, timeline constraints, and stakeholder priorities.'

      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 1,
        questions: [
          {
            id: 'q1',
            text: 'Question',
            type: 'text',
            required: true,
            impact_hint: longHint
          }
        ]
      }

      render(
        <ClarifierPanel
          clarifier={mockClarifier}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      expect(screen.getByText(longHint)).toBeInTheDocument()
    })
  })
})
