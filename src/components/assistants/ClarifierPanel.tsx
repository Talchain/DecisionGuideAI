/**
 * M3: Guided Clarifier Panel
 * MCQ-first question answering (≤3 rounds)
 */

import { useState } from 'react'
import { HelpCircle, CheckCircle2, ArrowRight } from 'lucide-react'
import type { DraftResponse } from '../../adapters/assistants/types'

interface ClarifierPanelProps {
  clarifier: NonNullable<DraftResponse['clarifier']>
  onSubmit: (answers: Array<{ question_id: string; answer: string | string[] }>) => void
  onSkip: () => void
  isSubmitting: boolean
}

interface Answer {
  question_id: string
  answer: string | string[]
}

export function ClarifierPanel({ clarifier, onSubmit, onSkip, isSubmitting }: ClarifierPanelProps) {
  const [answers, setAnswers] = useState<Map<string, string | string[]>>(new Map())

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
        <p className="text-sm text-blue-700 mt-1">
          Round {clarifier.round} of 3 • Answer these questions to improve your draft
        </p>
      </div>

      {/* Questions */}
      <div className="p-4 space-y-4">
        {clarifier.questions.map((question, idx) => (
          <div key={question.id} className="space-y-2">
            <label className="block font-medium text-gray-900 text-sm">
              {idx + 1}. {question.text}
              {question.required && <span className="text-red-500 ml-1">*</span>}
            </label>

            {question.type === 'mcq' && question.options ? (
              <div className="space-y-2">
                {question.options.map((option) => {
                  const currentAnswer = answers.get(question.id)
                  const isChecked = Array.isArray(currentAnswer)
                    ? currentAnswer.includes(option)
                    : currentAnswer === option

                  return (
                    <label
                      key={option}
                      className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer"
                    >
                      <input
                        type={Array.isArray(currentAnswer) ? 'checkbox' : 'radio'}
                        name={question.id}
                        checked={isChecked}
                        onChange={() => handleMcqChange(question.id, option, Array.isArray(currentAnswer))}
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
        ))}
      </div>

      {/* Actions */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={!canProceed || isSubmitting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed font-medium"
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
