/**
 * M3 + S7-PERSIST + S7-HINTS: Guided Clarifier Panel
 * MCQ-first question answering (≤3 rounds)
 * S7-PERSIST: Persists answers across rounds, pre-populates from history
 * S7-HINTS: Shows impact hints explaining why questions matter
 */

import { useState } from 'react'
import { HelpCircle, CheckCircle2, ArrowRight, History, Info } from 'lucide-react'
import type { DraftResponse } from '../../adapters/assistants/types'

export interface Answer {
  question_id: string
  answer: string | string[]
}

export interface AnswerHistory {
  round: number
  answers: Answer[]
}

interface ClarifierPanelProps {
  clarifier: NonNullable<DraftResponse['clarifier']>
  onSubmit: (answers: Array<{ question_id: string; answer: string | string[] }>) => void
  onSkip: () => void
  isSubmitting: boolean
  // S7-PERSIST: Previous answers from earlier rounds
  previousAnswers?: AnswerHistory[]
}

export function ClarifierPanel({ clarifier, onSubmit, onSkip, isSubmitting, previousAnswers = [] }: ClarifierPanelProps) {
  // S7-PERSIST: Helper to find most recent previous answer for a question
  // Searches backwards through history to get the latest answer
  const getPreviousAnswer = (questionId: string): string | string[] | undefined => {
    for (let i = previousAnswers.length - 1; i >= 0; i--) {
      const found = previousAnswers[i].answers.find(a => a.question_id === questionId)
      if (found) return found.answer
    }
    return undefined
  }

  // AUDIT FIX 4 + S7-PERSIST: Pre-seed with empty arrays AND previous answers
  const [answers, setAnswers] = useState<Map<string, string | string[]>>(() => {
    const initialAnswers = new Map<string, string | string[]>()

    clarifier.questions.forEach((q) => {
      // S7-PERSIST: Try to load from previous answers first
      const prevAnswer = getPreviousAnswer(q.id)
      if (prevAnswer !== undefined) {
        initialAnswers.set(q.id, prevAnswer)
      } else if (q.type === 'mcq' && q.multiple) {
        // AUDIT FIX 4: Pre-seed multi-select questions with empty arrays
        initialAnswers.set(q.id, [])
      }
    })

    return initialAnswers
  })

  const handleMcqChange = (questionId: string, option: string, multiple: boolean) => {
    if (multiple) {
      const current = (answers.get(questionId) as string[]) || []
      const updated = current.includes(option)
        ? current.filter((o) => o !== option)
        : [...current, option]
      setAnswers(new Map(answers.set(questionId, updated)))
    } else {
      setAnswers(new Map(answers.set(questionId, option)))
    }
  }

  const handleTextChange = (questionId: string, value: string) => {
    setAnswers(new Map(answers.set(questionId, value)))
  }

  const handleSubmit = () => {
    const answerArray: Answer[] = Array.from(answers.entries()).map(([question_id, answer]) => ({
      question_id,
      answer,
    }))
    onSubmit(answerArray)
  }

  const requiredQuestions = clarifier.questions.filter((q) => q.required)
  const allRequiredAnswered = requiredQuestions.every((q) => {
    const answer = answers.get(q.id)
    if (q.type === 'mcq') {
      return Array.isArray(answer) ? answer.length > 0 : !!answer
    }
    return typeof answer === 'string' && answer.trim().length > 0
  })

  const canProceed = allRequiredAnswered || clarifier.round >= 3 // M3: ≤3 rounds, allow skip after

  return (
    <div className="bg-white rounded-lg border border-blue-200 shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 bg-blue-50 border-b border-blue-200">
        <div className="flex items-center gap-2">
          <HelpCircle className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-blue-900">Help us clarify your model</h3>
        </div>
        <p className="text-sm text-blue-700 mt-1" role="status" aria-live="polite">
          Round {clarifier.round} of 3 • Answer these questions to improve your draft
        </p>
      </div>

      {/* Questions */}
      <div className="p-4 space-y-4">
        {clarifier.questions.map((question, idx) => {
          // S7-PERSIST: Check if this question was answered in a previous round
          const wasPreviouslyAnswered = getPreviousAnswer(question.id) !== undefined

          return (
            <div key={question.id} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="block font-medium text-gray-900 text-sm">
                  {idx + 1}. {question.text}
                  {question.required && <span className="text-red-500 ml-1">*</span>}
                </label>
                {/* S7-PERSIST: Show indicator if question was previously answered */}
                {wasPreviouslyAnswered && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700 border border-blue-200">
                    <History className="w-3 h-3" />
                    Pre-filled
                  </span>
                )}
              </div>

              {/* S7-HINTS: Show impact hint if provided */}
              {question.impact_hint && (
                <div
                  className="flex items-start gap-1.5 px-3 py-2 bg-blue-50 rounded-md border border-blue-100"
                  role="note"
                  aria-label="Impact hint"
                >
                  <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-800 leading-relaxed">
                    {question.impact_hint}
                  </p>
                </div>
              )}

            {question.type === 'mcq' && question.options ? (
              <div className="space-y-2">
                {question.options.map((option) => {
                  const currentAnswer = answers.get(question.id)
                  // AUDIT FIX 4: Check question.multiple flag instead of answer state
                  const isMultiple = question.multiple === true
                  const isChecked = isMultiple
                    ? (currentAnswer as string[] || []).includes(option)
                    : currentAnswer === option

                  return (
                    <label
                      key={option}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type={isMultiple ? 'checkbox' : 'radio'}
                        name={question.id}
                        checked={isChecked}
                        onChange={() => handleMcqChange(question.id, option, isMultiple)}
                        className="w-4 h-4 text-blue-600 focus:ring-2 focus:ring-blue-500"
                        disabled={isSubmitting}
                      />
                      <span className="text-sm text-gray-700">{option}</span>
                    </label>
                  )
                })}
              </div>
            ) : (
              <textarea
                value={(answers.get(question.id) as string) || ''}
                onChange={(e) => handleTextChange(question.id, e.target.value)}
                placeholder="Type your answer here..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={isSubmitting}
                required={question.required}
              />
            )}
            </div>
          )
        })}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!canProceed || isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
          aria-live="polite"
        >
          {isSubmitting ? (
            'Re-drafting...'
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Submit Answers
            </>
          )}
        </button>
        <button
          onClick={onSkip}
          disabled={isSubmitting}
          className="px-4 py-2 border border-gray-300 rounded-md hover:bg-gray-50 font-medium flex items-center gap-2"
        >
          <ArrowRight className="w-4 h-4" />
          Skip & Continue
        </button>
      </div>

      {/* Progress indicator */}
      <div className="px-4 py-2 bg-gray-100 border-t border-gray-200">
        <div className="flex gap-1">
          {[1, 2, 3].map((round) => (
            <div
              key={round}
              className={`flex-1 h-1 rounded ${
                round <= clarifier.round ? 'bg-blue-600' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
