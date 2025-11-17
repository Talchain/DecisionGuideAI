/**
 * S7-PERSIST: ClarifierPanel Answer Persistence Tests
 *
 * Tests that answers persist across clarification rounds:
 * - Pre-populate answers from previous rounds
 * - Visual indicators for pre-filled questions
 * - Maintain answer history
 * - Handle new questions in later rounds
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ClarifierPanel, type AnswerHistory } from '../ClarifierPanel'
import type { DraftResponse } from '../../../adapters/assistants/types'

describe('S7-PERSIST: ClarifierPanel Answer Persistence', () => {
  const mockOnSubmit = vi.fn()
  const mockOnSkip = vi.fn()

  const mockClarifierRound1: NonNullable<DraftResponse['clarifier']> = {
    round: 1,
    questions: [
      {
        id: 'q1',
        text: 'What is your goal?',
        type: 'text',
        required: true
      },
      {
        id: 'q2',
        text: 'Select your preferred options',
        type: 'mcq',
        options: ['Option A', 'Option B', 'Option C'],
        multiple: true,
        required: false
      }
    ]
  }

  const mockClarifierRound2: NonNullable<DraftResponse['clarifier']> = {
    round: 2,
    questions: [
      // Same question from round 1 - should be pre-filled
      {
        id: 'q1',
        text: 'What is your goal?',
        type: 'text',
        required: true
      },
      // New question in round 2
      {
        id: 'q3',
        text: 'What is your timeline?',
        type: 'mcq',
        options: ['Short-term', 'Medium-term', 'Long-term'],
        required: false
      }
    ]
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Pre-population from Previous Answers', () => {
    it('should pre-fill text answer from previous round', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q1', answer: 'Maximize revenue' }
          ]
        }
      ]

      render(
        <ClarifierPanel
          clarifier={mockClarifierRound2}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      const textarea = screen.getByPlaceholderText('Type your answer here...') as HTMLTextAreaElement
      expect(textarea.value).toBe('Maximize revenue')
    })

    it('should pre-fill MCQ single-select answer from previous round', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 2,
        questions: [
          {
            id: 'q3',
            text: 'What is your timeline?',
            type: 'mcq',
            options: ['Short-term', 'Medium-term', 'Long-term'],
            required: false
          }
        ]
      }

      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q3', answer: 'Medium-term' }
          ]
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

      const mediumTermRadio = screen.getByLabelText('Medium-term') as HTMLInputElement
      expect(mediumTermRadio.checked).toBe(true)
    })

    it('should pre-fill MCQ multi-select answers from previous round', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q2', answer: ['Option A', 'Option C'] }
          ]
        }
      ]

      render(
        <ClarifierPanel
          clarifier={mockClarifierRound1}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      const optionA = screen.getByLabelText('Option A') as HTMLInputElement
      const optionB = screen.getByLabelText('Option B') as HTMLInputElement
      const optionC = screen.getByLabelText('Option C') as HTMLInputElement

      expect(optionA.checked).toBe(true)
      expect(optionB.checked).toBe(false)
      expect(optionC.checked).toBe(true)
    })

    it('should handle multiple rounds of previous answers', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 3,
        questions: [
          { id: 'q1', text: 'Question 1', type: 'text', required: true },
          { id: 'q2', text: 'Question 2', type: 'text', required: false },
          { id: 'q4', text: 'Question 4', type: 'text', required: false }
        ]
      }

      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q1', answer: 'Answer from round 1' }
          ]
        },
        {
          round: 2,
          answers: [
            { question_id: 'q1', answer: 'Updated answer from round 2' },
            { question_id: 'q2', answer: 'New answer in round 2' }
          ]
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

      const textareas = screen.getAllByPlaceholderText('Type your answer here...')

      // Should use most recent answer (from round 2)
      expect((textareas[0] as HTMLTextAreaElement).value).toBe('Updated answer from round 2')
      expect((textareas[1] as HTMLTextAreaElement).value).toBe('New answer in round 2')
      // q4 is new, should be empty
      expect((textareas[2] as HTMLTextAreaElement).value).toBe('')
    })
  })

  describe('Visual Indicators', () => {
    it('should show "Pre-filled" badge for previously answered questions', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q1', answer: 'Previous answer' }
          ]
        }
      ]

      render(
        <ClarifierPanel
          clarifier={mockClarifierRound2}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      expect(screen.getByText('Pre-filled')).toBeInTheDocument()
    })

    it('should not show "Pre-filled" badge for new questions', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q1', answer: 'Previous answer' }
          ]
        }
      ]

      render(
        <ClarifierPanel
          clarifier={mockClarifierRound2}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      // q1 should have badge, q3 should not
      const badges = screen.queryAllByText('Pre-filled')
      expect(badges).toHaveLength(1)
    })

    it('should show history icon in "Pre-filled" badge', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q1', answer: 'Previous answer' }
          ]
        }
      ]

      const { container } = render(
        <ClarifierPanel
          clarifier={mockClarifierRound2}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      // Check for History icon (lucide-react renders SVG with specific class)
      const historyIcon = container.querySelector('svg.lucide-history')
      expect(historyIcon).toBeInTheDocument()
    })
  })

  describe('User Interaction with Pre-filled Answers', () => {
    it('should allow editing pre-filled text answer', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q1', answer: 'Original answer' }
          ]
        }
      ]

      render(
        <ClarifierPanel
          clarifier={mockClarifierRound2}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      const textarea = screen.getByPlaceholderText('Type your answer here...')
      fireEvent.change(textarea, { target: { value: 'Updated answer' } })

      expect((textarea as HTMLTextAreaElement).value).toBe('Updated answer')
    })

    it('should allow changing pre-filled MCQ answer', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 2,
        questions: [
          {
            id: 'q3',
            text: 'What is your timeline?',
            type: 'mcq',
            options: ['Short-term', 'Medium-term', 'Long-term'],
            required: false
          }
        ]
      }

      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q3', answer: 'Medium-term' }
          ]
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

      // Change from Medium-term to Long-term
      const longTermRadio = screen.getByLabelText('Long-term')
      fireEvent.click(longTermRadio)

      expect((longTermRadio as HTMLInputElement).checked).toBe(true)
      expect((screen.getByLabelText('Medium-term') as HTMLInputElement).checked).toBe(false)
    })

    it('should submit updated answers', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q1', answer: 'Old answer' }
          ]
        }
      ]

      render(
        <ClarifierPanel
          clarifier={mockClarifierRound2}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      const textarea = screen.getByPlaceholderText('Type your answer here...')
      fireEvent.change(textarea, { target: { value: 'New answer' } })

      const submitButton = screen.getByText('Submit Answers')
      fireEvent.click(submitButton)

      expect(mockOnSubmit).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({
            question_id: 'q1',
            answer: 'New answer'
          })
        ])
      )
    })
  })

  describe('Empty Previous Answers', () => {
    it('should work normally when previousAnswers is empty array', () => {
      render(
        <ClarifierPanel
          clarifier={mockClarifierRound1}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={[]}
        />
      )

      const textarea = screen.getByPlaceholderText('Type your answer here...') as HTMLTextAreaElement
      expect(textarea.value).toBe('')
      expect(screen.queryByText('Pre-filled')).not.toBeInTheDocument()
    })

    it('should work normally when previousAnswers is undefined', () => {
      render(
        <ClarifierPanel
          clarifier={mockClarifierRound1}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
        />
      )

      const textarea = screen.getByPlaceholderText('Type your answer here...') as HTMLTextAreaElement
      expect(textarea.value).toBe('')
      expect(screen.queryByText('Pre-filled')).not.toBeInTheDocument()
    })
  })

  describe('Edge Cases', () => {
    it('should handle question with no matching previous answer', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            { question_id: 'q_different', answer: 'Some answer' }
          ]
        }
      ]

      render(
        <ClarifierPanel
          clarifier={mockClarifierRound1}
          onSubmit={mockOnSubmit}
          onSkip=          {mockOnSkip}
          isSubmitting={false}
          previousAnswers={previousAnswers}
        />
      )

      const textarea = screen.getByPlaceholderText('Type your answer here...') as HTMLTextAreaElement
      expect(textarea.value).toBe('')
    })

    it('should handle multi-select question with previous single-select answer gracefully', () => {
      const previousAnswers: AnswerHistory[] = [
        {
          round: 1,
          answers: [
            // Incorrectly stored as string instead of array
            { question_id: 'q2', answer: 'Option A' }
          ]
        }
      ]

      // Should not crash, might treat as invalid
      expect(() => {
        render(
          <ClarifierPanel
            clarifier={mockClarifierRound1}
            onSubmit={mockOnSubmit}
            onSkip={mockOnSkip}
            isSubmitting={false}
            previousAnswers={previousAnswers}
          />
        )
      }).not.toThrow()
    })

    it('should preserve empty array for multi-select with no previous answer', () => {
      render(
        <ClarifierPanel
          clarifier={mockClarifierRound1}
          onSubmit={mockOnSubmit}
          onSkip={mockOnSkip}
          isSubmitting={false}
          previousAnswers={[]}
        />
      )

      const checkboxes = screen.getAllByRole('checkbox')
      checkboxes.forEach(checkbox => {
        expect((checkbox as HTMLInputElement).checked).toBe(false)
      })
    })
  })

  describe('Answer History Structure', () => {
    it('should accept answer history with multiple rounds', () => {
      const previousAnswers: AnswerHistory[] = [
        { round: 1, answers: [{ question_id: 'q1', answer: 'Round 1' }] },
        { round: 2, answers: [{ question_id: 'q1', answer: 'Round 2' }] },
        { round: 3, answers: [{ question_id: 'q1', answer: 'Round 3' }] }
      ]

      expect(() => {
        render(
          <ClarifierPanel
            clarifier={mockClarifierRound2}
            onSubmit={mockOnSubmit}
            onSkip={mockOnSkip}
            isSubmitting={false}
            previousAnswers={previousAnswers}
          />
        )
      }).not.toThrow()
    })

    it('should use most recent answer when question appears in multiple rounds', () => {
      const mockClarifier: NonNullable<DraftResponse['clarifier']> = {
        round: 3,
        questions: [
          { id: 'q1', text: 'Question 1', type: 'text', required: true }
        ]
      }

      const previousAnswers: AnswerHistory[] = [
        { round: 1, answers: [{ question_id: 'q1', answer: 'First answer' }] },
        { round: 2, answers: [{ question_id: 'q1', answer: 'Second answer' }] }
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

      const textarea = screen.getByPlaceholderText('Type your answer here...') as HTMLTextAreaElement
      // Should use the most recent answer (from round 2, which is at index 1)
      expect(textarea.value).toBe('Second answer')
    })
  })
})
